/**
 * Usage Examples - Mutual Aid & Escalation System
 * Demonstrates how to use each component
 */

const EscalationRules = require('./escalation-rules');
const MutualAidCoordinator = require('./mutual-aid-coordinator');
const MassCasualtyHandler = require('./mass-casualty-handler');
const ResourcePoolingManager = require('./resource-pooling');

// ============================================================================
// EXAMPLE 1: Basic Escalation Rules Usage
// ============================================================================

console.log('=== EXAMPLE 1: Escalation Rules ===\n');

// Initialize escalation rules
const escalationRules = new EscalationRules({
  localUnitThreshold: 0.85,      // 85% utilization
  mciDeclarationThreshold: 3,    // 3+ patients
  responseTimeThreshold: 15,     // 15 minutes
});

// Scenario: Check if escalation needed
const incidentData = {
  resourceStatus: {
    totalUnits: 10,
    availableUnits: 2,     // 80% utilized - high but not over threshold
  },
  incident: {
    patientCount: 2,       // Below MCI threshold
    severity: 'MODERATE',
  },
  averageResponseTime: 12,  // Within threshold
  pendingDispatches: 2,
};

const escalationCheck = escalationRules.determineEscalationLevel(incidentData);
console.log('Escalation Level:', escalationCheck.level);
console.log('Recommended:', escalationCheck.recommended);
console.log('Factors:', escalationCheck.factors);
console.log('');

// Scenario 2: MCI Declaration
const mciIncident = {
  resourceStatus: {
    totalUnits: 10,
    availableUnits: 2,
  },
  incident: {
    patientCount: 5,       // ABOVE MCI threshold
    severity: 'CRITICAL',
  },
  averageResponseTime: 18,  // Above threshold
  pendingDispatches: 5,
};

const mciEscalation = escalationRules.determineEscalationLevel(mciIncident);
console.log('MCI Escalation Level:', mciEscalation.level);
console.log('Recommended:', mciEscalation.recommended);
console.log('Factors:', mciEscalation.factors);
console.log('');

// ============================================================================
// EXAMPLE 2: Mass Casualty Incident Handler
// ============================================================================

console.log('=== EXAMPLE 2: Mass Casualty Handler ===\n');

const mciHandler = new MassCasualtyHandler();

// Declare MCI
const mciId = mciHandler.declareMCI({
  location: 'Highway 101 Mile Marker 42',
  incidentType: 'MOTOR_VEHICLE_ACCIDENT',
  estimatedPatients: 4,
  severity: 'HIGH',
  coordinates: { lat: 37.7749, lng: -122.4194 },
});

console.log('MCI Declared:', mciId);
console.log('');

// Register patients with triage
const patients = [
  {
    location: 'Scene - Vehicle 1',
    age: 45,
    gender: 'M',
    injuries: ['Chest trauma', 'Fractured ribs'],
    vitals: {
      respiratoryRate: 28,   // Fast
      capillaryRefill: 2.5,  // Delayed
      alertness: true,
    },
  },
  {
    location: 'Scene - Vehicle 1',
    age: 42,
    gender: 'F',
    injuries: ['Head injury', 'Laceration'],
    vitals: {
      respiratoryRate: 20,   // Normal
      capillaryRefill: 2.0,  // Normal
      alertness: false,      // Unalert
    },
  },
  {
    location: 'Scene - Vehicle 2',
    age: 62,
    gender: 'M',
    injuries: ['Multiple abrasions'],
    vitals: {
      respiratoryRate: 18,
      capillaryRefill: 2.0,
      alertness: true,
    },
  },
  {
    location: 'Scene - Vehicle 2',
    age: 8,
    gender: 'F',
    injuries: [],
    vitals: {
      respiratoryRate: 20,
      capillaryRefill: 2.0,
      alertness: true,
    },
  },
];

console.log('Registering patients with triage:');
patients.forEach((patient, index) => {
  const patientId = mciHandler.registerPatient(mciId, patient);
  console.log(`Patient ${index + 1}: ${patientId} - Triage: ${patient.vitals.respiratoryRate > 30 ? 'RED' : 'YELLOW/GREEN'}`);
});
console.log('');

// Get MCI status
const mciStatus = mciHandler.getMCIStatus(mciId);
console.log('MCI Status:');
console.log(`  Patients: ${mciStatus.registeredPatients}`);
console.log(`  Triage Breakdown - RED: ${mciStatus.triage.red}, YELLOW: ${mciStatus.triage.yellow}, GREEN: ${mciStatus.triage.green}`);
console.log('');

// ============================================================================
// EXAMPLE 3: Mutual Aid Coordinator
// ============================================================================

console.log('=== EXAMPLE 3: Mutual Aid Coordinator ===\n');

const maidCoordinator = new MutualAidCoordinator();

// Register neighboring districts
maidCoordinator.registerDistrict('DIST-A', {
  name: 'District A',
  location: { lat: 37.7749, lng: -122.4194 },
});

maidCoordinator.registerDistrict('DIST-B', {
  name: 'District B',
  location: { lat: 37.7849, lng: -122.4094 },
});

maidCoordinator.registerDistrict('DIST-C', {
  name: 'District C',
  location: { lat: 37.7849, lng: -122.4294 },
});

// Request mutual aid
(async () => {
  try {
    console.log('Requesting mutual aid...');
    const response = await maidCoordinator.requestMutualAid({
      incidentId: 'INC-2024-00001',
      location: { lat: 37.7749, lng: -122.4194 },
      requiredUnits: 2,
      patientCount: 4,
      severity: 'CRITICAL',
      reason: 'MCI declared - insufficient local resources',
    });

    console.log('Request Status:', response);
    console.log('');

    // Simulate responses from districts
    setTimeout(() => {
      console.log('Handling district responses...');

      // District A responds positively
      const resp1 = maidCoordinator.handleDistrictResponse(response.requestId, {
        districtId: 'DIST-A',
        availableUnits: 2,
        estimatedArrival: 8,
        status: 'ACCEPTED',
      });
      console.log('District A Response:', resp1);

      // District B declines
      const resp2 = maidCoordinator.handleDistrictResponse(response.requestId, {
        districtId: 'DIST-B',
        availableUnits: 0,
        status: 'DECLINED',
        notes: 'No units available',
      });
      console.log('District B Response:', resp2);

      // Check request status
      const status = maidCoordinator.getRequestStatus(response.requestId);
      console.log('Final Request Status:');
      console.log(`  Confirmed Units: ${status.confirmedUnits}`);
      console.log(`  Request Status: ${status.status}`);
      console.log('');
    }, 100);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

// ============================================================================
// EXAMPLE 4: Resource Pooling Manager
// ============================================================================

console.log('=== EXAMPLE 4: Resource Pooling Manager ===\n');

const poolingManager = new ResourcePoolingManager({
  poolingStrategy: 'DYNAMIC',
});

// Register jurisdictions in pool
poolingManager.registerJurisdiction('LOCAL-DISTRICT', {
  name: 'Local District',
  location: { lat: 37.7749, lng: -122.4194 },
  baseUnits: ['AMB-001', 'AMB-002', 'AMB-003', 'AMB-004'],
  resourceCapacity: 100,
  region: 'Bay Area',
});

poolingManager.registerJurisdiction('NORTH-DISTRICT', {
  name: 'North District',
  location: { lat: 37.8849, lng: -122.4194 },
  baseUnits: ['AMB-101', 'AMB-102', 'AMB-103'],
  resourceCapacity: 100,
  region: 'Bay Area',
});

poolingManager.registerJurisdiction('SOUTH-DISTRICT', {
  name: 'South District',
  location: { lat: 37.6749, lng: -122.4194 },
  baseUnits: ['AMB-201', 'AMB-202', 'AMB-203', 'AMB-204', 'AMB-205'],
  resourceCapacity: 100,
  region: 'Bay Area',
});

// Set jurisdiction loads
console.log('Setting jurisdiction loads...');
poolingManager.updateJurisdictionLoad('LOCAL-DISTRICT', 80);   // 80% utilized
poolingManager.updateJurisdictionLoad('NORTH-DISTRICT', 40);   // 40% utilized
poolingManager.updateJurisdictionLoad('SOUTH-DISTRICT', 30);   // 30% utilized
console.log('');

// Request resources
(async () => {
  try {
    console.log('Requesting pooled resources...');
    const allocation = await poolingManager.requestPooledResources(
      'LOCAL-DISTRICT',
      {
        unitType: 'AMBULANCE',
        requiredCount: 2,
        reason: 'MCI Response',
        duration: 3600000, // 1 hour
      }
    );

    console.log('Allocation Result:');
    console.log(`  Allocation ID: ${allocation.allocationId}`);
    console.log(`  Allocated Units: ${allocation.allocatedUnits}`);
    console.log(`  Expires At: ${allocation.expiresAt}`);
    console.log('');

    // Get pool status
    const poolStatus = poolingManager.getPoolStatus();
    console.log('Pool Status:');
    console.log(`  Total Jurisdictions: ${poolStatus.totalJurisdictions}`);
    console.log(`  Active Allocations: ${poolStatus.activeAllocations}`);
    poolStatus.jurisdictions.forEach((j) => {
      console.log(`  ${j.name}: ${(j.utilization * 100).toFixed(1)}% utilized`);
    });
    console.log('');

    // Return resources
    setTimeout(() => {
      console.log('Returning resources...');
      const returnResult = poolingManager.returnResources(allocation.allocationId);
      console.log('Return Result:', returnResult);
    }, 5000);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

// ============================================================================
// EXAMPLE 5: Complete Integrated Workflow
// ============================================================================

console.log('=== EXAMPLE 5: Integrated Workflow ===\n');

async function completeWorkflow() {
  console.log('STEP 1: Incident Reported');
  console.log('  Multi-vehicle accident on highway');
  console.log('  Initial report: 4 patients\n');

  console.log('STEP 2: Check Escalation');
  const escalation = escalationRules.determineEscalationLevel({
    resourceStatus: { totalUnits: 10, availableUnits: 2 },
    incident: { patientCount: 4, severity: 'CRITICAL' },
    averageResponseTime: 18,
    pendingDispatches: 4,
  });
  console.log(`  Escalation Level: ${escalation.level}`);
  console.log(`  Recommended: ${escalation.recommended}\n`);

  console.log('STEP 3: Declare MCI');
  const newMciId = mciHandler.declareMCI({
    location: 'Highway 101, Mile 42',
    incidentType: 'MOTOR_VEHICLE_ACCIDENT',
    estimatedPatients: 4,
    severity: 'CRITICAL',
  });
  console.log(`  MCI ID: ${newMciId}\n`);

  console.log('STEP 4: Register Patients');
  // Register 4 patients
  console.log(`  Patients registered: 4\n`);

  console.log('STEP 5: Request Mutual Aid');
  try {
    const maidResponse = await maidCoordinator.requestMutualAid({
      incidentId: newMciId,
      location: { lat: 37.7749, lng: -122.4194 },
      requiredUnits: 2,
      patientCount: 4,
      severity: 'CRITICAL',
    });
    console.log(`  Request ID: ${maidResponse.requestId}`);
    console.log(`  Districts Contacted: ${maidResponse.districtsContacted}\n`);
  } catch (error) {
    console.log(`  Note: ${error.message}\n`);
  }

  console.log('STEP 6: Request Pooled Resources');
  try {
    const poolResponse = await poolingManager.requestPooledResources(
      'LOCAL-DISTRICT',
      {
        unitType: 'AMBULANCE',
        requiredCount: 2,
        reason: 'MCI response',
      }
    );
    console.log(`  Allocation ID: ${poolResponse.allocationId}`);
    console.log(`  Units Allocated: ${poolResponse.allocatedUnits}\n`);
  } catch (error) {
    console.log(`  Note: ${error.message}\n`);
  }

  console.log('STEP 7: Transport Patients');
  console.log('  Patient transport initiated in priority order');
  console.log('  RED patients transported first\n');

  console.log('STEP 8: Close MCI');
  console.log('  All patients transported');
  console.log('  Mutual aid units released\n');

  console.log('WORKFLOW COMPLETE\n');
}

// Run integrated workflow
setTimeout(() => {
  completeWorkflow().catch(console.error);
}, 6000);

// ============================================================================
// EVENT LISTENERS EXAMPLE
// ============================================================================

console.log('=== Setting up Event Listeners ===\n');

escalationRules.on('mutual-aid-recommended', (data) => {
  console.log('[EVENT] Mutual Aid Recommended:', data);
});

maidCoordinator.on('mutual-aid-requested', (data) => {
  console.log('[EVENT] Mutual Aid Requested:', data);
});

maidCoordinator.on('mutual-aid-response', (data) => {
  console.log('[EVENT] Mutual Aid Response:', data);
});

mciHandler.on('mci-declared', (data) => {
  console.log('[EVENT] MCI Declared:', data);
});

mciHandler.on('patient-registered', (data) => {
  console.log('[EVENT] Patient Registered:', data);
});

poolingManager.on('resource-allocated', (data) => {
  console.log('[EVENT] Resources Allocated:', data);
});

poolingManager.on('resources-returned', (data) => {
  console.log('[EVENT] Resources Returned:', data);
});

module.exports = {
  escalationRules,
  mciHandler,
  maidCoordinator,
  poolingManager,
};
