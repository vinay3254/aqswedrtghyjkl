# Dispatch & Assignment System

**Intelligent ambulance-hospital matching with auto-dispatch and timeout handling**

---

## Overview

The Dispatch System automatically selects the best ambulance and hospital for each incident based on multiple scoring factors, with support for manual overrides and timeout-based reassignment.

## Features

### 🚑 Ambulance Selection
- **Automatic Scoring Algorithm**
  - Distance/travel time (-3 points per minute)
  - Equipment match bonus (+20 points for exact match)
  - Fuel level bonus (+10 points for >50% fuel)
  - Recent maintenance bonus (+5 points if <30 days)
  
- **Equipment Requirements**
  - CRITICAL/HIGH severity → ALS required
  - MEDIUM/LOW severity → BLS acceptable
  - ALS units can handle BLS cases (with partial bonus)

### 🏥 Hospital Selection
- **Multi-Factor Scoring**
  - Distance/travel time (closer = higher score)
  - Bed availability (+20 points for >10 beds)
  - ICU beds for critical cases (+15 points)
  - Specialty matching (+15 points per match)
  
- **Incident Type Specialties**
  - CARDIAC → Cardiology, ICU
  - STROKE → Neurology, Stroke Unit
  - TRAUMA → Trauma Center, Surgery
  - MATERNITY → Maternity, Obstetrics
  - ACCIDENT → Emergency, Trauma Center
  - MEDICAL → Emergency, General Medicine

### ⏱️ Timeout & Reassignment
- **60-Second Acceptance Window**
  - Driver must accept within 60 seconds
  - Auto-reject if timeout expires
  - Ambulance status reset to AVAILABLE
  
- **Automatic Reassignment**
  - Selects next-best ambulance
  - Excludes previously rejected ambulances
  - Max 3 reassignment attempts
  - Notifies dispatcher if all attempts fail

### 👤 Manual Override
- Dispatchers can manually select ambulance/hospital
- Override reason required for audit trail
- Logged in audit_log table
- Marked as `auto_selected: false`

---

## API Endpoints

### Create Assignment (Auto-Dispatch)
```http
POST /api/assignments
Authorization: Bearer <dispatcher_token>
Content-Type: application/json

{
  "incident_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assignment": {
      "id": 456,
      "incident_id": 123,
      "ambulance_id": 10,
      "hospital_id": 5,
      "status": "PENDING",
      "ambulance_reasoning": "Close proximity (7.2 km), 12 min ETA, ALS equipped, adequate fuel (75%)",
      "hospital_reasoning": "Very close (4.5 km) + has Cardiology, ICU + 3 ICU beds available + 15 beds available",
      "auto_selected": true,
      "estimated_arrival_time": 12
    },
    "ambulance": { ... },
    "hospital": { ... },
    "hospital_options": [ ... ],
    "route_info": {
      "ambulance_to_incident": {
        "distance_km": 7.2,
        "estimated_time_minutes": 12
      },
      "incident_to_hospital": {
        "distance_km": 4.5,
        "estimated_time_minutes": 8
      },
      "total_estimated_time_minutes": 20
    }
  }
}
```

### Create Assignment (Manual Override)
```http
POST /api/assignments
Authorization: Bearer <dispatcher_token>
Content-Type: application/json

{
  "incident_id": 123,
  "ambulance_id": 15,
  "hospital_id": 8,
  "override_reason": "Ambulance 15 has specialized equipment for this case"
}
```

### Get Assignment Details
```http
GET /api/assignments/:id
Authorization: Bearer <token>
```

### Get Active Assignments
```http
GET /api/assignments/active
Authorization: Bearer <dispatcher_token>
```

### Get Driver Assignments
```http
GET /api/assignments/driver/:driver_id?include_completed=false
Authorization: Bearer <driver_token>
```

### Accept Assignment (Driver)
```http
POST /api/assignments/:id/accept
Authorization: Bearer <driver_token>
```

**Effect:**
- Assignment status → ACCEPTED
- Incident status → EN_ROUTE
- Logged in audit_log

### Reject Assignment (Driver)
```http
POST /api/assignments/:id/reject
Authorization: Bearer <driver_token>
Content-Type: application/json

{
  "reason": "Vehicle mechanical issue"
}
```

**Effect:**
- Assignment status → REJECTED
- Ambulance status → AVAILABLE
- Triggers auto-reassignment to next-best ambulance

### Reassign Ambulance (Dispatcher)
```http
PUT /api/assignments/:id/ambulance
Authorization: Bearer <dispatcher_token>
Content-Type: application/json

{
  "ambulance_id": 20,
  "reason": "Ambulance 10 reported low fuel"
}
```

### Reassign Hospital (Dispatcher)
```http
PUT /api/assignments/:id/hospital
Authorization: Bearer <dispatcher_token>
Content-Type: application/json

{
  "hospital_id": 12,
  "reason": "Patient condition worsened, needs trauma center"
}
```

### Get Assignment Metrics
```http
GET /api/assignments/metrics
Authorization: Bearer <dispatcher_token>
```

**Response:**
```json
{
  "pending_count": 3,
  "accepted_count": 8,
  "rejected_count": 2,
  "completed_count": 45,
  "cancelled_count": 1,
  "avg_acceptance_time_seconds": 15.4,
  "avg_completion_time_seconds": 1245.6,
  "auto_selected_count": 42,
  "manual_override_count": 3
}
```

---

## Database Schema

### assignments table
```sql
CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  ambulance_id INTEGER NOT NULL REFERENCES ambulances(id),
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
  dispatcher_id INTEGER NOT NULL REFERENCES users(id),
  
  status VARCHAR(20) NOT NULL,  -- PENDING, ACCEPTED, REJECTED, CANCELLED, COMPLETED
  
  ambulance_reasoning TEXT,     -- Why this ambulance was selected
  hospital_reasoning TEXT,      -- Why this hospital was selected
  auto_selected BOOLEAN DEFAULT true,
  override_reason TEXT,
  
  estimated_arrival_time INTEGER,  -- Minutes
  route_info JSONB,
  
  assigned_at TIMESTAMP,
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  completed_at TIMESTAMP,
  rejection_reason TEXT,
  
  timeout_handled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER,
  updated_by INTEGER
);
```

---

## Service Architecture

### Files
- `service.js` - Main dispatch orchestration
- `ambulance-selector.js` - Ambulance scoring algorithm
- `hospital-scorer.js` - Hospital scoring algorithm
- `assignment-manager.js` - Assignment CRUD operations
- `timeout-handler.js` - Timeout detection & auto-reassignment
- `notifications.js` - Driver notifications (stub)
- `controller.js` - API route handlers

### Flow

#### Auto-Dispatch Flow
1. Incident status changes ACKNOWLEDGED → DISPATCHED (trigger)
2. `DispatchService.createAssignment(incident_id, dispatcher_id)`
3. `AmbulanceSelector.selectBestAmbulance()` - scores all available
4. `HospitalScorer.selectBestHospitals()` - scores all hospitals
5. Create assignment in PENDING state
6. Update ambulance status → DISPATCHED
7. Update incident status → DISPATCHED
8. Log audit trail
9. Notify driver
10. Start 60-second timeout

#### Timeout Flow
1. `TimeoutHandler` checks every 10 seconds
2. Finds assignments PENDING > 60 seconds
3. Auto-reject assignment
4. Reset ambulance to AVAILABLE
5. Get list of previously rejected ambulances
6. Select next-best ambulance (excluding rejects)
7. Create new assignment
8. If max attempts reached → notify dispatcher

#### Driver Acceptance Flow
1. Driver receives notification
2. POST `/api/assignments/:id/accept`
3. Assignment status → ACCEPTED
4. Incident status → EN_ROUTE
5. Audit log created

---

## Usage Examples

### Start Timeout Handler
```javascript
const TimeoutHandler = require('./services/dispatch/timeout-handler');

const timeoutHandler = new TimeoutHandler();
timeoutHandler.start(10000); // Check every 10 seconds

// On shutdown
timeoutHandler.stop();
```

### Manual Dispatch with Override
```javascript
const DispatchService = require('./services/dispatch/service');

const result = await DispatchService.createAssignment(incidentId, dispatcherId, {
  ambulanceId: 15,
  hospitalId: 8,
  override_reason: 'Ambulance 15 has specialized cardiac equipment'
});
```

### Get Best Ambulance (Programmatic)
```javascript
const AmbulanceSelector = require('./services/dispatch/ambulance-selector');

const bestAmbulance = await AmbulanceSelector.selectBestAmbulance(
  34.0522,  // incident lat
  -118.2437, // incident lng
  'CRITICAL'  // severity
);
```

### Get Best Hospitals (Programmatic)
```javascript
const HospitalScorer = require('./services/dispatch/hospital-scorer');

const topHospitals = await HospitalScorer.selectBestHospitals(
  'CARDIAC',   // incident type
  'CRITICAL',  // severity
  34.0522,     // from lat
  -118.2437,   // from lng
  3            // top N results
);
```

---

## Scoring Examples

### Ambulance Score Calculation
```
Base Score: 100

Distance Penalty:
  - 12 minutes away = -36 points
  
Equipment Match:
  - Has ALS (required) = +20 points
  
Fuel Level:
  - 75% fuel = +10 points
  
Maintenance:
  - Last maintenance 15 days ago = +5 points

FINAL SCORE: 99
```

### Hospital Score Calculation
```
Base Score: 100

Distance:
  - 4.5 km away (< 5km) = +30 points
  
Bed Availability:
  - 15 beds available (> 10) = +20 points
  
ICU Beds:
  - 3 ICU beds (critical case) = +15 points
  
Specialty Match:
  - Has Cardiology = +15 points
  - Has ICU = +15 points
  
FINAL SCORE: 195
```

---

## Error Handling

### Common Errors
- `Incident must be in ACKNOWLEDGED status to dispatch` - Incident not ready
- `No available ambulances found` - All ambulances busy
- `No available hospitals found` - All hospitals full/offline
- `Assignment must be in PENDING status to accept` - Already accepted/rejected

### Timeout Scenarios
- If all ambulances reject → Max attempts reached → Notify dispatcher
- If ambulance becomes UNAVAILABLE mid-timeout → Reassign anyway
- If incident cancelled during timeout → Skip reassignment

---

## Performance Considerations

- Ambulance/hospital scoring runs in-memory (fast)
- Database queries optimized with indexes
- Timeout handler runs async (non-blocking)
- Notifications stubbed for now (integrate later)

---

## Future Enhancements

- Real-time driver notifications (WebSocket/Push)
- SMS notifications for drivers
- Dynamic timeout based on severity
- Machine learning for score optimization
- Traffic API integration for ETA
- Driver preference learning
- Hospital bed availability real-time sync

---

## Testing

```bash
# Test ambulance selection
curl -X POST http://localhost:3000/api/assignments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"incident_id": 123}'

# Test manual override
curl -X POST http://localhost:3000/api/assignments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": 123,
    "ambulance_id": 10,
    "override_reason": "Testing manual selection"
  }'

# Test driver acceptance
curl -X POST http://localhost:3000/api/assignments/456/accept \
  -H "Authorization: Bearer <driver_token>"

# Test driver rejection
curl -X POST http://localhost:3000/api/assignments/456/reject \
  -H "Authorization: Bearer <driver_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Vehicle breakdown"}'
```

---

## License

MIT
