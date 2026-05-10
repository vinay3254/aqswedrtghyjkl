const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const DispatchController = require('../../services/dispatch/controller');

router.post(
  '/',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(DispatchController.createAssignment)
);

router.get(
  '/active',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(DispatchController.getActiveAssignments)
);

router.get(
  '/driver/:driver_id',
  authenticateToken,
  checkRole('admin', 'dispatcher', 'driver'),
  asyncHandler(DispatchController.getDriverAssignments)
);

router.get(
  '/metrics',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(DispatchController.getAssignmentMetrics)
);

router.get(
  '/:id',
  authenticateToken,
  asyncHandler(DispatchController.getAssignment)
);

router.post(
  '/:id/accept',
  authenticateToken,
  checkRole('driver'),
  asyncHandler(DispatchController.acceptAssignment)
);

router.post(
  '/:id/reject',
  authenticateToken,
  checkRole('driver'),
  asyncHandler(DispatchController.rejectAssignment)
);

router.put(
  '/:id/ambulance',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(DispatchController.reassignAmbulance)
);

router.put(
  '/:id/hospital',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(DispatchController.reassignHospital)
);

module.exports = router;
