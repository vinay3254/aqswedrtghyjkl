const { IncidentService } = require('./service');
const { validateQueryParams } = require('./validation');
const { ValidationError } = require('../../api/utils/errors');
const logger = require('../../api/utils/logger');

const incidentService = new IncidentService();

const createIncident = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user || (user.role !== 'CITIZEN' && user.role !== 'DISPATCHER' && user.role !== 'ADMIN')) {
      throw new ValidationError('Only citizens, dispatchers, and admins can create incidents');
    }

    const incident = await incidentService.createIncident(req.body, user);

    res.status(201).json({
      success: true,
      data: incident,
      message: 'Incident created successfully',
    });
  } catch (error) {
    next(error);
  }
};

const getIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const incident = await incidentService.getIncidentById(id, user);

    res.status(200).json({
      success: true,
      data: incident,
    });
  } catch (error) {
    next(error);
  }
};

const listIncidents = async (req, res, next) => {
  try {
    const user = req.user;
    
    validateQueryParams(req.query);

    const filters = {
      status: req.query.status,
      severity: req.query.severity,
      incident_type: req.query.incident_type,
      active_only: req.query.active_only === 'true',
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
      offset: req.query.page ? (parseInt(req.query.page, 10) - 1) * (req.query.limit || 50) : 0,
    };

    const incidents = await incidentService.listIncidents(filters, user);

    res.status(200).json({
      success: true,
      data: incidents,
      count: incidents.length,
      filters,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveIncidents = async (req, res, next) => {
  try {
    const user = req.user;

    const incidents = await incidentService.getActiveIncidents(user);

    res.status(200).json({
      success: true,
      data: incidents,
      count: incidents.length,
    });
  } catch (error) {
    next(error);
  }
};

const updateIncidentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const user = req.user;

    if (!status) {
      throw new ValidationError('Status is required');
    }

    const incident = await incidentService.transitionState(id, status, user, reason);

    res.status(200).json({
      success: true,
      data: incident,
      message: `Incident status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

const updateIncidentSeverity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { severity, reason } = req.body;
    const user = req.user;

    if (!severity) {
      throw new ValidationError('Severity is required');
    }

    const incident = await incidentService.updateSeverity(id, severity, user, reason);

    res.status(200).json({
      success: true,
      data: incident,
      message: `Incident severity updated to ${severity}`,
    });
  } catch (error) {
    next(error);
  }
};

const assignHospital = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hospital_id } = req.body;
    const user = req.user;

    if (!hospital_id) {
      throw new ValidationError('Hospital ID is required');
    }

    const incident = await incidentService.assignHospital(id, hospital_id, user);

    res.status(200).json({
      success: true,
      data: incident,
      message: 'Hospital assigned successfully',
    });
  } catch (error) {
    next(error);
  }
};

const getAvailableTransitions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const transitions = await incidentService.getAvailableTransitions(id, user);

    res.status(200).json({
      success: true,
      data: transitions,
    });
  } catch (error) {
    next(error);
  }
};

const getIncidentMetrics = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.role !== 'DISPATCHER' && user.role !== 'ADMIN') {
      throw new ValidationError('Only dispatchers and admins can view metrics');
    }

    const metrics = await incidentService.getMetrics();

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

const getIncidentAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== 'DISPATCHER' && user.role !== 'ADMIN') {
      throw new ValidationError('Only dispatchers and admins can view audit logs');
    }

    const auditLog = await incidentService.getAuditLog(id);

    res.status(200).json({
      success: true,
      data: auditLog,
      count: auditLog.length,
    });
  } catch (error) {
    next(error);
  }
};

const checkEscalations = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.role !== 'DISPATCHER' && user.role !== 'ADMIN') {
      throw new ValidationError('Only dispatchers and admins can check escalations');
    }

    const escalatedIncidents = await incidentService.checkEscalations();

    res.status(200).json({
      success: true,
      data: escalatedIncidents,
      count: escalatedIncidents.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createIncident,
  getIncident,
  listIncidents,
  getActiveIncidents,
  updateIncidentStatus,
  updateIncidentSeverity,
  assignHospital,
  getAvailableTransitions,
  getIncidentMetrics,
  getIncidentAuditLog,
  checkEscalations,
};
