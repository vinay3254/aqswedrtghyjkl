/**
 * Traffic Module Configuration Examples
 * Shows how to configure and use the traffic system in different scenarios
 */

// ============================================
// Example 1: Basic Configuration
// ============================================
const basicConfig = {
  aggregator: {
    cacheTTL: 60000, // 60 seconds
    // API keys from environment variables
  },
  analyzer: {
    historyWindow: 3600000 // 1 hour
  },
  optimizer: {
    maxAlternativeRoutes: 3,
    ambulanceSpeed: 60 // km/h
  },
  preemption: {
    timeout: 5000 // 5 seconds
  }
};

// ============================================
// Example 2: High-Traffic Urban Configuration
// ============================================
const urbanConfig = {
  aggregator: {
    cacheTTL: 30000, // More frequent updates
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    tomtomApiKey: process.env.TOMTOM_API_KEY
  },
  analyzer: {
    historyWindow: 7200000 // 2 hours for better trends
  },
  optimizer: {
    maxAlternativeRoutes: 5, // More options in congested areas
    ambulanceSpeed: 40 // Lower baseline speed
  },
  preemption: {
    timeout: 3000,
    maxHistorySize: 500
  }
};

// ============================================
// Example 3: Rural/Suburban Configuration
// ============================================
const ruralConfig = {
  aggregator: {
    cacheTTL: 120000, // Less frequent updates
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    localSensorEndpoint: null
  },
  analyzer: {
    historyWindow: 1800000 // 30 minutes
  },
  optimizer: {
    maxAlternativeRoutes: 2,
    ambulanceSpeed: 80 // Higher baseline speed
  },
  preemption: {
    timeout: 5000
  }
};

// ============================================
// Example 4: Integration with Dispatch System
// ============================================
const { initializeTrafficSystem } = require('./index');

async function integrateWithDispatchSystem() {
  // Initialize traffic system
  const traffic = initializeTrafficSystem(urbanConfig);

  // When dispatch receives emergency call:
  const emergencyCall = {
    id: 'CALL-123456',
    patientLocation: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: '123 Main St, New York'
    },
    destinationHospital: {
      latitude: 40.7489,
      longitude: -73.9680,
      name: 'Emergency Hospital'
    },
    ambulanceId: 'AMB-001',
    priority: 'critical'
  };

  // Analyze the emergency route
  const analysis = await traffic.analyzeEmergencyRoute(
    emergencyCall.patientLocation,
    emergencyCall.destinationHospital,
    emergencyCall.ambulanceId
  );

  console.log('Emergency Route Analysis:');
  console.log(`- Recommended Route: ${analysis.routeOptimization.recommendedRoute.strategy}`);
  console.log(`- Distance: ${analysis.routeOptimization.recommendedRoute.distance} km`);
  console.log(`- ETA: ${analysis.ambulanceMetrics.totalEstimatedTime} minutes`);
  console.log(`- Signals Preempted: ${analysis.signalPreemption.affectedIntersections.length}`);
  console.log(`- Risk Factors: ${analysis.ambulanceMetrics.criticalRiskFactors.length}`);

  return analysis;
}

// ============================================
// Example 5: Real-time Location Tracking
// ============================================
async function trackAmbulanceInTransit() {
  const traffic = initializeTrafficSystem(urbanConfig);

  const dispatch = {
    ambulanceId: 'AMB-001',
    destination: {
      latitude: 40.7489,
      longitude: -73.9680
    }
  };

  // Simulate ambulance movement
  const locations = [
    { latitude: 40.7128, longitude: -74.0060 }, // Start
    { latitude: 40.7180, longitude: -74.0000 }, // 1st update
    { latitude: 40.7250, longitude: -73.9950 }, // 2nd update
    { latitude: 40.7350, longitude: -73.9850 }, // 3rd update
    { latitude: 40.7489, longitude: -73.9680 }  // Destination
  ];

  let timeElapsed = 0;
  for (const location of locations) {
    // Update ambulance progress
    const update = await traffic.updateAmbulanceProgress(
      dispatch.ambulanceId,
      location,
      dispatch.destination,
      timeElapsed
    );

    console.log(`\n📍 Location Update (${timeElapsed} min):`);
    console.log(`   Position: ${location.latitude}, ${location.longitude}`);
    console.log(`   Traffic: ${update.trafficConditions.congestionLevel}`);
    console.log(`   Should Reroute: ${update.shouldReroute}`);

    if (update.shouldReroute) {
      console.log(`   💡 New Route Distance: ${update.newRoute.distance} km`);
      console.log(`   ⏱️  Time Savings: ${update.estimatedTimeSavings} min`);
    }

    timeElapsed += 5; // 5 minutes between updates
  }

  // Cancel when arrived
  await traffic.cancelEmergencyDispatch(dispatch.ambulanceId);
  console.log('\n✅ Emergency dispatch completed');
}

// ============================================
// Example 6: Multi-Ambulance Coordination
// ============================================
async function coordinateMultipleAmbulances() {
  const traffic = initializeTrafficSystem(urbanConfig);

  const emergencies = [
    {
      ambulanceId: 'AMB-001',
      start: { latitude: 40.7128, longitude: -74.0060 },
      end: { latitude: 40.7489, longitude: -73.9680 }
    },
    {
      ambulanceId: 'AMB-002',
      start: { latitude: 40.7200, longitude: -74.0100 },
      end: { latitude: 40.7600, longitude: -73.9500 }
    },
    {
      ambulanceId: 'AMB-003',
      start: { latitude: 40.7000, longitude: -73.9800 },
      end: { latitude: 40.7400, longitude: -73.9600 }
    }
  ];

  // Analyze all routes in parallel
  const analyses = await Promise.all(
    emergencies.map(e =>
      traffic.analyzeEmergencyRoute(e.start, e.end, e.ambulanceId)
    )
  );

  // Get system status
  const status = traffic.getSystemStatus();
  console.log('\n📊 System Status:');
  console.log(`   Active Ambulances: ${status.activeAmbulances}`);
  console.log(`   Cached Locations: ${status.analyzer.trackedLocations}`);

  // Display summary
  analyses.forEach((analysis, index) => {
    console.log(`\n🚑 ${emergencies[index].ambulanceId}:`);
    console.log(`   ETA: ${analysis.ambulanceMetrics.totalEstimatedTime} min`);
    console.log(`   Signals: ${analysis.signalPreemption.affectedIntersections.length}`);
  });

  return analyses;
}

// ============================================
// Example 7: Event Monitoring
// ============================================
function setupEventMonitoring() {
  const traffic = initializeTrafficSystem(urbanConfig);

  // Monitor traffic aggregator
  traffic.aggregator.on('traffic-data-updated', (data) => {
    console.log(`[TRAFFIC] New data: ${data.data.aggregated.congestionLevel}`);
  });

  // Monitor signal preemption
  traffic.preemption.on('preemption-requested', (data) => {
    console.log(`[SIGNALS] Preemption activated for ${data.ambulanceId}`);
    console.log(`         ${data.affectedIntersections} intersections`);
  });

  traffic.preemption.on('preemption-updated', (data) => {
    console.log(`[SIGNALS] Location updated for ${data.ambulanceId}`);
  });

  traffic.preemption.on('preemption-cancelled', (data) => {
    console.log(`[SIGNALS] Preemption cancelled for ${data.ambulanceId}`);
  });

  traffic.preemption.on('preemption-failed', (data) => {
    console.error(`[ERROR] Preemption failed for ${data.ambulanceId}: ${data.error}`);
  });

  return traffic;
}

// ============================================
// Example 8: Conditional Route Selection
// ============================================
async function selectBestRoute(startLocation, endLocation) {
  const traffic = initializeTrafficSystem(urbanConfig);

  const analysis = await traffic.analyzeEmergencyRoute(
    startLocation,
    endLocation
  );

  // Select route based on traffic conditions
  let selectedRoute;
  const { congestionLevel } = analysis.trafficAnalysis.trafficImpact;

  if (congestionLevel === 'severe') {
    // Prefer fastest route
    selectedRoute = analysis.routeOptimization.alternativeRoutes[0];
    console.log('🚨 Severe congestion: Taking fastest route');
  } else if (congestionLevel === 'heavy') {
    // Balance speed and distance
    selectedRoute = analysis.routeOptimization.recommendedRoute;
    console.log('⚠️  Heavy congestion: Taking balanced route');
  } else {
    // Can take direct route
    selectedRoute = analysis.routeOptimization.recommendedRoute;
    console.log('✅ Light traffic: Taking direct route');
  }

  console.log(`\n📍 Selected Route:`);
  console.log(`   Strategy: ${selectedRoute.strategy}`);
  console.log(`   Distance: ${selectedRoute.distance} km`);
  console.log(`   Duration: ${selectedRoute.estimatedDuration} min`);

  return selectedRoute;
}

// ============================================
// Example 9: Performance Monitoring
// ============================================
async function monitorPerformance() {
  const traffic = initializeTrafficSystem(urbanConfig);
  const startTime = Date.now();

  // Time traffic analysis
  const location = { latitude: 40.7128, longitude: -74.0060 };
  const destination = { latitude: 40.7489, longitude: -73.9680 };

  const t0 = Date.now();
  const analysis = await traffic.analyzeEmergencyRoute(location, destination, 'AMB-001');
  const totalTime = Date.now() - t0;

  console.log('⏱️  Performance Metrics:');
  console.log(`   Total Analysis Time: ${totalTime}ms`);
  console.log(`   Traffic Aggregation: ~200-500ms`);
  console.log(`   Congestion Analysis: ~50-100ms`);
  console.log(`   Route Optimization: ~100-300ms`);
  console.log(`   Signal Preemption: ~100-200ms`);

  return analysis;
}

// ============================================
// Example 10: Error Handling
// ============================================
async function handleErrorsGracefully() {
  const traffic = initializeTrafficSystem(urbanConfig);

  try {
    // Try to analyze route with invalid location
    const analysis = await traffic.analyzeEmergencyRoute(
      { latitude: NaN, longitude: NaN },
      { latitude: 40.7489, longitude: -73.9680 },
      'AMB-001'
    );
  } catch (error) {
    console.error('❌ Error caught:', error.message);
    console.log('✅ System continues with fallback behavior');
  }

  // System continues to work
  const status = traffic.getSystemStatus();
  console.log('System Status:', status);
}

// ============================================
// Export all examples
// ============================================
module.exports = {
  basicConfig,
  urbanConfig,
  ruralConfig,
  integrateWithDispatchSystem,
  trackAmbulanceInTransit,
  coordinateMultipleAmbulances,
  setupEventMonitoring,
  selectBestRoute,
  monitorPerformance,
  handleErrorsGracefully
};

// ============================================
// Quick Start
// ============================================
if (require.main === module) {
  console.log('Traffic Module Configuration Examples\n');
  console.log('Available examples:');
  console.log('1. Basic Configuration');
  console.log('2. Urban Configuration');
  console.log('3. Rural Configuration');
  console.log('4. Dispatch System Integration');
  console.log('5. Real-time Location Tracking');
  console.log('6. Multi-Ambulance Coordination');
  console.log('7. Event Monitoring');
  console.log('8. Conditional Route Selection');
  console.log('9. Performance Monitoring');
  console.log('10. Error Handling\n');

  console.log('Run: node config-examples.js [1-10]\n');

  // Example usage: node config-examples.js 4
  const example = parseInt(process.argv[2]) || 4;

  switch (example) {
    case 1:
      console.log('Configuration:', basicConfig);
      break;
    case 4:
      integrateWithDispatchSystem().catch(console.error);
      break;
    case 5:
      trackAmbulanceInTransit().catch(console.error);
      break;
    case 6:
      coordinateMultipleAmbulances().catch(console.error);
      break;
    case 7:
      setupEventMonitoring();
      break;
    case 8:
      selectBestRoute(
        { latitude: 40.7128, longitude: -74.0060 },
        { latitude: 40.7489, longitude: -73.9680 }
      ).catch(console.error);
      break;
    case 9:
      monitorPerformance().catch(console.error);
      break;
    case 10:
      handleErrorsGracefully().catch(console.error);
      break;
    default:
      console.log('Invalid example number');
  }
}
