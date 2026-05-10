const db = require('../../api/config/database');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError, ValidationError, ConflictError } = require('../../api/utils/errors');
const logger = require('../../api/utils/logger');
const { SHIFT_STATUS } = require('./model');

class DriverService {
  async create(driverData) {
    const {
      userId,
      licenseNumber,
      licenseExpiry,
      certifications = [],
      metadata = {},
    } = driverData;

    const checkQuery = 'SELECT id FROM ambulance_drivers WHERE license_number = $1 AND deleted_at IS NULL';
    const existing = await db.query(checkQuery, [licenseNumber]);
    
    if (existing.rows.length > 0) {
      throw new ConflictError('Driver with this license number already exists');
    }

    const query = `
      INSERT INTO ambulance_drivers (
        user_id, license_number, license_expiry, certifications
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [userId, licenseNumber, licenseExpiry, JSON.stringify(certifications)];

    const result = await db.query(query, values);
    logger.info('Driver created', { driverId: result.rows[0].id, userId });

    return this.formatDriver(result.rows[0]);
  }

  async findById(id) {
    const query = `
      SELECT d.*, a.call_sign as ambulance_call_sign, a.type as ambulance_type
      FROM ambulance_drivers d
      LEFT JOIN ambulances a ON d.current_ambulance_id = a.id AND a.deleted_at IS NULL
      WHERE d.id = $1 AND d.deleted_at IS NULL
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Driver not found');
    }

    return this.formatDriverWithAmbulance(result.rows[0]);
  }

  async findByUserId(userId) {
    const query = `
      SELECT d.*, a.call_sign as ambulance_call_sign, a.type as ambulance_type
      FROM ambulance_drivers d
      LEFT JOIN ambulances a ON d.current_ambulance_id = a.id AND a.deleted_at IS NULL
      WHERE d.user_id = $1 AND d.deleted_at IS NULL
    `;

    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Driver not found');
    }

    return this.formatDriverWithAmbulance(result.rows[0]);
  }

  async assignToAmbulance(driverId, ambulanceId) {
    const driver = await this.findById(driverId);
    
    if (driver.shiftStatus !== 'ON_DUTY') {
      throw new ValidationError('Driver must be on duty to be assigned to ambulance');
    }

    const checkQuery = 'SELECT id FROM ambulances WHERE id = $1 AND deleted_at IS NULL';
    const ambulanceCheck = await db.query(checkQuery, [ambulanceId]);
    
    if (ambulanceCheck.rows.length === 0) {
      throw new NotFoundError('Ambulance not found');
    }

    const assignedQuery = `
      SELECT id, user_id FROM ambulance_drivers 
      WHERE current_ambulance_id = $1 AND shift_status = 'ON_DUTY' AND deleted_at IS NULL
    `;
    const assigned = await db.query(assignedQuery, [ambulanceId]);
    
    if (assigned.rows.length > 0 && assigned.rows[0].id !== driverId) {
      throw new ConflictError('Ambulance already has an assigned driver');
    }

    const query = `
      UPDATE ambulance_drivers
      SET current_ambulance_id = $1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [ambulanceId, driverId]);
    logger.info('Driver assigned to ambulance', { driverId, ambulanceId });

    return this.formatDriver(result.rows[0]);
  }

  async unassignFromAmbulance(driverId) {
    const query = `
      UPDATE ambulance_drivers
      SET current_ambulance_id = NULL
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [driverId]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Driver not found');
    }

    logger.info('Driver unassigned from ambulance', { driverId });

    return this.formatDriver(result.rows[0]);
  }

  async startShift(driverId, ambulanceId = null) {
    const driver = await this.findById(driverId);

    if (driver.shiftStatus === 'ON_DUTY') {
      throw new ValidationError('Driver is already on duty');
    }

    const updates = [
      "shift_status = 'ON_DUTY'",
      "shift_start_time = NOW()",
      "shift_end_time = NULL",
    ];

    if (ambulanceId) {
      const ambulanceCheck = await db.query(
        'SELECT id FROM ambulances WHERE id = $1 AND deleted_at IS NULL',
        [ambulanceId]
      );
      
      if (ambulanceCheck.rows.length === 0) {
        throw new NotFoundError('Ambulance not found');
      }

      const assignedCheck = await db.query(
        `SELECT id FROM ambulance_drivers 
         WHERE current_ambulance_id = $1 AND shift_status = 'ON_DUTY' AND id != $2 AND deleted_at IS NULL`,
        [ambulanceId, driverId]
      );
      
      if (assignedCheck.rows.length > 0) {
        throw new ConflictError('Ambulance already has an assigned driver');
      }

      updates.push(`current_ambulance_id = '${ambulanceId}'`);
    }

    const query = `
      UPDATE ambulance_drivers
      SET ${updates.join(', ')}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [driverId]);
    logger.info('Driver shift started', { driverId, ambulanceId });

    return this.formatDriver(result.rows[0]);
  }

  async endShift(driverId) {
    const driver = await this.findById(driverId);

    if (driver.shiftStatus !== 'ON_DUTY' && driver.shiftStatus !== 'BREAK') {
      throw new ValidationError('Driver is not on duty');
    }

    if (driver.currentAmbulanceId) {
      const ambulanceCheck = await db.query(
        "SELECT status FROM ambulances WHERE id = $1 AND status IN ('DISPATCHED', 'BUSY')",
        [driver.currentAmbulanceId]
      );
      
      if (ambulanceCheck.rows.length > 0) {
        throw new ValidationError('Cannot end shift while ambulance is dispatched or busy');
      }
    }

    const query = `
      UPDATE ambulance_drivers
      SET 
        shift_status = 'OFF_DUTY',
        shift_end_time = NOW(),
        current_ambulance_id = NULL
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [driverId]);
    logger.info('Driver shift ended', { driverId });

    return this.formatDriver(result.rows[0]);
  }

  async updateShiftStatus(driverId, status) {
    if (!Object.values(SHIFT_STATUS).includes(status)) {
      throw new ValidationError('Invalid shift status');
    }

    const driver = await this.findById(driverId);

    if (status === 'ON_DUTY' && driver.shiftStatus === 'OFF_DUTY') {
      return this.startShift(driverId, driver.currentAmbulanceId);
    }

    if (status === 'OFF_DUTY') {
      return this.endShift(driverId);
    }

    const query = `
      UPDATE ambulance_drivers
      SET shift_status = $1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [status, driverId]);
    logger.info('Driver shift status updated', { driverId, status });

    return this.formatDriver(result.rows[0]);
  }

  async updateLocation(driverId, latitude, longitude) {
    const query = `
      UPDATE ambulance_drivers
      SET 
        latitude = $1,
        longitude = $2,
        location = ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
      WHERE id = $5 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [latitude, longitude, longitude, latitude, driverId]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Driver not found');
    }

    logger.debug('Driver location updated', { driverId, latitude, longitude });

    return this.formatDriver(result.rows[0]);
  }

  async updatePerformanceMetrics(driverId, metrics) {
    const driver = await this.findById(driverId);
    const currentMetrics = driver.performanceMetrics || {};
    const updatedMetrics = { ...currentMetrics, ...metrics };

    const query = `
      UPDATE ambulance_drivers
      SET performance_metrics = $1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [JSON.stringify(updatedMetrics), driverId]);
    logger.info('Driver performance metrics updated', { driverId });

    return this.formatDriver(result.rows[0]);
  }

  async getOnDutyDrivers() {
    const query = `
      SELECT d.*, a.call_sign as ambulance_call_sign, a.type as ambulance_type
      FROM ambulance_drivers d
      LEFT JOIN ambulances a ON d.current_ambulance_id = a.id AND a.deleted_at IS NULL
      WHERE d.shift_status = 'ON_DUTY' AND d.deleted_at IS NULL
      ORDER BY d.shift_start_time DESC
    `;

    const result = await db.query(query);
    
    return result.rows.map(row => this.formatDriverWithAmbulance(row));
  }

  formatDriver(row) {
    return {
      id: row.id,
      userId: row.user_id,
      licenseNumber: row.license_number,
      licenseExpiry: row.license_expiry,
      certifications: typeof row.certifications === 'string' ? JSON.parse(row.certifications) : row.certifications,
      shiftStatus: row.shift_status,
      currentAmbulanceId: row.current_ambulance_id,
      shiftStartTime: row.shift_start_time,
      shiftEndTime: row.shift_end_time,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      performanceMetrics: typeof row.performance_metrics === 'string' 
        ? JSON.parse(row.performance_metrics) 
        : row.performance_metrics,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  formatDriverWithAmbulance(row) {
    const driver = this.formatDriver(row);
    
    if (row.current_ambulance_id) {
      driver.ambulance = {
        id: row.current_ambulance_id,
        callSign: row.ambulance_call_sign,
        type: row.ambulance_type,
      };
    } else {
      driver.ambulance = null;
    }

    return driver;
  }
}

module.exports = new DriverService();
