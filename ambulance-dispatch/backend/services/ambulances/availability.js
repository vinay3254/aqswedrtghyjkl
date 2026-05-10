const db = require('../../api/config/database');
const logger = require('../../api/utils/logger');
const { AMBULANCE_STATUS } = require('./model');

class AvailabilityService {
  async markAsDispatched(ambulanceId, incidentId, userId = null) {
    await db.transaction(async (client) => {
      const ambulanceResult = await client.query(
        'SELECT status FROM ambulances WHERE id = $1 AND deleted_at IS NULL',
        [ambulanceId]
      );

      if (ambulanceResult.rows.length === 0) {
        throw new Error('Ambulance not found');
      }

      const currentStatus = ambulanceResult.rows[0].status;

      if (currentStatus !== 'AVAILABLE') {
        throw new Error(`Cannot dispatch ambulance with status ${currentStatus}`);
      }

      await client.query(
        'UPDATE ambulances SET status = $1 WHERE id = $2',
        ['DISPATCHED', ambulanceId]
      );

      await client.query(
        `INSERT INTO ambulance_status_history 
         (ambulance_id, previous_status, new_status, changed_by, reason, incident_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ambulanceId, currentStatus, 'DISPATCHED', userId, 'Dispatched to incident', incidentId]
      );
    });

    logger.info('Ambulance marked as dispatched', { ambulanceId, incidentId });
  }

  async markAsBusy(ambulanceId, reason = 'At scene', userId = null) {
    await db.transaction(async (client) => {
      const ambulanceResult = await client.query(
        'SELECT status FROM ambulances WHERE id = $1 AND deleted_at IS NULL',
        [ambulanceId]
      );

      if (ambulanceResult.rows.length === 0) {
        throw new Error('Ambulance not found');
      }

      const currentStatus = ambulanceResult.rows[0].status;

      if (currentStatus !== 'DISPATCHED' && currentStatus !== 'AVAILABLE') {
        throw new Error(`Cannot mark ambulance as busy from status ${currentStatus}`);
      }

      await client.query(
        'UPDATE ambulances SET status = $1 WHERE id = $2',
        ['BUSY', ambulanceId]
      );

      await client.query(
        `INSERT INTO ambulance_status_history 
         (ambulance_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [ambulanceId, currentStatus, 'BUSY', userId, reason]
      );
    });

    logger.info('Ambulance marked as busy', { ambulanceId, reason });
  }

  async markAsAvailable(ambulanceId, userId = null) {
    await db.transaction(async (client) => {
      const ambulanceResult = await client.query(
        `SELECT a.status, d.id as driver_id, d.shift_status
         FROM ambulances a
         LEFT JOIN ambulance_drivers d ON a.id = d.current_ambulance_id AND d.deleted_at IS NULL
         WHERE a.id = $1 AND a.deleted_at IS NULL`,
        [ambulanceId]
      );

      if (ambulanceResult.rows.length === 0) {
        throw new Error('Ambulance not found');
      }

      const { status: currentStatus, driver_id, shift_status } = ambulanceResult.rows[0];

      if (currentStatus === 'OUT_OF_SERVICE') {
        throw new Error('Cannot mark out-of-service ambulance as available');
      }

      if (!driver_id || shift_status !== 'ON_DUTY') {
        throw new Error('Cannot mark ambulance as available without on-duty driver');
      }

      await client.query(
        'UPDATE ambulances SET status = $1 WHERE id = $2',
        ['AVAILABLE', ambulanceId]
      );

      await client.query(
        `INSERT INTO ambulance_status_history 
         (ambulance_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [ambulanceId, currentStatus, 'AVAILABLE', userId, 'Returned to available status']
      );
    });

    logger.info('Ambulance marked as available', { ambulanceId });
  }

  async markAsOffline(ambulanceId, reason = 'End of shift', userId = null) {
    await db.transaction(async (client) => {
      const ambulanceResult = await client.query(
        'SELECT status FROM ambulances WHERE id = $1 AND deleted_at IS NULL',
        [ambulanceId]
      );

      if (ambulanceResult.rows.length === 0) {
        throw new Error('Ambulance not found');
      }

      const currentStatus = ambulanceResult.rows[0].status;

      if (currentStatus === 'DISPATCHED' || currentStatus === 'BUSY') {
        throw new Error(`Cannot mark ambulance as offline while ${currentStatus}`);
      }

      await client.query(
        'UPDATE ambulances SET status = $1 WHERE id = $2',
        ['OFFLINE', ambulanceId]
      );

      await client.query(
        `INSERT INTO ambulance_status_history 
         (ambulance_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [ambulanceId, currentStatus, 'OFFLINE', userId, reason]
      );
    });

    logger.info('Ambulance marked as offline', { ambulanceId, reason });
  }

  async markAsOutOfService(ambulanceId, reason, userId = null) {
    await db.transaction(async (client) => {
      const ambulanceResult = await client.query(
        'SELECT status FROM ambulances WHERE id = $1 AND deleted_at IS NULL',
        [ambulanceId]
      );

      if (ambulanceResult.rows.length === 0) {
        throw new Error('Ambulance not found');
      }

      const currentStatus = ambulanceResult.rows[0].status;

      if (currentStatus === 'DISPATCHED' || currentStatus === 'BUSY') {
        throw new Error(`Cannot mark ambulance as out-of-service while ${currentStatus}`);
      }

      await client.query(
        'UPDATE ambulances SET status = $1 WHERE id = $2',
        ['OUT_OF_SERVICE', ambulanceId]
      );

      await client.query(
        `INSERT INTO ambulance_status_history 
         (ambulance_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [ambulanceId, currentStatus, 'OUT_OF_SERVICE', userId, reason]
      );
    });

    logger.info('Ambulance marked as out-of-service', { ambulanceId, reason });
  }

  async getAvailabilityStats() {
    const query = `
      SELECT 
        type,
        status,
        COUNT(*) as count
      FROM ambulances
      WHERE deleted_at IS NULL
      GROUP BY type, status
      ORDER BY type, status
    `;

    const result = await db.query(query);

    const stats = {
      byType: {},
      byStatus: {},
      total: 0,
    };

    result.rows.forEach(row => {
      if (!stats.byType[row.type]) {
        stats.byType[row.type] = {
          total: 0,
          available: 0,
          dispatched: 0,
          busy: 0,
          offline: 0,
          outOfService: 0,
        };
      }

      const count = parseInt(row.count);
      stats.byType[row.type].total += count;
      stats.total += count;

      const statusKey = row.status.toLowerCase().replace(/_/g, '');
      if (statusKey === 'outofservice') {
        stats.byType[row.type].outOfService += count;
      } else {
        stats.byType[row.type][statusKey] = count;
      }

      if (!stats.byStatus[row.status]) {
        stats.byStatus[row.status] = 0;
      }
      stats.byStatus[row.status] += count;
    });

    return stats;
  }

  async checkLowFuelAmbulances(threshold = 25) {
    const query = `
      SELECT id, call_sign, fuel_level, status
      FROM ambulances
      WHERE fuel_level < $1 
        AND deleted_at IS NULL
        AND status NOT IN ('OFFLINE', 'OUT_OF_SERVICE')
      ORDER BY fuel_level ASC
    `;

    const result = await db.query(query, [threshold]);

    if (result.rows.length > 0) {
      logger.warn('Low fuel ambulances detected', {
        count: result.rows.length,
        ambulances: result.rows.map(r => ({
          id: r.id,
          callSign: r.call_sign,
          fuelLevel: r.fuel_level,
          status: r.status,
        })),
      });
    }

    return result.rows.map(row => ({
      id: row.id,
      callSign: row.call_sign,
      fuelLevel: row.fuel_level,
      status: row.status,
    }));
  }

  async autoUpdateFromIncident(incidentId, incidentStatus, ambulanceId) {
    const statusMap = {
      'DISPATCHED': 'DISPATCHED',
      'EN_ROUTE': 'DISPATCHED',
      'ON_SCENE': 'BUSY',
      'TRANSPORTING': 'BUSY',
      'AT_HOSPITAL': 'BUSY',
      'COMPLETED': 'AVAILABLE',
      'CANCELLED': 'AVAILABLE',
    };

    const newStatus = statusMap[incidentStatus];

    if (newStatus) {
      try {
        const currentResult = await db.query(
          'SELECT status FROM ambulances WHERE id = $1',
          [ambulanceId]
        );

        if (currentResult.rows.length > 0) {
          const currentStatus = currentResult.rows[0].status;

          if (currentStatus !== newStatus) {
            if (newStatus === 'DISPATCHED') {
              await this.markAsDispatched(ambulanceId, incidentId);
            } else if (newStatus === 'BUSY') {
              await this.markAsBusy(ambulanceId, `Incident status: ${incidentStatus}`);
            } else if (newStatus === 'AVAILABLE') {
              const driverCheck = await db.query(
                `SELECT d.id FROM ambulance_drivers d
                 WHERE d.current_ambulance_id = $1 
                   AND d.shift_status = 'ON_DUTY' 
                   AND d.deleted_at IS NULL`,
                [ambulanceId]
              );

              if (driverCheck.rows.length > 0) {
                await this.markAsAvailable(ambulanceId);
              } else {
                await this.markAsOffline(ambulanceId, 'Incident completed, no driver on duty');
              }
            }
          }
        }
      } catch (error) {
        logger.error('Failed to auto-update ambulance status from incident', {
          incidentId,
          incidentStatus,
          ambulanceId,
          error: error.message,
        });
      }
    }
  }
}

module.exports = new AvailabilityService();
