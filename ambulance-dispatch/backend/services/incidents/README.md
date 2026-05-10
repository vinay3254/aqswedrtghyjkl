# Incident Management Service

The Incident Management Service is the operational heart of the ambulance dispatch system. It manages the complete lifecycle of emergency incidents using a robust 8-state finite state machine (FSM).

## 8-State Finite State Machine

### States

1. **PENDING** - Emergency call received, waiting for dispatcher acknowledgment
2. **ACKNOWLEDGED** - Dispatcher acknowledged, selecting optimal ambulance
3. **DISPATCHED** - Ambulance assigned, waiting for driver acceptance
4. **EN_ROUTE** - Driver accepted, ambulance moving to incident scene
5. **ON_SCENE** - Ambulance arrived at incident location
6. **TRANSPORTING** - Patient loaded, moving to hospital
7. **AT_HOSPITAL** - Arrived at hospital, patient handoff in progress
8. **RESOLVED** - Incident complete, ambulance available
9. **CANCELLED** - Incident cancelled (can occur from any state)

### State Transitions

```
PENDING → ACKNOWLEDGED (dispatcher acknowledges)
ACKNOWLEDGED → DISPATCHED (ambulance assigned)
DISPATCHED → EN_ROUTE (driver accepts)
DISPATCHED → ACKNOWLEDGED (driver rejects, reassign)
EN_ROUTE → ON_SCENE (driver arrives at scene)
ON_SCENE → TRANSPORTING (patient loaded)
TRANSPORTING → AT_HOSPITAL (arrived at hospital)
AT_HOSPITAL → RESOLVED (handoff complete)
Any state → CANCELLED (authorized cancellation)
```

### Role-Based Permissions

- **CITIZEN**: Can create incidents and cancel their own
- **DRIVER**: Can accept/reject assignments, update location status
- **DISPATCHER**: Full control over incident lifecycle
- **ADMIN**: Complete system access

## Priority Scoring

Incidents are automatically prioritized based on:

- **Severity**: LOW (1x), MEDIUM (2x), HIGH (3x), CRITICAL (4x)
- **Type**: MEDICAL (1x), ACCIDENT (2x), TRAUMA (3x), MATERNITY (3x), CARDIAC (4x), STROKE (4x), OTHER (1x)

**Formula**: `priority_score = severity_weight × type_weight × 10`

## API Endpoints

### POST /api/incidents
Create a new emergency incident.

**Permissions**: CITIZEN, DISPATCHER, ADMIN

**Request Body**:
```json
{
  "caller_name": "John Doe",
  "caller_phone": "+1234567890",
  "location_lat": 37.7749,
  "location_lng": -122.4194,
  "location_address": "123 Main St, San Francisco, CA",
  "severity": "HIGH",
  "incident_type": "CARDIAC",
  "description": "Patient experiencing chest pain and shortness of breath",
  "patient_count": 1
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "priority_score": 120,
    "created_at": "2025-01-01T12:00:00Z",
    ...
  },
  "message": "Incident created successfully"
}
```

### GET /api/incidents
List all incidents (with filters).

**Permissions**: DISPATCHER, ADMIN (Citizens see only their own)

**Query Parameters**:
- `status`: Filter by status (PENDING, ACKNOWLEDGED, etc.)
- `severity`: Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
- `incident_type`: Filter by type
- `active_only`: Only non-terminal incidents (true/false)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50, max: 100)

### GET /api/incidents/:id
Get incident details.

**Permissions**: All roles (Citizens only see their own)

### GET /api/incidents/active
Get all active incidents (non-RESOLVED, non-CANCELLED).

**Permissions**: DISPATCHER, ADMIN

### PUT /api/incidents/:id/status
Transition incident to new state.

**Permissions**: Role-based (see FSM permissions)

**Request Body**:
```json
{
  "status": "ACKNOWLEDGED",
  "reason": "Dispatcher reviewing incident"
}
```

### PUT /api/incidents/:id/severity
Update incident severity.

**Permissions**: DISPATCHER, ADMIN

**Request Body**:
```json
{
  "severity": "CRITICAL",
  "reason": "Patient condition deteriorating"
}
```

### PUT /api/incidents/:id/hospital
Assign hospital to incident.

**Permissions**: DISPATCHER, ADMIN

**Request Body**:
```json
{
  "hospital_id": "uuid"
}
```

### GET /api/incidents/:id/transitions
Get available state transitions for current user.

**Permissions**: All roles

### GET /api/incidents/metrics
Get system-wide incident metrics.

**Permissions**: DISPATCHER, ADMIN

**Response**:
```json
{
  "success": true,
  "data": {
    "pending_count": 3,
    "acknowledged_count": 2,
    "dispatched_count": 5,
    "en_route_count": 4,
    "on_scene_count": 2,
    "transporting_count": 3,
    "at_hospital_count": 1,
    "resolved_count": 156,
    "cancelled_count": 12,
    "avg_response_time_minutes": 8.5,
    "avg_acknowledgment_time_seconds": 15.2
  }
}
```

### GET /api/incidents/:id/audit
Get complete audit trail for an incident.

**Permissions**: DISPATCHER, ADMIN

## Event System

The service emits events for all state changes and important actions:

### Events Emitted

- `incident.created` - New incident created
- `incident.acknowledged` - Dispatcher acknowledged
- `incident.dispatched` - Ambulance assigned
- `incident.en_route` - Driver en route to scene
- `incident.on_scene` - Arrived at scene
- `incident.transporting` - Transporting patient
- `incident.at_hospital` - Arrived at hospital
- `incident.resolved` - Incident completed
- `incident.cancelled` - Incident cancelled
- `incident.severity_changed` - Severity updated
- `incident.escalated` - Incident stuck in PENDING > 60s
- `incident.state_changed` - Generic state change event

### Event Handlers

Event handlers trigger automatic actions:

- **ACKNOWLEDGED**: Notify optimization worker to find best ambulance
- **DISPATCHED**: Notify driver, start acceptance timer
- **EN_ROUTE**: Start ETA tracking, notify caller
- **ON_SCENE**: Send 10-minute hospital warning
- **TRANSPORTING**: Update hospital ETA, send patient info
- **AT_HOSPITAL**: Prepare handoff report
- **RESOLVED**: Update ambulance to AVAILABLE, log metrics

## Auto-Escalation

Incidents stuck in PENDING for more than 60 seconds are automatically escalated:

- Event emitted: `incident.escalated`
- Logs warning with incident details
- Triggers notifications to supervisors/managers
- Highlights incident on dispatcher dashboard

## Validation Rules

### Geographic Coordinates
- Latitude: -90 to 90
- Longitude: -180 to 180
- Address: Minimum 5 characters

### Phone Numbers
- Format: International format (E.164 recommended)
- Pattern: `^+?[1-9]\d{1,14}$`

### Patient Count
- Range: 1 to 100

### Description
- Minimum: 10 characters

## Audit Logging

Every state transition and severity change is logged to `incident_audit_log`:

```sql
{
  incident_id: uuid,
  previous_state: string,
  new_state: string,
  changed_by: uuid,
  reason: string,
  changed_at: timestamp
}
```

## Response Time Tracking

The system automatically tracks:

- **Age**: Time since incident created
- **Acknowledgment Time**: PENDING → ACKNOWLEDGED
- **Dispatch Time**: ACKNOWLEDGED → DISPATCHED
- **Response Time**: EN_ROUTE → ON_SCENE
- **Transport Time**: ON_SCENE → AT_HOSPITAL
- **Total Time**: PENDING → RESOLVED

Times are stored as timestamps for each state transition.

## Database Schema

### incidents table

```sql
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_name VARCHAR(255),
  caller_phone VARCHAR(20) NOT NULL,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  location_address TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  incident_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  patient_count INTEGER DEFAULT 1,
  priority_score INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  hospital_id UUID REFERENCES hospitals(id),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  dispatched_at TIMESTAMP,
  en_route_at TIMESTAMP,
  on_scene_at TIMESTAMP,
  transporting_at TIMESTAMP,
  at_hospital_at TIMESTAMP,
  resolved_at TIMESTAMP,
  CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CHECK (incident_type IN ('MEDICAL', 'ACCIDENT', 'CARDIAC', 'STROKE', 'TRAUMA', 'MATERNITY', 'OTHER')),
  CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'RESOLVED', 'CANCELLED'))
);

CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
CREATE INDEX idx_incidents_priority ON incidents(priority_score DESC);
CREATE INDEX idx_incidents_location ON incidents USING GIST (point(location_lng, location_lat));
```

### incident_audit_log table

```sql
CREATE TABLE incident_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id),
  previous_state VARCHAR(20),
  new_state VARCHAR(20),
  action_type VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_incident ON incident_audit_log(incident_id);
CREATE INDEX idx_audit_changed_at ON incident_audit_log(changed_at DESC);
```

## Usage Examples

### Creating an Incident

```javascript
const incidentService = new IncidentService();

const incident = await incidentService.createIncident({
  caller_name: 'Jane Smith',
  caller_phone: '+14155551234',
  location_lat: 37.7749,
  location_lng: -122.4194,
  location_address: '555 Market St, San Francisco, CA',
  severity: 'HIGH',
  incident_type: 'CARDIAC',
  description: 'Patient collapsed, not breathing',
  patient_count: 1,
}, user);
```

### Transitioning States

```javascript
// Dispatcher acknowledges incident
await incidentService.transitionState(
  incidentId,
  'ACKNOWLEDGED',
  dispatcher,
  'Reviewing incident details'
);

// Assign ambulance (done in assignment service)
// Then transition to DISPATCHED
await incidentService.transitionState(
  incidentId,
  'DISPATCHED',
  dispatcher,
  'Ambulance AMB-101 assigned'
);

// Driver accepts
await incidentService.transitionState(
  incidentId,
  'EN_ROUTE',
  driver,
  'En route to scene'
);
```

### Checking Escalations

```javascript
// Run this periodically (e.g., every 30 seconds)
const escalatedIncidents = await incidentService.checkEscalations();
// Returns incidents stuck in PENDING > 60 seconds
```

## Integration Points

### With Assignment Service
- DISPATCHED state requires active assignment
- Assignment cancellation reverts to ACKNOWLEDGED

### With Optimization Worker
- ACKNOWLEDGED triggers optimization to find best ambulance
- Uses priority_score for ranking

### With Notification Service
- Events trigger SMS/Push notifications
- Real-time updates to dispatcher dashboard

### With Tracking Service
- EN_ROUTE enables GPS tracking
- Calculates and updates ETA

### With Hospital Service
- TRANSPORTING requires hospital assignment
- AT_HOSPITAL triggers handoff protocols

## Error Handling

All errors are thrown as custom error classes:

- `ValidationError` (400) - Invalid input data
- `AuthorizationError` (403) - Insufficient permissions
- `NotFoundError` (404) - Incident not found
- `ConflictError` (409) - Invalid state transition

## Performance Considerations

- Uses database transactions for state changes
- Indexes on status, severity, created_at, priority_score
- Spatial index for geographic queries
- Event emitters are non-blocking

## Testing

Key test scenarios:

1. Valid state transitions
2. Invalid state transitions (should fail)
3. Role-based authorization
4. Priority score calculation
5. Auto-escalation logic
6. Event emission
7. Audit logging
8. Geographic validation
9. Concurrent state changes (transaction safety)
10. Terminal state immutability

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Multi-patient incident support
- [ ] Automatic hospital selection based on capacity
- [ ] Predictive ETA using ML models
- [ ] Integration with 911 systems
- [ ] Voice recording storage
- [ ] Photo/video evidence upload
- [ ] Multi-language support
- [ ] Incident clustering for mass casualty events
