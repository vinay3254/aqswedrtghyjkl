const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, hospitalValidation } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { successResponse } = require('../utils/response');
const axios = require('axios');
const config = require('../config/config');

router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, specialty } = req.query;
    
    const params = { page, limit, specialty };
    
    const response = await axios.get(
      `${config.services.hospital}/api/hospitals`,
      { params, timeout: 5000 }
    );

    successResponse(res, response.data, 'Hospitals retrieved successfully');
  })
);

router.get(
  '/nearby',
  authenticateToken,
  validate(hospitalValidation.nearby),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10, specialty } = req.query;
    
    const params = { 
      latitude, 
      longitude, 
      radius,
      specialty
    };
    
    const response = await axios.get(
      `${config.services.hospital}/api/hospitals/nearby`,
      { params, timeout: 5000 }
    );

    successResponse(res, response.data, 'Nearby hospitals retrieved successfully');
  })
);

router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const response = await axios.get(
      `${config.services.hospital}/api/hospitals/${id}`,
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Hospital retrieved successfully');
  })
);

router.get(
  '/:id/capacity',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const response = await axios.get(
      `${config.services.hospital}/api/hospitals/${id}/capacity`,
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Hospital capacity retrieved successfully');
  })
);

router.put(
  '/:id/capacity',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const response = await axios.put(
      `${config.services.hospital}/api/hospitals/${id}/capacity`,
      req.body,
      { timeout: 5000 }
    );

    successResponse(res, response.data, 'Hospital capacity updated successfully');
  })
);

module.exports = router;
