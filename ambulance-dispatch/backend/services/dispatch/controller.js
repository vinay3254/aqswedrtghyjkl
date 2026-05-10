const DispatchService = require('./service');
const { AssignmentManager } = require('./assignment-manager');
const logger = require('../../api/utils/logger');
const { successResponse, errorResponse } = require('../../api/utils/response');

class DispatchController {
  static async createAssignment(req, res, next) {
    try {
      const { incident_id, ambulance_id, hospital_id, override_reason } = req.body;
      const dispatcher_id = req.user.id;

      if (!incident_id) {
        return errorResponse(res, 'incident_id is required', 400);
      }

      const options = {};
      if (ambulance_id) {
        options.ambulanceId = ambulance_id;
        options.override_reason = override_reason || 'Manual ambulance selection';
      }

      if (hospital_id) {
        options.hospitalId = hospital_id;
        options.override_reason = override_reason || 'Manual hospital selection';
      }

      const result = await DispatchService.createAssignment(incident_id, dispatcher_id, options);

      logger.info('Assignment created via API', {
        assignment_id: result.assignment.id,
        dispatcher_id,
      });

      return successResponse(res, result, 'Assignment created successfully', 201);
    } catch (error) {
      logger.error('Create assignment error', { error: error.message });
      return next(error);
    }
  }

  static async getAssignment(req, res, next) {
    try {
      const { id } = req.params;

      const assignment = await AssignmentManager.findById(id);

      return successResponse(res, assignment, 'Assignment retrieved successfully');
    } catch (error) {
      logger.error('Get assignment error', { error: error.message });
      return next(error);
    }
  }

  static async getActiveAssignments(req, res, next) {
    try {
      const assignments = await AssignmentManager.getActiveAssignments();

      return successResponse(res, {
        assignments,
        count: assignments.length,
      }, 'Active assignments retrieved successfully');
    } catch (error) {
      logger.error('Get active assignments error', { error: error.message });
      return next(error);
    }
  }

  static async getDriverAssignments(req, res, next) {
    try {
      const { driver_id } = req.params;
      const include_completed = req.query.include_completed === 'true';

      const assignments = await AssignmentManager.findByDriverId(driver_id, include_completed);

      return successResponse(res, {
        assignments,
        count: assignments.length,
      }, 'Driver assignments retrieved successfully');
    } catch (error) {
      logger.error('Get driver assignments error', { error: error.message });
      return next(error);
    }
  }

  static async acceptAssignment(req, res, next) {
    try {
      const { id } = req.params;
      const driver_id = req.user.id;

      const assignment = await DispatchService.acceptAssignment(id, driver_id);

      logger.info('Assignment accepted via API', {
        assignment_id: id,
        driver_id,
      });

      return successResponse(res, assignment, 'Assignment accepted successfully');
    } catch (error) {
      logger.error('Accept assignment error', { error: error.message });
      return next(error);
    }
  }

  static async rejectAssignment(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const driver_id = req.user.id;

      if (!reason) {
        return errorResponse(res, 'Rejection reason is required', 400);
      }

      const result = await DispatchService.rejectAssignment(id, driver_id, reason);

      logger.info('Assignment rejected via API', {
        assignment_id: id,
        driver_id,
        reason,
      });

      return successResponse(res, result, 'Assignment rejected successfully');
    } catch (error) {
      logger.error('Reject assignment error', { error: error.message });
      return next(error);
    }
  }

  static async reassignAmbulance(req, res, next) {
    try {
      const { id } = req.params;
      const { ambulance_id, reason } = req.body;
      const dispatcher_id = req.user.id;

      if (!ambulance_id) {
        return errorResponse(res, 'ambulance_id is required', 400);
      }

      if (!reason) {
        return errorResponse(res, 'Reason is required', 400);
      }

      const assignment = await DispatchService.reassignAmbulance(id, ambulance_id, reason, dispatcher_id);

      logger.info('Ambulance reassigned via API', {
        assignment_id: id,
        new_ambulance_id: ambulance_id,
        dispatcher_id,
      });

      return successResponse(res, assignment, 'Ambulance reassigned successfully');
    } catch (error) {
      logger.error('Reassign ambulance error', { error: error.message });
      return next(error);
    }
  }

  static async reassignHospital(req, res, next) {
    try {
      const { id } = req.params;
      const { hospital_id, reason } = req.body;
      const dispatcher_id = req.user.id;

      if (!hospital_id) {
        return errorResponse(res, 'hospital_id is required', 400);
      }

      if (!reason) {
        return errorResponse(res, 'Reason is required', 400);
      }

      const assignment = await DispatchService.reassignHospital(id, hospital_id, reason, dispatcher_id);

      logger.info('Hospital reassigned via API', {
        assignment_id: id,
        new_hospital_id: hospital_id,
        dispatcher_id,
      });

      return successResponse(res, assignment, 'Hospital reassigned successfully');
    } catch (error) {
      logger.error('Reassign hospital error', { error: error.message });
      return next(error);
    }
  }

  static async getAssignmentMetrics(req, res, next) {
    try {
      const metrics = await AssignmentManager.getMetrics();

      return successResponse(res, metrics, 'Assignment metrics retrieved successfully');
    } catch (error) {
      logger.error('Get assignment metrics error', { error: error.message });
      return next(error);
    }
  }
}

module.exports = DispatchController;
