const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.post('/', controller.createAmbulance);

router.get('/', controller.getAmbulances);

router.get('/available', controller.getAvailableAmbulances);

router.get('/nearby', controller.getNearbyAmbulances);

router.get('/stats', controller.getAvailabilityStats);

router.get('/low-fuel', controller.getLowFuelAmbulances);

router.get('/coverage', controller.getCoverageMap);

router.post('/find-optimal', controller.findOptimalAmbulance);

router.get('/:id', controller.getAmbulanceById);

router.put('/:id', controller.updateAmbulance);

router.put('/:id/status', controller.updateAmbulanceStatus);

router.put('/:id/location', controller.updateAmbulanceLocation);

router.put('/:id/fuel', controller.updateFuelLevel);

router.get('/:id/history', controller.getAmbulanceStatusHistory);

router.delete('/:id', controller.deleteAmbulance);

router.post('/drivers', controller.createDriver);

router.get('/drivers/on-duty', controller.getOnDutyDrivers);

router.post('/drivers/assign', controller.assignDriver);

router.get('/drivers/:id', controller.getDriver);

router.post('/drivers/:id/shift/start', controller.startDriverShift);

router.post('/drivers/:id/shift/end', controller.endDriverShift);

router.put('/drivers/:id/location', controller.updateDriverLocation);

module.exports = router;
