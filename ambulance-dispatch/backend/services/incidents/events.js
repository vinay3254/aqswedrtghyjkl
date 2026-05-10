const EventEmitter = require('events');
const logger = require('../../api/utils/logger');
const { STATES } = require('./fsm');

class IncidentEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.on('incident.created', this.handleIncidentCreated.bind(this));
    this.on('incident.acknowledged', this.handleIncidentAcknowledged.bind(this));
    this.on('incident.dispatched', this.handleIncidentDispatched.bind(this));
    this.on('incident.en_route', this.handleIncidentEnRoute.bind(this));
    this.on('incident.on_scene', this.handleIncidentOnScene.bind(this));
    this.on('incident.transporting', this.handleIncidentTransporting.bind(this));
    this.on('incident.at_hospital', this.handleIncidentAtHospital.bind(this));
    this.on('incident.resolved', this.handleIncidentResolved.bind(this));
    this.on('incident.cancelled', this.handleIncidentCancelled.bind(this));
    this.on('incident.severity_changed', this.handleSeverityChanged.bind(this));
    this.on('incident.escalated', this.handleIncidentEscalated.bind(this));
  }

  async handleIncidentCreated(data) {
    const { incident, user } = data;
    
    logger.info('Incident created', {
      incidentId: incident.id,
      severity: incident.severity,
      type: incident.incident_type,
      location: { lat: incident.location_lat, lng: incident.location_lng },
      userId: user?.id,
    });

    // TODO: Notify all active dispatchers
    // TODO: Send SMS/Push notification to on-call dispatcher
    // TODO: Log to analytics system
  }

  async handleIncidentAcknowledged(data) {
    const { incident, previousState, user, reason } = data;
    
    logger.info('Incident acknowledged', {
      incidentId: incident.id,
      previousState,
      dispatcherId: user?.id,
      reason,
    });

    // TODO: Stop escalation timer
    // TODO: Notify optimization worker to start finding best ambulance
    // TODO: Update dispatcher dashboard
    // TODO: Send acknowledgment to caller if phone provided
  }

  async handleIncidentDispatched(data) {
    const { incident, previousState, user, ambulanceId } = data;
    
    logger.info('Incident dispatched', {
      incidentId: incident.id,
      ambulanceId,
      previousState,
      dispatcherId: user?.id,
    });

    // TODO: Notify assigned driver (SMS/Push)
    // TODO: Start acceptance timeout (30 seconds)
    // TODO: Update ambulance status to 'ASSIGNED'
    // TODO: Create assignment record
    // TODO: Send ETA calculation request to routing service
  }

  async handleIncidentEnRoute(data) {
    const { incident, previousState, user } = data;
    
    logger.info('Ambulance en route', {
      incidentId: incident.id,
      ambulanceId: incident.ambulance_id,
      previousState,
      driverId: user?.id,
    });

    // TODO: Start ETA tracking
    // TODO: Enable real-time location tracking
    // TODO: Notify incident caller with ambulance ETA
    // TODO: Update dispatcher dashboard with live tracking
    // TODO: Send incident details to driver mobile app
  }

  async handleIncidentOnScene(data) {
    const { incident, previousState, user } = data;
    
    logger.info('Ambulance on scene', {
      incidentId: incident.id,
      ambulanceId: incident.ambulance_id,
      previousState,
      driverId: user?.id,
    });

    // TODO: Stop location tracking (already at scene)
    // TODO: Notify hospital to prepare (10 min warning)
    // TODO: Send patient assessment form to driver
    // TODO: Alert dispatcher of scene arrival
    // TODO: Update incident timeline
  }

  async handleIncidentTransporting(data) {
    const { incident, previousState, user, hospitalId } = data;
    
    logger.info('Patient being transported', {
      incidentId: incident.id,
      ambulanceId: incident.ambulance_id,
      hospitalId: hospitalId || incident.hospital_id,
      previousState,
      driverId: user?.id,
    });

    // TODO: Resume real-time location tracking to hospital
    // TODO: Calculate and send hospital ETA
    // TODO: Send patient vitals/assessment to hospital
    // TODO: Notify hospital emergency department
    // TODO: Request bed/room preparation
  }

  async handleIncidentAtHospital(data) {
    const { incident, previousState, user } = data;
    
    logger.info('Arrived at hospital', {
      incidentId: incident.id,
      ambulanceId: incident.ambulance_id,
      hospitalId: incident.hospital_id,
      previousState,
      driverId: user?.id,
    });

    // TODO: Stop location tracking
    // TODO: Initiate patient handoff process
    // TODO: Generate handoff report
    // TODO: Notify hospital staff of arrival
    // TODO: Start handoff timer (max 15 minutes)
  }

  async handleIncidentResolved(data) {
    const { incident, previousState, user, reason } = data;
    
    const responseTime = incident.resolved_at 
      ? new Date(incident.resolved_at) - new Date(incident.created_at)
      : null;

    logger.info('Incident resolved', {
      incidentId: incident.id,
      ambulanceId: incident.ambulance_id,
      previousState,
      userId: user?.id,
      reason,
      responseTimeMs: responseTime,
    });

    // TODO: Update ambulance status to 'AVAILABLE'
    // TODO: Close assignment record
    // TODO: Generate incident report
    // TODO: Calculate performance metrics
    // TODO: Send completion notification to dispatcher
    // TODO: Log to analytics/billing system
    // TODO: Request driver to complete post-incident form
  }

  async handleIncidentCancelled(data) {
    const { incident, previousState, user, reason } = data;
    
    logger.warn('Incident cancelled', {
      incidentId: incident.id,
      ambulanceId: incident.ambulance_id,
      previousState,
      userId: user?.id,
      reason,
    });

    // TODO: If ambulance assigned, return to available status
    // TODO: Close assignment record
    // TODO: Notify all involved parties
    // TODO: Log cancellation reason for analytics
    // TODO: Update dispatcher dashboard
    // TODO: Send cancellation confirmation to caller if possible
  }

  async handleSeverityChanged(data) {
    const { incident, oldSeverity, newSeverity, user } = data;
    
    logger.info('Incident severity changed', {
      incidentId: incident.id,
      oldSeverity,
      newSeverity,
      oldPriority: incident.priority_score,
      userId: user?.id,
    });

    // TODO: Re-prioritize in dispatch queue
    // TODO: If upgraded to CRITICAL, alert all dispatchers
    // TODO: If downgraded, may trigger reassignment
    // TODO: Update optimization worker with new priority
  }

  async handleIncidentEscalated(data) {
    const { incident, ageSeconds, thresholdSeconds } = data;
    
    logger.warn('Incident escalated due to timeout', {
      incidentId: incident.id,
      severity: incident.severity,
      ageSeconds,
      thresholdSeconds,
      status: incident.status,
    });

    // TODO: Send urgent notification to supervisor/manager
    // TODO: Highlight incident on dispatcher dashboard
    // TODO: Auto-upgrade severity if stuck too long
    // TODO: Send SMS alert to on-call manager
    // TODO: Log escalation for compliance/audit
  }

  emitStateChange(incident, previousState, user, additionalData = {}) {
    const eventName = `incident.${incident.status.toLowerCase()}`;
    
    this.emit(eventName, {
      incident,
      previousState,
      user,
      timestamp: new Date(),
      ...additionalData,
    });

    this.emit('incident.state_changed', {
      incident,
      previousState,
      newState: incident.status,
      user,
      timestamp: new Date(),
      ...additionalData,
    });
  }

  emitIncidentCreated(incident, user) {
    this.emit('incident.created', {
      incident,
      user,
      timestamp: new Date(),
    });
  }

  emitSeverityChanged(incident, oldSeverity, newSeverity, user) {
    this.emit('incident.severity_changed', {
      incident,
      oldSeverity,
      newSeverity,
      user,
      timestamp: new Date(),
    });
  }

  emitEscalation(incident, ageSeconds, thresholdSeconds) {
    this.emit('incident.escalated', {
      incident,
      ageSeconds,
      thresholdSeconds,
      timestamp: new Date(),
    });
  }
}

const incidentEvents = new IncidentEventEmitter();

module.exports = {
  IncidentEventEmitter,
  incidentEvents,
};
