const { IncidentService } = require('./service');
const { IncidentModel, SEVERITY_LEVELS, INCIDENT_TYPES } = require('./model');
const { IncidentStateMachine, STATES, VALID_TRANSITIONS } = require('./fsm');
const { incidentEvents } = require('./events');
const controller = require('./controller');

module.exports = {
  IncidentService,
  IncidentModel,
  IncidentStateMachine,
  incidentEvents,
  SEVERITY_LEVELS,
  INCIDENT_TYPES,
  STATES,
  VALID_TRANSITIONS,
  controller,
};
