# Hospital Allocation & Scoring System

## Overview

Intelligent hospital selection algorithm that ranks hospitals based on multiple weighted factors, NOT just distance. The system provides transparent, data-driven recommendations for optimal hospital allocation during emergency incidents.

## Scoring Formula

```
Hospital_Score = weighted_sum(
  travel_time_score,      // 30% weight - Lower time = higher score
  bed_availability_score, // 25% weight - More beds = higher score
  specialist_match_score, // 20% weight - Has required specialist = high score
  urgency_match_score,    // 15% weight - ICU for critical patients
  facility_capability,    // 10% weight - Equipment match
)
```

## Scoring Factors

### 1. Travel Time Score (30% Weight)

**Purpose:** Minimize time to hospital while accounting for traffic

**Calculation:**
```javascript
raw_score = 100 - (travel_time_minutes * 2)
weighted_score = raw_score * 0.30
```

**Example:**
- 10 min travel → 80 raw score → 24.0 weighted
- 20 min travel → 60 raw score → 18.0 weighted
- 50 min travel → 0 raw score → 0.0 weighted
- >50 min travel → 0 (hospital filtered out)

**Traffic Multiplier:**
- Morning rush (7-9 AM): 1.5x
- Evening rush (5-7 PM): 1.5x
- Other times: 1.0x

### 2. Bed Availability Score (25% Weight)

**Purpose:** Ensure hospital can accept patient

**Calculation:**
```javascript
// For critical patients (needs ICU)
raw_score = (icu_beds_available / total_icu_beds) * 100

// For other patients
raw_score = (general_beds_available / total_general_beds) * 100

weighted_score = raw_score * 0.25
```

**Example:**
- 23 / 25 general beds → 92% → 23.0 weighted
- 5 / 10 ICU beds → 50% → 12.5 weighted
- 0 beds → 0 score (hospital filtered out)

### 3. Specialist Match Score (20% Weight)

**Purpose:** Match patient condition to medical expertise

**Specialist Requirements:**
- **CARDIAC** → Cardiologist required
- **STROKE** → Neurologist required
- **TRAUMA** → Trauma surgeon required
- **MATERNITY** → Obstetrician required
- **MEDICAL/OTHER** → General physician (baseline 50 points)

**Calculation:**
```javascript
if (has_required_specialist) {
  raw_score = 100
} else if (general_case) {
  raw_score = 50
} else {
  raw_score = 0
}
weighted_score = raw_score * 0.20
```

**Example:**
- Has cardiologist for cardiac case → 100 → 20.0 weighted
- Missing neurologist for stroke → 0 → 0.0 weighted
- General medical case → 50 → 10.0 weighted

### 4. Urgency Match Score (15% Weight)

**Purpose:** Match patient severity to facility type

**Severity Levels:**

**CRITICAL:**
- Needs ICU bed
- Has ICU → 100 points
- No ICU → 20 points (poor match)

**HIGH:**
- Prefers ICU, accepts general
- Has ICU → 80 points
- Has general bed → 50 points
- No beds → 0 points

**MEDIUM/LOW:**
- General bed sufficient
- Has any bed → 100 points
- No beds → 0 points

**Example:**
- Critical patient + ICU available → 100 → 15.0 weighted
- Critical patient + no ICU → 20 → 3.0 weighted
- Low severity + general bed → 100 → 15.0 weighted

### 5. Facility Capability Score (10% Weight)

**Purpose:** Match required equipment/capabilities

**Required Capabilities by Type:**
- **CARDIAC:** Cath lab, ECG
- **STROKE:** CT scan, MRI
- **TRAUMA:** Trauma center, Blood bank, Operating room
- **MATERNITY:** NICU, Labor & delivery

**Calculation:**
```javascript
base_score = 50
bonus = matched_capabilities * 10
raw_score = min(100, base_score + bonus)
weighted_score = raw_score * 0.10
```

**Example:**
- Trauma case + trauma center + blood bank → 70 → 7.0 weighted
- Cardiac case + cath lab only → 60 → 6.0 weighted
- No special requirements → 50 → 5.0 weighted

## Pre-Filtering Logic

Before scoring, hospitals are filtered to remove unsuitable candidates:

### Filter 1: Bed Availability
- **Critical patients:** Must have ICU bed
- **Other patients:** Must have any bed (ICU or general)
- **Rejection reason:** `no_beds_available` or `no_icu_for_critical`

### Filter 2: Distance/Time
- **Urban areas:** Max 60 minutes travel time
- **Rural areas:** Max 90 minutes travel time
- **Rejection reason:** `exceeds_max_distance`

### Filter 3: Required Specialist (Life-Threatening Cases Only)
- **Applies to:** CARDIAC, STROKE, TRAUMA with CRITICAL or HIGH severity
- **Must have:** Required specialist on staff
- **Rejection reason:** `missing_required_specialist`

### Filter 4: Required Capabilities
- **Trauma cases:** Must be designated trauma center
- **Rejection reason:** `missing_required_capability`

## API Endpoints

### 1. Score Hospitals

```http
POST /api/allocation/score-hospitals
Content-Type: application/json

{
  "incident_id": "123e4567-e89b-12d3-a456-426614174000"
}

Query Parameters:
- max_results (optional): Number of results to return (default: 5)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "incident": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "type": "CARDIAC",
      "severity": "CRITICAL",
      "location": {
        "lat": 40.7128,
        "lng": -74.0060,
        "address": "123 Main St, New York, NY"
      }
    },
    "recommended_hospitals": [
      {
        "rank": 1,
        "hospital_id": "H123",
        "hospital_name": "City General Hospital",
        "total_score": 87.5,
        "score_breakdown": {
          "travel_time": 28.5,
          "bed_availability": 23.0,
          "specialist_match": 20.0,
          "urgency_match": 12.0,
          "facility_capability": 4.0
        },
        "eta_minutes": 15,
        "distance_km": 12.3,
        "available_beds": 23,
        "general_beds_available": 18,
        "icu_beds_available": 5,
        "has_required_specialist": true,
        "required_specialist": "cardiologist",
        "capabilities": ["cath_lab", "ecg", "icu"]
      }
    ],
    "filter_summary": {
      "total_hospitals_evaluated": 15,
      "passed_filters": 8,
      "rejected": 7
    }
  }
}
```

### 2. Get Recommendations

```http
POST /api/allocation/recommend
Content-Type: application/json

{
  "incident_id": "123e4567-e89b-12d3-a456-426614174000"
}

Query Parameters:
- top_n (optional): Number of recommendations (default: 3)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "incident_id": "123e4567-e89b-12d3-a456-426614174000",
    "incident_type": "CARDIAC",
    "incident_severity": "CRITICAL",
    "recommended_hospitals": [
      {
        "rank": 1,
        "hospital_id": "H123",
        "hospital_name": "City General Hospital",
        "total_score": 87.5,
        "eta_minutes": 15,
        "distance_km": 12.3,
        "reasoning": "Top hospital due to shortest travel time and has required cardiologist and 5 ICU bed(s) available"
      },
      {
        "rank": 2,
        "hospital_id": "H456",
        "hospital_name": "Metro Medical Center",
        "total_score": 82.3,
        "eta_minutes": 18,
        "distance_km": 15.7,
        "reasoning": "Ranked #2 and has required cardiologist and nearby (18 min ETA)"
      }
    ],
    "total_evaluated": 15,
    "rejected_count": 7,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 3. Assign Hospital

```http
POST /api/allocation/assign
Content-Type: application/json

{
  "incident_id": "123e4567-e89b-12d3-a456-426614174000",
  "hospital_id": "H456",
  "override_reason": "Dispatcher knows H456 has cardiac specialist on duty now"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Hospital assigned (manual override)",
  "data": {
    "incident": { ... },
    "selected_hospital": {
      "hospital_id": "H456",
      "hospital_name": "Metro Medical Center",
      "total_score": 82.3,
      "rank": 2
    },
    "was_override": true,
    "recommendations": [ ... ]
  }
}
```

### 4. Get Allocation Reasoning

```http
GET /api/allocation/:incident_id/reasoning
```

**Response:**
```json
{
  "success": true,
  "data": {
    "incident_id": "123e4567-e89b-12d3-a456-426614174000",
    "incident_type": "CARDIAC",
    "incident_severity": "CRITICAL",
    "selected_hospital": {
      "id": "H123",
      "name": "City General Hospital",
      "score": 87.5,
      "rank": 1
    },
    "is_top_recommendation": true,
    "primary_factors": {
      "primary": {
        "name": "travel_time",
        "score": 28.5,
        "label": "Travel Time"
      },
      "secondary": {
        "name": "bed_availability",
        "score": 23.0,
        "label": "Bed Availability"
      }
    },
    "score_breakdown": {
      "total_score": 87.5,
      "components": [
        {
          "factor": "Travel Time",
          "weight": "30%",
          "raw_score": 95,
          "weighted_score": 28.5,
          "details": "15 minutes ETA, 12.3 km"
        },
        ...
      ]
    }
  }
}
```

### 5. Get Allocation Metrics

```http
GET /api/allocation/metrics?days=7
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period_days": 7,
    "total_allocations": 250,
    "total_overrides": 45,
    "followed_recommendations": 205,
    "override_percentage": 18.0,
    "unique_override_reasons": 8,
    "top_override_reasons": [
      {
        "override_reason": "Hospital requested by patient family",
        "count": 15
      },
      {
        "override_reason": "Specialist on duty confirmed",
        "count": 12
      }
    ]
  }
}
```

### 6. Get Scoring Weights

```http
GET /api/allocation/weights
```

### 7. Get Detailed Score Breakdown

```http
GET /api/allocation/:incident_id/breakdown
```

## Usage Examples

### Example 1: Cardiac Emergency (Critical)

**Input:**
- Type: CARDIAC
- Severity: CRITICAL
- Location: Downtown area

**Scoring Results:**

| Hospital | Travel | Beds | Specialist | Urgency | Capability | Total |
|----------|--------|------|------------|---------|------------|-------|
| City General | 28.5 | 23.0 | 20.0 | 15.0 | 7.0 | **93.5** |
| Metro Medical | 18.0 | 25.0 | 20.0 | 15.0 | 6.0 | **84.0** |
| County Hospital | 25.0 | 15.0 | 0.0 | 3.0 | 5.0 | **48.0** |

**Winner:** City General (has cardiologist + ICU + closest)

### Example 2: Stroke (High Severity)

**Input:**
- Type: STROKE
- Severity: HIGH
- Location: Suburban area

**Scoring Results:**

| Hospital | Travel | Beds | Specialist | Urgency | Capability | Total |
|----------|--------|------|------------|---------|------------|-------|
| Neuro Center | 24.0 | 20.0 | 20.0 | 12.0 | 8.0 | **84.0** |
| General Hospital | 28.0 | 22.0 | 0.0 | 12.0 | 5.0 | **67.0** |

**Winner:** Neuro Center (has neurologist + CT/MRI)

### Example 3: Trauma (Critical)

**Input:**
- Type: TRAUMA
- Severity: CRITICAL
- Location: Highway accident

**Scoring Results:**

| Hospital | Travel | Beds | Specialist | Urgency | Capability | Total |
|----------|--------|------|------------|---------|------------|-------|
| Trauma Center | 21.0 | 18.0 | 20.0 | 15.0 | 9.0 | **83.0** |
| City General | 27.0 | 23.0 | 0.0 | 15.0 | 5.0 | **70.0** |

**Winner:** Trauma Center (designated trauma center + surgeon)

**Pre-filtered:**
- Community Hospital (no trauma center designation)
- Suburban Clinic (no ICU beds)

## Override Tracking

When a dispatcher selects a non-top-ranked hospital, the system:

1. **Logs the override** with reason
2. **Tracks patterns** for quality improvement
3. **Generates metrics** on override frequency
4. **Provides comparison** between selected and recommended

**Common Override Reasons:**
- Patient/family requested specific hospital
- Confirmed specialist availability
- Hospital has patient's medical records
- Insurance/coverage considerations
- Hospital requested transfer

## Integration Points

### Required Database Tables

```sql
-- Hospitals table
CREATE TABLE hospitals (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(20),
  email VARCHAR(255),
  total_general_beds INTEGER,
  general_beds_available INTEGER,
  total_icu_beds INTEGER,
  icu_beds_available INTEGER,
  specialists TEXT[],
  capabilities TEXT[],
  trauma_level INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Allocation logs table
CREATE TABLE allocation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL,
  selected_hospital_id UUID NOT NULL,
  recommended_hospital_ids JSON,
  is_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hospitals_active ON hospitals(is_active);
CREATE INDEX idx_hospitals_location ON hospitals(latitude, longitude);
CREATE INDEX idx_allocation_logs_incident ON allocation_logs(incident_id);
CREATE INDEX idx_allocation_logs_created ON allocation_logs(created_at);
```

### Routing Service Integration

Replace mock distance calculation with actual routing service:

```javascript
// In service.js, replace getTravelData() with:
static async getTravelData(incidentLat, incidentLng, hospitals) {
  // Option 1: Google Maps Distance Matrix API
  const origins = `${incidentLat},${incidentLng}`;
  const destinations = hospitals.map(h => `${h.latitude},${h.longitude}`).join('|');
  
  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/distancematrix/json`,
    {
      params: {
        origins,
        destinations,
        mode: 'driving',
        traffic_model: 'best_guess',
        departure_time: 'now',
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    }
  );
  
  // Parse and return travel data...
}
```

## Performance Considerations

- **Caching:** Cache hospital data (refresh every 5 minutes)
- **Routing:** Batch routing requests to reduce API calls
- **Indexing:** Use spatial indexes for hospital location queries
- **Async:** Score hospitals in parallel where possible

## Quality Metrics

Track these metrics to improve the algorithm:

1. **Override Rate:** Should be <20%
2. **Average Score Difference:** Between #1 and selected
3. **Travel Time Variance:** Predicted vs actual
4. **Patient Outcomes:** By hospital selection method
5. **Dispatcher Feedback:** On recommendation quality

## Future Enhancements

1. **Machine Learning:** Learn from override patterns
2. **Real-Time Beds:** WebSocket updates from hospitals
3. **Historical Performance:** Factor in hospital response times
4. **Weather Integration:** Adjust travel times for conditions
5. **Predictive Analytics:** Anticipate bed shortages

## License

MIT
