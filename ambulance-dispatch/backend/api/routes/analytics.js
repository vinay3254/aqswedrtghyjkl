const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { successResponse } = require('../utils/response');
const axios = require('axios');
const config = require('../config/config');

router.get(
  '/dashboard',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const params = { startDate, endDate };

    const response = await axios.get(
      `${config.services.analytics}/api/dashboard`,
      { params, timeout: 10000 }
    );

    successResponse(res, response.data, 'Dashboard data retrieved successfully');
  })
);

router.get(
  '/incidents/stats',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(async (req, res) => {
    const { period = '7d' } = req.query;

    const response = await axios.get(
      `${config.services.analytics}/api/incidents/stats`,
      { params: { period }, timeout: 10000 }
    );

    successResponse(res, response.data, 'Incident statistics retrieved successfully');
  })
);

router.get(
  '/response-times',
  authenticateToken,
  checkRole('admin', 'dispatcher'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const params = { startDate, endDate, groupBy };

    const response = await axios.get(
      `${config.services.analytics}/api/response-times`,
      { params, timeout: 10000 }
    );

    successResponse(res, response.data, 'Response time analytics retrieved successfully');
  })
);

router.get(
  '/performance',
  authenticateToken,
  checkRole('admin'),
  asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const response = await axios.get(
      `${config.services.analytics}/api/performance`,
      { params: { period }, timeout: 10000 }
    );

    successResponse(res, response.data, 'Performance metrics retrieved successfully');
  })
);

module.exports = router;
