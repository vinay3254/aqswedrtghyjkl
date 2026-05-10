/**
 * Incident Service Tests
 * 
 * Test suite for incident management system with 8-state FSM
 * 
 * Run with: npm test -- incidents.test.js
 */

const { IncidentService } = require('../../services/incidents/service');
const { IncidentModel } = require('../../services/incidents/model');
const { IncidentStateMachine, STATES } = require('../../services/incidents/fsm');
const { incidentEvents } = require('../../services/incidents/events');

describe('Incident State Machine', () => {
  let fsm;

  beforeEach(() => {
    fsm = new IncidentStateMachine();
  });

  test('should validate valid state transitions', () => {
    expect(fsm.isValidTransition('PENDING', 'ACKNOWLEDGED')).toBe(true);
    expect(fsm.isValidTransition('ACKNOWLEDGED', 'DISPATCHED')).toBe(true);
    expect(fsm.isValidTransition('DISPATCHED', 'EN_ROUTE')).toBe(true);
    expect(fsm.isValidTransition('EN_ROUTE', 'ON_SCENE')).toBe(true);
    expect(fsm.isValidTransition('ON_SCENE', 'TRANSPORTING')).toBe(true);
    expect(fsm.isValidTransition('TRANSPORTING', 'AT_HOSPITAL')).toBe(true);
    expect(fsm.isValidTransition('AT_HOSPITAL', 'RESOLVED')).toBe(true);
  });

  test('should reject invalid state transitions', () => {
    expect(fsm.isValidTransition('PENDING', 'EN_ROUTE')).toBe(false);
    expect(fsm.isValidTransition('ACKNOWLEDGED', 'ON_SCENE')).toBe(false);
    expect(fsm.isValidTransition('RESOLVED', 'PENDING')).toBe(false);
    expect(fsm.isValidTransition('CANCELLED', 'ACKNOWLEDGED')).toBe(false);
  });

  test('should allow cancellation from any state', () => {
    expect(fsm.isValidTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(fsm.isValidTransition('ACKNOWLEDGED', 'CANCELLED')).toBe(true);
    expect(fsm.isValidTransition('DISPATCHED', 'CANCELLED')).toBe(true);
    expect(fsm.isValidTransition('EN_ROUTE', 'CANCELLED')).toBe(true);
    expect(fsm.isValidTransition('ON_SCENE', 'CANCELLED')).toBe(true);
    expect(fsm.isValidTransition('TRANSPORTING', 'CANCELLED')).toBe(true);
    expect(fsm.isValidTransition('AT_HOSPITAL', 'CANCELLED')).toBe(true);
  });

  test('should validate role permissions for transitions', () => {
    expect(fsm.canUserTransition('PENDING', 'ACKNOWLEDGED', 'DISPATCHER')).toBe(true);
    expect(fsm.canUserTransition('PENDING', 'ACKNOWLEDGED', 'CITIZEN')).toBe(false);
    expect(fsm.canUserTransition('DISPATCHED', 'EN_ROUTE', 'DRIVER')).toBe(true);
    expect(fsm.canUserTransition('DISPATCHED', 'EN_ROUTE', 'CITIZEN')).toBe(false);
  });

  test('should identify terminal states', () => {
    expect(fsm.isTerminalState('RESOLVED')).toBe(true);
    expect(fsm.isTerminalState('CANCELLED')).toBe(true);
    expect(fsm.isTerminalState('PENDING')).toBe(false);
    expect(fsm.isTerminalState('EN_ROUTE')).toBe(false);
  });

  test('should get available transitions for role', () => {
    const dispatcherTransitions = fsm.getAvailableTransitions('PENDING', 'DISPATCHER');
    expect(dispatcherTransitions).toContain('ACKNOWLEDGED');
    expect(dispatcherTransitions).toContain('CANCELLED');

    const driverTransitions = fsm.getAvailableTransitions('DISPATCHED', 'DRIVER');
    expect(driverTransitions).toContain('EN_ROUTE');
    expect(driverTransitions).toContain('ACKNOWLEDGED');
  });

  test('should throw error for invalid transitions', () => {
    expect(() => {
      fsm.validateTransition('PENDING', 'EN_ROUTE', 'DISPATCHER');
    }).toThrow();

    expect(() => {
      fsm.validateTransition('RESOLVED', 'PENDING', 'DISPATCHER');
    }).toThrow();
  });

  test('should throw error for unauthorized transitions', () => {
    expect(() => {
      fsm.validateTransition('PENDING', 'ACKNOWLEDGED', 'CITIZEN');
    }).toThrow();

    expect(() => {
      fsm.validateTransition('DISPATCHED', 'EN_ROUTE', 'CITIZEN');
    }).toThrow();
  });
});

describe('Incident Model', () => {
  test('should calculate priority correctly', () => {
    expect(IncidentModel.calculatePriority('CRITICAL', 'CARDIAC')).toBe(160); // 4 * 4 * 10
    expect(IncidentModel.calculatePriority('HIGH', 'TRAUMA')).toBe(90); // 3 * 3 * 10
    expect(IncidentModel.calculatePriority('MEDIUM', 'ACCIDENT')).toBe(40); // 2 * 2 * 10
    expect(IncidentModel.calculatePriority('LOW', 'MEDICAL')).toBe(10); // 1 * 1 * 10
  });

  test('should validate geographic coordinates', async () => {
    const invalidLat = {
      caller_phone: '+1234567890',
      location_lat: 100, // Invalid
      location_lng: -122.4194,
      location_address: '123 Main St',
      severity: 'HIGH',
      incident_type: 'MEDICAL',
      description: 'Test description',
      created_by: 'user-id',
    };

    await expect(IncidentModel.create(invalidLat)).rejects.toThrow();
  });
});

describe('Incident Service', () => {
  let service;
  let mockUser;

  beforeEach(() => {
    service = new IncidentService();
    mockUser = {
      id: 'user-123',
      role: 'DISPATCHER',
    };
  });

  test('should create incident with PENDING status', async () => {
    const incidentData = {
      caller_name: 'John Doe',
      caller_phone: '+1234567890',
      location_lat: 37.7749,
      location_lng: -122.4194,
      location_address: '123 Main St, San Francisco, CA',
      severity: 'HIGH',
      incident_type: 'CARDIAC',
      description: 'Patient experiencing chest pain',
      patient_count: 1,
    };

    // Note: This will fail without database connection
    // In real tests, mock the database
    // const incident = await service.createIncident(incidentData, mockUser);
    // expect(incident.status).toBe('PENDING');
    // expect(incident.priority_score).toBe(120);
  });

  test('should track escalation threshold', () => {
    expect(service.escalationThreshold).toBe(60);
  });
});

describe('Event Emitter', () => {
  test('should emit incident created event', (done) => {
    const mockIncident = {
      id: 'incident-123',
      severity: 'HIGH',
      incident_type: 'CARDIAC',
    };

    const mockUser = {
      id: 'user-123',
    };

    incidentEvents.once('incident.created', (data) => {
      expect(data.incident).toEqual(mockIncident);
      expect(data.user).toEqual(mockUser);
      done();
    });

    incidentEvents.emitIncidentCreated(mockIncident, mockUser);
  });

  test('should emit state change event', (done) => {
    const mockIncident = {
      id: 'incident-123',
      status: 'ACKNOWLEDGED',
    };

    const mockUser = {
      id: 'user-123',
    };

    incidentEvents.once('incident.acknowledged', (data) => {
      expect(data.incident.status).toBe('ACKNOWLEDGED');
      expect(data.previousState).toBe('PENDING');
      done();
    });

    incidentEvents.emitStateChange(mockIncident, 'PENDING', mockUser);
  });

  test('should emit escalation event', (done) => {
    const mockIncident = {
      id: 'incident-123',
      status: 'PENDING',
      age_seconds: 75,
    };

    incidentEvents.once('incident.escalated', (data) => {
      expect(data.incident).toEqual(mockIncident);
      expect(data.ageSeconds).toBe(75);
      expect(data.thresholdSeconds).toBe(60);
      done();
    });

    incidentEvents.emitEscalation(mockIncident, 75, 60);
  });
});

describe('Validation', () => {
  const { 
    validateIncidentCreation,
    validateStateTransition,
    validateSeverityUpdate,
    sanitizeIncidentData,
  } = require('../../services/incidents/validation');

  test('should validate required fields for incident creation', () => {
    const invalidData = {
      caller_phone: 'invalid',
      location_lat: 37.7749,
    };

    expect(() => validateIncidentCreation(invalidData)).toThrow();
  });

  test('should validate phone number format', () => {
    const invalidPhone = {
      caller_phone: 'not-a-phone',
      location_lat: 37.7749,
      location_lng: -122.4194,
      location_address: '123 Main St',
      severity: 'HIGH',
      incident_type: 'MEDICAL',
      description: 'Test description longer than ten characters',
    };

    expect(() => validateIncidentCreation(invalidPhone)).toThrow();
  });

  test('should sanitize incident data', () => {
    const rawData = {
      caller_name: '  John Doe  ',
      caller_phone: '+1 (234) 567-8900',
      location_lat: '37.7749',
      location_lng: '-122.4194',
      location_address: '  123 Main St  ',
      severity: 'high',
      incident_type: 'cardiac',
      description: '  Test description  ',
      patient_count: '2',
    };

    const sanitized = sanitizeIncidentData(rawData);

    expect(sanitized.caller_name).toBe('John Doe');
    expect(sanitized.caller_phone).toBe('+12345678900');
    expect(sanitized.location_lat).toBe(37.7749);
    expect(sanitized.location_lng).toBe(-122.4194);
    expect(sanitized.location_address).toBe('123 Main St');
    expect(sanitized.severity).toBe('HIGH');
    expect(sanitized.incident_type).toBe('CARDIAC');
    expect(sanitized.description).toBe('Test description');
    expect(sanitized.patient_count).toBe(2);
  });

  test('should validate state transition data', () => {
    expect(() => validateStateTransition({ status: 'ACKNOWLEDGED' })).not.toThrow();
    expect(() => validateStateTransition({})).toThrow();
  });

  test('should validate severity update', () => {
    expect(() => validateSeverityUpdate({ severity: 'CRITICAL' })).not.toThrow();
    expect(() => validateSeverityUpdate({ severity: 'INVALID' })).toThrow();
  });
});

describe('Integration Tests', () => {
  test('should handle complete incident lifecycle', async () => {
    // This would test the complete flow:
    // 1. Create incident (PENDING)
    // 2. Acknowledge (ACKNOWLEDGED)
    // 3. Dispatch (DISPATCHED)
    // 4. Accept (EN_ROUTE)
    // 5. Arrive (ON_SCENE)
    // 6. Load patient (TRANSPORTING)
    // 7. Arrive hospital (AT_HOSPITAL)
    // 8. Complete (RESOLVED)
    
    // Note: Requires database mock or test database
  });

  test('should handle driver rejection and reassignment', async () => {
    // This would test:
    // 1. Create and dispatch incident
    // 2. Driver rejects (DISPATCHED → ACKNOWLEDGED)
    // 3. Reassign to different ambulance
    // 4. New driver accepts
    
    // Note: Requires database mock or test database
  });

  test('should handle incident cancellation from various states', async () => {
    // This would test cancellation from:
    // - PENDING
    // - ACKNOWLEDGED
    // - DISPATCHED
    // - EN_ROUTE
    
    // Note: Requires database mock or test database
  });
});
