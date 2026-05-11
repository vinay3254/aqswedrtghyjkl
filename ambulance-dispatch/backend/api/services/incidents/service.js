const incidentModel = require('./model');
const { NotFoundError, ValidationError } = require('../../utils/errors');

const VALID_TRANSITIONS = {
  REPORTED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['AT_SCENE', 'CANCELLED'],
  AT_SCENE: ['RESOLVED'],
  RESOLVED: [],
  CANCELLED: [],
};

const createIncident = async (data, userId) => {
  return incidentModel.create({ ...data, reportedBy: userId });
};

const getIncident = async (id) => {
  const incident = await incidentModel.findById(id);
  if (!incident) throw new NotFoundError('Incident not found');
  return incident;
};

const listIncidents = async (query) => incidentModel.findAll(query);

const getActiveIncidents = async () => incidentModel.getActiveIncidents();

const updateIncidentStatus = async (id, newStatus, userId, userRole) => {
  const incident = await incidentModel.findById(id);
  if (!incident) throw new NotFoundError('Incident not found');
  const allowed = VALID_TRANSITIONS[incident.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(`Cannot transition from ${incident.status} to ${newStatus}`);
  }
  return incidentModel.updateStatus(id, newStatus, userId);
};

const updateIncidentSeverity = async (id, severity) => {
  const incident = await incidentModel.findById(id);
  if (!incident) throw new NotFoundError('Incident not found');
  return incidentModel.updateSeverity(id, severity);
};

const assignHospital = async (id, hospitalId) => {
  const incident = await incidentModel.findById(id);
  if (!incident) throw new NotFoundError('Incident not found');
  return incidentModel.assignHospital(id, hospitalId);
};

const getAvailableTransitions = (incident) => VALID_TRANSITIONS[incident.status] || [];

const checkEscalations = async () => incidentModel.getPendingEscalations();

const getIncidentMetrics = async () => incidentModel.getMetrics();

const getIncidentAuditLog = async (id) => incidentModel.getAuditLog(id);

module.exports = { createIncident, getIncident, listIncidents, getActiveIncidents, updateIncidentStatus, updateIncidentSeverity, assignHospital, getAvailableTransitions, checkEscalations, getIncidentMetrics, getIncidentAuditLog };
