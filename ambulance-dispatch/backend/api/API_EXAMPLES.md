# API Examples Collection

Complete collection of API request examples for testing the Ambulance Dispatch System API Gateway.

## Variables

Set these variables before running requests:
- `BASE_URL`: http://localhost:3000
- `TOKEN`: Your JWT token (obtained from login)
- `ADMIN_TOKEN`: Admin user JWT token

---

## Authentication

### Register User

**POST** `/api/auth/register`

```json
{
  "email": "dispatcher@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Dispatcher",
  "phoneNumber": "+1234567890",
  "role": "dispatcher"
}
```

### Register Driver

```json
{
  "email": "driver1@example.com",
  "password": "DriverPass123!",
  "firstName": "Mike",
  "lastName": "Driver",
  "phoneNumber": "+1234567891",
  "role": "driver"
}
```

### Login

**POST** `/api/auth/login`

```json
{
  "email": "dispatcher@example.com",
  "password": "SecurePass123!"
}
```

### Logout

**POST** `/api/auth/logout`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Refresh Token

**POST** `/api/auth/refresh`

```json
{
  "refreshToken": "your-refresh-token"
}
```

---

## Incidents

### Create Emergency Incident

**POST** `/api/incidents`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

```json
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "350 5th Ave, New York, NY 10118"
  },
  "severity": "critical",
  "description": "70-year-old male, unconscious, not breathing. Bystander performing CPR.",
  "contactNumber": "+12125551234",
  "patientInfo": {
    "name": "Robert Johnson",
    "age": 70,
    "gender": "male"
  }
}
```

### Get All Incidents (Dispatcher/Admin)

**GET** `/api/incidents?page=1&limit=20&status=pending`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Incident by ID

**GET** `/api/incidents/:id`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Update Incident Status

**PUT** `/api/incidents/:id/status`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

```json
{
  "status": "dispatched",
  "notes": "Ambulance dispatched to scene"
}
```

Status values: `pending`, `dispatched`, `in_progress`, `completed`, `cancelled`

### Delete Incident (Admin only)

**DELETE** `/api/incidents/:id`

Headers:
```
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

## Ambulances

### Get All Ambulances

**GET** `/api/ambulances?status=available&page=1&limit=20`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Available Ambulances Near Location

**GET** `/api/ambulances/available?latitude=40.7128&longitude=-74.0060&radius=10`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Ambulance by ID

**GET** `/api/ambulances/:id`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Update Ambulance GPS Location

**PUT** `/api/ambulances/:id/location`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

```json
{
  "latitude": 40.7580,
  "longitude": -73.9855,
  "heading": 45.5,
  "speed": 65.2
}
```

### Update Ambulance Status

**PUT** `/api/ambulances/:id/status`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

```json
{
  "status": "en_route"
}
```

Status values: `available`, `dispatched`, `en_route`, `at_scene`, `transporting`, `at_hospital`, `offline`

---

## Hospitals

### Get All Hospitals

**GET** `/api/hospitals?page=1&limit=20&specialty=cardiology`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Find Nearby Hospitals

**GET** `/api/hospitals/nearby?latitude=40.7128&longitude=-74.0060&radius=5&specialty=emergency`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Hospital by ID

**GET** `/api/hospitals/:id`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Hospital Capacity

**GET** `/api/hospitals/:id/capacity`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Update Hospital Capacity

**PUT** `/api/hospitals/:id/capacity`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

```json
{
  "emergencyBeds": 15,
  "icuBeds": 8,
  "ventilators": 5,
  "operatingRooms": 3
}
```

---

## Assignments

### Create Assignment (Dispatcher/Admin)

**POST** `/api/assignments`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

```json
{
  "incidentId": "uuid-of-incident",
  "ambulanceId": "uuid-of-ambulance",
  "driverId": "uuid-of-driver",
  "paramedicIds": ["uuid-paramedic-1", "uuid-paramedic-2"],
  "priority": "emergency"
}
```

Priority values: `emergency`, `urgent`, `normal`

### Get All Assignments

**GET** `/api/assignments?status=assigned&page=1&limit=20`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Assignment by ID

**GET** `/api/assignments/:id`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Update Assignment Status

**PUT** `/api/assignments/:id/status`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

```json
{
  "status": "in_progress"
}
```

---

## Drivers

### Get All Drivers (Admin/Dispatcher)

**GET** `/api/drivers?status=active&page=1&limit=20`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get My Driver Profile

**GET** `/api/drivers/me`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Driver by ID

**GET** `/api/drivers/:id`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Update Driver Status

**PUT** `/api/drivers/:id/status`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

```json
{
  "status": "on_duty"
}
```

### Get Driver Assignments

**GET** `/api/drivers/:id/assignments?status=assigned&page=1&limit=20`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

---

## Tracking

### Get Location History

**GET** `/api/tracking/locations/:vehicleId?startTime=2024-01-15T00:00:00Z&endTime=2024-01-15T23:59:59Z`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Live Location

**GET** `/api/tracking/live/:vehicleId`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Route Information

**GET** `/api/tracking/route/:assignmentId`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

---

## Analytics

### Get Dashboard Stats (Admin/Dispatcher)

**GET** `/api/analytics/dashboard?startDate=2024-01-01&endDate=2024-01-31`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

### Get Incident Statistics

**GET** `/api/analytics/incidents/stats?period=7d`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

Period values: `24h`, `7d`, `30d`, `90d`, `1y`

### Get Response Time Analytics

**GET** `/api/analytics/response-times?startDate=2024-01-01&endDate=2024-01-31&groupBy=day`

Headers:
```
Authorization: Bearer {{TOKEN}}
```

GroupBy values: `hour`, `day`, `week`, `month`

### Get Performance Metrics (Admin)

**GET** `/api/analytics/performance?period=30d`

Headers:
```
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

## System Endpoints

### Health Check

**GET** `/health`

No authentication required.

### Readiness Check

**GET** `/health/ready`

No authentication required.

### Liveness Check

**GET** `/health/live`

No authentication required.

### Get System Metrics (Admin)

**GET** `/metrics`

Headers:
```
Authorization: Bearer {{ADMIN_TOKEN}}
```

### Reset Metrics (Admin)

**POST** `/metrics/reset`

Headers:
```
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

## Complete Workflow Example

### 1. Emergency Response Flow

```bash
# 1. User calls 911, operator creates incident
POST /api/incidents
{
  "location": {"latitude": 40.7128, "longitude": -74.0060},
  "severity": "critical",
  "description": "Heart attack patient"
}

# 2. Dispatcher finds available ambulances nearby
GET /api/ambulances/available?latitude=40.7128&longitude=-74.0060&radius=10

# 3. Dispatcher creates assignment
POST /api/assignments
{
  "incidentId": "incident-uuid",
  "ambulanceId": "ambulance-uuid"
}

# 4. Driver updates location in real-time
PUT /api/ambulances/ambulance-uuid/location
{
  "latitude": 40.7200,
  "longitude": -74.0100
}

# 5. Driver arrives at scene
PUT /api/incidents/incident-uuid/status
{
  "status": "in_progress"
}

# 6. Find nearest hospital
GET /api/hospitals/nearby?latitude=40.7128&longitude=-74.0060&radius=5

# 7. Transport to hospital
PUT /api/ambulances/ambulance-uuid/status
{
  "status": "transporting"
}

# 8. Complete incident
PUT /api/incidents/incident-uuid/status
{
  "status": "completed"
}
```

### 2. Driver Daily Workflow

```bash
# 1. Driver logs in
POST /api/auth/login

# 2. Check own profile
GET /api/drivers/me

# 3. Update status to on-duty
PUT /api/drivers/driver-uuid/status
{"status": "on_duty"}

# 4. Check assignments
GET /api/drivers/driver-uuid/assignments

# 5. Update location periodically
PUT /api/ambulances/ambulance-uuid/location
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Common error codes:
- `VALIDATION_ERROR` (400)
- `AUTHENTICATION_ERROR` (401)
- `AUTHORIZATION_ERROR` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `RATE_LIMIT_EXCEEDED` (429)
- `SERVICE_UNAVAILABLE` (503)

---

## Rate Limits

Be aware of rate limits:
- Default endpoints: 100 requests / 15 minutes
- Auth endpoints: 10 requests / 15 minutes
- Emergency creation: 10 requests / 1 minute

Response headers include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
```

---

**Testing Tool Recommendations:**
- Postman
- Insomnia
- cURL
- Thunder Client (VS Code extension)
