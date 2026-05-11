const service = require('./service');
const assignmentManager = require('./assignment-manager');
const { successResponse } = require('../../utils/response');

const createAssignment = async (req, res) => {
  const assignment = await service.createAssignment(req.body, req.user?.userId);
  successResponse(res, assignment, 'Assignment created', 201);
};

const getAssignment = async (req, res) => {
  const assignment = await assignmentManager.findById(req.params.id);
  successResponse(res, assignment, 'Assignment retrieved');
};

const getActiveAssignments = async (req, res) => {
  const assignments = await assignmentManager.getActiveAssignments();
  successResponse(res, assignments, 'Active assignments retrieved');
};

const getDriverAssignments = async (req, res) => {
  const assignments = await assignmentManager.findByDriverId(req.params.driver_id);
  successResponse(res, assignments, 'Driver assignments retrieved');
};

const getAssignmentMetrics = async (req, res) => {
  const metrics = await assignmentManager.getMetrics();
  successResponse(res, metrics, 'Metrics retrieved');
};

const acceptAssignment = async (req, res) => {
  const assignment = await service.acceptAssignment(req.params.id, req.user?.userId);
  successResponse(res, assignment, 'Assignment accepted');
};

const rejectAssignment = async (req, res) => {
  const assignment = await service.rejectAssignment(req.params.id, req.user?.userId);
  successResponse(res, assignment, 'Assignment rejected');
};

const reassignAmbulance = async (req, res) => {
  const assignment = await service.reassignAmbulance(req.params.id, req.body.ambulanceId);
  successResponse(res, assignment, 'Ambulance reassigned');
};

const reassignHospital = async (req, res) => {
  const assignment = await service.reassignHospital(req.params.id, req.body.hospitalId);
  successResponse(res, assignment, 'Hospital reassigned');
};

module.exports = { createAssignment, getAssignment, getActiveAssignments, getDriverAssignments, getAssignmentMetrics, acceptAssignment, rejectAssignment, reassignAmbulance, reassignHospital };
