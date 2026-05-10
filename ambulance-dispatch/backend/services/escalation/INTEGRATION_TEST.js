/**
 * Integration Test - Mutual Aid & Escalation System
 * Demonstrates complete system integration and workflow
 */

const EscalationRules = require('./escalation-rules');
const MutualAidCoordinator = require('./mutual-aid-coordinator');
const MassCasualtyHandler = require('./mass-casualty-handler');
const ResourcePoolingManager = require('./resource-pooling');

/**
 * Complete Integration Test
 * Simulates a real-world incident from initial report to resolution
 */
class IntegrationTest {
  constructor() {
    this.escalationRules = new EscalationRules();
    this.maidCoordinator = new MutualAidCoordinator();
    this.mciHandler = new MassCasualtyHandler();
    this.poolingManager = new ResourcePoolingManager();

    this.setupEventListeners();
    this.setupJurisdictions();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Escalation events
    this.escalationRules.on('mutual-aid-recommended', (data) => {
      console.log('[ESCALATION] Mutual aid recommended:', data);
    });

    // Mutual aid events
    this.maidCoordinator.on('mutual-aid-requested', (data) => {
      console.log('[MUTUAL AID] Request sent to', data.districtsContacted, 'districts');
    });

    this.maidCoordinator.on('mutual-aid-response', (data) => {
      console.log('[MUTUAL AID] District', data.districtId, 'status:', data.status, 'units:', data.unitsAvailable);
    });

    // MCI events
    this.mciHandler.on('mci-declared', (data) => {
      console.log('[MCI] MCI Declared:', data.mciId, 'Location:', data.location);
    });

    this.mciHandler.on('patient-registered', (data) => {
      console.log('[MCI] Patient registered:', data.patientId, 'Triage:', data.triageCategory);
    });

    this.mciHandler.on('resource-deployed', (data) => {
      console.log('[MCI] Resource deployed:', data.unitId, 'Sector:', data.sector);
    });

    // Resource pooling events
    this.poolingManager.on('resource-allocated', (data) => {
      console.log('[POOL] Allocated', data.allocatedUnits, 'units from', data.sources, 'sources');
    });

    this.poolingManager.on('resources-returned', (data) => {
      console.log('[POOL] Returned', data.returnedUnits, 'units');
    });

    this.poolingManager.on('resources-rebalanced', (data) => {
      console.log('[POOL] Rebalanced', data.actions.length, 'resources');
    });
  }

  /**
   * Setup test jurisdictions
   */
  setupJurisdictions() {
    // Register local district
    this.poolingManager.registerJurisdiction('LOCAL-DIST', {
      name: 'Local District',
      location: { lat: 37.7749, lng: -122.4194 },
      baseUnits: ['AMB-001', 'AMB-002', 'AMB-003', 'AMB-004'],
      resourceCapacity: 100,
      region: 'Bay Area',
    });

    // Register neighboring districts for mutual aid
    this.maidCoordinator.registerDistrict('DIST-NORTH', {
      name: 'North District',
      location: { lat: 37.8849, lng: -122.4194 },
    });

    this.maidCoordinator.registerDistrict('DIST-SOUTH', {
      name: 'South District',
      location: { lat: 37.6749, lng: -122.4194 },
    });

    // Register same districts in pooling manager
    this.poolingManager.registerJurisdiction('DIST-NORTH', {
      name: 'North District',
      location: { lat: 37.8849, lng: -122.4194 },
      baseUnits: ['AMB-101', 'AMB-102', 'AMB-103'],
      resourceCapacity: 100,
      region: 'Bay Area',
    });

    this.poolingManager.registerJurisdiction('DIST-SOUTH', {
      name: 'South District',
      location: { lat: 37.6749, lng: -122.4194 },
      baseUnits: ['AMB-201', 'AMB-202', 'AMB-203', 'AMB-204'],
      resourceCapacity: 100,
      region: 'Bay Area',
    });
  }

  /**
   * Run complete incident simulation
   */
  async runScenario() {
    console.log('\n' + '='.repeat(70));
    console.log('INTEGRATION TEST: Multi-Vehicle Accident with MCI Response');
    console.log('='.repeat(70) + '\n');

    // Step 1: Initial incident report
    console.log('STEP 1: Incident Reported');
    console.log('-'.repeat(70));
    const incidentId = 'INC-2024-00001';
    console.log('Incident ID:', incidentId);
    console.log('Type: Multi-vehicle motor vehicle accident');
    console.log('Location: Highway 101, Mile Marker 42');
    console.log('Initial Report: 4 patients estimated\n');

    // Step 2: Resource status assessment
    console.log('STEP 2: Resource Status Assessment');
    console.log('-'.repeat(70));
    const resourceStatus = {
      totalUnits: 10,
      availableUnits: 2, // 80% utilized
    };
    console.log('Local units available:', resourceStatus.availableUnits, '/', resourceStatus.totalUnits);
    console.log('Utilization:', ((resourceStatus.totalUnits - resourceStatus.availableUnits) / resourceStatus.totalUnits * 100).toFixed(1) + '%\n');

    // Step 3: Escalation analysis
    console.log('STEP 3: Escalation Analysis');
    console.log('-'.repeat(70));
    const incidentData = {
      resourceStatus,
      incident: {
        patientCount: 4,
        severity: 'CRITICAL',
      },
      averageResponseTime: 18,
      pendingDispatches: 3,
    };

    const escalation = this.escalationRules.determineEscalationLevel(incidentData);
    console.log('Escalation Level:', escalation.level);
    console.log('Recommended:', escalation.recommended);
    console.log('Factors:', escalation.factors.length);
    escalation.factors.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.type}`);
    });
    console.log('');

    // Step 4: MCI Declaration
    console.log('STEP 4: MCI Declaration');
    console.log('-'.repeat(70));
    const mciId = this.mciHandler.declareMCI({
      location: 'Highway 101, Mile Marker 42',
      incidentType: 'MOTOR_VEHICLE_ACCIDENT',
      estimatedPatients: 4,
      severity: 'CRITICAL',
      coordinates: { lat: 37.7749, lng: -122.4194 },
    });
    console.log('MCI Declared: ' + mciId + '\n');

    // Step 5: Patient registration and triage
    console.log('STEP 5: Patient Registration & Triage');
    console.log('-'.repeat(70));

    const patients = [
      {
        location: 'Vehicle 1 - Driver',
        age: 45,
        gender: 'M',
        injuries: ['Chest trauma', 'Fractured ribs'],
        vitals: { respiratoryRate: 32, capillaryRefill: 2.5, alertness: true },
      },
      {
        location: 'Vehicle 1 - Passenger',
        age: 42,
        gender: 'F',
        injuries: ['Head injury', 'Laceration'],
        vitals: { respiratoryRate: 20, capillaryRefill: 2.0, alertness: false },
      },
      {
        location: 'Vehicle 2 - Driver',
        age: 62,
        gender: 'M',
        injuries: ['Multiple abrasions'],
        vitals: { respiratoryRate: 18, capillaryRefill: 2.0, alertness: true },
      },
      {
        location: 'Vehicle 2 - Child',
        age: 8,
        gender: 'F',
        injuries: ['Minor scratches'],
        vitals: { respiratoryRate: 20, capillaryRefill: 2.0, alertness: true },
      },
    ];

    const patientIds = [];
    patients.forEach((patient, index) => {
      const patientId = this.mciHandler.registerPatient(mciId, patient);
      patientIds.push(patientId);
    });

    const mciStatus = this.mciHandler.getMCIStatus(mciId);
    console.log('Patients Registered:', mciStatus.registeredPatients);
    console.log('Triage Summary:');
    console.log('  RED (Immediate):', mciStatus.triage.red);
    console.log('  YELLOW (Delayed):', mciStatus.triage.yellow);
    console.log('  GREEN (Minor):', mciStatus.triage.green);
    console.log('  BLACK (Deceased):', mciStatus.triage.black);
    console.log('');

    // Step 6: Mutual aid request
    console.log('STEP 6: Mutual Aid Request');
    console.log('-'.repeat(70));

    this.poolingManager.updateJurisdictionLoad('LOCAL-DIST', 80);
    this.poolingManager.updateJurisdictionLoad('DIST-NORTH', 40);
    this.poolingManager.updateJurisdictionLoad('DIST-SOUTH', 50);

    try {
      const maidResponse = await this.maidCoordinator.requestMutualAid({
        incidentId,
        location: { lat: 37.7749, lng: -122.4194 },
        requiredUnits: 2,
        patientCount: 4,
        severity: 'CRITICAL',
        reason: 'MCI declared - insufficient local resources',
      });

      console.log('Request ID:', maidResponse.requestId);
      console.log('Districts Contacted:', maidResponse.districtsContacted);
      console.log('Expected Response Time:', maidResponse.expectedResponseTime, 'ms\n');

      // Simulate district responses
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Handle responses
      console.log('STEP 7: District Responses');
      console.log('-'.repeat(70));

      this.maidCoordinator.handleDistrictResponse(maidResponse.requestId, {
        districtId: 'DIST-NORTH',
        availableUnits: 2,
        estimatedArrival: 8,
        status: 'ACCEPTED',
        notes: 'Two ambulances dispatched',
      });

      this.maidCoordinator.handleDistrictResponse(maidResponse.requestId, {
        districtId: 'DIST-SOUTH',
        availableUnits: 0,
        status: 'DECLINED',
        notes: 'No units available',
      });

      const finalStatus = this.maidCoordinator.getRequestStatus(maidResponse.requestId);
      console.log('Total Confirmed Units:', finalStatus.confirmedUnits);
      console.log('Request Status:', finalStatus.status);
      console.log('');

      // Step 7: Resource pooling
      console.log('STEP 8: Resource Pooling Allocation');
      console.log('-'.repeat(70));

      try {
        const poolAllocation = await this.poolingManager.requestPooledResources(
          'LOCAL-DIST',
          {
            unitType: 'AMBULANCE',
            requiredCount: 2,
            reason: 'MCI Response',
            duration: 3600000, // 1 hour
          }
        );

        console.log('Allocation ID:', poolAllocation.allocationId);
        console.log('Allocated Units:', poolAllocation.allocatedUnits);
        console.log('Expires At:', poolAllocation.expiresAt);
        console.log('');

        // Step 8: Resource deployment to MCI
        console.log('STEP 9: Deploy Resources to MCI Sectors');
        console.log('-'.repeat(70));

        // Deploy mutual aid units
        this.mciHandler.dispatchResource(mciId, {
          unitId: 'AMB-101',
          unitType: 'AMBULANCE',
          crew: ['John Smith, Paramedic', 'Jane Doe, EMT'],
          assignedSector: mciId + '-North',
        });

        this.mciHandler.dispatchResource(mciId, {
          unitId: 'AMB-102',
          unitType: 'AMBULANCE',
          crew: ['Bob Johnson, Paramedic', 'Alice Brown, EMT'],
          assignedSector: mciId + '-South',
        });

        console.log('Resources deployed to assigned sectors\n');

        // Step 9: Patient transport
        console.log('STEP 10: Patient Transport');
        console.log('-'.repeat(70));

        // Transport RED patient first
        this.mciHandler.updatePatientTransport(mciId, patientIds[0], 'TRANSPORTED', {
          transportUnit: 'AMB-001',
          destination: 'County Trauma Center',
          eta: new Date(Date.now() + 18 * 60000),
        });
        console.log('RED patient transported to trauma center');

        // Transport YELLOW patients
        this.mciHandler.updatePatientTransport(mciId, patientIds[1], 'TRANSPORTED', {
          transportUnit: 'AMB-101',
          destination: 'Regional Medical Center',
          eta: new Date(Date.now() + 15 * 60000),
        });
        console.log('YELLOW patient 1 transported');

        this.mciHandler.updatePatientTransport(mciId, patientIds[2], 'TRANSPORTED', {
          transportUnit: 'AMB-102',
          destination: 'Regional Medical Center',
          eta: new Date(Date.now() + 20 * 60000),
        });
        console.log('YELLOW patient 2 transported');

        // Transport GREEN patient
        this.mciHandler.updatePatientTransport(mciId, patientIds[3], 'TRANSPORTED', {
          transportUnit: 'AMB-003',
          destination: 'Community Hospital',
          eta: new Date(Date.now() + 10 * 60000),
        });
        console.log('GREEN patient transported\n');

        // Step 10: MCI closure
        console.log('STEP 11: MCI Closure');
        console.log('-'.repeat(70));

        this.mciHandler.closeMCI(mciId, {
          reason: 'All patients transported',
          finalized_by: 'Incident Commander',
        });

        const finalMciStatus = this.mciHandler.getMCIStatus(mciId);
        console.log('MCI Status:', finalMciStatus.status);
        console.log('Total Patients:', finalMciStatus.registeredPatients);
        console.log('Transport Summary:');
        console.log('  Transported:', finalMciStatus.transportSummary.transported);
        console.log('  Waiting:', finalMciStatus.transportSummary.waiting);
        console.log('  In Treatment:', finalMciStatus.transportSummary.inTreatment);
        console.log('');

        // Step 11: Resource return
        console.log('STEP 12: Return Resources');
        console.log('-'.repeat(70));

        const returnResult = this.poolingManager.returnResources(poolAllocation.allocationId);
        console.log('Resources returned:', returnResult.returnedUnits, 'units');

        const maidCancelResult = this.maidCoordinator.completeRequest(
          maidResponse.requestId,
          'All units returned'
        );
        console.log('Mutual aid request completed\n');

        // Final status report
        console.log('STEP 13: Final Status Report');
        console.log('='.repeat(70));

        const poolStatus = this.poolingManager.getPoolStatus();
        console.log('\nResource Pool Status:');
        console.log('  Total Jurisdictions:', poolStatus.totalJurisdictions);
        console.log('  Active Allocations:', poolStatus.activeAllocations);
        console.log('  Pooling Strategy:', poolStatus.poolingStrategy);

        const escalationAlerts = this.escalationRules.getActiveAlerts();
        console.log('\nActive Escalation Alerts:', escalationAlerts.length);

        const activeMCIs = this.mciHandler.getActiveMCIs();
        console.log('Active MCIs:', activeMCIs.length);

        const activeMaidRequests = this.maidCoordinator.getActiveRequests();
        console.log('Active Mutual Aid Requests:', activeMaidRequests.length);

        console.log('\n' + '='.repeat(70));
        console.log('INCIDENT RESOLUTION COMPLETE');
        console.log('='.repeat(70) + '\n');
      } catch (error) {
        console.error('Error in resource pooling:', error.message);
      }
    } catch (error) {
      console.error('Error in mutual aid request:', error.message);
    }
  }
}

/**
 * Run integration test
 */
async function runTests() {
  const test = new IntegrationTest();
  await test.runScenario();
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = IntegrationTest;
