# Mutual Aid & Escalation System

A comprehensive system for handling ambulance resource escalation, mutual aid coordination, mass casualty incidents (MCI), and dynamic resource pooling across multiple jurisdictions.

## 📋 Overview

This system provides four integrated components that work together to:

- **Monitor** resource utilization and incident severity
- **Escalate** incidents based on configurable thresholds
- **Request** assistance from neighboring districts
- **Handle** mass casualty incidents with triage and sector management
- **Pool** resources dynamically across jurisdictions
- **Rebalance** resources based on demand

## 🏗️ Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                   Escalation Rules Engine                    │
│              (Monitors conditions & thresholds)              │
└────────────────┬────────────────┬────────────────┬───────────┘
                 │                │                │
        ┌────────▼─────┐  ┌──────▼────────┐  ┌───▼──────────┐
        │ Mutual Aid   │  │ Mass Casualty │  │  Resource    │
        │ Coordinator  │  │ Incident      │  │  Pooling     │
        │              │  │ Handler       │  │  Manager     │
        └──────────────┘  └───────────────┘  └──────────────┘
                │                │                │
                └────────────────┼────────────────┘
                                 │
                         ┌───────▼────────┐
                         │ Real-time Data │
                         │ & Monitoring   │
                         └────────────────┘
```

### Files

1. **escalation-rules.js** - Determines when to escalate
2. **mutual-aid-coordinator.js** - Requests & manages mutual aid from neighbors
3. **mass-casualty-handler.js** - Manages large-scale incidents
4. **resource-pooling.js** - Dynamic resource allocation across jurisdictions

## 🚀 Quick Start

### Installation

```javascript
const EscalationRules = require('./escalation-rules');
const MutualAidCoordinator = require('./mutual-aid-coordinator');
const MassCasualtyHandler = require('./mass-casualty-handler');
const ResourcePoolingManager = require('./resource-pooling');

// Initialize components
const escalationRules = new EscalationRules();
const maidCoordinator = new MutualAidCoordinator();
const mciHandler = new MassCasualtyHandler();
const poolingManager = new ResourcePoolingManager();
```

### Basic Usage

```javascript
// Check if escalation needed
const escalation = escalationRules.determineEscalationLevel(incidentData);
if (escalation.recommended) {
  // Request mutual aid
  const request = await maidCoordinator.requestMutualAid(requestData);
  
  // Or request pooled resources
  const allocation = await poolingManager.requestPooledResources(
    'jurisdiction-id',
    { unitType: 'AMBULANCE', requiredCount: 2 }
  );
}

// Handle MCI
const mciId = mciHandler.declareMCI(mciData);
mciHandler.registerPatient(mciId, patientData);
mciHandler.dispatchResource(mciId, resourceData);
```

## 📊 Escalation Rules

### Escalation Levels

| Level | Trigger | Action |
|-------|---------|--------|
| **LOCAL** | Normal operations | Handle locally |
| **DISTRICT** | MCI OR 2+ factors | Request from neighbors |
| **REGIONAL** | 3+ escalation factors | Multi-district coordination |
| **MUTUAL_AID** | Severe shortage | Maximum escalation |

### Escalation Factors

- **Local Capacity Exceeded** (≥85% utilization)
- **Mass Casualty Incident** (≥3 patients OR CATASTROPHIC severity)
- **Response Time Degradation** (>15 minutes average)
- **High Dispatch Queue** (pending > 2x available units)

### Example

```javascript
const escalation = escalationRules.determineEscalationLevel({
  resourceStatus: { totalUnits: 10, availableUnits: 2 },  // 80% utilized
  incident: { patientCount: 4, severity: 'CRITICAL' },   // MCI
  averageResponseTime: 18,                                 // Over threshold
  pendingDispatches: 5,
});

console.log(escalation.level);        // "REGIONAL"
console.log(escalation.factors);      // [3 factors]
console.log(escalation.recommended);  // true
```

## 🤝 Mutual Aid Coordination

### Request Workflow

1. **Identify** neighboring districts by proximity
2. **Send** simultaneous requests to all neighbors
3. **Collect** responses with availability and ETA
4. **Accept** best available units
5. **Dispatch** accepted units to incident
6. **Return** units after incident resolution

### Key Features

- **Automatic neighbor discovery** based on geographic proximity
- **Parallel requests** to multiple districts
- **Response timeout** handling with retry logic
- **Request history** tracking for compliance
- **Mutual aid agreements** support

### Example

```javascript
const response = await maidCoordinator.requestMutualAid({
  incidentId: 'INC-2024-00001',
  location: { lat: 37.7749, lng: -122.4194 },
  requiredUnits: 2,
  patientCount: 4,
  severity: 'CRITICAL',
  reason: 'MCI declared'
});

// Simulate district responses
maidCoordinator.handleDistrictResponse(response.requestId, {
  districtId: 'DIST-A',
  availableUnits: 2,
  estimatedArrival: 8,
  status: 'ACCEPTED'
});
```

## 🏥 Mass Casualty Incident Handler

### MCI Workflow

1. **Declare** MCI (≥3 patients)
2. **Establish** command post and sectors
3. **Perform** triage on all patients (START protocol)
4. **Register** patients with priority levels
5. **Deploy** resources to sectors
6. **Transport** patients by priority
7. **Close** incident when all transported

### START Triage Protocol

**S**imple **T**riage **A**nd **R**apid **T**reatment:

```
Check Breathing?
  ├─ Not breathing → Position airway
  │  ├─ Opens → YELLOW (Delayed)
  │  └─ Still not → BLACK (Deceased)
  ├─ >30/min → RED (Immediate)
  └─ Normal → Check Perfusion
     ├─ Cap refill >2s → RED (Immediate)
     └─ Cap refill ≤2s → Check Alertness
        ├─ Alert → GREEN (Minor)
        └─ Unalert → YELLOW (Delayed)
```

### Triage Categories

| Category | Priority | Description |
|----------|----------|-------------|
| **RED** | 1 (Immediate) | Life-threatening, critical |
| **YELLOW** | 2 (Delayed) | Serious but stable |
| **GREEN** | 3 (Minor) | Walking wounded |
| **BLACK** | 4 | Deceased/expectant |

### Example

```javascript
// Declare MCI
const mciId = mciHandler.declareMCI({
  location: 'Highway 101, Mile 42',
  incidentType: 'MOTOR_VEHICLE_ACCIDENT',
  estimatedPatients: 4,
  severity: 'CRITICAL'
});

// Register patients with vitals
const patientId = mciHandler.registerPatient(mciId, {
  location: 'Scene - Vehicle 1',
  age: 45,
  vitals: {
    respiratoryRate: 28,  // Fast → triggers RED
    capillaryRefill: 2.5,
    alertness: true
  }
});

// Get status
const status = mciHandler.getMCIStatus(mciId);
console.log(status.triage); // { red: 1, yellow: 2, green: 1, black: 0 }
```

## 💾 Resource Pooling

### Pooling Strategy

**DYNAMIC** (default):
- Resources allocated based on real-time utilization
- Continuous rebalancing
- Maximizes efficiency
- Minimizes response times

**STATIC**:
- Pre-allocated by agreement
- Fixed allocation levels
- More predictable
- Less flexible

### Pooling Policy

Each jurisdiction has a policy:

```javascript
{
  shareWhenUtilization: 0.70,    // Can share if <70% utilized
  recallWhenUtilization: 0.40,   // Recall if requester <40% utilized
  priorityTier: 1,               // Higher tier gets priority
  maxSharedUnits: 5,             // Max can share
  minRetainedUnits: 2            // Min must keep
}
```

### Example

```javascript
// Register jurisdictions
poolingManager.registerJurisdiction('LOCAL-DIST', {
  name: 'Local District',
  location: { lat: 37.7749, lng: -122.4194 },
  baseUnits: ['AMB-001', 'AMB-002', 'AMB-003'],
  resourceCapacity: 100
});

// Update load
poolingManager.updateJurisdictionLoad('LOCAL-DIST', 80); // 80% utilized

// Request resources
const allocation = await poolingManager.requestPooledResources(
  'LOCAL-DIST',
  {
    unitType: 'AMBULANCE',
    requiredCount: 2,
    reason: 'MCI Response',
    duration: 3600000 // 1 hour
  }
);

// Resources automatically recalled after 1 hour
// Or manually return them
poolingManager.returnResources(allocation.allocationId);
```

## 📡 Events & Monitoring

All components emit events for real-time monitoring:

```javascript
// Escalation events
escalationRules.on('mutual-aid-recommended', (data) => {
  console.log('Mutual aid needed:', data);
});

// Mutual aid events
maidCoordinator.on('mutual-aid-requested', (data) => {
  console.log('Request sent to', data.districtsContacted, 'districts');
});

maidCoordinator.on('mutual-aid-response', (data) => {
  console.log('District', data.districtId, 'responding');
});

// MCI events
mciHandler.on('mci-declared', (data) => {
  console.log('MCI declared:', data.mciId);
});

mciHandler.on('patient-registered', (data) => {
  console.log('Patient triage:', data.triageCategory);
});

// Resource pooling events
poolingManager.on('resource-allocated', (data) => {
  console.log('Allocated', data.allocatedUnits, 'units');
});

poolingManager.on('resources-rebalanced', (data) => {
  console.log('Rebalanced', data.actions.length, 'resources');
});
```

## 🔧 Configuration

### EscalationRules Config

```javascript
new EscalationRules({
  localUnitThreshold: 0.85,              // Utilization threshold
  mciDeclarationThreshold: 3,            // Min patients for MCI
  responseTimeThreshold: 15,             // Max response time (min)
  escalationLevels: ['LOCAL', 'DISTRICT', 'REGIONAL', 'MUTUAL_AID']
});
```

### MutualAidCoordinator Config

```javascript
new MutualAidCoordinator({
  requestTimeout: 30000,                 // Request timeout (ms)
  maxRetries: 3,                         // Retry attempts
  responseWaitTime: 60000,               // Wait for response (ms)
  districtRegistry: new Map()            // Registered districts
});
```

### MassCasualtyHandler Config

```javascript
new MassCasualtyHandler({
  mciThreshold: 3,                       // Min patients for MCI
  triageProtocol: 'START',               // Triage protocol
  commandStructure: 'ICS'                // Command structure
});
```

### ResourcePoolingManager Config

```javascript
new ResourcePoolingManager({
  poolingStrategy: 'DYNAMIC',            // DYNAMIC or STATIC
  rebalanceInterval: 30000,              // Rebalance frequency (ms)
  minStandbyTime: 60000                  // Min time before rebalance (ms)
});
```

## 📊 Status & Reporting

### Get Escalation Status

```javascript
const alerts = escalationRules.getActiveAlerts();
const history = escalationRules.getEscalationHistory(incidentId);
```

### Get MCI Status

```javascript
const status = mciHandler.getMCIStatus(mciId);
// Returns: patients, triage breakdown, resources, sectors, transport summary
```

### Get Mutual Aid Status

```javascript
const requestStatus = maidCoordinator.getRequestStatus(requestId);
const activeRequests = maidCoordinator.getActiveRequests();
const history = maidCoordinator.getIncidentHistory(incidentId);
```

### Get Pool Status

```javascript
const poolStatus = poolingManager.getPoolStatus();
// Returns: jurisdictions, utilization, allocations, strategy
```

## 🔄 Complete Workflow Example

See [ESCALATION_WORKFLOW.md](./ESCALATION_WORKFLOW.md) for a detailed example of a complete multi-patient incident from declaration through resolution.

See [USAGE_EXAMPLES.js](./USAGE_EXAMPLES.js) for code examples of each component.

## 📋 Key Methods

### EscalationRules
- `determineEscalationLevel(incidentData)` - Get escalation recommendation
- `shouldEscalate(incidentData)` - Check if escalation needed
- `isLocalCapacityExceeded(resourceStatus)` - Check capacity
- `isMassCasualtyIncident(incident)` - Check if MCI
- `createEscalationAlert(incidentId, escalationData)` - Create alert
- `getActiveAlerts()` - Get active escalation alerts
- `closeAlert(alertId, reason)` - Close alert

### MutualAidCoordinator
- `requestMutualAid(requestData)` - Request ambulances from neighbors
- `handleDistrictResponse(requestId, response)` - Process district response
- `cancelRequest(requestId)` - Cancel request
- `getRequestStatus(requestId)` - Get request status
- `getActiveRequests()` - Get active requests
- `completeRequest(requestId, reason)` - Mark request complete
- `registerDistrict(districtId, districtInfo)` - Register district

### MassCasualtyHandler
- `declareMCI(incidentData)` - Declare MCI
- `registerPatient(mciId, patientData)` - Register patient with triage
- `dispatchResource(mciId, resourceData)` - Deploy resource to MCI
- `updatePatientTransport(mciId, patientId, status, details)` - Update transport
- `getMCIStatus(mciId)` - Get comprehensive MCI status
- `closeMCI(mciId, closeDetails)` - Close MCI incident
- `getActiveMCIs()` - Get active MCIs

### ResourcePoolingManager
- `registerJurisdiction(jurisdictionId, data)` - Register jurisdiction
- `requestPooledResources(jurisdiction, requestData)` - Request resources
- `returnResources(allocationId)` - Return resources
- `rebalanceResources()` - Rebalance across jurisdictions
- `getPoolStatus()` - Get pool status
- `getJurisdictionDetails(jurisdictionId)` - Get jurisdiction info

## 🧪 Testing

Run usage examples:

```bash
node USAGE_EXAMPLES.js
```

## 📝 License

Part of the Ambulance Dispatch System

## 📚 Documentation

- [Escalation Workflow](./ESCALATION_WORKFLOW.md) - Complete workflow documentation
- [Usage Examples](./USAGE_EXAMPLES.js) - Code examples
- Component files include detailed JSDoc comments

## 🤖 Event Architecture

All components are EventEmitter subclasses:

```javascript
// Listen for events
component.on('event-name', (data) => {
  // Handle event
});

// Emit events
component.emit('event-name', data);
```

## 🔐 Best Practices

1. **Always check escalation** before major incidents
2. **Declare MCI early** if unsure (minimum 3 patients)
3. **Use START triage** protocol for consistency
4. **Monitor events** for real-time visibility
5. **Return resources promptly** to free up capacity
6. **Track performance** with history records
7. **Update utilization** frequently for accurate pooling

## 🐛 Error Handling

All methods include error handling:

```javascript
try {
  const result = await maidCoordinator.requestMutualAid(data);
} catch (error) {
  console.error('Request failed:', error.message);
  // Handle gracefully
}
```

## 📞 Support

Refer to component JSDoc comments for detailed parameter information.

---

**Created**: 2024
**Status**: Production Ready
