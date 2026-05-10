const { ValidationError } = require('../../api/utils/errors');

const STATES = {
  PENDING: 'PENDING',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  DISPATCHED: 'DISPATCHED',
  EN_ROUTE: 'EN_ROUTE',
  ON_SCENE: 'ON_SCENE',
  TRANSPORTING: 'TRANSPORTING',
  AT_HOSPITAL: 'AT_HOSPITAL',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
};

const VALID_TRANSITIONS = {
  PENDING: ['ACKNOWLEDGED', 'CANCELLED'],
  ACKNOWLEDGED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['EN_ROUTE', 'ACKNOWLEDGED', 'CANCELLED'],
  EN_ROUTE: ['ON_SCENE', 'CANCELLED'],
  ON_SCENE: ['TRANSPORTING', 'CANCELLED'],
  TRANSPORTING: ['AT_HOSPITAL', 'CANCELLED'],
  AT_HOSPITAL: ['RESOLVED', 'CANCELLED'],
  RESOLVED: [],
  CANCELLED: [],
};

const ROLE_PERMISSIONS = {
  PENDING: {
    ACKNOWLEDGED: ['DISPATCHER', 'ADMIN'],
    CANCELLED: ['DISPATCHER', 'ADMIN'],
  },
  ACKNOWLEDGED: {
    DISPATCHED: ['DISPATCHER', 'ADMIN'],
    CANCELLED: ['DISPATCHER', 'ADMIN'],
  },
  DISPATCHED: {
    EN_ROUTE: ['DRIVER', 'DISPATCHER', 'ADMIN'],
    ACKNOWLEDGED: ['DRIVER', 'DISPATCHER', 'ADMIN'],
    CANCELLED: ['DISPATCHER', 'ADMIN'],
  },
  EN_ROUTE: {
    ON_SCENE: ['DRIVER', 'DISPATCHER', 'ADMIN'],
    CANCELLED: ['DISPATCHER', 'ADMIN'],
  },
  ON_SCENE: {
    TRANSPORTING: ['DRIVER', 'DISPATCHER', 'ADMIN'],
    CANCELLED: ['DISPATCHER', 'ADMIN'],
  },
  TRANSPORTING: {
    AT_HOSPITAL: ['DRIVER', 'DISPATCHER', 'ADMIN'],
    CANCELLED: ['DISPATCHER', 'ADMIN'],
  },
  AT_HOSPITAL: {
    RESOLVED: ['DRIVER', 'DISPATCHER', 'ADMIN'],
    CANCELLED: ['DISPATCHER', 'ADMIN'],
  },
};

const STATE_DESCRIPTIONS = {
  PENDING: 'Emergency call received, waiting for acknowledgment',
  ACKNOWLEDGED: 'Dispatcher acknowledged, selecting ambulance',
  DISPATCHED: 'Ambulance assigned, waiting for driver acceptance',
  EN_ROUTE: 'Driver accepted, ambulance moving to scene',
  ON_SCENE: 'Ambulance arrived at incident location',
  TRANSPORTING: 'Patient loaded, moving to hospital',
  AT_HOSPITAL: 'Arrived at hospital, patient handoff in progress',
  RESOLVED: 'Incident complete, ambulance available',
  CANCELLED: 'Incident cancelled',
};

class IncidentStateMachine {
  constructor() {
    this.states = STATES;
    this.validTransitions = VALID_TRANSITIONS;
    this.rolePermissions = ROLE_PERMISSIONS;
  }

  isValidState(state) {
    return Object.values(STATES).includes(state);
  }

  isValidTransition(currentState, newState) {
    if (!this.isValidState(currentState) || !this.isValidState(newState)) {
      return false;
    }
    return VALID_TRANSITIONS[currentState]?.includes(newState) || false;
  }

  canUserTransition(currentState, newState, userRole) {
    if (!this.isValidTransition(currentState, newState)) {
      return false;
    }

    const allowedRoles = ROLE_PERMISSIONS[currentState]?.[newState] || [];
    return allowedRoles.includes(userRole);
  }

  validateTransition(currentState, newState, userRole) {
    if (!this.isValidState(currentState)) {
      throw new ValidationError(`Invalid current state: ${currentState}`);
    }

    if (!this.isValidState(newState)) {
      throw new ValidationError(`Invalid new state: ${newState}`);
    }

    if (currentState === newState) {
      throw new ValidationError('Cannot transition to the same state');
    }

    if (!this.isValidTransition(currentState, newState)) {
      throw new ValidationError(
        `Invalid state transition: ${currentState} → ${newState}`,
        [{
          field: 'status',
          message: `Cannot transition from ${currentState} to ${newState}`,
          validTransitions: VALID_TRANSITIONS[currentState],
        }]
      );
    }

    if (!this.canUserTransition(currentState, newState, userRole)) {
      throw new ValidationError(
        `User role '${userRole}' not authorized for transition: ${currentState} → ${newState}`,
        [{
          field: 'authorization',
          message: `Role '${userRole}' cannot perform this transition`,
          allowedRoles: ROLE_PERMISSIONS[currentState][newState],
        }]
      );
    }

    return true;
  }

  getAvailableTransitions(currentState, userRole) {
    if (!this.isValidState(currentState)) {
      return [];
    }

    const possibleTransitions = VALID_TRANSITIONS[currentState] || [];
    
    return possibleTransitions.filter(newState => {
      const allowedRoles = ROLE_PERMISSIONS[currentState]?.[newState] || [];
      return allowedRoles.includes(userRole);
    });
  }

  getStateDescription(state) {
    return STATE_DESCRIPTIONS[state] || 'Unknown state';
  }

  isTerminalState(state) {
    return state === STATES.RESOLVED || state === STATES.CANCELLED;
  }

  requiresAmbulanceAssignment(state) {
    return state === STATES.DISPATCHED || 
           state === STATES.EN_ROUTE || 
           state === STATES.ON_SCENE || 
           state === STATES.TRANSPORTING || 
           state === STATES.AT_HOSPITAL;
  }

  requiresHospitalAssignment(state) {
    return state === STATES.TRANSPORTING || state === STATES.AT_HOSPITAL;
  }
}

module.exports = {
  IncidentStateMachine,
  STATES,
  VALID_TRANSITIONS,
  ROLE_PERMISSIONS,
  STATE_DESCRIPTIONS,
};
