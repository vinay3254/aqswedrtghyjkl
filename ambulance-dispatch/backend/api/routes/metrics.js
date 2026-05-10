const express = require('express');
const router = express.Router();
const { successResponse } = require('../utils/response');
const metrics = require('../utils/metrics');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

router.get(
  '/',
  authenticateToken,
  checkRole('admin'),
  (req, res) => {
    const metricsData = metrics.getMetrics();
    successResponse(res, metricsData, 'Metrics retrieved successfully');
  }
);

router.post(
  '/reset',
  authenticateToken,
  checkRole('admin'),
  (req, res) => {
    metrics.resetMetrics();
    successResponse(res, null, 'Metrics reset successfully');
  }
);

module.exports = router;
