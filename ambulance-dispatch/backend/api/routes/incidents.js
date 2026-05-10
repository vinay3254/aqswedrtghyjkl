const express = require('express');
const router = express.Router();
const controller = require('../../services/incidents/controller');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

// Public/Citizen endpoints - Create and view own incidents
router.post('/', authenticateToken, asyncHandler(controller.createIncident));
router.get('/:id', authenticateToken, asyncHandler(controller.getIncident));

// Dispatcher/Admin endpoints - List and manage all incidents
router.get('/', authenticateToken, checkRole('DISPATCHER', 'ADMIN'), asyncHandler(controller.listIncidents));
router.get('/active/list', authenticateToken, checkRole('DISPATCHER', 'ADMIN'), asyncHandler(controller.getActiveIncidents));
router.get('/metrics/stats', authenticateToken, checkRole('DISPATCHER', 'ADMIN'), asyncHandler(controller.getIncidentMetrics));
router.get('/escalations/check', authenticateToken, checkRole('DISPATCHER', 'ADMIN'), asyncHandler(controller.checkEscalations));

// State management - Role-based permissions enforced in controller
router.put('/:id/status', authenticateToken, asyncHandler(controller.updateIncidentStatus));
router.put('/:id/severity', authenticateToken, checkRole('DISPATCHER', 'ADMIN'), asyncHandler(controller.updateIncidentSeverity));
router.put('/:id/hospital', authenticateToken, checkRole('DISPATCHER', 'ADMIN'), asyncHandler(controller.assignHospital));
router.get('/:id/transitions', authenticateToken, asyncHandler(controller.getAvailableTransitions));
router.get('/:id/audit', authenticateToken, checkRole('DISPATCHER', 'ADMIN'), asyncHandler(controller.getIncidentAuditLog));

module.exports = router;
