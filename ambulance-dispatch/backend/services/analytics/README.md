# Analytics Service

## Overview

The Analytics Service provides predictive analytics and intelligent fleet repositioning capabilities for the ambulance dispatch system. It analyzes historical incident data, forecasts demand, identifies hotspots, and suggests optimal ambulance positioning.

## Features

### 1. Historical Data Collection
- Track all incidents with location, time, day of week, and severity
- Track response times by zone
- Track ambulance utilization patterns
- Export data to CSV for external analysis

### 2. Demand Forecasting
Rule-based forecasting identifies high-demand periods:
- **Morning Rush**: 7-10 AM
- **Midday**: 11 AM-2 PM
- **Evening Rush**: 5-8 PM
- **Weekend Nights**: Friday/Saturday 10 PM - 2 AM

High-demand location types:
- Highway corridors (accidents)
- Dense residential areas (medical emergencies)
- Commercial zones (cardiac events)
- School/college areas (injuries)

### 3. Hotspot Analysis
- Grid-based heatmap of incidents (configurable grid size, default 1km)
- Identify top 10 hotspot zones
- Calculate average incidents per zone per day
- Risk levels: HIGH, MEDIUM, LOW
- Breakdown by severity and incident type

### 4. Fleet Repositioning Algorithm
- Calculate optimal ambulance distribution
- Ensure coverage: no zone >15 min from nearest ambulance
- Load balancing based on demand density
- Generate actionable repositioning suggestions
- Prioritize moves by impact and urgency

### 5. Event-Based Surge Prediction
- Predict surge zones 24-48 hours before events
- Recommend additional ambulance deployment
- Alert supervisors to activate mutual aid

### 6. Analytics Dashboard
- Response time trends (daily, weekly, monthly)
- Incident volume by time of day
- Ambulance utilization rate
- Hospital load distribution
- Hotspot heatmap
- Real-time repositioning suggestions

## API Endpoints

### GET /api/analytics/dashboard
Get comprehensive dashboard data with all analytics.

**Query Parameters:**
- `startDate` (optional): ISO date string, default 30 days ago
- `endDate` (optional): ISO date string, default now

**Response:**
```json
{
  "summary": {
    "total_incidents": 150,
    "avg_response_time": 420,
    "avg_utilization": 65.5,
    "active_ambulances": 10
  },
  "incidents": [...],
  "hotspots": {...},
  "demand_forecast": {...},
  "repositioning_suggestions": {...}
}
```

### GET /api/analytics/incidents
Get historical incident data.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "incidents": [...],
  "count": 150,
  "date_range": {
    "start": "2026-03-01T00:00:00Z",
    "end": "2026-04-01T00:00:00Z"
  }
}
```

### GET /api/analytics/hotspots
Get hotspot analysis and heatmap data.

**Query Parameters:**
- `gridSize` (optional): Grid size in kilometers, default 1

**Response:**
```json
{
  "grid_size_km": 1,
  "analysis_period_days": 30,
  "hotspots": [
    {
      "center_lat": 40.7128,
      "center_lng": -74.0060,
      "incident_count": 45,
      "incidents_per_day": 1.5,
      "risk_level": "HIGH",
      "primary_incident_type": "CARDIAC",
      "severity_breakdown": {...},
      "type_breakdown": {...}
    }
  ],
  "total_zones": 120
}
```

### GET /api/analytics/demand-forecast
Get demand forecast for specific date/time.

**Query Parameters:**
- `date` (optional): Target date, default now
- `timeOfDay` (optional): Hour (0-23), default current hour

**Response:**
```json
{
  "target_date": "2026-04-05T14:00:00Z",
  "target_hour": 14,
  "day_of_week": 5,
  "is_weekend": false,
  "is_high_demand_period": false,
  "predicted_incidents": 8,
  "confidence": "HIGH",
  "high_demand_zones": [...],
  "recommendations": [
    {
      "type": "POSITIONING",
      "priority": "MEDIUM",
      "message": "Pre-position ambulance near zone...",
      "zone": {...}
    }
  ]
}
```

### GET /api/analytics/repositioning
Get repositioning suggestions for current fleet.

**Response:**
```json
{
  "timestamp": "2026-04-05T10:00:00Z",
  "current_distribution": {
    "total": 15,
    "by_status": {...},
    "by_type": {...}
  },
  "coverage_gaps": 3,
  "suggested_moves": [
    {
      "ambulance_id": "uuid",
      "ambulance_call_sign": "AMB-12",
      "from_lat": 40.7128,
      "from_lng": -74.0060,
      "to_lat": 40.7580,
      "to_lng": -73.9855,
      "distance_km": 5.2,
      "estimated_time_minutes": 8,
      "reason": "Zone 4 has no coverage and 3 incidents in last hour",
      "priority": "HIGH",
      "zone_risk": "HIGH",
      "zone_incidents": 12
    }
  ],
  "total_moves": 4,
  "high_priority_moves": 2,
  "summary": {...}
}
```

### GET /api/analytics/response-times
Get response time metrics by zone.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "response_times": [
    {
      "zone_lat": 40.71,
      "zone_lng": -74.01,
      "incident_count": 25,
      "avg_response_time_seconds": 420,
      "median_response_time_seconds": 380,
      "min_response_time_seconds": 180,
      "max_response_time_seconds": 900
    }
  ],
  "date_range": {...}
}
```

### GET /api/analytics/utilization
Get ambulance utilization statistics.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "utilization": [
    {
      "ambulance_id": "uuid",
      "call_sign": "AMB-12",
      "type": "ALS",
      "incidents_handled": 45,
      "utilization_percentage": 68.5,
      "total_active_hours": 82.3,
      "period_hours": 120
    }
  ],
  "date_range": {...}
}
```

### GET /api/analytics/trends
Get incident trends over time.

**Query Parameters:**
- `period` (optional): Time period (e.g., "7d", "30d"), default "30d"

**Response:**
```json
{
  "trends": [
    {
      "date": "2026-04-05",
      "incident_count": 23,
      "critical_count": 4,
      "high_count": 8,
      "medium_count": 7,
      "low_count": 4,
      "avg_total_time_seconds": 1800
    }
  ],
  "period": "30d"
}
```

### GET /api/analytics/time-of-day
Get incident patterns by time of day.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "time_of_day": [
    {
      "hour": 8,
      "day_of_week": 1,
      "incident_count": 15,
      "avg_priority": 35.2
    }
  ],
  "date_range": {...}
}
```

### GET /api/analytics/hospital-load
Get hospital load distribution.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "hospital_load": [
    {
      "id": "uuid",
      "name": "General Hospital",
      "patients_received": 85,
      "critical_patients": 12,
      "avg_transport_time_seconds": 900,
      "capacity_total": 50,
      "capacity_available": 12
    }
  ],
  "date_range": {...}
}
```

### GET /api/analytics/export
Export data to CSV.

**Query Parameters:**
- `type` (required): "incidents", "response-times", or "utilization"
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `format` (optional): "csv" (default)

**Response:** CSV file download

## Usage Examples

### Get Dashboard Data
```javascript
const response = await fetch('/api/analytics/dashboard?startDate=2026-03-01&endDate=2026-04-01');
const dashboard = await response.json();
```

### Get Hotspots with 2km Grid
```javascript
const response = await fetch('/api/analytics/hotspots?gridSize=2');
const hotspots = await response.json();
```

### Forecast Tomorrow's 8 AM Demand
```javascript
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const response = await fetch(`/api/analytics/demand-forecast?date=${tomorrow.toISOString()}&timeOfDay=8`);
const forecast = await response.json();
```

### Get Repositioning Suggestions
```javascript
const response = await fetch('/api/analytics/repositioning');
const suggestions = await response.json();

suggestions.suggested_moves.forEach(move => {
  if (move.priority === 'HIGH') {
    console.log(`URGENT: Move ${move.ambulance_call_sign} to (${move.to_lat}, ${move.to_lng})`);
    console.log(`Reason: ${move.reason}`);
  }
});
```

### Export Incidents to CSV
```javascript
window.location.href = '/api/analytics/export?type=incidents&startDate=2026-03-01&endDate=2026-04-01';
```

## Architecture

### Service Layer (`service.js`)
Main analytics service orchestrating all analytics operations.

### Hotspot Analysis (`hotspots.js`)
- Grid-based spatial analysis
- Incident density calculation
- Risk level classification
- Heatmap data generation

### Demand Forecasting (`forecasting.js`)
- Historical pattern analysis
- Time-based demand prediction
- Zone-based demand prediction
- Surge event prediction
- Recommendation generation

### Fleet Repositioning (`repositioning.js`)
- Coverage gap analysis
- Optimal distribution calculation
- Move suggestion generation
- Impact evaluation
- Distance and time estimation

### Data Export (`export.js`)
- CSV export for incidents
- CSV export for response times
- CSV export for utilization
- CSV export for hotspots
- Report summary generation

## Algorithms

### Hotspot Detection
1. Divide area into grid cells (default 1km × 1km)
2. Count incidents per cell
3. Calculate incidents per day
4. Classify risk level:
   - HIGH: ≥5 incidents/day
   - MEDIUM: ≥2 incidents/day
   - LOW: <2 incidents/day
5. Identify primary incident type
6. Sort by incident count

### Demand Forecasting
1. Analyze historical patterns by hour/day
2. Identify current time period
3. Calculate base prediction from historical average
4. Apply multipliers for high-demand periods
5. Apply weekend night surge multiplier
6. Generate zone-specific predictions
7. Create actionable recommendations

### Repositioning Algorithm
1. Get current ambulance positions
2. Identify coverage gaps (zones >15 min away)
3. For each gap, find nearest available ambulance
4. Calculate move distance and time
5. Prioritize by zone risk and incident count
6. Consider predicted demand zones
7. Generate prioritized move list
8. Calculate coverage improvement

## Performance Considerations

- Database queries use indexes on `created_at`, `location`, `status`
- Grid calculations are optimized for 1km grid size
- Large exports may take time; consider pagination
- Forecast calculations run in O(n) time
- Repositioning suggestions limited to available ambulances

## Future Enhancements

- Machine learning models for demand prediction
- Weather integration for seasonal patterns
- Real-time traffic data integration
- Multi-variable regression for response time prediction
- Automated repositioning execution
- Mobile app notifications for suggested moves
- Integration with CAD systems
- Advanced visualization with D3.js/Mapbox

## Dependencies

- PostgreSQL with PostGIS extension
- Express.js
- Node.js database client

## Testing

Run analytics service tests:
```bash
npm test services/analytics
```

## License

Proprietary - Ambulance Dispatch System
