const service = require('./service');
const { successResponse } = require('../../utils/response');

const createIncident = async (req, res) => {
  const incident = await service.createIncident(req.body, req.user?.userId);
  successResponse(res, incident, 'Incident created', 201);
};

const getIncident = async (req, res) => {
  const incident = await service.getIncident(req.params.id);
  successResponse(res, incident, 'Incident retrieved');
};

const listIncidents = async (req, res) => {
  const result = await service.listIncidents(req.query);
  successResponse(res, result, 'Incidents retrieved');
};

const getActiveIncidents = async (req, res) => {
  const incidents = await service.getActiveIncidents();
  successResponse(res, incidents, 'Active incidents retrieved');
};

const updateIncidentStatus = async (req, res) => {
  const { status } = req.body;
  const incident = await service.updateIncidentStatus(req.params.id, status, req.user?.userId, req.user?.role);
  successResponse(res, incident, 'Status updated');
};

const updateIncidentSeverity = async (req, res) => {
  const { severity } = req.body;
  const incident = await service.updateIncidentSeverity(req.params.id, severity);
  successResponse(res, incident, 'Severity updated');
};

const assignHospital = async (req, res) => {
  const { hospitalId } = req.body;
  const incident = await service.assignHospital(req.params.id, hospitalId);
  successResponse(res, incident, 'Hospital assigned');
};

const getAvailableTransitions = async (req, res) => {
  const incident = await service.getIncident(req.params.id);
  const transitions = service.getAvailableTransitions(incident);
  successResponse(res, transitions, 'Transitions retrieved');
};

const checkEscalations = async (req, res) => {
  const escalations = await service.checkEscalations();
  successResponse(res, escalations, 'Escalations retrieved');
};

const getIncidentMetrics = async (req, res) => {
  const metrics = await service.getIncidentMetrics();
  successResponse(res, metrics, 'Metrics retrieved');
};

const getIncidentAuditLog = async (req, res) => {
  const log = await service.getIncidentAuditLog(req.params.id);
  successResponse(res, log, 'Audit log retrieved');
};

module.exports = { createIncident, getIncident, listIncidents, getActiveIncidents, updateIncidentStatus, updateIncidentSeverity, assignHospital, getAvailableTransitions, checkEscalations, getIncidentMetrics, getIncidentAuditLog };
