const db = require('../../api/config/database');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError, ConflictError } = require('../../api/utils/errors');
const logger = require('../../api/utils/logger');
const { AMBULANCE_TYPES, AMBULANCE_STATUS } = require('./model');

class AmbulanceService {
  async create(ambulanceData) {
    const {
      callSign,
      type,
      baseStation,
      equipment = [],
      latitude,
      longitude,
      metadata = {},
    } = ambulanceData;

    if (!Object.values(AMBULANCE_TYPES).includes(type)) {
      throw new ValidationError('Invalid ambulance type');
    }

    const checkQuery = 'SELECT id FROM ambulances WHERE call_sign = $1 AND deleted_at IS NULL';
    const existing = await db.query(checkQuery, [callSign]);
    
    if (existing.rows.length > 0) {
      throw new ConflictError(`Ambulance with call sign ${callSign} already exists`);
    }

    const query = `
      INSERT INTO ambulances (
        call_sign, type, base_station, equipment, latitude, longitude,
        location, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 
        ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
        $9, 'OFFLINE'
      )
      RETURNING *
    `;

    const values = [
      callSign,
      type,
      baseStation,
      JSON.stringify(equipment),
      latitude,
      longitude,
      longitude,
      latitude,
      JSON.stringify(metadata),
    ];

    const result = await db.query(query, values);
    const ambulance = result.rows[0];

    logger.info('Ambulance created', { ambulanceId: ambulance.id, callSign });

    return this.formatAmbulance(ambulance);
  }

  async findById(id) {
    const query = `
      SELECT 
        a.*,
        d.id as driver_id,
        d.user_id as driver_user_id,
        d.license_number as driver_license,
        d.shift_status as driver_shift_status,
        d.shift_start_time,
        d.shift_end_time
      FROM ambulances a
      LEFT JOIN ambulance_drivers d ON a.id = d.current_ambulance_id AND d.deleted_at IS NULL
      WHERE a.id = $1 AND a.deleted_at IS NULL
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Ambulance not found');
    }

    return this.formatAmbulanceWithDriver(result.rows[0]);
  }

  async findAll(filters = {}) {
    const {
      type,
      status,
      baseStation,
      minFuelLevel = 0,
      page = 1,
      limit = 50,
    } = filters;

    const conditions = ['a.deleted_at IS NULL'];
    const values = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      conditions.push(`a.type = $${paramCount}`);
      values.push(type);
    }

    if (status) {
      paramCount++;
      conditions.push(`a.status = $${paramCount}`);
      values.push(status);
    }

    if (baseStation) {
      paramCount++;
      conditions.push(`a.base_station = $${paramCount}`);
      values.push(baseStation);
    }

    if (minFuelLevel > 0) {
      paramCount++;
      conditions.push(`a.fuel_level >= $${paramCount}`);
      values.push(minFuelLevel);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) FROM ambulances a WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;
    values.push(limit, offset);

    const query = `
      SELECT 
        a.*,
        d.id as driver_id,
        d.user_id as driver_user_id,
        d.license_number as driver_license,
        d.shift_status as driver_shift_status
      FROM ambulances a
      LEFT JOIN ambulance_drivers d ON a.id = d.current_ambulance_id AND d.deleted_at IS NULL
      WHERE ${whereClause}
      ORDER BY a.call_sign
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await db.query(query, values);

    return {
      ambulances: result.rows.map(row => this.formatAmbulanceWithDriver(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAvailable(filters = {}) {
    const { type, latitude, longitude, maxDistance, minFuelLevel = 25 } = filters;

    const conditions = [
      'a.deleted_at IS NULL',
      "a.status = 'AVAILABLE'",
      `a.fuel_level >= $1`,
    ];
    const values = [minFuelLevel];
    let paramCount = 1;

    if (type) {
      paramCount++;
      conditions.push(`a.type = $${paramCount}`);
      values.push(type);
    }

    const whereClause = conditions.join(' AND ');

    let distanceSelect = '0 as distance';
    let orderBy = 'a.call_sign';

    if (latitude !== undefined && longitude !== undefined) {
      paramCount++;
      const latParam = paramCount;
      paramCount++;
      const lonParam = paramCount;
      values.push(latitude, longitude);

      distanceSelect = `
        ST_Distance(
          a.location,
          ST_SetSRID(ST_MakePoint($${lonParam}, $${latParam}), 4326)::geography
        ) / 1000.0 as distance
      `;
      orderBy = 'distance';

      if (maxDistance) {
        paramCount++;
        conditions.push(`
          ST_Distance(
            a.location,
            ST_SetSRID(ST_MakePoint($${lonParam}, $${latParam}), 4326)::geography
          ) / 1000.0 <= $${paramCount}
        `);
        values.push(maxDistance);
      }
    }

    const query = `
      SELECT 
        a.*,
        ${distanceSelect},
        d.id as driver_id,
        d.user_id as driver_user_id,
        d.license_number as driver_license,
        d.shift_status as driver_shift_status
      FROM ambulances a
      LEFT JOIN ambulance_drivers d ON a.id = d.current_ambulance_id AND d.deleted_at IS NULL
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT 20
    `;

    const result = await db.query(query, values);

    return result.rows.map(row => ({
      ...this.formatAmbulanceWithDriver(row),
      distance: parseFloat(row.distance) || 0,
    }));
  }

  async update(id, updateData) {
    const ambulance = await this.findById(id);
    
    const allowedFields = [
      'call_sign',
      'type',
      'base_station',
      'equipment',
      'metadata',
      'last_maintenance_date',
      'next_maintenance_date',
      'mileage',
    ];

    const updates = [];
    const values = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        paramCount++;
        if (key === 'equipment' || key === 'metadata') {
          updates.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updateData[key]));
        } else {
          updates.push(`${key} = $${paramCount}`);
          values.push(updateData[key]);
        }
      }
    });

    if (updates.length === 0) {
      return ambulance;
    }

    paramCount++;
    values.push(id);

    const query = `
      UPDATE ambulances
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, values);
    logger.info('Ambulance updated', { ambulanceId: id });

    return this.formatAmbulance(result.rows[0]);
  }

  async updateStatus(id, newStatus, options = {}) {
    const { userId, reason, incidentId } = options;

    if (!Object.values(AMBULANCE_STATUS).includes(newStatus)) {
      throw new ValidationError('Invalid ambulance status');
    }

    const ambulance = await this.findById(id);
    const previousStatus = ambulance.status;

    if (previousStatus === newStatus) {
      return ambulance;
    }

    if (newStatus === 'AVAILABLE' && 
        (ambulance.status === 'OUT_OF_SERVICE' || ambulance.status === 'OFFLINE')) {
      if (!ambulance.driver_id) {
        throw new ValidationError('Cannot set ambulance to AVAILABLE without assigned driver');
      }
    }

    await db.transaction(async (client) => {
      await client.query(
        'UPDATE ambulances SET status = $1 WHERE id = $2',
        [newStatus, id]
      );

      await client.query(
        `INSERT INTO ambulance_status_history 
         (ambulance_id, previous_status, new_status, changed_by, reason, incident_id, latitude, longitude, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 
           CASE WHEN $7 IS NOT NULL AND $8 IS NOT NULL 
           THEN ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography 
           ELSE NULL END
         )`,
        [id, previousStatus, newStatus, userId, reason, incidentId, 
         ambulance.latitude, ambulance.longitude]
      );
    });

    logger.info('Ambulance status updated', {
      ambulanceId: id,
      previousStatus,
      newStatus,
      userId,
      incidentId,
    });

    return this.findById(id);
  }

  async updateLocation(id, latitude, longitude) {
    const query = `
      UPDATE ambulances
      SET 
        latitude = $1,
        longitude = $2,
        location = ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
      WHERE id = $5 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [latitude, longitude, longitude, latitude, id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Ambulance not found');
    }

    logger.debug('Ambulance location updated', { ambulanceId: id, latitude, longitude });

    return this.formatAmbulance(result.rows[0]);
  }

  async updateFuelLevel(id, fuelLevel) {
    if (fuelLevel < 0 || fuelLevel > 100) {
      throw new ValidationError('Fuel level must be between 0 and 100');
    }

    const query = `
      UPDATE ambulances
      SET fuel_level = $1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [fuelLevel, id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Ambulance not found');
    }

    logger.info('Ambulance fuel level updated', { ambulanceId: id, fuelLevel });

    if (fuelLevel < 25) {
      logger.warn('Low fuel alert', { ambulanceId: id, fuelLevel, callSign: result.rows[0].call_sign });
    }

    return this.formatAmbulance(result.rows[0]);
  }

  async delete(id) {
    const query = `
      UPDATE ambulances
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Ambulance not found');
    }

    logger.info('Ambulance deleted', { ambulanceId: id });

    return this.formatAmbulance(result.rows[0]);
  }

  async getStatusHistory(id, limit = 50) {
    const query = `
      SELECT *
      FROM ambulance_status_history
      WHERE ambulance_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [id, limit]);
    
    return result.rows.map(row => ({
      id: row.id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      changedBy: row.changed_by,
      reason: row.reason,
      incidentId: row.incident_id,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      createdAt: row.created_at,
    }));
  }

  formatAmbulance(row) {
    return {
      id: row.id,
      callSign: row.call_sign,
      type: row.type,
      status: row.status,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      fuelLevel: row.fuel_level,
      baseStation: row.base_station,
      equipment: typeof row.equipment === 'string' ? JSON.parse(row.equipment) : row.equipment,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      lastMaintenanceDate: row.last_maintenance_date,
      nextMaintenanceDate: row.next_maintenance_date,
      mileage: row.mileage,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  formatAmbulanceWithDriver(row) {
    const ambulance = this.formatAmbulance(row);
    
    if (row.driver_id) {
      ambulance.driver = {
        id: row.driver_id,
        userId: row.driver_user_id,
        licenseNumber: row.driver_license,
        shiftStatus: row.driver_shift_status,
        shiftStartTime: row.shift_start_time,
        shiftEndTime: row.shift_end_time,
      };
    } else {
      ambulance.driver = null;
    }

    return ambulance;
  }
}

module.exports = new AmbulanceService();
