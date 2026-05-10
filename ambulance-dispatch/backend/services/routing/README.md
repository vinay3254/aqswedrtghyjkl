# Routing Service

## Overview

The Routing Service provides comprehensive route calculation, ETA estimation, and traffic-aware routing for the Ambulance Dispatch System. It integrates with OSRM (Open Source Routing Machine) for high-performance routing with automatic fallback to Haversine-based calculations.

## Features

- **OSRM Integration**: Production-grade routing using OpenStreetMap data
- **Automatic Fallback**: Haversine distance calculation when OSRM is unavailable
- **Traffic-Aware Routing**: Dynamic traffic multipliers for accurate ETAs
- **Route Caching**: Redis-based caching (5-minute TTL) for performance
- **Alternative Routes**: Multiple route options with comparison
- **Batch Processing**: Efficient calculation of multiple routes
- **Full Route Planning**: Multi-leg routes (Ambulance → Incident → Hospital)
- **GPS Tracking Integration**: Match actual GPS traces to road network

## Architecture

```
routing/
├── osrm-client.js      # OSRM HTTP client
├── cache.js            # Redis caching layer
├── traffic.js          # Traffic multiplier service
├── fallback.js         # Haversine fallback calculations
├── service.js          # Core routing service
├── controller.js       # API endpoint controllers
├── routes.js           # Express route definitions
├── helpers.js          # Integration helpers
└── README.md           # This file
```

## Setup

### 1. OSRM Installation

```bash
# Navigate to infrastructure directory
cd infrastructure

# Download and prepare OSM data (choose region)
bash osrm-setup.sh delhi      # For Delhi region
bash osrm-setup.sh india      # For all of India (large file!)
bash osrm-setup.sh maharashtra # For Maharashtra state

# Start OSRM server
docker-compose -f docker-compose.osrm.yml up -d

# Check health
curl http://localhost:5000/route/v1/driving/77.2090,28.6139;77.1025,28.7041
```

### 2. Environment Variables

Add to your `.env` file:

```env
# OSRM Configuration
OSRM_URL=http://localhost:5000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_ROUTING_DB=2
ROUTE_CACHE_TTL=300

# Optional: Google Maps API for real traffic data
GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 3. Database Schema

```sql
-- Routes table
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id),
  route_json JSONB NOT NULL,           -- GeoJSON geometry
  actual_route_json JSONB,             -- Actual GPS-tracked route
  distance FLOAT NOT NULL,             -- Meters
  duration FLOAT NOT NULL,             -- Seconds
  actual_distance FLOAT,
  actual_duration FLOAT,
  traffic_multiplier FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_routes_assignment ON routes(assignment_id);
```

## API Endpoints

### Calculate Route

Calculate route between two or more points.

```http
POST /api/routing/calculate
Content-Type: application/json

{
  "coordinates": [
    [77.2090, 28.6139],  // [lng, lat]
    [77.1025, 28.7041]
  ],
  "alternatives": false,
  "simplify": false,
  "trafficMultiplier": null  // null = auto-detect
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "routes": [{
      "distance": 15234.5,
      "duration": 1845.2,
      "durationMinutes": 31,
      "trafficMultiplier": 1.5,
      "geometry": {
        "type": "LineString",
        "coordinates": [[77.2090, 28.6139], ...]
      },
      "legs": [...]
    }],
    "fallback": false
  }
}
```

### Calculate ETA

Get estimated time of arrival with traffic consideration.

```http
POST /api/routing/eta
Content-Type: application/json

{
  "origin": [77.2090, 28.6139],
  "destination": [77.1025, 28.7041],
  "datetime": "2024-01-15T09:00:00Z",  // Optional
  "trafficMultiplier": null
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "distance": 15234.5,
    "duration": 1845.2,
    "durationMinutes": 31,
    "eta": "2024-01-15T09:31:00Z",
    "trafficMultiplier": 1.5,
    "trafficLevel": "moderate",
    "fallback": false
  }
}
```

### Alternative Routes

Get multiple route options.

```http
POST /api/routing/alternative
Content-Type: application/json

{
  "origin": [77.2090, 28.6139],
  "destination": [77.1025, 28.7041],
  "maxAlternatives": 3
}
```

### Distance Only

Calculate distance without full route geometry (faster).

```http
POST /api/routing/distance
Content-Type: application/json

{
  "origin": [77.2090, 28.6139],
  "destination": [77.1025, 28.7041]
}
```

### Batch Routing

Calculate multiple routes in one request.

```http
POST /api/routing/batch
Content-Type: application/json

{
  "requests": [
    {
      "origin": [77.2090, 28.6139],
      "destination": [77.1025, 28.7041]
    },
    {
      "origin": [77.3000, 28.7000],
      "destination": [77.1500, 28.6500]
    }
  ]
}
```

### Traffic Information

```http
# Current traffic status
GET /api/routing/traffic/current

# Traffic predictions
GET /api/routing/traffic/predict?hours=24
```

### Health Check

```http
GET /api/routing/health
```

## Integration Helpers

### Calculate Ambulance to Incident

```javascript
const { calculateAmbulanceToIncident } = require('./services/routing/helpers');

const route = await calculateAmbulanceToIncident(
  'ambulance-123',
  'incident-456',
  db
);

console.log(`ETA: ${route.durationMinutes} minutes`);
```

### Calculate Full Route

```javascript
const { calculateFullRoute } = require('./services/routing/helpers');

const fullRoute = await calculateFullRoute(
  'ambulance-123',
  'incident-456',
  'hospital-789',
  db
);

console.log(`Total time: ${fullRoute.total.durationMinutes} minutes`);
console.log(`ETA to incident: ${fullRoute.eta.toIncident}`);
console.log(`ETA to hospital: ${fullRoute.eta.toHospital}`);
```

### Find Nearest Ambulances

```javascript
const { findNearestAmbulances } = require('./services/routing/helpers');

const ambulances = await findNearestAmbulances('incident-456', db, 5);

ambulances.forEach(amb => {
  console.log(`${amb.vehicleNumber}: ${amb.durationMinutes} min away`);
});
```

### Save Route

```javascript
const { saveRoute } = require('./services/routing/helpers');

const savedRoute = await saveRoute(assignmentId, routeData, db);
```

## Fallback Mode

When OSRM is unavailable, the service automatically switches to fallback calculations:

- **Distance**: Haversine formula × road factor (1.4 for urban, 1.3 suburban, 1.2 highway)
- **Duration**: Distance / average speed (30 km/h urban, 45 km/h suburban, 65 km/h highway)
- **Traffic**: Applied using time-based multipliers

The fallback provides reasonable estimates for emergency routing when OSRM is down.

## Traffic Multipliers

### Time-Based (Default)

The service uses hourly traffic patterns:
- **Peak morning (7-9 AM)**: 1.5-1.6x
- **Peak evening (5-7 PM)**: 1.6-1.7x
- **Midday**: 1.2-1.3x
- **Late night**: 1.0x (no traffic)

### Google Maps Integration (Production)

For production, integrate with Google Maps Distance Matrix API:

```javascript
// In traffic.js
const response = await axios.get(
  'https://maps.googleapis.com/maps/api/distancematrix/json',
  {
    params: {
      origins: `${origin[1]},${origin[0]}`,
      destinations: `${destination[1]},${destination[0]}`,
      departure_time: 'now',
      traffic_model: 'best_guess',
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  }
);
```

## Caching Strategy

Routes are cached in Redis with the following strategy:

- **Cache Key**: Hash of coordinates + options
- **TTL**: 5 minutes (configurable via `ROUTE_CACHE_TTL`)
- **Traffic**: Reapplied on cache hit based on current time
- **Invalidation**: Automatic expiry or manual clear

### Clear Cache

```http
DELETE /api/routing/cache
```

## Performance Optimization

### Route Simplification

For mobile apps, enable geometry simplification:

```javascript
const route = await routingService.calculateRoute(
  [origin, destination],
  { simplify: true }
);
```

This reduces coordinate count by ~90% while maintaining route accuracy.

### Batch Requests

Use batch endpoints instead of multiple individual requests:

```javascript
// Bad: Multiple sequential requests
const route1 = await fetch('/api/routing/calculate', ...);
const route2 = await fetch('/api/routing/calculate', ...);

// Good: Single batch request
const routes = await fetch('/api/routing/batch', {
  body: JSON.stringify({ requests: [...] })
});
```

## Monitoring

### Health Metrics

- OSRM availability status
- Cache hit/miss ratio
- Average response times
- Fallback usage percentage

### Logging

All routing operations are logged with:
- Request coordinates
- Calculation time
- Cache status
- Fallback usage
- Errors with stack traces

## Testing

### OSRM Health Check

```bash
curl http://localhost:5000/route/v1/driving/77.2090,28.6139;77.1025,28.7041
```

### API Testing

```bash
# Calculate route
curl -X POST http://localhost:3000/api/routing/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [[77.2090, 28.6139], [77.1025, 28.7041]]
  }'

# Get ETA
curl -X POST http://localhost:3000/api/routing/eta \
  -H "Content-Type: application/json" \
  -d '{
    "origin": [77.2090, 28.6139],
    "destination": [77.1025, 28.7041]
  }'

# Health check
curl http://localhost:3000/api/routing/health
```

## Troubleshooting

### OSRM Not Starting

1. Check if OSM data is prepared:
   ```bash
   ls -lh infrastructure/osrm-data/
   # Should see: delhi-latest.osrm, delhi-latest.osrm.nodes, etc.
   ```

2. Run setup script:
   ```bash
   cd infrastructure
   bash osrm-setup.sh delhi
   ```

3. Check Docker logs:
   ```bash
   docker logs osrm-backend
   ```

### High Latency

1. Check Redis connection
2. Verify OSRM memory allocation (should be 2-4GB)
3. Enable route simplification for mobile clients
4. Use batch endpoints for multiple requests

### Cache Issues

1. Check Redis connection:
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

2. Monitor cache stats:
   ```bash
   redis-cli -h localhost -p 6379 INFO stats
   ```

3. Clear cache if stale:
   ```http
   DELETE /api/routing/cache
   ```

## Roadmap

- [ ] Real-time traffic integration (Google Maps, TomTom, HERE)
- [ ] Historical traffic patterns from database
- [ ] Route optimization for multiple stops
- [ ] Avoid toll roads option
- [ ] Emergency vehicle priority routing
- [ ] Route deviation alerts
- [ ] Predictive ETA updates based on GPS tracking

## License

MIT
