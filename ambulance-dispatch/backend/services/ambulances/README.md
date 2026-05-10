# Ambulance Management Service

Complete ambulance fleet management system with real-time availability tracking, geospatial queries, driver management, and equipment monitoring.

## Features

### 🚑 Ambulance Management
- **Fleet Registration**: Register and manage ambulance units (ALS, BLS, NEONATAL)
- **Real-time Status Tracking**: AVAILABLE, DISPATCHED, BUSY, OFFLINE, OUT_OF_SERVICE
- **GPS Location Tracking**: Real-time location updates with PostGIS geospatial indexing
- **Fuel Level Monitoring**: Track fuel levels with automatic low-fuel alerts (<25%)
- **Equipment Inventory**: Track equipment and capabilities per ambulance
- **Maintenance Scheduling**: Schedule and track maintenance records

### 👨‍⚕️ Driver Management
- **Driver Registration**: License tracking and certification management
- **Shift Management**: ON_DUTY, OFF_DUTY, BREAK status tracking
- **Ambulance Assignment**: Assign drivers to specific ambulances
- **Performance Metrics**: Track driver performance and history
- **Location Tracking**: Real-time driver location updates

### 📍 Geospatial Capabilities
- **Nearest Ambulance Search**: Find closest available units to incident location
- **Radius Search**: Find all ambulances within specified distance
- **Distance Calculation**: Calculate distances using PostGIS ST_Distance
- **Optimal Unit Selection**: AI-based selection considering distance, fuel, equipment, type
- **Coverage Analysis**: Identify coverage gaps and generate coverage maps

### 🔄 Availability Logic
- **Auto-status Updates**: Automatically update status based on incident state
- **Validation Rules**: Prevent invalid status transitions
- **History Tracking**: Complete audit trail of status changes
- **Stats Dashboard**: Real-time fleet availability statistics

## Database Schema

### Tables

#### `ambulances`
```sql
- id (UUID, PK)
- call_sign (VARCHAR, UNIQUE) - Unit identifier (e.g., "AMB-01")
- type (VARCHAR) - ALS, BLS, NEONATAL
- status (VARCHAR) - AVAILABLE, DISPATCHED, BUSY, OFFLINE, OUT_OF_SERVICE
- location (GEOGRAPHY) - PostGIS point for geospatial queries
- latitude (DECIMAL)
- longitude (DECIMAL)
- fuel_level (INTEGER) - 0-100%
- base_station (VARCHAR)
- equipment (JSONB) - Array of equipment items
- metadata (JSONB) - Additional custom data
- last_maintenance_date (TIMESTAMP)
- next_maintenance_date (TIMESTAMP)
- mileage (INTEGER)
- created_at, updated_at, deleted_at
```

#### `ambulance_drivers`
```sql
- id (UUID, PK)
- user_id (UUID) - References user account
- license_number (VARCHAR, UNIQUE)
- license_expiry (DATE)
- certifications (JSONB)
- shift_status (VARCHAR) - ON_DUTY, OFF_DUTY, BREAK
- current_ambulance_id (UUID, FK)
- shift_start_time (TIMESTAMP)
- shift_end_time (TIMESTAMP)
- location (GEOGRAPHY)
- latitude, longitude (DECIMAL)
- performance_metrics (JSONB)
- created_at, updated_at, deleted_at
```

#### `ambulance_equipment`
```sql
- id (UUID, PK)
- ambulance_id (UUID, FK)
- equipment_name (VARCHAR)
- equipment_type (VARCHAR)
- status (VARCHAR) - OPERATIONAL, NEEDS_CHECK, DEFECTIVE, MISSING
- quantity (INTEGER)
- expiry_date (DATE)
- last_checked (TIMESTAMP)
- next_check_date (TIMESTAMP)
- notes (TEXT)
```

#### `ambulance_status_history`
```sql
- id (UUID, PK)
- ambulance_id (UUID, FK)
- previous_status (VARCHAR)
- new_status (VARCHAR)
- changed_by (UUID) - User who made the change
- reason (TEXT)
- incident_id (UUID) - Related incident if applicable
- location (GEOGRAPHY)
- created_at (TIMESTAMP)
```

#### `ambulance_maintenance`
```sql
- id (UUID, PK)
- ambulance_id (UUID, FK)
- maintenance_type (VARCHAR)
- description (TEXT)
- scheduled_date (TIMESTAMP)
- completed_date (TIMESTAMP)
- status (VARCHAR) - SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
- cost (DECIMAL)
- performed_by (VARCHAR)
- mileage_at_service (INTEGER)
- notes (TEXT)
```

## API Endpoints

### Ambulance Endpoints

#### Create Ambulance
```http
POST /api/ambulances
Authorization: Bearer <token> (ADMIN role required)
Content-Type: application/json

{
  "callSign": "AMB-01",
  "type": "ALS",
  "baseStation": "Station Alpha",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "equipment": [
    "defibrillator",
    "ventilator",
    "oxygen",
    "stretcher",
    "medications"
  ],
  "metadata": {
    "vehicle_make": "Ford",
    "vehicle_model": "F-450",
    "year": 2023
  }
}

Response: 201 Created
{
  "success": true,
  "message": "Ambulance created successfully",
  "data": {
    "id": "uuid",
    "callSign": "AMB-01",
    "type": "ALS",
    "status": "OFFLINE",
    ...
  }
}
```

#### Get All Ambulances
```http
GET /api/ambulances?type=ALS&status=AVAILABLE&page=1&limit=50
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

#### Get Available Ambulances
```http
GET /api/ambulances/available?type=BLS&latitude=40.7128&longitude=-74.0060&maxDistance=20
Authorization: Bearer <token> (DISPATCHER role required)

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "callSign": "AMB-02",
      "type": "BLS",
      "status": "AVAILABLE",
      "distance": 3.5,
      "fuelLevel": 85,
      ...
    }
  ]
}
```

#### Get Ambulance Details
```http
GET /api/ambulances/:id
Authorization: Bearer <token>

Response: 200 OK
```

#### Update Ambulance
```http
PUT /api/ambulances/:id
Authorization: Bearer <token> (ADMIN role required)
Content-Type: application/json

{
  "callSign": "AMB-01-A",
  "baseStation": "Station Beta",
  "equipment": ["defibrillator", "oxygen"]
}

Response: 200 OK
```

#### Update Status
```http
PUT /api/ambulances/:id/status
Authorization: Bearer <token> (DRIVER or DISPATCHER role)
Content-Type: application/json

{
  "status": "AVAILABLE",
  "reason": "Incident completed"
}

Response: 200 OK
```

#### Update Location (GPS)
```http
PUT /api/ambulances/:id/location
Authorization: Bearer <token> (DRIVER role)
Content-Type: application/json

{
  "latitude": 40.7580,
  "longitude": -73.9855
}

Response: 200 OK
```

#### Update Fuel Level
```http
PUT /api/ambulances/:id/fuel
Authorization: Bearer <token> (DRIVER role)
Content-Type: application/json

{
  "fuelLevel": 65
}

Response: 200 OK
```

#### Get Nearby Ambulances (Geospatial)
```http
GET /api/ambulances/nearby?latitude=40.7128&longitude=-74.0060&maxDistance=50&type=ALS&limit=10
Authorization: Bearer <token> (DISPATCHER role)

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "callSign": "AMB-01",
      "type": "ALS",
      "status": "AVAILABLE",
      "distance": 2.3,
      "latitude": 40.7156,
      "longitude": -74.0095,
      "fuelLevel": 90,
      "equipment": [...],
      "driver": {
        "id": "uuid",
        "shiftStatus": "ON_DUTY"
      }
    }
  ]
}
```

#### Find Optimal Ambulance
```http
POST /api/ambulances/find-optimal
Authorization: Bearer <token> (DISPATCHER role)
Content-Type: application/json

{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "type": "ALS",
  "equipment": ["defibrillator", "ventilator"],
  "minFuelLevel": 30,
  "maxResponseTime": 15
}

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "callSign": "AMB-03",
    "distance": 4.2,
    "estimatedResponseTime": 5,
    "priorityScore": 87.6,
    ...
  }
}
```

#### Get Status History
```http
GET /api/ambulances/:id/history?limit=50
Authorization: Bearer <token>

Response: 200 OK
```

#### Get Availability Stats
```http
GET /api/ambulances/stats
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": {
    "total": 25,
    "byType": {
      "ALS": {
        "total": 10,
        "available": 6,
        "dispatched": 2,
        "busy": 1,
        "offline": 1,
        "outOfService": 0
      },
      "BLS": {...},
      "NEONATAL": {...}
    },
    "byStatus": {
      "AVAILABLE": 15,
      "DISPATCHED": 5,
      "BUSY": 3,
      "OFFLINE": 2,
      "OUT_OF_SERVICE": 0
    }
  }
}
```

#### Get Low Fuel Ambulances
```http
GET /api/ambulances/low-fuel?threshold=25
Authorization: Bearer <token>

Response: 200 OK
```

#### Get Coverage Map
```http
GET /api/ambulances/coverage
Authorization: Bearer <token>

Response: 200 OK
```

### Driver Endpoints

#### Create Driver
```http
POST /api/ambulances/drivers
Authorization: Bearer <token> (ADMIN role)
Content-Type: application/json

{
  "userId": "uuid",
  "licenseNumber": "DL123456",
  "licenseExpiry": "2025-12-31",
  "certifications": ["EMT-B", "CPR", "ACLS"]
}

Response: 201 Created
```

#### Get Driver
```http
GET /api/ambulances/drivers/:id
Authorization: Bearer <token>

Response: 200 OK
```

#### Assign Driver to Ambulance
```http
POST /api/ambulances/drivers/assign
Authorization: Bearer <token> (DISPATCHER role)
Content-Type: application/json

{
  "driverId": "uuid",
  "ambulanceId": "uuid"
}

Response: 200 OK
```

#### Start Shift
```http
POST /api/ambulances/drivers/:id/shift/start
Authorization: Bearer <token> (DRIVER role)
Content-Type: application/json

{
  "ambulanceId": "uuid"
}

Response: 200 OK
```

#### End Shift
```http
POST /api/ambulances/drivers/:id/shift/end
Authorization: Bearer <token> (DRIVER role)

Response: 200 OK
```

#### Update Driver Location
```http
PUT /api/ambulances/drivers/:id/location
Authorization: Bearer <token> (DRIVER role)
Content-Type: application/json

{
  "latitude": 40.7128,
  "longitude": -74.0060
}

Response: 200 OK
```

#### Get On-Duty Drivers
```http
GET /api/ambulances/drivers/on-duty
Authorization: Bearer <token>

Response: 200 OK
```

## Service Methods

### AmbulanceService (`service.js`)

```javascript
const ambulanceService = require('./services/ambulances/service');

// Create ambulance
await ambulanceService.create({
  callSign, type, baseStation, equipment, latitude, longitude, metadata
});

// Find by ID
await ambulanceService.findById(ambulanceId);

// Find all with filters
await ambulanceService.findAll({ type, status, baseStation, minFuelLevel, page, limit });

// Find available ambulances
await ambulanceService.findAvailable({ type, latitude, longitude, maxDistance, minFuelLevel });

// Update ambulance
await ambulanceService.update(ambulanceId, updateData);

// Update status
await ambulanceService.updateStatus(ambulanceId, newStatus, { userId, reason, incidentId });

// Update location
await ambulanceService.updateLocation(ambulanceId, latitude, longitude);

// Update fuel level
await ambulanceService.updateFuelLevel(ambulanceId, fuelLevel);

// Get status history
await ambulanceService.getStatusHistory(ambulanceId, limit);

// Delete (soft delete)
await ambulanceService.delete(ambulanceId);
```

### DriverService (`driver-service.js`)

```javascript
const driverService = require('./services/ambulances/driver-service');

// Create driver
await driverService.create({ userId, licenseNumber, licenseExpiry, certifications });

// Find driver
await driverService.findById(driverId);
await driverService.findByUserId(userId);

// Assign to ambulance
await driverService.assignToAmbulance(driverId, ambulanceId);
await driverService.unassignFromAmbulance(driverId);

// Shift management
await driverService.startShift(driverId, ambulanceId);
await driverService.endShift(driverId);
await driverService.updateShiftStatus(driverId, status);

// Location tracking
await driverService.updateLocation(driverId, latitude, longitude);

// Performance metrics
await driverService.updatePerformanceMetrics(driverId, metrics);

// Get on-duty drivers
await driverService.getOnDutyDrivers();
```

### AvailabilityService (`availability.js`)

```javascript
const availabilityService = require('./services/ambulances/availability');

// Status transitions
await availabilityService.markAsDispatched(ambulanceId, incidentId, userId);
await availabilityService.markAsBusy(ambulanceId, reason, userId);
await availabilityService.markAsAvailable(ambulanceId, userId);
await availabilityService.markAsOffline(ambulanceId, reason, userId);
await availabilityService.markAsOutOfService(ambulanceId, reason, userId);

// Stats and monitoring
await availabilityService.getAvailabilityStats();
await availabilityService.checkLowFuelAmbulances(threshold);

// Auto-update from incident
await availabilityService.autoUpdateFromIncident(incidentId, incidentStatus, ambulanceId);
```

### GeospatialService (`geospatial.js`)

```javascript
const geospatialService = require('./services/ambulances/geospatial');

// Find nearest ambulances
await geospatialService.findNearestAmbulances(latitude, longitude, {
  type, maxDistance, limit, minFuelLevel, requiredEquipment, status
});

// Radius search
await geospatialService.findAmbulancesInRadius(latitude, longitude, radiusKm, filters);

// Distance calculations
await geospatialService.calculateDistance(fromLat, fromLon, toLat, toLon);
await geospatialService.getDistanceToAmbulance(ambulanceId, latitude, longitude);

// Optimal selection
await geospatialService.findOptimalAmbulance(incidentLocation, requirements);

// Coverage analysis
await geospatialService.getCoverageMap(gridSize);
await geospatialService.findCoverageGaps(targetCoverageRadius);
```

## Status Workflow

### Valid Status Transitions

```
OFFLINE → AVAILABLE (requires on-duty driver)
AVAILABLE → DISPATCHED (incident assigned)
DISPATCHED → BUSY (arrived at scene)
BUSY → AVAILABLE (incident completed, driver on duty)
BUSY → OFFLINE (incident completed, no driver)
AVAILABLE → OFFLINE (end of shift)
ANY → OUT_OF_SERVICE (maintenance/repair)
OUT_OF_SERVICE → OFFLINE (repair completed)
```

### Auto-status Updates

When integrated with incident system:
- Incident status `DISPATCHED` → Ambulance `DISPATCHED`
- Incident status `ON_SCENE` → Ambulance `BUSY`
- Incident status `TRANSPORTING` → Ambulance `BUSY`
- Incident status `COMPLETED` → Ambulance `AVAILABLE` (if driver on duty) or `OFFLINE`

## Geospatial Features

### PostGIS Integration

Uses PostGIS extension for efficient geospatial queries:
- `ST_Distance`: Calculate distance between points
- `ST_DWithin`: Find points within radius
- `ST_SetSRID`: Set spatial reference (WGS84 - SRID 4326)
- `ST_MakePoint`: Create geography points
- Spatial indexes for fast queries

### Distance Calculation

```javascript
// Haversine formula fallback
const distance = geospatialService.haversineDistance(
  lat1, lon1, lat2, lon2
); // Returns distance in km
```

## Equipment Tracking

Example equipment array:
```json
[
  "defibrillator",
  "ventilator",
  "oxygen_tank",
  "stretcher",
  "spinal_board",
  "medications",
  "IV_supplies",
  "trauma_kit",
  "pediatric_kit"
]
```

Query by equipment:
```javascript
// Find ambulances with specific equipment
await ambulanceService.findAvailable({
  requiredEquipment: ["defibrillator", "ventilator"]
});
```

## Fuel Level Alerts

- **Warning Threshold**: 25%
- **Critical Threshold**: 10%
- Automatic logging when fuel drops below threshold
- Prevents dispatch of low-fuel units

## Integration Guide

### Initialize Tables

```javascript
const { createTables } = require('./services/ambulances/model');
await createTables();
```

### Register Routes in Express App

```javascript
const ambulanceRoutes = require('./services/ambulances/routes');
app.use('/api/ambulances', ambulanceRoutes);
```

### Hook into Incident System

```javascript
// In incident update handler
const availabilityService = require('./services/ambulances/availability');

// Auto-update ambulance status when incident status changes
await availabilityService.autoUpdateFromIncident(
  incidentId,
  newIncidentStatus,
  assignedAmbulanceId
);
```

## Testing Examples

```javascript
// Create ambulance
const amb1 = await ambulanceService.create({
  callSign: 'AMB-01',
  type: 'ALS',
  baseStation: 'Central Station',
  latitude: 40.7128,
  longitude: -74.0060,
  equipment: ['defibrillator', 'ventilator', 'oxygen'],
});

// Create driver and start shift
const driver = await driverService.create({
  userId: 'user-uuid',
  licenseNumber: 'DL123456',
  licenseExpiry: '2025-12-31',
  certifications: ['EMT-P', 'ACLS'],
});

await driverService.startShift(driver.id, amb1.id);

// Mark ambulance as available
await availabilityService.markAsAvailable(amb1.id);

// Find nearest available ambulance
const nearest = await geospatialService.findNearestAmbulances(
  40.7580, -73.9855, // Times Square
  { type: 'ALS', limit: 1 }
);

// Dispatch to incident
await availabilityService.markAsDispatched(amb1.id, 'incident-uuid');

// Update location during transit
await ambulanceService.updateLocation(amb1.id, 40.7589, -73.9851);

// Mark as busy (arrived)
await availabilityService.markAsBusy(amb1.id, 'On scene');

// Complete incident
await availabilityService.markAsAvailable(amb1.id);
```

## Performance Considerations

- Spatial indexes on `location` column for fast geospatial queries
- Indexes on `status`, `type` for filtering
- Soft deletes with `deleted_at` timestamp
- Pagination on list queries
- Connection pooling via `pg` pool
- Query result caching recommended for stats endpoints

## Security & Authorization

Role-based access control:
- **ADMIN**: Create/update/delete ambulances, manage drivers
- **DISPATCHER**: View all, update status, assign drivers, geospatial queries
- **DRIVER**: Update own location, fuel level, shift status
- **PUBLIC**: No access

## Future Enhancements

- [ ] Route optimization integration (Google Maps API, OSRM)
- [ ] Real-time WebSocket updates for location tracking
- [ ] Predictive maintenance based on mileage/usage
- [ ] Equipment expiry notifications
- [ ] Driver fatigue monitoring
- [ ] Integration with dispatch optimization algorithms
- [ ] Historical analytics and reporting
- [ ] Mobile app SDK for driver updates

## Dependencies

```json
{
  "pg": "^8.11.3",
  "uuid": "^9.0.1",
  "express": "^4.18.2"
}
```

PostGIS extension must be installed on PostgreSQL database.

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-04  
**Maintainer**: Ambulance Dispatch System Team
