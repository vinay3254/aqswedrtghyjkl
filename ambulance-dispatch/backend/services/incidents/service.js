const { IncidentStateMachine, STATES } = require('./fsm');
const { IncidentModel } = require('./model');
const { incidentEvents } = require('./events');
const {
  validateIncidentCreation,
  validateStateTransition,
  validateSeverityUpdate,
  sanitizeIncidentData,
} = require('./validation');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../api/utils/errors');
const db = require('../../api/config/database');
const logger = require('../../api/utils/logger');

class IncidentService {
  constructor() {
    this.fsm = new IncidentStateMachine();
    this.escalationThreshold = 60; // seconds
  }

  async createIncident(incidentData, user) {
    validateIncidentCreation(incidentData);
    const sanitizedData = sanitizeIncidentData(incidentData);

    sanitizedData.created_by = user.id;

    const incident = await IncidentModel.create(sanitizedData);

    await this.logStateChange(incident.id, null, STATES.PENDING, user.id, 'Incident created');

    incidentEvents.emitIncidentCreated(incident, user);

    logger.info('Incident created successfully', {
      incidentId: incident.id,
      severity: incident.severity,
      type: incident.incident_type,
      userId: user.id,
    });

    return incident;
  }

  async getIncidentById(id, user) {
    const incident = await IncidentModel.findById(id);

    if (user.role === 'CITIZEN' && incident.created_by !== user.id) {
      throw new AuthorizationError('You can only view incidents you created');
    }

    return incident;
  }

  async listIncidents(filters = {}, user) {
    if (user.role === 'CITIZEN') {
      filters.created_by = user.id;
    }

    const incidents = await IncidentModel.findAll(filters);
    return incidents;
  }

  async getActiveIncidents(user) {
    if (user.role === 'CITIZEN') {
      throw new AuthorizationError('Only dispatchers and admins can view all active incidents');
    }

    const incidents = await IncidentModel.getActiveIncidents();
    return incidents;
  }

  async transitionState(incidentId, newState, user, reason = null) {
    validateStateTransition({ status: newState, reason });

    return await db.transaction(async (client) => {
      const incident = await IncidentModel.findById(incidentId);
      const currentState = incident.status;

      if (user.role === 'CITIZEN' && incident.created_by !== user.id) {
        throw new AuthorizationError('You can only modify incidents you created');
      }

      this.fsm.validateTransition(currentState, newState, user.role);

      if (this.fsm.requiresAmbulanceAssignment(newState) && !incident.ambulance_id) {
        if (newState !== STATES.DISPATCHED) {
          throw new ValidationError(
            `Cannot transition to ${newState} without ambulance assignment`
          );
        }
      }

      if (this.fsm.requiresHospitalAssignment(newState) && !incident.hospital_id) {
        if (newState === STATES.AT_HOSPITAL) {
          throw new ValidationError(
            'Cannot transition to AT_HOSPITAL without hospital assignment'
          );
        }
      }

      const updatedIncident = await IncidentModel.updateStatus(incidentId, newState, user.id);

      await this.logStateChange(incidentId, currentState, newState, user.id, reason);

      incidentEvents.emitStateChange(updatedIncident, currentState, user, { reason });

      logger.info('Incident state transitioned', {
        incidentId,
        from: currentState,
        to: newState,
        userId: user.id,
        reason,
      });

      return updatedIncident;
    });
  }

  async updateSeverity(incidentId, severity, user, reason = null) {
    validateSeverityUpdate({ severity, reason });

    const incident = await IncidentModel.findById(incidentId);

    if (user.role === 'CITIZEN') {
      throw new AuthorizationError('Only dispatchers and admins can update severity');
    }

    if (this.fsm.isTerminalState(incident.status)) {
      throw new ValidationError('Cannot update severity of resolved or cancelled incident');
    }

    const oldSeverity = incident.severity;
    const updatedIncident = await IncidentModel.updateSeverity(incidentId, severity, user.id);

    await this.logSeverityChange(incidentId, oldSeverity, severity, user.id, reason);

    incidentEvents.emitSeverityChanged(updatedIncident, oldSeverity, severity, user);

    logger.info('Incident severity updated', {
      incidentId,
      from: oldSeverity,
      to: severity,
      userId: user.id,
      reason,
    });

    return updatedIncident;
  }

  async assignHospital(incidentId, hospitalId, user) {
    const incident = await IncidentModel.findById(incidentId);

    if (user.role !== 'DISPATCHER' && user.role !== 'ADMIN') {
      throw new AuthorizationError('Only dispatchers and admins can assign hospitals');
    }

    if (incident.status !== STATES.ON_SCENE && incident.status !== STATES.TRANSPORTING) {
      throw new ValidationError('Hospital can only be assigned when on scene or transporting');
    }

    const updatedIncident = await IncidentModel.assignHospital(incidentId, hospitalId, user.id);

    logger.info('Hospital assigned to incident', {
      incidentId,
      hospitalId,
      userId: user.id,
    });

    return updatedIncident;
  }

  async getAvailableTransitions(incidentId, user) {
    const incident = await IncidentModel.findById(incidentId);
    const availableTransitions = this.fsm.getAvailableTransitions(incident.status, user.role);

    return {
      currentState: incident.status,
      availableTransitions: availableTransitions.map(state => ({
        state,
        description: this.fsm.getStateDescription(state),
      })),
    };
  }

  async checkEscalations() {
    const pendingIncidents = await IncidentModel.getPendingEscalations(this.escalationThreshold);

    for (const incident of pendingIncidents) {
      incidentEvents.emitEscalation(incident, incident.age_seconds, this.escalationThreshold);

      logger.warn('Incident escalated', {
        incidentId: incident.id,
        ageSeconds: incident.age_seconds,
        severity: incident.severity,
      });
    }

    return pendingIncidents;
  }

  async getMetrics() {
    const metrics = await IncidentModel.getMetrics();
    return {
      ...metrics,
      avg_response_time_minutes: metrics.avg_response_time_seconds 
        ? parseFloat((metrics.avg_response_time_seconds / 60).toFixed(2))
        : null,
      avg_acknowledgment_time_seconds: metrics.avg_acknowledgment_time_seconds 
        ? parseFloat(metrics.avg_acknowledgment_time_seconds.toFixed(2))
        : null,
    };
  }

  async logStateChange(incidentId, previousState, newState, userId, reason) {
    const query = `
      INSERT INTO incident_audit_log (
        incident_id, previous_state, new_state, changed_by, reason, changed_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `;

    await db.query(query, [incidentId, previousState, newState, userId, reason]);
  }

  async logSeverityChange(incidentId, oldSeverity, newSeverity, userId, reason) {
    const query = `
      INSERT INTO incident_audit_log (
        incident_id, action_type, old_value, new_value, changed_by, reason, changed_at
      ) VALUES ($1, 'SEVERITY_CHANGE', $2, $3, $4, $5, NOW())
    `;

    await db.query(query, [incidentId, oldSeverity, newSeverity, userId, reason]);
  }

  async getAuditLog(incidentId) {
    const query = `
      SELECT 
        id,
        incident_id,
        previous_state,
        new_state,
        action_type,
        old_value,
        new_value,
        changed_by,
        reason,
        changed_at
      FROM incident_audit_log
      WHERE incident_id = $1
      ORDER BY changed_at DESC
    `;

    const result = await db.query(query, [incidentId]);
    return result.rows;
  }
}

module.exports = {
  IncidentService,
};
