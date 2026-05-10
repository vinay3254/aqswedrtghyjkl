const db = require('../../api/config/database');
const logger = require('../../api/utils/logger');
const { NotFoundError, ValidationError } = require('../../api/utils/errors');
const signalAPIClient = require('./signal-api-client');
const signalSequencer = require('./signal-sequencer');
const policeCoordination = require('./police-coordination');

const CORRIDOR_STATUS = {
  ACTIVATING: 'ACTIVATING',
  ACTIVE: 'ACTIVE',
  DEACTIVATING: 'DEACTIVATING',
  DEACTIVATED: 'DEACTIVATED',
  FAILED: 'FAILED'
};

const AUTO_ACTIVATE_SEVERITIES = ['CRITICAL', 'HIGH'];
const DEFAULT_CORRIDOR_DURATION_MIN = 20;
const AMBULANCE_AVERAGE_SPEED_KMH = 60;

class CorridorService {
  async activateCorridor(assignmentId, options = {}) {
    try {
      // Get assignment details
      const assignment = await this._getAssignment(assignmentId);
      if (!assignment) {
        throw new NotFoundError(`Assignment ${assignmentId} not found`);
      }

      // Check if corridor should be auto-activated
      const shouldAutoActivate = this._shouldAutoActivate(assignment);
      const manualOverride = options.manual_override || false;

      if (!shouldAutoActivate && !manualOverride) {
        logger.info('Corridor activation skipped - criteria not met', {
          assignment_id: assignmentId,
          severity: assignment.severity,
          status: assignment.ambulance_status
        });
        return null;
      }

      // Check if corridor already exists
      const existingCorridor = await this._getActiveCorridorForAssignment(assignmentId);
      if (existingCorridor) {
        logger.warn('Corridor already active for assignment', {
          assignment_id: assignmentId,
          corridor_id: existingCorridor.corridor_id
        });
        return existingCorridor;
      }

      // Parse route information
      const route = this._parseRouteInfo(assignment.route_info);
      if (!route || !route.distance) {
        throw new ValidationError('Invalid route information for corridor activation');
      }

      // Calculate signal timings
      const signalTimings = signalSequencer.calculateSignalTimings(
        route,
        options.ambulance_speed || AMBULANCE_AVERAGE_SPEED_KMH
      );

      // Generate corridor ID
      const corridorId = this._generateCorridorId(assignment.ambulance_id);

      // Create corridor record
      const corridor = await this._createCorridorRecord({
        corridor_id: corridorId,
        assignment_id: assignmentId,
        ambulance_id: assignment.ambulance_id,
        incident_id: assignment.incident_id,
        route,
        signal_timings: signalTimings,
        duration_minutes: options.duration_minutes || DEFAULT_CORRIDOR_DURATION_MIN,
        manual_override: manualOverride,
        activated_by: options.activated_by || 'SYSTEM'
      });

      // Activate via traffic API
      const apiResponse = await signalAPIClient.activateCorridor({
        corridor_id: corridorId,
        ambulance_id: assignment.ambulance_id,
        route,
        duration_minutes: corridor.duration_minutes,
        priority: this._getPriorityLevel(assignment.severity)
      });

      // Update corridor with API response
      await this._updateCorridorStatus(corridorId, CORRIDOR_STATUS.ACTIVE, {
        api_response: apiResponse,
        signals_affected: apiResponse.signals_affected,
        estimated_time_savings_sec: apiResponse.estimated_time_savings_sec
      });

      // Notify police
      await policeCoordination.notifyCorridorActivation({
        corridor_id: corridorId,
        assignment_id: assignmentId,
        ambulance_id: assignment.ambulance_id,
        route,
        severity: assignment.severity,
        signals_affected: apiResponse.signals_affected
      });

      logger.info('Green corridor activated successfully', {
        corridor_id: corridorId,
        assignment_id: assignmentId,
        signals_affected: apiResponse.signals_affected,
        estimated_savings_sec: apiResponse.estimated_time_savings_sec
      });

      return await this._getCorridorById(corridorId);
    } catch (error) {
      logger.error('Failed to activate corridor', {
        assignment_id: assignmentId,
        error: error.message
      });
      throw error;
    }
  }

  async deactivateCorridor(corridorId, reason = 'COMPLETED', options = {}) {
    try {
      const corridor = await this._getCorridorById(corridorId);
      if (!corridor) {
        throw new NotFoundError(`Corridor ${corridorId} not found`);
      }

      if (corridor.status === CORRIDOR_STATUS.DEACTIVATED) {
        logger.warn('Corridor already deactivated', { corridor_id: corridorId });
        return corridor;
      }

      // Update status to deactivating
      await this._updateCorridorStatus(corridorId, CORRIDOR_STATUS.DEACTIVATING);

      // Deactivate via traffic API
      const apiResponse = await signalAPIClient.deactivateCorridor(corridorId, reason);

      // Update final status
      await this._updateCorridorStatus(corridorId, CORRIDOR_STATUS.DEACTIVATED, {
        deactivation_reason: reason,
        deactivated_by: options.deactivated_by || 'SYSTEM',
        api_response: apiResponse
      });

      // Notify police
      await policeCoordination.notifyCorridorDeactivation({
        corridor_id: corridorId,
        reason
      });

      logger.info('Green corridor deactivated', {
        corridor_id: corridorId,
        reason,
        duration_sec: apiResponse.total_duration_sec
      });

      return await this._getCorridorById(corridorId);
    } catch (error) {
      logger.error('Failed to deactivate corridor', {
        corridor_id: corridorId,
        error: error.message
      });
      throw error;
    }
  }

  async getActiveCorridors(filters = {}) {
    try {
      let query = `
        SELECT 
          c.*,
          a.incident_id,
          a.ambulance_id,
          i.severity,
          i.incident_type
        FROM green_corridors c
        LEFT JOIN assignments a ON c.assignment_id = a.id
        LEFT JOIN incidents i ON a.incident_id = i.id
        WHERE c.status = $1
      `;
      const params = [CORRIDOR_STATUS.ACTIVE];

      if (filters.ambulance_id) {
        params.push(filters.ambulance_id);
        query += ` AND c.ambulance_id = $${params.length}`;
      }

      query += ' ORDER BY c.activated_at DESC';

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get active corridors', { error: error.message });
      throw error;
    }
  }

  async getCorridorStatus(corridorId) {
    try {
      const corridor = await this._getCorridorById(corridorId);
      if (!corridor) {
        throw new NotFoundError(`Corridor ${corridorId} not found`);
      }

      // Get live status from traffic API
      const apiStatus = await signalAPIClient.getCorridorStatus(corridorId);

      // Update signal timings with current status
      const updatedSignals = signalSequencer.updateSignalStatus(
        corridor.signal_timings,
        apiStatus.current_position
      );

      return {
        ...corridor,
        live_status: apiStatus,
        signal_timings: updatedSignals,
        signals_passed: apiStatus.signals_passed,
        signals_remaining: apiStatus.signals_remaining,
        time_saved_sec: apiStatus.time_saved_so_far_sec
      };
    } catch (error) {
      logger.error('Failed to get corridor status', {
        corridor_id: corridorId,
        error: error.message
      });
      throw error;
    }
  }

  async manualOverride(corridorId, action, overriddenBy, reason) {
    try {
      const corridor = await this._getCorridorById(corridorId);
      if (!corridor) {
        throw new NotFoundError(`Corridor ${corridorId} not found`);
      }

      logger.info('Manual corridor override', {
        corridor_id: corridorId,
        action,
        overridden_by: overriddenBy,
        reason
      });

      if (action === 'DEACTIVATE') {
        return await this.deactivateCorridor(corridorId, 'MANUAL_OVERRIDE', {
          deactivated_by: overriddenBy
        });
      } else if (action === 'EXTEND') {
        return await this._extendCorridor(corridorId, reason);
      }

      // Log override in database
      await db.query(
        `INSERT INTO corridor_overrides (corridor_id, action, overridden_by, reason, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [corridorId, action, overriddenBy, reason]
      );

      return await this._getCorridorById(corridorId);
    } catch (error) {
      logger.error('Failed to execute manual override', {
        corridor_id: corridorId,
        error: error.message
      });
      throw error;
    }
  }

  async emergencyKillswitch(executedBy, reason) {
    try {
      const activeCorridors = await this.getActiveCorridors();

      logger.warn('EMERGENCY KILLSWITCH ACTIVATED', {
        executed_by: executedBy,
        reason,
        active_corridors: activeCorridors.length
      });

      const results = [];
      for (const corridor of activeCorridors) {
        try {
          const result = await this.deactivateCorridor(
            corridor.corridor_id,
            'EMERGENCY_KILLSWITCH',
            { deactivated_by: executedBy }
          );
          results.push({ corridor_id: corridor.corridor_id, success: true });
        } catch (error) {
          logger.error('Failed to deactivate corridor in killswitch', {
            corridor_id: corridor.corridor_id,
            error: error.message
          });
          results.push({ corridor_id: corridor.corridor_id, success: false, error: error.message });
        }
      }

      // Notify all police units
      await policeCoordination.notifyEmergencyKillswitch(executedBy, reason, results);

      return {
        executed_by: executedBy,
        reason,
        corridors_deactivated: results.filter(r => r.success).length,
        corridors_failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      logger.error('Emergency killswitch failed', { error: error.message });
      throw error;
    }
  }

  async handleAssignmentStatusChange(assignmentId, newStatus) {
    try {
      const corridor = await this._getActiveCorridorForAssignment(assignmentId);
      
      if (!corridor) {
        return null; // No active corridor for this assignment
      }

      // Auto-deactivate on arrival or completion
      if (['ARRIVED_AT_HOSPITAL', 'COMPLETED'].includes(newStatus)) {
        logger.info('Auto-deactivating corridor on assignment completion', {
          assignment_id: assignmentId,
          corridor_id: corridor.corridor_id,
          new_status: newStatus
        });
        
        return await this.deactivateCorridor(corridor.corridor_id, 'AUTO_DEACTIVATE_ON_COMPLETION');
      }

      return corridor;
    } catch (error) {
      logger.error('Failed to handle assignment status change', {
        assignment_id: assignmentId,
        error: error.message
      });
      return null;
    }
  }

  _shouldAutoActivate(assignment) {
    const severity = assignment.severity;
    const ambulanceStatus = assignment.ambulance_status;

    // Must be high priority incident
    if (!AUTO_ACTIVATE_SEVERITIES.includes(severity)) {
      return false;
    }

    // Ambulance must be en route
    if (ambulanceStatus !== 'EN_ROUTE') {
      return false;
    }

    return true;
  }

  _parseRouteInfo(routeInfo) {
    if (!routeInfo) return null;
    
    if (typeof routeInfo === 'string') {
      try {
        return JSON.parse(routeInfo);
      } catch {
        return null;
      }
    }
    
    return routeInfo;
  }

  _generateCorridorId(ambulanceId) {
    const timestamp = Date.now();
    return `COR-${ambulanceId}-${timestamp}`;
  }

  _getPriorityLevel(severity) {
    const priorityMap = {
      'CRITICAL': 'EMERGENCY',
      'HIGH': 'HIGH',
      'MEDIUM': 'MEDIUM',
      'LOW': 'LOW'
    };
    return priorityMap[severity] || 'MEDIUM';
  }

  async _getAssignment(assignmentId) {
    const query = `
      SELECT 
        a.*,
        i.severity,
        i.incident_type,
        amb.status as ambulance_status
      FROM assignments a
      LEFT JOIN incidents i ON a.incident_id = i.id
      LEFT JOIN ambulances amb ON a.ambulance_id = amb.id
      WHERE a.id = $1
    `;
    const result = await db.query(query, [assignmentId]);
    return result.rows[0];
  }

  async _getActiveCorridorForAssignment(assignmentId) {
    const query = `
      SELECT * FROM green_corridors
      WHERE assignment_id = $1 AND status = $2
      LIMIT 1
    `;
    const result = await db.query(query, [assignmentId, CORRIDOR_STATUS.ACTIVE]);
    return result.rows[0];
  }

  async _getCorridorById(corridorId) {
    const query = 'SELECT * FROM green_corridors WHERE corridor_id = $1';
    const result = await db.query(query, [corridorId]);
    return result.rows[0];
  }

  async _createCorridorRecord(data) {
    const query = `
      INSERT INTO green_corridors (
        corridor_id, assignment_id, ambulance_id, incident_id,
        route_info, signal_timings, duration_minutes,
        status, manual_override, activated_by, activated_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NOW())
      RETURNING *
    `;

    const values = [
      data.corridor_id,
      data.assignment_id,
      data.ambulance_id,
      data.incident_id,
      JSON.stringify(data.route),
      JSON.stringify(data.signal_timings),
      data.duration_minutes,
      CORRIDOR_STATUS.ACTIVATING,
      data.manual_override,
      data.activated_by
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  async _updateCorridorStatus(corridorId, status, additionalData = {}) {
    const updates = { status, updated_at: new Date() };
    
    if (additionalData.api_response) {
      updates.api_response = JSON.stringify(additionalData.api_response);
    }
    if (additionalData.signals_affected !== undefined) {
      updates.signals_affected = additionalData.signals_affected;
    }
    if (additionalData.estimated_time_savings_sec !== undefined) {
      updates.estimated_time_savings_sec = additionalData.estimated_time_savings_sec;
    }
    if (additionalData.deactivation_reason) {
      updates.deactivation_reason = additionalData.deactivation_reason;
      updates.deactivated_at = new Date();
    }
    if (additionalData.deactivated_by) {
      updates.deactivated_by = additionalData.deactivated_by;
    }

    const fields = Object.keys(updates);
    const setClause = fields.map((field, idx) => `${field} = $${idx + 2}`).join(', ');
    const values = [corridorId, ...fields.map(field => {
      const value = updates[field];
      return value instanceof Date ? value : value;
    })];

    const query = `UPDATE green_corridors SET ${setClause} WHERE corridor_id = $1 RETURNING *`;
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async _extendCorridor(corridorId, reason) {
    const corridor = await this._getCorridorById(corridorId);
    const newDuration = corridor.duration_minutes + 10; // Extend by 10 minutes

    await db.query(
      `UPDATE green_corridors SET duration_minutes = $1, updated_at = NOW() WHERE corridor_id = $2`,
      [newDuration, corridorId]
    );

    logger.info('Corridor extended', {
      corridor_id: corridorId,
      old_duration: corridor.duration_minutes,
      new_duration: newDuration,
      reason
    });

    return await this._getCorridorById(corridorId);
  }
}

module.exports = new CorridorService();
