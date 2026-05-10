const ambulanceService = require('./service');
const driverService = require('./driver-service');
const availabilityService = require('./availability');
const geospatialService = require('./geospatial');
const controller = require('./controller');
const routes = require('./routes');
const { AMBULANCE_TYPES, AMBULANCE_STATUS, SHIFT_STATUS, createTables } = require('./model');

module.exports = {
  ambulanceService,
  driverService,
  availabilityService,
  geospatialService,
  controller,
  routes,
  AMBULANCE_TYPES,
  AMBULANCE_STATUS,
  SHIFT_STATUS,
  createTables,
};
