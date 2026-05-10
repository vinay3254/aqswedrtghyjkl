const db = require('../../api/config/database');
const logger = require('../../api/utils/logger');
const { ValidationError, NotFoundError } = require('../../api/utils/errors');
const AmbulanceSelector = require('./ambulance-selector');
const HospitalScorer = require('./hospital-scorer');
const { AssignmentManager, ASSIGNMENT_STATES } = require('./assignment-manager');
const NotificationService = require('./notifications');

class DispatchService {
  static async createAssignment(incidentId, dispatcherId, options = {}) {
    try {
      const incident = await db.query(
        'SELECT * FROM incidents WHERE id = $1',
        [incidentId]
      );

      if (incident.rows.length === 0) {
        throw new NotFoundError(`Incident ${incidentId} not found`);
      }

      const incidentData = incident.rows[0];

      if (incidentData.status !== 'ACKNOWLEDGED') {
        throw new ValidationError('Incident must be in ACKNOWLEDGED status to dispatch');
      }

      let selectedAmbulance;
      if (options.ambulanceId) {
        const ambulance = await db.query(
          'SELECT * FROM ambulances WHERE id = $1',
          [options.ambulanceId]
        );

        if (ambulance.rows.length === 0) {
          throw new NotFoundError(`Ambulance ${options.ambulanceId} not found`);
        }

        selectedAmbulance = ambulance.rows[0];
        selectedAmbulance.distance_km = AmbulanceSelector.calculateDistance(
          selectedAmbulance.current_location_lat,
          selectedAmbulance.current_location_lng,
          incidentData.location_lat,
          incidentData.location_lng
        );
        selectedAmbulance.travel_time_minutes = AmbulanceSelector.estimateTravelTime(selectedAmbulance.distance_km);
        
        logger.info('Manual ambulance selection', {
          ambulance_id: options.ambulanceId,
          reason: options.override_reason,
        });
      } else {
        selectedAmbulance = await AmbulanceSelector.selectBestAmbulance(
          incidentData.location_lat,
          incidentData.location_lng,
          incidentData.severity
        );

        if (!selectedAmbulance) {
          throw new ValidationError('No available ambulances found');
        }
      }

      let selectedHospital;
      let hospitalOptions = [];

      if (options.hospitalId) {
        const hospital = await db.query(
          'SELECT * FROM hospitals WHERE id = $1',
          [options.hospitalId]
        );

        if (hospital.rows.length === 0) {
          throw new NotFoundError(`Hospital ${options.hospitalId} not found`);
        }

        selectedHospital = HospitalScorer.scoreHospital(
          hospital.rows[0],
          incidentData.incident_type,
          incidentData.severity,
          incidentData.location_lat,
          incidentData.location_lng
        );

        logger.info('Manual hospital selection', {
          hospital_id: options.hospitalId,
          reason: options.override_reason,
        });
      } else {
        hospitalOptions = await HospitalScorer.selectBestHospitals(
          incidentData.incident_type,
          incidentData.severity,
          incidentData.location_lat,
          incidentData.location_lng,
          3
        );

        if (hospitalOptions.length === 0) {
          throw new ValidationError('No available hospitals found');
        }

        selectedHospital = hospitalOptions[0];
      }

      const ambulanceReasoning = options.ambulanceId
        ? `Manually selected: ${options.override_reason || 'No reason provided'}`
        : AmbulanceSelector.generateAmbulanceReasoning(selectedAmbulance);

      const hospitalReasoning = options.hospitalId
        ? `Manually selected: ${options.override_reason || 'No reason provided'}`
        : HospitalScorer.generateHospitalReasoning(selectedHospital);

      const routeInfo = {
        ambulance_to_incident: {
          distance_km: selectedAmbulance.distance_km,
          estimated_time_minutes: selectedAmbulance.travel_time_minutes,
        },
        incident_to_hospital: {
          distance_km: selectedHospital.distance_km,
          estimated_time_minutes: selectedHospital.travel_time_minutes,
        },
        total_estimated_time_minutes: selectedAmbulance.travel_time_minutes + selectedHospital.travel_time_minutes,
      };

      const client = await db.getClient();

      try {
        await client.query('BEGIN');

        const assignment = await this.createAssignmentInTransaction(client, {
          incident_id: incidentId,
          ambulance_id: selectedAmbulance.id,
          hospital_id: selectedHospital.hospital_id,
          dispatcher_id: dispatcherId,
          ambulance_reasoning: ambulanceReasoning,
          hospital_reasoning: hospitalReasoning,
          auto_selected: !options.ambulanceId && !options.hospitalId,
          override_reason: options.override_reason,
          estimated_arrival_time: selectedAmbulance.travel_time_minutes,
          route_info: routeInfo,
        });

        await client.query(
          `UPDATE ambulances SET status = 'DISPATCHED' WHERE id = $1`,
          [selectedAmbulance.id]
        );

        await client.query(
          `UPDATE incidents SET 
            status = 'DISPATCHED', 
            hospital_id = $1,
            dispatched_at = NOW(),
            updated_at = NOW(),
            updated_by = $2
          WHERE id = $3`,
          [selectedHospital.hospital_id, dispatcherId, incidentId]
        );

        await this.logAudit(client, {
          entity_type: 'ASSIGNMENT',
          entity_id: assignment.id,
          action: 'CREATE',
          user_id: dispatcherId,
          details: `Assignment created. Ambulance: ${selectedAmbulance.vehicle_number}, Hospital: ${selectedHospital.hospital_name}`,
        });

        await client.query('COMMIT');

        await NotificationService.notifyDriver(assignment, 'NEW_ASSIGNMENT');

        logger.info('Dispatch completed successfully', {
          assignment_id: assignment.id,
          incident_id: incidentId,
          ambulance_id: selectedAmbulance.id,
          hospital_id: selectedHospital.hospital_id,
        });

        return {
          assignment,
          ambulance: selectedAmbulance,
          hospital: selectedHospital,
          hospital_options: hospitalOptions.length > 0 ? hospitalOptions : [selectedHospital],
          route_info: routeInfo,
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Dispatch failed', {
        incident_id: incidentId,
        error: error.message,
      });
      throw error;
    }
  }

  static async createAssignmentInTransaction(client, data) {
    const query = `
      INSERT INTO assignments (
        incident_id, ambulance_id, hospital_id, dispatcher_id,
        status, ambulance_reasoning, hospital_reasoning,
        auto_selected, override_reason, estimated_arrival_time,
        route_info, assigned_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
      RETURNING *
    `;

    const result = await client.query(query, [
      data.incident_id,
      data.ambulance_id,
      data.hospital_id,
      data.dispatcher_id,
      ASSIGNMENT_STATES.PENDING,
      data.ambulance_reasoning,
      data.hospital_reasoning,
      data.auto_selected,
      data.override_reason,
      data.estimated_arrival_time,
      JSON.stringify(data.route_info),
    ]);

    return result.rows[0];
  }

  static async acceptAssignment(assignmentId, driverId) {
    const assignment = await AssignmentManager.findById(assignmentId);

    if (assignment.status !== ASSIGNMENT_STATES.PENDING) {
      throw new ValidationError('Assignment must be in PENDING status to accept');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const updatedAssignment = await this.updateAssignmentStatusInTransaction(
        client,
        assignmentId,
        ASSIGNMENT_STATES.ACCEPTED,
        driverId
      );

      await client.query(
        `UPDATE incidents SET 
          status = 'EN_ROUTE',
          en_route_at = NOW(),
          updated_at = NOW(),
          updated_by = $1
        WHERE id = $2`,
        [driverId, assignment.incident_id]
      );

      await this.logAudit(client, {
        entity_type: 'ASSIGNMENT',
        entity_id: assignmentId,
        action: 'ACCEPT',
        user_id: driverId,
        details: 'Driver accepted assignment',
      });

      await client.query('COMMIT');

      logger.info('Assignment accepted', {
        assignment_id: assignmentId,
        driver_id: driverId,
      });

      return updatedAssignment;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async rejectAssignment(assignmentId, driverId, reason) {
    const assignment = await AssignmentManager.findById(assignmentId);

    if (assignment.status !== ASSIGNMENT_STATES.PENDING) {
      throw new ValidationError('Assignment must be in PENDING status to reject');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE assignments SET 
          status = $1,
          rejection_reason = $2,
          rejected_at = NOW(),
          updated_at = NOW(),
          updated_by = $3
        WHERE id = $4`,
        [ASSIGNMENT_STATES.REJECTED, reason, driverId, assignmentId]
      );

      await client.query(
        `UPDATE ambulances SET status = 'AVAILABLE' WHERE id = $1`,
        [assignment.ambulance_id]
      );

      await this.logAudit(client, {
        entity_type: 'ASSIGNMENT',
        entity_id: assignmentId,
        action: 'REJECT',
        user_id: driverId,
        details: `Driver rejected assignment. Reason: ${reason}`,
      });

      await client.query('COMMIT');

      logger.info('Assignment rejected', {
        assignment_id: assignmentId,
        driver_id: driverId,
        reason,
      });

      setTimeout(() => {
        this.handleRejection(assignment, driverId).catch(error => {
          logger.error('Error handling rejection', { error: error.message });
        });
      }, 2000);

      return { success: true, message: 'Assignment rejected' };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async handleRejection(assignment, driverId) {
    logger.info('Handling rejection, attempting reassignment', {
      incident_id: assignment.incident_id,
    });

    try {
      await this.createAssignment(assignment.incident_id, assignment.dispatcher_id, {
        excludeAmbulances: [assignment.ambulance_id],
      });
    } catch (error) {
      logger.error('Reassignment after rejection failed', {
        incident_id: assignment.incident_id,
        error: error.message,
      });
    }
  }

  static async reassignAmbulance(assignmentId, newAmbulanceId, reason, dispatcherId) {
    const assignment = await AssignmentManager.findById(assignmentId);

    if (assignment.status === ASSIGNMENT_STATES.COMPLETED) {
      throw new ValidationError('Cannot reassign completed assignment');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE ambulances SET status = 'AVAILABLE' WHERE id = $1`,
        [assignment.ambulance_id]
      );

      await client.query(
        `UPDATE ambulances SET status = 'DISPATCHED' WHERE id = $1`,
        [newAmbulanceId]
      );

      await client.query(
        `UPDATE assignments SET
          ambulance_id = $1,
          override_reason = $2,
          auto_selected = false,
          updated_at = NOW(),
          updated_by = $3
        WHERE id = $4`,
        [newAmbulanceId, reason, dispatcherId, assignmentId]
      );

      await this.logAudit(client, {
        entity_type: 'ASSIGNMENT',
        entity_id: assignmentId,
        action: 'REASSIGN_AMBULANCE',
        user_id: dispatcherId,
        details: `Ambulance reassigned. Old: ${assignment.ambulance_id}, New: ${newAmbulanceId}. Reason: ${reason}`,
      });

      await client.query('COMMIT');

      logger.info('Ambulance reassigned', {
        assignment_id: assignmentId,
        old_ambulance: assignment.ambulance_id,
        new_ambulance: newAmbulanceId,
      });

      return await AssignmentManager.findById(assignmentId);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async reassignHospital(assignmentId, newHospitalId, reason, dispatcherId) {
    const assignment = await AssignmentManager.findById(assignmentId);

    if (assignment.status === ASSIGNMENT_STATES.COMPLETED) {
      throw new ValidationError('Cannot reassign completed assignment');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE assignments SET
          hospital_id = $1,
          override_reason = CASE 
            WHEN override_reason IS NULL THEN $2
            ELSE override_reason || '; Hospital changed: ' || $2
          END,
          auto_selected = false,
          updated_at = NOW(),
          updated_by = $3
        WHERE id = $4`,
        [newHospitalId, reason, dispatcherId, assignmentId]
      );

      await client.query(
        `UPDATE incidents SET
          hospital_id = $1,
          updated_at = NOW(),
          updated_by = $2
        WHERE id = $3`,
        [newHospitalId, dispatcherId, assignment.incident_id]
      );

      await this.logAudit(client, {
        entity_type: 'ASSIGNMENT',
        entity_id: assignmentId,
        action: 'REASSIGN_HOSPITAL',
        user_id: dispatcherId,
        details: `Hospital reassigned. Old: ${assignment.hospital_id}, New: ${newHospitalId}. Reason: ${reason}`,
      });

      await client.query('COMMIT');

      logger.info('Hospital reassigned', {
        assignment_id: assignmentId,
        old_hospital: assignment.hospital_id,
        new_hospital: newHospitalId,
      });

      return await AssignmentManager.findById(assignmentId);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateAssignmentStatusInTransaction(client, assignmentId, status, userId) {
    const query = `
      UPDATE assignments SET
        status = $1,
        updated_at = NOW(),
        updated_by = $2,
        accepted_at = CASE WHEN $1 = 'ACCEPTED' THEN NOW() ELSE accepted_at END,
        rejected_at = CASE WHEN $1 = 'REJECTED' THEN NOW() ELSE rejected_at END,
        completed_at = CASE WHEN $1 = 'COMPLETED' THEN NOW() ELSE completed_at END
      WHERE id = $3
      RETURNING *
    `;

    const result = await client.query(query, [status, userId, assignmentId]);
    return result.rows[0];
  }

  static async logAudit(client, data) {
    const query = `
      INSERT INTO audit_log (
        entity_type, entity_id, action, user_id, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `;

    await client.query(query, [
      data.entity_type,
      data.entity_id,
      data.action,
      data.user_id,
      data.details,
    ]);
  }
}

module.exports = DispatchService;
