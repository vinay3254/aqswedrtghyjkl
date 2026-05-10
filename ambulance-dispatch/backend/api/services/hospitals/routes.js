const express = require('express');
const router = express.Router();
const hospitalController = require('./controller');

// Middleware placeholders (should be implemented in your auth system)
const authenticate = (req, res, next) => next();
const authorize = (...roles) => (req, res, next) => next();

// Hospital management (ADMIN only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  hospitalController.createHospital
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HOSPITAL_STAFF'),
  hospitalController.updateHospital
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  hospitalController.deleteHospital
);

// Public/Dispatcher endpoints
router.get(
  '/',
  hospitalController.getAllHospitals
);

router.get(
  '/nearby',
  authenticate,
  authorize('DISPATCHER', 'PARAMEDIC'),
  hospitalController.getNearbyHospitals
);

router.post(
  '/find-optimal',
  authenticate,
  authorize('DISPATCHER'),
  hospitalController.findOptimalHospital
);

router.get(
  '/:id',
  hospitalController.getHospitalById
);

// Capacity management (HOSPITAL_STAFF)
router.put(
  '/:id/beds',
  authenticate,
  authorize('HOSPITAL_STAFF', 'ADMIN'),
  hospitalController.updateBedAvailability
);

router.get(
  '/:id/capacity',
  authenticate,
  hospitalController.getCapacityUtilization
);

router.post(
  '/:id/beds/reserve',
  authenticate,
  authorize('DISPATCHER'),
  hospitalController.reserveBed
);

router.post(
  '/beds/release',
  authenticate,
  authorize('DISPATCHER', 'HOSPITAL_STAFF'),
  hospitalController.releaseBedReservation
);

// Specialist management (HOSPITAL_STAFF)
router.put(
  '/:id/specialists',
  authenticate,
  authorize('HOSPITAL_STAFF', 'ADMIN'),
  hospitalController.updateSpecialistAvailability
);

// Blood bank management (HOSPITAL_STAFF)
router.put(
  '/:id/blood-bank',
  authenticate,
  authorize('HOSPITAL_STAFF', 'ADMIN'),
  hospitalController.updateBloodInventory
);

router.get(
  '/:id/blood-availability',
  authenticate,
  hospitalController.checkBloodAvailability
);

router.get(
  '/blood/find',
  authenticate,
  authorize('DISPATCHER'),
  hospitalController.findHospitalsWithBlood
);

// Patient acceptance/rejection (HOSPITAL_STAFF)
router.post(
  '/:id/accept-patient',
  authenticate,
  authorize('HOSPITAL_STAFF'),
  hospitalController.acceptPatient
);

router.post(
  '/:id/reject-patient',
  authenticate,
  authorize('HOSPITAL_STAFF'),
  hospitalController.rejectPatient
);

// Pre-arrival alerts (DISPATCHER sends, HOSPITAL_STAFF receives)
router.post(
  '/:id/alerts',
  authenticate,
  authorize('DISPATCHER'),
  hospitalController.sendPreArrivalAlert
);

router.get(
  '/:id/alerts',
  authenticate,
  authorize('HOSPITAL_STAFF'),
  hospitalController.getHospitalAlerts
);

router.post(
  '/:id/alerts/acknowledge',
  authenticate,
  authorize('HOSPITAL_STAFF'),
  hospitalController.acknowledgeAlert
);

router.get(
  '/:id/alerts/statistics',
  authenticate,
  authorize('HOSPITAL_STAFF', 'ADMIN'),
  hospitalController.getAlertStatistics
);

module.exports = router;
