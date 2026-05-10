# Hospital Inventory & Capacity Management System

## Overview

The Hospital Inventory & Capacity Management System provides real-time tracking of hospital resources, bed availability, specialist on-duty status, blood bank inventory, and equipment availability. It enables intelligent hospital matching based on incident requirements and patient needs.

## Features

### 1. **Real-time Capacity Tracking**
- Total beds (general ward)
- ICU beds (intensive care)
- Trauma bays (emergency trauma)
- Automatic capacity updates
- Reservation system with auto-release

### 2. **Specialist Matching**
- Track specialists on duty by shift
- Match incident types to required specialists
- Support for multiple specialties
- Real-time availability updates

### 3. **Blood Bank Management**
- Track inventory for all blood types (O-, O+, A-, A+, B-, B+, AB-, AB+)
- Blood type compatibility checking
- Find hospitals with compatible blood types

### 4. **Geospatial Search**
- Find nearby hospitals within radius
- Filter by capacity, services, and equipment
- Calculate optimal hospital based on multiple factors
- Distance and ETA calculations

### 5. **Pre-Arrival Alerts**
- Notify hospitals when ambulance is assigned
- Track acknowledgment status
- Auto-escalate unacknowledged alerts
- Real-time ETA updates

### 6. **Equipment Tracking**
- MRI, CT scan availability
- Catheterization lab status
- Ventilator availability
- Specialized equipment tracking

## API Endpoints

### Hospital Management

#### Create Hospital (ADMIN)
```
POST /api/hospitals
```

**Request Body:**
```json
{
  "name": "City General Hospital",
  "address": "123 Main St, City, State 12345",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "phone": "+1-555-0100",
  "email": "emergency@citygeneral.com",
  "total_beds": 200,
  "icu_beds": 40,
  "trauma_bays": 10,
  "trauma_level": "Level 1",
  "services": [
    "cardiology",
    "neurology",
    "trauma_surgery",
    "orthopedics",
    "obstetrics"
  ],
  "equipment": {
    "mri": true,
    "ct_scan": true,
    "cath_lab": true,
    "ventilators": true
  },
  "blood_inventory": {
    "O-": 50,
    "O+": 100,
    "A-": 30,
    "A+": 80,
    "B-": 20,
    "B+": 60,
    "AB-": 10,
    "AB+": 40
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Hospital created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "City General Hospital",
    "address": "123 Main St, City, State 12345",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "contact": {
      "phone": "+1-555-0100",
      "email": "emergency@citygeneral.com"
    },
    "capacity": {
      "beds": {
        "total": 200,
        "available": 200,
        "occupied": 0
      },
      "icu": {
        "total": 40,
        "available": 40,
        "occupied": 0
      },
      "trauma": {
        "total": 10,
        "available": 10,
        "occupied": 0
      }
    },
    "trauma_level": "Level 1",
    "status": "active",
    "services": ["cardiology", "neurology", "trauma_surgery", "orthopedics", "obstetrics"],
    "equipment": {
      "mri": true,
      "ct_scan": true,
      "cath_lab": true,
      "ventilators": true
    },
    "blood_inventory": {
      "O-": 50,
      "O+": 100,
      "A-": 30,
      "A+": 80,
      "B-": 20,
      "B+": 60,
      "AB-": 10,
      "AB+": 40
    },
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Get All Hospitals
```
GET /api/hospitals?status=active&trauma_level=Level 1&page=1&limit=20
```

#### Get Hospital by ID
```
GET /api/hospitals/:id
```

#### Update Hospital (ADMIN, HOSPITAL_STAFF)
```
PUT /api/hospitals/:id
```

#### Delete Hospital (ADMIN)
```
DELETE /api/hospitals/:id
```

### Capacity Management

#### Update Bed Availability (HOSPITAL_STAFF)
```
PUT /api/hospitals/:id/beds
```

**Request Body:**
```json
{
  "available_beds": 150,
  "available_icu_beds": 30,
  "available_trauma_bays": 8
}
```

#### Get Capacity Utilization
```
GET /api/hospitals/:id/capacity
```

**Response:**
```json
{
  "success": true,
  "data": {
    "general": {
      "total": 200,
      "available": 150,
      "occupied": 50,
      "utilization": "25.00"
    },
    "icu": {
      "total": 40,
      "available": 30,
      "occupied": 10,
      "utilization": "25.00"
    },
    "trauma": {
      "total": 10,
      "available": 8,
      "occupied": 2,
      "utilization": "20.00"
    }
  }
}
```

#### Reserve Bed (DISPATCHER)
```
POST /api/hospitals/:id/beds/reserve
```

**Request Body:**
```json
{
  "bed_type": "icu",
  "reservation_id": "amb_12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "res_1673784600000",
      "hospital_id": "550e8400-e29b-41d4-a716-446655440000",
      "bed_type": "icu",
      "reserved_at": "2024-01-15T10:30:00Z",
      "expires_at": "2024-01-15T11:00:00Z"
    }
  }
}
```

**Note:** Reservations automatically expire after 30 minutes if not confirmed.

#### Release Bed Reservation
```
POST /api/hospitals/beds/release
```

**Request Body:**
```json
{
  "reservation_id": "res_1673784600000"
}
```

### Geospatial Search

#### Find Nearby Hospitals (DISPATCHER)
```
GET /api/hospitals/nearby?latitude=40.7128&longitude=-74.0060&radius=50&min_beds=10&min_icu_beds=2
```

**Query Parameters:**
- `latitude` (required): Latitude coordinate
- `longitude` (required): Longitude coordinate
- `radius`: Search radius in kilometers (default: 50)
- `min_beds`: Minimum available general beds
- `min_icu_beds`: Minimum available ICU beds
- `trauma_bay_required`: Boolean for trauma bay requirement
- `trauma_level`: Filter by trauma level (Level 1, 2, or 3)
- `service`: Filter by specialist service (e.g., "cardiology")
- `blood_type`: Filter by blood type availability
- `equipment`: Filter by equipment (e.g., "mri")
- `limit`: Maximum number of results

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "City General Hospital",
      "distance": "2.5",
      "capacity": {
        "beds": { "total": 200, "available": 150 },
        "icu": { "total": 40, "available": 30 },
        "trauma": { "total": 10, "available": 8 }
      },
      "trauma_level": "Level 1"
    }
  ]
}
```

#### Find Optimal Hospital (DISPATCHER)
```
POST /api/hospitals/find-optimal
```

**Request Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "incident_type": "CARDIAC",
  "severity": "critical",
  "patient_condition": {
    "requires_icu": true,
    "blood_type": "O+",
    "equipment_required": "cath_lab"
  },
  "radius": 50,
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "City General Hospital",
      "distance": "2.5",
      "trauma_level": "Level 1",
      "capacity": {
        "beds": 150,
        "icu": 30,
        "trauma": 8
      },
      "services": ["cardiology", "neurology", "trauma_surgery"],
      "specialist_match": true,
      "match_score": 100,
      "required_specialists": ["cardiology"],
      "scores": {
        "capacity": 85.5,
        "distance": 95.0,
        "specialist": 100,
        "total": 91.7
      },
      "recommended": true
    }
  ]
}
```

### Specialist Management

#### Update Specialist Availability (HOSPITAL_STAFF)
```
PUT /api/hospitals/:id/specialists
```

**Request Body:**
```json
{
  "specialists": [
    "cardiology",
    "neurology",
    "trauma_surgery",
    "orthopedics",
    "obstetrics",
    "pediatrics"
  ]
}
```

**Available Specialist Types:**
- `cardiology`
- `neurology`
- `trauma_surgery`
- `orthopedics`
- `obstetrics`
- `pediatrics`
- `burn_unit`
- `neurosurgery`
- `pulmonology`
- `oncology`
- `nephrology`
- `gastroenterology`

### Blood Bank Management

#### Update Blood Inventory (HOSPITAL_STAFF)
```
PUT /api/hospitals/:id/blood-bank
```

**Request Body:**
```json
{
  "O-": 45,
  "O+": 95,
  "A-": 28,
  "A+": 75,
  "B-": 18,
  "B+": 55,
  "AB-": 8,
  "AB+": 35
}
```

#### Check Blood Availability
```
GET /api/hospitals/:id/blood-availability?blood_type=O-&units_required=2
```

**Response:**
```json
{
  "success": true,
  "data": {
    "blood_type": "O-",
    "available": 45,
    "required": 2,
    "sufficient": true
  }
}
```

#### Find Hospitals with Blood (DISPATCHER)
```
GET /api/hospitals/blood/find?blood_type=AB-&latitude=40.7128&longitude=-74.0060&radius=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "City General Hospital",
      "distance": "2.5",
      "available_blood_types": ["O-", "A-", "B-", "AB-"]
    }
  ]
}
```

### Patient Acceptance/Rejection

#### Accept Patient (HOSPITAL_STAFF)
```
POST /api/hospitals/:id/accept-patient
```

**Request Body:**
```json
{
  "patient_id": "patient_12345",
  "ambulance_id": "amb_67890",
  "requires_icu": true,
  "requires_trauma": false,
  "alert_id": "alert_98765"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Patient accepted",
    "bed_type": "icu",
    "hospital_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Reject Patient (HOSPITAL_STAFF)
```
POST /api/hospitals/:id/reject-patient
```

**Request Body:**
```json
{
  "patient_id": "patient_12345",
  "reason": "No ICU beds available"
}
```

### Pre-Arrival Alerts

#### Send Pre-Arrival Alert (DISPATCHER)
```
POST /api/hospitals/:id/alerts
```

**Request Body:**
```json
{
  "ambulance_id": "amb_67890",
  "severity": "critical",
  "incident_type": "CARDIAC",
  "eta": 15,
  "vital_signs": {
    "heart_rate": 120,
    "blood_pressure_systolic": 80,
    "blood_pressure_diastolic": 50,
    "oxygen_saturation": 88,
    "respiratory_rate": 24
  },
  "medical_history": {
    "allergies": ["penicillin"],
    "medications": ["aspirin", "metformin"]
  },
  "requires_blood": true,
  "blood_type": "A+"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert_550e8400",
    "hospital_id": "hospital_12345",
    "ambulance_id": "amb_67890",
    "patient_info": {
      "severity": "critical",
      "incident_type": "CARDIAC",
      "vital_signs": { ... },
      "medical_history": { ... }
    },
    "eta": 15,
    "required_preparation": [
      "Prepare cardiac catheterization lab",
      "Alert cardiologist on call",
      "Have defibrillator ready",
      "Prepare IV fluids and vasopressors",
      "Prepare oxygen and ventilator",
      "Prepare A+ blood units"
    ],
    "sent_at": "2024-01-15T10:30:00Z",
    "acknowledged": false,
    "acknowledgment_deadline": "2024-01-15T10:32:00Z",
    "escalated": false
  }
}
```

#### Get Hospital Alerts (HOSPITAL_STAFF)
```
GET /api/hospitals/:id/alerts
```

#### Acknowledge Alert (HOSPITAL_STAFF)
```
POST /api/hospitals/:id/alerts/acknowledge
```

**Request Body:**
```json
{
  "alert_id": "alert_550e8400"
}
```

#### Get Alert Statistics (HOSPITAL_STAFF, ADMIN)
```
GET /api/hospitals/:id/alerts/statistics?time_range=24
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_alerts": 45,
    "acknowledged": 42,
    "escalated": 3,
    "patient_arrived": 40,
    "acknowledgment_rate": 93,
    "avg_acknowledgment_time_seconds": 45,
    "time_range_hours": 24
  }
}
```

## Incident Type to Specialist Mapping

| Incident Type | Required Specialists |
|--------------|---------------------|
| CARDIAC | cardiology |
| STROKE | neurology |
| TRAUMA | trauma_surgery, orthopedics |
| MATERNITY | obstetrics |
| PEDIATRIC | pediatrics |
| BURN | burn_unit |
| NEURO | neurology, neurosurgery |
| RESPIRATORY | pulmonology |
| ACCIDENT | trauma_surgery, orthopedics |
| FALL | orthopedics |

## Blood Type Compatibility

Recipients can receive from the following donors:

| Recipient | Compatible Donors |
|-----------|------------------|
| O- | O- |
| O+ | O-, O+ |
| A- | O-, A- |
| A+ | O-, O+, A-, A+ |
| B- | O-, B- |
| B+ | O-, O+, B-, B+ |
| AB- | O-, A-, B-, AB- |
| AB+ | All types |

## Capacity Scoring Algorithm

The system calculates a capacity score (0-100) based on:

- **Bed Availability (30%)**: Ratio of available beds to total beds
- **ICU Availability (25%)**: Ratio of available ICU beds to total ICU beds (if required)
- **Trauma Availability (20%)**: Ratio of available trauma bays to total trauma bays (if required)
- **Specialist Match (15%)**: Whether required specialists are available
- **Equipment Match (10%)**: Whether required equipment is available

## Optimal Hospital Ranking

When finding the optimal hospital, the system ranks based on:

- **Capacity Score (40%)**: Hospital's current capacity and availability
- **Distance Score (30%)**: Proximity to incident location
- **Specialist Score (30%)**: Match with required specialists

Hospitals with a total score >= 70 are marked as "recommended".

## Bed Reservation System

1. **Reserve**: Dispatcher reserves a bed when assigning ambulance
2. **Hold**: Bed is held for 30 minutes
3. **Auto-Release**: If ambulance doesn't arrive, bed is automatically released
4. **Confirm**: When patient arrives, reservation is confirmed and bed is occupied

## Alert Workflow

1. **Send**: Dispatcher sends pre-arrival alert with patient details and ETA
2. **Acknowledge**: Hospital staff must acknowledge within 2 minutes
3. **Escalate**: If not acknowledged, alert is automatically escalated
4. **Arrive**: When patient arrives, alert is marked as complete

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error 1", "Detailed error 2"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Authentication & Authorization

All endpoints require authentication except public hospital listings.

**Role-Based Access:**
- **ADMIN**: Full access to all endpoints
- **DISPATCHER**: Search, alerts, reservations
- **HOSPITAL_STAFF**: Capacity updates, alerts, patient acceptance
- **PARAMEDIC**: View hospitals, nearby search

## Database Schema

```sql
CREATE TABLE hospitals (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  total_beds INTEGER DEFAULT 0,
  icu_beds INTEGER DEFAULT 0,
  trauma_bays INTEGER DEFAULT 0,
  available_beds INTEGER DEFAULT 0,
  available_icu_beds INTEGER DEFAULT 0,
  available_trauma_bays INTEGER DEFAULT 0,
  trauma_level VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  services JSONB DEFAULT '[]',
  equipment JSONB DEFAULT '{}',
  blood_inventory JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hospitals_location ON hospitals USING GIST(
  ll_to_earth(latitude, longitude)
);
CREATE INDEX idx_hospitals_status ON hospitals(status);
CREATE INDEX idx_hospitals_trauma_level ON hospitals(trauma_level);
CREATE INDEX idx_hospitals_services ON hospitals USING GIN(services);
```

## Redis Cache Keys

- `hospital:{id}:specialists` - Cached specialist availability (1 hour TTL)
- `hospital:{id}:schedule` - Specialist schedule (24 hour TTL)
- `hospital:{id}:alerts` - Active alerts list
- `hospital:{id}:escalated_alerts` - Escalated alerts
- `alert:{id}` - Alert details (1 hour TTL)
- `reservation:{id}` - Bed reservation (30 minute TTL)

## Performance Considerations

- Geospatial queries use PostgreSQL's built-in distance calculations
- Specialist availability is cached in Redis for 1 hour
- Bed reservations auto-expire using Redis TTL
- Alert escalations run asynchronously

## Future Enhancements

- [ ] Real-time WebSocket updates for capacity changes
- [ ] Machine learning for ETA prediction
- [ ] Historical analytics and reporting
- [ ] Integration with hospital EMR systems
- [ ] Mobile app for hospital staff
- [ ] Automated bed allocation optimization

## Support

For issues or questions, contact the development team or refer to the main ambulance dispatch system documentation.
