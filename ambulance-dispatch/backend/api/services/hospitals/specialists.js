const db = require('../../config/database');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');

const INCIDENT_SPECIALIST_MAP = {
  CARDIAC: ['cardiology'],
  STROKE: ['neurology'],
  TRAUMA: ['trauma_surgery', 'orthopedics'],
  MATERNITY: ['obstetrics'],
  PEDIATRIC: ['pediatrics'],
  BURN: ['burn_unit'],
  NEURO: ['neurology', 'neurosurgery'],
  RESPIRATORY: ['pulmonology'],
  ACCIDENT: ['trauma_surgery', 'orthopedics'],
  FALL: ['orthopedics'],
};

const SPECIALIST_SERVICES = [
  'cardiology',
  'neurology',
  'trauma_surgery',
  'orthopedics',
  'obstetrics',
  'pediatrics',
  'burn_unit',
  'neurosurgery',
  'pulmonology',
  'oncology',
  'nephrology',
  'gastroenterology',
];

class SpecialistManager {
  static getRequiredSpecialists(incidentType) {
    const type = incidentType.toUpperCase();
    return INCIDENT_SPECIALIST_MAP[type] || [];
  }

  static async updateSpecialistAvailability(hospitalId, specialists) {
    const query = `
      UPDATE hospitals
      SET services = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [hospitalId, JSON.stringify(specialists)]);
    
    if (result.rows.length === 0) {
      throw new Error('Hospital not found');
    }

    await redis.setex(
      `hospital:${hospitalId}:specialists`,
      3600,
      JSON.stringify(specialists)
    );

    logger.info('Specialist availability updated', { hospitalId, specialists });

    return specialists;
  }

  static async getOnDutySpecialists(hospitalId) {
    const cached = await redis.get(`hospital:${hospitalId}:specialists`);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const query = 'SELECT services FROM hospitals WHERE id = $1';
    const result = await db.query(query, [hospitalId]);

    if (result.rows.length === 0) {
      throw new Error('Hospital not found');
    }

    const specialists = typeof result.rows[0].services === 'string'
      ? JSON.parse(result.rows[0].services)
      : result.rows[0].services;

    await redis.setex(
      `hospital:${hospitalId}:specialists`,
      3600,
      JSON.stringify(specialists)
    );

    return specialists;
  }

  static async findHospitalsWithSpecialist(specialistType, latitude, longitude, radiusKm = 50) {
    const query = `
      SELECT *,
        (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance
      FROM hospitals
      WHERE status = 'active'
        AND services::jsonb ? $3
      HAVING distance <= $4
      ORDER BY distance ASC
    `;

    const result = await db.query(query, [latitude, longitude, specialistType, radiusKm]);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      address: row.address,
      distance: parseFloat(row.distance).toFixed(2),
      services: typeof row.services === 'string' ? JSON.parse(row.services) : row.services,
      capacity: {
        beds: row.available_beds,
        icu: row.available_icu_beds,
        trauma: row.available_trauma_bays,
      },
    }));
  }

  static async matchHospitalToIncident(incidentType, latitude, longitude, options = {}) {
    const requiredSpecialists = this.getRequiredSpecialists(incidentType);
    const radiusKm = options.radius || 50;

    let query = `
      SELECT *,
        (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance
      FROM hospitals
      WHERE status = 'active'
    `;

    const values = [latitude, longitude];
    let paramCount = 3;

    if (options.requires_icu) {
      query += ` AND available_icu_beds > 0`;
    }

    if (options.requires_trauma) {
      query += ` AND available_trauma_bays > 0`;
    }

    if (options.min_trauma_level) {
      query += ` AND trauma_level = $${paramCount}`;
      values.push(options.min_trauma_level);
      paramCount++;
    }

    query += ` HAVING distance <= $${paramCount}`;
    values.push(radiusKm);

    query += ` ORDER BY distance ASC`;

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await db.query(query, values);

    const hospitals = result.rows.map(row => {
      const services = typeof row.services === 'string' ? JSON.parse(row.services) : row.services;
      
      const specialistMatch = requiredSpecialists.length === 0 ||
        requiredSpecialists.some(specialist => services.includes(specialist));

      const matchScore = this.calculateSpecialistMatchScore(services, requiredSpecialists);

      return {
        id: row.id,
        name: row.name,
        address: row.address,
        distance: parseFloat(row.distance).toFixed(2),
        trauma_level: row.trauma_level,
        capacity: {
          beds: row.available_beds,
          icu: row.available_icu_beds,
          trauma: row.available_trauma_bays,
        },
        services,
        specialist_match: specialistMatch,
        match_score: matchScore,
        required_specialists: requiredSpecialists,
      };
    });

    const matchedHospitals = hospitals.filter(h => h.specialist_match);
    const otherHospitals = hospitals.filter(h => !h.specialist_match);

    return [...matchedHospitals, ...otherHospitals];
  }

  static calculateSpecialistMatchScore(availableServices, requiredSpecialists) {
    if (requiredSpecialists.length === 0) {
      return 100;
    }

    const matchCount = requiredSpecialists.filter(specialist =>
      availableServices.includes(specialist)
    ).length;

    return Math.round((matchCount / requiredSpecialists.length) * 100);
  }

  static async getSpecialistSchedule(hospitalId) {
    const scheduleKey = `hospital:${hospitalId}:schedule`;
    const cached = await redis.get(scheduleKey);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  static async setSpecialistSchedule(hospitalId, schedule) {
    const scheduleKey = `hospital:${hospitalId}:schedule`;
    
    await redis.setex(
      scheduleKey,
      86400,
      JSON.stringify(schedule)
    );

    logger.info('Specialist schedule updated', { hospitalId });

    return schedule;
  }

  static async getAvailableSpecialistsByShift(shift = 'current') {
    const currentHour = new Date().getHours();
    let shiftPeriod;

    if (shift === 'current') {
      if (currentHour >= 7 && currentHour < 15) {
        shiftPeriod = 'day';
      } else if (currentHour >= 15 && currentHour < 23) {
        shiftPeriod = 'evening';
      } else {
        shiftPeriod = 'night';
      }
    } else {
      shiftPeriod = shift;
    }

    const query = 'SELECT id, name, services FROM hospitals WHERE status = $1';
    const result = await db.query(query, ['active']);

    return result.rows.map(row => ({
      hospital_id: row.id,
      hospital_name: row.name,
      shift: shiftPeriod,
      specialists: typeof row.services === 'string' ? JSON.parse(row.services) : row.services,
    }));
  }

  static validateSpecialist(specialistType) {
    return SPECIALIST_SERVICES.includes(specialistType);
  }

  static getAllSpecialistTypes() {
    return SPECIALIST_SERVICES;
  }

  static getIncidentTypeMap() {
    return INCIDENT_SPECIALIST_MAP;
  }
}

module.exports = SpecialistManager;
