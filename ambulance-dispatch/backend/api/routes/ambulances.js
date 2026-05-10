const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, ambulanceValidation } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { successResponse } = require('../utils/response');
const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

router.get(
  '/',
  authenticateToken,
  validate(ambulanceValidation.list),
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    
    const params = { status, page, limit };
    
    const response = await axios.get(
      `${config.services.ambulance}/api/ambulances`,
      { params, timeout: 5000 }
    );

    successResponse(res, response.data, 'Ambulances retrieved successfully');
  })
);

router.get(
  '/available',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10 } = req.query;
    
    const params = { 
      status: 'available',
      latitude,
      longitude,
      radius
    };
    
    const response = await axios.get(
      `${config.services.ambulance}/api/ambulances/available`,
      { params, timeout: 5000 }
    );

    successResponse(res, response.data, 'Available ambulances retrieved successfully');
  })
);

router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const response = await axios.get(
      `${config.services.ambulance}/api/ambulances/${id}`,
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Ambulance retrieved successfully');
  })
);

router.put(
  '/:id/location',
  authenticateToken,
  checkRole('driver', 'dispatcher', 'admin'),
  validate(ambulanceValidation.updateLocation),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { latitude, longitude, heading, speed } = req.body;

    const locationData = {
      latitude,
      longitude,
      heading,
      speed,
      timestamp: new Date(),
      updatedBy: req.user.userId,
    };

    const response = await axios.put(
      `${config.services.ambulance}/api/ambulances/${id}/location`,
      locationData,
      { timeout: 5000 }
    );

    await axios.post(
      `${config.services.tracking}/api/locations`,
      {
        vehicleId: id,
        vehicleType: 'ambulance',
        ...locationData,
      },
      { timeout: 3000 }
    ).catch(err => logger.warn('Failed to update tracking service:', err.message));

    successResponse(res, response.data, 'Location updated successfully');
  })
);

router.put(
  '/:id/status',
  authenticateToken,
  checkRole('driver', 'dispatcher', 'admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const response = await axios.put(
      `${config.services.ambulance}/api/ambulances/${id}/status`,
      { status, updatedBy: req.user.userId },
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Ambulance status updated successfully');
  })
);

module.exports = router;
