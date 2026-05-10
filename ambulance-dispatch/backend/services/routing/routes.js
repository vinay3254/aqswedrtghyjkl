const express = require('express');
const router = express.Router();
const controller = require('./controller');

// Route calculation endpoints
router.post('/calculate', controller.calculateRoute);
router.post('/eta', controller.calculateETA);
router.post('/alternative', controller.getAlternativeRoutes);
router.post('/distance', controller.calculateDistance);
router.post('/batch', controller.batchCalculate);

// Traffic endpoints
router.get('/traffic/predict', controller.getTrafficPrediction);
router.get('/traffic/current', controller.getCurrentTraffic);

// Health and cache management
router.get('/health', controller.getHealth);
router.delete('/cache', controller.clearCache);

module.exports = router;
