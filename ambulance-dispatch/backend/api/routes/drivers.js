const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { AuthorizationError } = require('../utils/errors');
const { successResponse } = require('../utils/response');
const axios = require('axios');
const config = require('../config/config');

router.get(
  '/',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    
    const params = { status, page, limit };
    
    const response = await axios.get(
      `${config.services.ambulance}/api/drivers`,
      { params, timeout: 5000 }
    );

    successResponse(res, response.data, 'Drivers retrieved successfully');
  })
);

router.get(
  '/me',
  authenticateToken,
  checkRole('driver'),
  asyncHandler(async (req, res) => {
    const response = await axios.get(
      `${config.services.ambulance}/api/drivers/${req.user.userId}`,
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Driver profile retrieved successfully');
  })
);

router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const response = await axios.get(
      `${config.services.ambulance}/api/drivers/${id}`,
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Driver retrieved successfully');
  })
);

router.put(
  '/:id/status',
  authenticateToken,
  checkRole('driver', 'admin', 'dispatcher'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (req.user.role === 'driver' && id !== req.user.userId) {
      throw new AuthorizationError('You can only update your own status');
    }

    const response = await axios.put(
      `${config.services.ambulance}/api/drivers/${id}/status`,
      { status, updatedBy: req.user.userId },
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Driver status updated successfully');
  })
);

router.get(
  '/:id/assignments',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    if (req.user.role === 'driver' && id !== req.user.userId) {
      throw new AuthorizationError('You can only view your own assignments');
    }

    const params = { driverId: id, status, page, limit };

    const response = await axios.get(
      `${config.services.incident}/api/assignments`,
      { params, timeout: 5000 }
    );

    successResponse(res, response.data, 'Driver assignments retrieved successfully');
  })
);

module.exports = router;
