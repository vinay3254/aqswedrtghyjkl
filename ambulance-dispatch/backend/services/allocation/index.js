const { AllocationService } = require('./service');
const { AllocationController } = require('./controller');
const { HospitalScorer, WEIGHTS, SPECIALIST_REQUIREMENTS, CAPABILITY_REQUIREMENTS } = require('./hospital-scorer');
const { HospitalFilters, FILTER_REASONS } = require('./filters');
const { TransparencyService } = require('./transparency');

module.exports = {
  AllocationService,
  AllocationController,
  HospitalScorer,
  HospitalFilters,
  TransparencyService,
  WEIGHTS,
  SPECIALIST_REQUIREMENTS,
  CAPABILITY_REQUIREMENTS,
  FILTER_REASONS,
};
