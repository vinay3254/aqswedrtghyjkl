const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { successResponse } = require('../utils/response');
const axios = require('axios');
const config = require('../config/config');

router.get(
  '/locations/:vehicleId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    const { startTime, endTime } = req.query;

    const params = { startTime, endTime };

    const response = await axios.get(
      `${config.services.tracking}/api/locations/${vehicleId}`,
      { params, timeout: 5000 }
    );

    successResponse(res, response.data, 'Location history retrieved successfully');
  })
);

router.get(
  '/live/:vehicleId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;

    const response = await axios.get(
      `${config.services.tracking}/api/live/${vehicleId}`,
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Live location retrieved successfully');
  })
);

router.get(
  '/route/:assignmentId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { assignmentId } = req.params;

    const response = await axios.get(
      `${config.services.tracking}/api/route/${assignmentId}`,
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Route information retrieved successfully');
  })
);

module.exports = router;
