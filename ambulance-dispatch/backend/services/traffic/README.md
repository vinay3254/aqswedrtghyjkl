# Traffic API Integration

Comprehensive traffic management system for emergency ambulance routing with real-time traffic data aggregation, congestion analysis, route optimization, and traffic signal preemption.

## Overview

This module provides a complete traffic intelligence system for ambulance dispatch, integrating multiple data sources and intelligently optimizing routes while coordinating with traffic signal systems.

### Key Features

- **Multi-Source Traffic Data Aggregation**: Combines data from Google Maps, TomTom, and local sensors
- **Real-Time Congestion Analysis**: Analyzes traffic patterns and predicts delays
- **Intelligent Route Optimization**: Suggests optimal routes based on current traffic
- **Traffic Signal Preemption**: Communicates with traffic signal systems to prioritize ambulances
- **Emergency Response Optimization**: Tailored metrics and recommendations for ambulances

## Architecture

```
Traffic System
├── traffic-aggregator.js      (Data source integration)
├── congestion-analyzer.js     (Pattern analysis & prediction)
├── route-optimizer.js         (Route selection optimization)
└── signal-preemption-api.js   (Traffic signal coordination)
```

## Installation

```bash
npm install axios
```

## Configuration

Create a `.env` file with the following variables:

```env
# Traffic Data APIs
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
TOMTOM_API_KEY=your_tomtom_api_key

# Local Sensor System
LOCAL_SENSOR_ENDPOINT=http://localhost:3001/api/sensors

# Traffic Signal System
SIGNAL_SYSTEM_URL=http://localhost:8080/api/signals
SIGNAL_SYSTEM_API_KEY=your_signal_system_api_key
```

> **Note**: All modules work with mock data if API keys are not provided, perfect for demo and testing.

## Module Documentation

### 1. Traffic Aggregator

Aggregates traffic data from multiple sources for a unified view.

```javascript
const TrafficAggregator = require('./traffic-aggregator');

const aggregator = new TrafficAggregator({
  cacheTTL: 60000, // Cache for 60 seconds
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  tomtomApiKey: process.env.TOMTOM_API_KEY
});

// Get traffic data for a location
const trafficData = await aggregator.getTrafficData(
  40.7128,  // latitude
  -74.0060  // longitude
);

// Get traffic data for entire route
const routeTraffic = await aggregator.getTrafficDataForRoute(routePoints);
```

**Response Structure:**
```javascript
{
  sources: {
    google: { /* Google Maps data */ },
    tomtom: { /* TomTom data */ },
    sensors: { /* Local sensor data */ }
  },
  aggregated: {
    averageSpeed: 35,           // km/h
    congestionLevel: 'moderate', // free-flow|light|moderate|heavy|severe
    incidents: [],
    speedLimit: 60,
    roadConditions: { /* ... */ },
    confidence: 0.85
  },
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

**Events:**
```javascript
aggregator.on('traffic-data-updated', (data) => {
  console.log('Traffic updated:', data);
});
```

### 2. Congestion Analyzer

Analyzes traffic patterns, identifies trends, and predicts future conditions.

```javascript
const CongestionAnalyzer = require('./congestion-analyzer');

const analyzer = new CongestionAnalyzer({
  historyWindow: 3600000 // 1 hour history
});

// Analyze congestion at a location
const analysis = analyzer.analyzeCongestion(trafficData, {
  latitude: 40.7128,
  longitude: -74.0060
});

// Analyze multiple route points
const routeAnalysis = analyzer.analyzeRouteConditions(routeWithTraffic);
```

**Analysis Results:**
```javascript
{
  currentConditions: {
    congestionLevel: 'heavy',
    averageSpeed: 25,
    speedLimit: 60,
    speedRatio: '41.7%',
    flowStatus: 'slow',
    vehicleDensity: { /* ... */ },
    incidents: [
      { type: 'accident', severity: 'major', location: 'Main St' }
    ],
    roadConditions: { /* ... */ }
  },
  historicalTrends: {
    trend: 'worsening',        // improving|stable|worsening
    averageSpeed: 30,
    speedVariance: 12.5,
    timespan: '45m'
  },
  predictions: {
    next15Minutes: {
      predictedSpeed: 22,
      predictedCongestionLevel: 'heavy',
      expectedDelay: '8.5m',
      confidence: 0.85
    },
    next30Minutes: { /* ... */ },
    next60Minutes: { /* ... */ }
  },
  riskFactors: [
    { risk: 'heavy-congestion', severity: 'high' },
    { risk: 'accidents-reported', severity: 'high' }
  ],
  recommendations: [
    {
      priority: 'high',
      action: 'prepare-delay',
      message: 'Heavy congestion expected. Plan extra time.',
      estimatedDelay: '15-20 minutes'
    }
  ]
}
```

### 3. Route Optimizer

Optimizes ambulance routes based on traffic conditions.

```javascript
const RouteOptimizer = require('./route-optimizer');

const optimizer = new RouteOptimizer({
  maxAlternativeRoutes: 3,
  ambulanceSpeed: 60 // km/h baseline
});

// Optimize route
const optimization = optimizer.optimizeRoute(
  baseRoute,
  trafficAnalysis,
  { isEmergency: true, maxDistanceIncrease: 0.2 }
);

// Ambulance-specific metrics
const metrics = optimizer.calculateAmbulanceMetrics(route, trafficAnalysis);

// Reoptimize during transit
const reopt = optimizer.reoptimizeRoute(
  currentLocation,
  destination,
  trafficAnalysis,
  5 // minutes elapsed
);
```

**Optimization Output:**
```javascript
{
  originalRoute: { /* ... */ },
  trafficImpact: {
    estimatedCurrentDelay: '12.5m',
    maxCongestionLevel: 'heavy',
    affectedSegments: 2,
    impactSeverity: 'high'
  },
  recommendedRoute: {
    strategy: 'avoid-worst-bottleneck',
    distance: 5.5,
    estimatedDuration: 12,
    score: 87,
    advantages: ['Avoids major bottleneck', 'More predictable travel time'],
    disadvantages: ['Slightly longer distance']
  },
  alternativeRoutes: [ /* up to 3 alternatives */ ],
  estimatedTimeSavings: 3.5 // minutes
}
```

**Ambulance Metrics:**
```javascript
{
  distance: 5.2,
  baseSpeed: 60,
  effectiveSpeed: 72,         // 20% emergency bonus
  estimatedTime: 4.3,         // minutes
  trafficDelay: 2.1,
  totalEstimatedTime: 6.4,
  criticalRiskFactors: [ /* ... */ ],
  recommendedPrecautions: [
    'Use siren and lights proactively',
    'Drive defensively'
  ]
}
```

### 4. Signal Preemption API

Communicates with traffic signal systems to prioritize ambulances.

```javascript
const SignalPreemptionAPI = require('./signal-preemption-api');

const signals = new SignalPreemptionAPI({
  signalSystemUrl: process.env.SIGNAL_SYSTEM_URL,
  apiKey: process.env.SIGNAL_SYSTEM_API_KEY
});

// Request signal preemption
const response = await signals.requestPreemption(
  'AMB-001',                          // ambulanceId
  { latitude: 40.7128, longitude: -74.0060 }, // location
  { latitude: 40.7489, longitude: -73.9680 }, // destination
  'high'                              // priority
);

// Update location during transit
await signals.updatePreemptionLocation('AMB-001', newLocation);

// Check status
const status = signals.getPreemptionStatus('AMB-001');

// Cancel when destination reached
await signals.cancelPreemption('AMB-001');
```

**Preemption Response:**
```javascript
{
  success: true,
  preemptionId: 'preempt_AMB-001_1234567890',
  status: 'active',
  affectedIntersections: [
    {
      id: 'int_001',
      name: 'Main & 1st',
      distance: 0.3,
      status: 'preempted',
      signalState: 'extended-green',
      effectiveTime: 60  // seconds
    }
    // ... more intersections
  ],
  estimatedDuration: 300  // 5 minutes
}
```

**Events:**
```javascript
signals.on('preemption-requested', (data) => {
  console.log(`Preemption activated: ${data.affectedIntersections} intersections`);
});

signals.on('preemption-updated', (data) => {
  console.log(`Location updated for ambulance: ${data.ambulanceId}`);
});

signals.on('preemption-cancelled', (data) => {
  console.log(`Preemption cancelled: ${data.ambulanceId}`);
});
```

## Usage Examples

### Complete Emergency Dispatch Flow

```javascript
// 1. Aggregate traffic data
const traffic = await aggregator.getTrafficData(lat, lon);

// 2. Analyze conditions
const analysis = analyzer.analyzeCongestion(traffic, location);

// 3. Request signal preemption
const preemption = await signals.requestPreemption(
  ambulanceId,
  startLocation,
  destination
);

// 4. Optimize route
const optimization = optimizer.optimizeRoute(
  baseRoute,
  analysis,
  { isEmergency: true }
);

// 5. Get ambulance metrics
const metrics = optimizer.calculateAmbulanceMetrics(
  optimization.recommendedRoute,
  analysis
);

// 6. Update location during transit
await signals.updatePreemptionLocation(ambulanceId, currentLocation);

// 7. Cancel when destination reached
await signals.cancelPreemption(ambulanceId);
```

### Monitoring Traffic for Multiple Ambulances

```javascript
const ambulances = ['AMB-001', 'AMB-002', 'AMB-003'];

ambulances.forEach(async (ambId) => {
  const status = signals.getPreemptionStatus(ambId);
  console.log(`${ambId}: ${status.status}`);
});

// Get all active preemptions
const active = signals.getAllActivePreemptions();
console.log(`Active preemptions: ${active.length}`);
```

## Running the Demo

```bash
node demo.js
```

The demo showcases:
1. **Traffic Aggregation**: Multi-source data collection
2. **Congestion Analysis**: Pattern analysis and predictions
3. **Route Optimization**: Alternative route generation
4. **Signal Preemption**: Traffic signal coordination
5. **Complete Emergency Scenario**: Full dispatch workflow

### Demo Output Includes:
- Real-time traffic conditions from all sources
- Historical trend analysis
- 15/30/60-minute congestion predictions
- Risk factor identification
- Route recommendations with time/distance trade-offs
- Signal preemption activation with affected intersections
- Ambulance-specific metrics and precautions

## Testing

```bash
# Run demo with mock data
node demo.js

# All APIs default to mock responses if no API keys provided
# Perfect for development and testing!
```

## Mock Data Features

All modules include comprehensive mock data generators:

- **Traffic Aggregator**: Simulates data from 3 sources
- **Congestion Analyzer**: Historical patterns and predictions
- **Route Optimizer**: Multiple alternative routes
- **Signal Preemption**: Mock traffic signal coordination

Mock data is automatically used when API keys are not configured.

## Performance Characteristics

- **Traffic Aggregation**: ~200-500ms per location
- **Congestion Analysis**: ~50-100ms
- **Route Optimization**: ~100-300ms
- **Signal Preemption**: ~100-200ms
- **Cache TTL**: 60 seconds (configurable)

## Error Handling

All modules include comprehensive error handling with graceful fallbacks:

```javascript
try {
  const data = await aggregator.getTrafficData(lat, lon);
} catch (error) {
  console.error('Traffic aggregation failed:', error);
  // Falls back to mock data
}
```

## Events

### TrafficAggregator
- `traffic-data-updated`: Emitted when new traffic data is available

### CongestionAnalyzer
- No events (synchronous analysis)

### RouteOptimizer
- No events (synchronous optimization)

### SignalPreemptionAPI
- `preemption-requested`: Emitted when preemption is activated
- `preemption-updated`: Emitted when location is updated
- `preemption-cancelled`: Emitted when preemption is cancelled
- `preemption-failed`: Emitted on preemption errors

## API Integration Points

### Google Maps
- Directions API for route and traffic data
- Requires: `GOOGLE_MAPS_API_KEY`

### TomTom
- Traffic Flow API for real-time speed data
- Requires: `TOMTOM_API_KEY`

### Local Sensors
- Custom endpoint for local traffic sensor data
- Requires: `LOCAL_SENSOR_ENDPOINT`

### Traffic Signal System
- Custom API for signal preemption
- Requires: `SIGNAL_SYSTEM_URL`, `SIGNAL_SYSTEM_API_KEY`

## Data Caching

- Traffic data cached for 60 seconds (configurable)
- Preemption history stored (max 100 records by default)
- Historical congestion data stored per location

## Future Enhancements

- [ ] Machine learning for improved delay predictions
- [ ] Integration with real-time incident management systems
- [ ] Support for additional traffic data providers
- [ ] Multi-ambulance coordination optimization
- [ ] Historical performance analytics
- [ ] Predictive maintenance for signal systems

## License

MIT

## Support

For issues or questions, contact the dispatch team.
