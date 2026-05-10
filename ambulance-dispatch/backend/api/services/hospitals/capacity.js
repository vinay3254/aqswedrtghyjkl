const db = require('../../config/database');
const redis = require('../../config/redis');
const { ValidationError } = require('../../utils/errors');
const logger = require('../../utils/logger');

const BED_RESERVATION_TTL = 30 * 60; // 30 minutes in seconds

class CapacityManager {
  static calculateCapacityScore(hospital, requirements = {}) {
    let score = 0;
    const weights = {
      bed_availability: 30,
      icu_availability: 25,
      trauma_availability: 20,
      specialist_match: 15,
      equipment_match: 10,
    };

    const bedUtilization = hospital.capacity.beds.total > 0
      ? hospital.capacity.beds.available / hospital.capacity.beds.total
      : 0;
    score += bedUtilization * weights.bed_availability;

    if (requirements.requires_icu && hospital.capacity.icu.total > 0) {
      const icuUtilization = hospital.capacity.icu.available / hospital.capacity.icu.total;
      score += icuUtilization * weights.icu_availability;
    } else if (!requirements.requires_icu) {
      score += weights.icu_availability;
    }

    if (requirements.requires_trauma && hospital.capacity.trauma.total > 0) {
      const traumaUtilization = hospital.capacity.trauma.available / hospital.capacity.trauma.total;
      score += traumaUtilization * weights.trauma_availability;
    } else if (!requirements.requires_trauma) {
      score += weights.trauma_availability;
    }

    if (requirements.specialist_required) {
      const hasSpecialist = hospital.services.includes(requirements.specialist_required);
      score += hasSpecialist ? weights.specialist_match : 0;
    } else {
      score += weights.specialist_match;
    }

    if (requirements.equipment_required) {
      const hasEquipment = hospital.equipment[requirements.equipment_required] === true;
      score += hasEquipment ? weights.equipment_match : 0;
    } else {
      score += weights.equipment_match;
    }

    return Math.round(score * 10) / 10;
  }

  static async reserveBed(hospitalId, bedType = 'general', reservationId = null) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      let column;
      switch (bedType) {
        case 'icu':
          column = 'available_icu_beds';
          break;
        case 'trauma':
          column = 'available_trauma_bays';
          break;
        default:
          column = 'available_beds';
      }

      const checkQuery = `SELECT ${column} FROM hospitals WHERE id = $1 FOR UPDATE`;
      const checkResult = await client.query(checkQuery, [hospitalId]);

      if (checkResult.rows.length === 0) {
        throw new ValidationError('Hospital not found');
      }

      const available = checkResult.rows[0][column];
      if (available <= 0) {
        throw new ValidationError(`No ${bedType} beds available`);
      }

      const updateQuery = `
        UPDATE hospitals
        SET ${column} = ${column} - 1, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [hospitalId]);

      await client.query('COMMIT');

      const reservation = {
        id: reservationId || `res_${Date.now()}`,
        hospital_id: hospitalId,
        bed_type: bedType,
        reserved_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + BED_RESERVATION_TTL * 1000).toISOString(),
      };

      await redis.setex(
        `reservation:${reservation.id}`,
        BED_RESERVATION_TTL,
        JSON.stringify(reservation)
      );

      logger.info('Bed reserved', { hospitalId, bedType, reservationId: reservation.id });

      return {
        reservation,
        hospital: updateResult.rows[0],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async releaseBed(reservationId) {
    const reservationData = await redis.get(`reservation:${reservationId}`);
    
    if (!reservationData) {
      logger.warn('Reservation not found or already expired', { reservationId });
      return null;
    }

    const reservation = JSON.parse(reservationData);
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      let column;
      switch (reservation.bed_type) {
        case 'icu':
          column = 'available_icu_beds';
          break;
        case 'trauma':
          column = 'available_trauma_bays';
          break;
        default:
          column = 'available_beds';
      }

      const updateQuery = `
        UPDATE hospitals
        SET ${column} = ${column} + 1, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      await client.query(updateQuery, [reservation.hospital_id]);

      await client.query('COMMIT');
      await redis.del(`reservation:${reservationId}`);

      logger.info('Bed reservation released', { reservationId, hospitalId: reservation.hospital_id });

      return reservation;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async confirmReservation(reservationId) {
    const reservationData = await redis.get(`reservation:${reservationId}`);
    
    if (!reservationData) {
      throw new ValidationError('Reservation not found or expired');
    }

    await redis.del(`reservation:${reservationId}`);
    
    const reservation = JSON.parse(reservationData);
    logger.info('Bed reservation confirmed (patient arrived)', { reservationId });

    return reservation;
  }

  static async getHospitalUtilization(hospitalId) {
    const query = `
      SELECT 
        total_beds, available_beds,
        icu_beds, available_icu_beds,
        trauma_bays, available_trauma_bays
      FROM hospitals
      WHERE id = $1
    `;

    const result = await db.query(query, [hospitalId]);
    
    if (result.rows.length === 0) {
      throw new ValidationError('Hospital not found');
    }

    const hospital = result.rows[0];

    return {
      general: {
        total: hospital.total_beds,
        available: hospital.available_beds,
        occupied: hospital.total_beds - hospital.available_beds,
        utilization: hospital.total_beds > 0 
          ? ((hospital.total_beds - hospital.available_beds) / hospital.total_beds * 100).toFixed(2)
          : 0,
      },
      icu: {
        total: hospital.icu_beds,
        available: hospital.available_icu_beds,
        occupied: hospital.icu_beds - hospital.available_icu_beds,
        utilization: hospital.icu_beds > 0
          ? ((hospital.icu_beds - hospital.available_icu_beds) / hospital.icu_beds * 100).toFixed(2)
          : 0,
      },
      trauma: {
        total: hospital.trauma_bays,
        available: hospital.available_trauma_bays,
        occupied: hospital.trauma_bays - hospital.available_trauma_bays,
        utilization: hospital.trauma_bays > 0
          ? ((hospital.trauma_bays - hospital.available_trauma_bays) / hospital.trauma_bays * 100).toFixed(2)
          : 0,
      },
    };
  }

  static async bulkUpdateCapacity(updates) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const results = [];
      for (const update of updates) {
        const query = `
          UPDATE hospitals
          SET 
            available_beds = COALESCE($2, available_beds),
            available_icu_beds = COALESCE($3, available_icu_beds),
            available_trauma_bays = COALESCE($4, available_trauma_bays),
            updated_at = NOW()
          WHERE id = $1
          RETURNING id, name, available_beds, available_icu_beds, available_trauma_bays
        `;

        const result = await client.query(query, [
          update.hospital_id,
          update.available_beds,
          update.available_icu_beds,
          update.available_trauma_bays,
        ]);

        if (result.rows.length > 0) {
          results.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');
      logger.info('Bulk capacity update completed', { count: results.length });

      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async checkBloodAvailability(hospitalId, bloodType, unitsRequired = 1) {
    const query = 'SELECT blood_inventory FROM hospitals WHERE id = $1';
    const result = await db.query(query, [hospitalId]);

    if (result.rows.length === 0) {
      throw new ValidationError('Hospital not found');
    }

    const inventory = typeof result.rows[0].blood_inventory === 'string'
      ? JSON.parse(result.rows[0].blood_inventory)
      : result.rows[0].blood_inventory;

    const available = inventory[bloodType] || 0;

    return {
      blood_type: bloodType,
      available,
      required: unitsRequired,
      sufficient: available >= unitsRequired,
    };
  }

  static getCompatibleBloodTypes(recipientType) {
    const compatibility = {
      'O-': ['O-'],
      'O+': ['O-', 'O+'],
      'A-': ['O-', 'A-'],
      'A+': ['O-', 'O+', 'A-', 'A+'],
      'B-': ['O-', 'B-'],
      'B+': ['O-', 'O+', 'B-', 'B+'],
      'AB-': ['O-', 'A-', 'B-', 'AB-'],
      'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    };

    return compatibility[recipientType] || [];
  }

  static async findHospitalsWithBlood(recipientBloodType, latitude, longitude, radiusKm = 50) {
    const compatibleTypes = this.getCompatibleBloodTypes(recipientBloodType);

    const query = `
      SELECT *,
        (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance
      FROM hospitals
      WHERE status = 'active'
      HAVING distance <= $3
      ORDER BY distance ASC
    `;

    const result = await db.query(query, [latitude, longitude, radiusKm]);

    const hospitalsWithBlood = result.rows.filter(hospital => {
      const inventory = typeof hospital.blood_inventory === 'string'
        ? JSON.parse(hospital.blood_inventory)
        : hospital.blood_inventory;

      return compatibleTypes.some(type => (inventory[type] || 0) > 0);
    });

    return hospitalsWithBlood.map(hospital => ({
      id: hospital.id,
      name: hospital.name,
      distance: parseFloat(hospital.distance).toFixed(2),
      available_blood_types: compatibleTypes.filter(type => {
        const inventory = typeof hospital.blood_inventory === 'string'
          ? JSON.parse(hospital.blood_inventory)
          : hospital.blood_inventory;
        return (inventory[type] || 0) > 0;
      }),
    }));
  }
}

module.exports = CapacityManager;
