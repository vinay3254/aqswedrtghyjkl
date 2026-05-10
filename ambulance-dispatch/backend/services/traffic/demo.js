/**
 * Traffic API Demo & Example Usage
 * Demonstrates how to use all traffic modules with mock data
 */

const TrafficAggregator = require('./traffic-aggregator');
const CongestionAnalyzer = require('./congestion-analyzer');
const RouteOptimizer = require('./route-optimizer');
const SignalPreemptionAPI = require('./signal-preemption-api');

// Initialize all modules
const trafficAggregator = new TrafficAggregator({
  cacheTTL: 60000,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  tomtomApiKey: process.env.TOMTOM_API_KEY
});

const congestionAnalyzer = new CongestionAnalyzer({
  historyWindow: 3600000
});

const routeOptimizer = new RouteOptimizer({
  maxAlternativeRoutes: 3,
  ambulanceSpeed: 60
});

const signalPreemption = new SignalPreemptionAPI({
  signalSystemUrl: process.env.SIGNAL_SYSTEM_URL,
  apiKey: process.env.SIGNAL_SYSTEM_API_KEY
});

/**
 * ============================================
 * Demo 1: Basic Traffic Data Aggregation
 * ============================================
 */
async function demoTrafficAggregation() {
  console.log('\n🚦 DEMO 1: Traffic Data Aggregation\n');
  console.log('─'.repeat(60));

  try {
    // Get traffic data for a location
    const location = {
      latitude: 40.7128,
      longitude: -74.0060
    };

    console.log(`📍 Fetching traffic data for location: ${location.latitude}, ${location.longitude}`);
    const trafficData = await trafficAggregator.getTrafficData(
      location.latitude,
      location.longitude
    );

    console.log('\n✅ Traffic Data Retrieved:');
    console.log(JSON.stringify(trafficData, null, 2));

    return trafficData;
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * ============================================
 * Demo 2: Congestion Analysis
 * ============================================
 */
async function demoCongestionAnalysis(trafficData) {
  console.log('\n📊 DEMO 2: Congestion Analysis\n');
  console.log('─'.repeat(60));

  try {
    const location = {
      latitude: 40.7128,
      longitude: -74.0060
    };

    console.log('🔍 Analyzing congestion patterns...\n');
    const analysis = congestionAnalyzer.analyzeCongestion(trafficData, location);

    console.log('✅ Congestion Analysis Results:');
    console.log('\n📈 Current Conditions:');
    console.log(JSON.stringify(analysis.currentConditions, null, 2));

    console.log('\n📉 Historical Trends:');
    console.log(JSON.stringify(analysis.historicalTrends, null, 2));

    console.log('\n🔮 Predictions:');
    console.log(JSON.stringify(analysis.predictions, null, 2));

    console.log('\n⚠️  Risk Factors:');
    console.log(JSON.stringify(analysis.riskFactors, null, 2));

    console.log('\n💡 Recommendations:');
    console.log(JSON.stringify(analysis.recommendations, null, 2));

    return analysis;
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * ============================================
 * Demo 3: Route Optimization
 * ============================================
 */
async function demoRouteOptimization(trafficData, congestionAnalysis) {
  console.log('\n🛣️  DEMO 3: Route Optimization\n');
  console.log('─'.repeat(60));

  try {
    // Create mock route data
    const baseRoute = {
      startPoint: { latitude: 40.7128, longitude: -74.0060, name: 'Downtown Medical Center' },
      endPoint: { latitude: 40.7489, longitude: -73.9680, name: 'East Side Hospital' },
      waypoints: [],
      distance: 5.2, // km
      duration: 15, // minutes
      routePoints: [
        { latitude: 40.7128, longitude: -74.0060 },
        { latitude: 40.7200, longitude: -74.0000 },
        { latitude: 40.7300, longitude: -73.9900 },
        { latitude: 40.7400, longitude: -73.9800 },
        { latitude: 40.7489, longitude: -73.9680 }
      ]
    };

    // Get traffic data for entire route
    console.log('🗺️  Getting traffic data for route segments...\n');
    const routeTrafficData = await trafficAggregator.getTrafficDataForRoute(
      baseRoute.routePoints
    );

    // Analyze route conditions
    const routeAnalysis = congestionAnalyzer.analyzeRouteConditions(routeTrafficData);

    console.log('✅ Route Analysis Results:');
    console.log('\n🚗 Overall Congestion:', routeAnalysis.overallCongestion);
    console.log('⏱️  Estimated Delay:', `${routeAnalysis.totalEstimatedDelay} minutes`);
    console.log('🚧 Bottlenecks Found:', routeAnalysis.bottlenecks.length);

    // Optimize route
    console.log('\n🔧 Optimizing route...\n');
    const optimization = routeOptimizer.optimizeRoute(
      baseRoute,
      routeAnalysis,
      { isEmergency: true, maxDistanceIncrease: 0.2 }
    );

    console.log('✅ Optimization Results:');
    console.log('\n📊 Traffic Impact:');
    console.log(JSON.stringify(optimization.trafficImpact, null, 2));

    console.log('\n🎯 Recommended Route:');
    console.log(JSON.stringify(optimization.recommendedRoute, null, 2));

    console.log('\n⏱️  Estimated Time Savings:', `${optimization.estimatedTimeSavings} minutes`);

    console.log('\n🚑 Ambulance-Specific Metrics:');
    const ambulanceMetrics = routeOptimizer.calculateAmbulanceMetrics(
      optimization.recommendedRoute,
      routeAnalysis
    );
    console.log(JSON.stringify(ambulanceMetrics, null, 2));

    return optimization;
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * ============================================
 * Demo 4: Signal Preemption
 * ============================================
 */
async function demoSignalPreemption() {
  console.log('\n🚨 DEMO 4: Signal Preemption\n');
  console.log('─'.repeat(60));

  try {
    const ambulanceId = 'AMB-001';
    const location = {
      latitude: 40.7128,
      longitude: -74.0060,
      name: 'Downtown Medical Center'
    };
    const destination = {
      latitude: 40.7489,
      longitude: -73.9680,
      name: 'East Side Hospital'
    };

    console.log(`🚑 Ambulance ID: ${ambulanceId}`);
    console.log(`📍 From: ${location.name}`);
    console.log(`📍 To: ${destination.name}\n`);

    // Request signal preemption
    console.log('📡 Requesting signal preemption...\n');
    const preemptionResponse = await signalPreemption.requestPreemption(
      ambulanceId,
      location,
      destination,
      'high'
    );

    console.log('✅ Signal Preemption Activated:');
    console.log(JSON.stringify(preemptionResponse, null, 2));

    // Get status
    console.log('\n🔍 Checking preemption status...\n');
    const status = signalPreemption.getPreemptionStatus(ambulanceId);
    console.log('📊 Preemption Status:');
    console.log(JSON.stringify(status, null, 2));

    // Simulate location update
    console.log('\n📍 Updating ambulance location...\n');
    const newLocation = {
      latitude: 40.7200,
      longitude: -74.0000
    };
    const updateResponse = await signalPreemption.updatePreemptionLocation(
      ambulanceId,
      newLocation
    );
    console.log('✅ Location Updated:');
    console.log(JSON.stringify(updateResponse, null, 2));

    // Get affected signals
    console.log('\n🚦 Getting signal status at intersection...\n');
    const signalStatus = await signalPreemption.getSignalStatus('int_001');
    console.log('✅ Signal Status:');
    console.log(JSON.stringify(signalStatus, null, 2));

    // View all active preemptions
    console.log('\n📋 Active Preemptions:');
    const activePreemptions = signalPreemption.getAllActivePreemptions();
    console.log(JSON.stringify(activePreemptions, null, 2));

    // Cancel preemption
    console.log('\n🛑 Cancelling preemption...\n');
    const cancelResponse = await signalPreemption.cancelPreemption(ambulanceId);
    console.log('✅ Preemption Cancelled:');
    console.log(JSON.stringify(cancelResponse, null, 2));

    return preemptionResponse;
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * ============================================
 * Demo 5: Complete Emergency Route Scenario
 * ============================================
 */
async function demoCompleteEmergencyScenario() {
  console.log('\n🚑🚨 DEMO 5: Complete Emergency Scenario\n');
  console.log('─'.repeat(60));

  try {
    const ambulanceId = 'AMB-999';
    const incidentLocation = {
      latitude: 40.7128,
      longitude: -74.0060,
      name: 'Downtown Street'
    };
    const hospitalLocation = {
      latitude: 40.7489,
      longitude: -73.9680,
      name: 'Emergency Hospital'
    };

    console.log('🚑 EMERGENCY DISPATCH SCENARIO\n');
    console.log(`Ambulance: ${ambulanceId}`);
    console.log(`Incident Location: ${incidentLocation.name}`);
    console.log(`Destination: ${hospitalLocation.name}\n`);

    // Step 1: Get current traffic
    console.log('📍 Step 1: Assessing current traffic conditions...\n');
    const currentTraffic = await trafficAggregator.getTrafficData(
      incidentLocation.latitude,
      incidentLocation.longitude
    );
    console.log(`Traffic Status: ${currentTraffic.aggregated.congestionLevel.toUpperCase()}`);
    console.log(`Current Speed: ${currentTraffic.aggregated.averageSpeed} km/h`);
    console.log(`Speed Limit: ${currentTraffic.aggregated.speedLimit} km/h\n`);

    // Step 2: Request signal preemption
    console.log('📡 Step 2: Requesting signal preemption...\n');
    const signalResponse = await signalPreemption.requestPreemption(
      ambulanceId,
      incidentLocation,
      hospitalLocation,
      'critical'
    );
    console.log(`✅ Preemption Activated for ${signalResponse.affectedIntersections.length} intersections\n`);

    // Step 3: Build optimal route
    console.log('🗺️  Step 3: Building optimal route...\n');
    const baseRoute = {
      startPoint: incidentLocation,
      endPoint: hospitalLocation,
      distance: 5.2,
      duration: 15,
      routePoints: [
        { latitude: 40.7128, longitude: -74.0060 },
        { latitude: 40.7200, longitude: -74.0000 },
        { latitude: 40.7300, longitude: -73.9900 },
        { latitude: 40.7400, longitude: -73.9800 },
        { latitude: 40.7489, longitude: -73.9680 }
      ]
    };

    const routeTraffic = await trafficAggregator.getTrafficDataForRoute(baseRoute.routePoints);
    const routeAnalysis = congestionAnalyzer.analyzeRouteConditions(routeTraffic);
    const optimization = routeOptimizer.optimizeRoute(
      baseRoute,
      routeAnalysis,
      { isEmergency: true }
    );

    console.log(`Recommended Route: ${optimization.recommendedRoute.strategy}`);
    console.log(`Distance: ${optimization.recommendedRoute.distance} km`);
    console.log(`Estimated Time: ${optimization.recommendedRoute.estimatedDuration} minutes`);
    console.log(`Time Savings: ${optimization.estimatedTimeSavings} minutes\n`);

    // Step 4: Ambulance in transit
    console.log('🚗 Step 4: Ambulance en route...\n');
    const metricsInTransit = routeOptimizer.calculateAmbulanceMetrics(
      optimization.recommendedRoute,
      routeAnalysis
    );
    console.log(`Total Estimated Time: ${metricsInTransit.totalEstimatedTime} minutes`);
    console.log(`Traffic Delay: ${metricsInTransit.trafficDelay} minutes`);
    console.log(`Critical Risk Factors: ${metricsInTransit.criticalRiskFactors.length}`);
    if (metricsInTransit.criticalRiskFactors.length > 0) {
      console.log('Precautions:');
      metricsInTransit.recommendedPrecautions.forEach(p => console.log(`  • ${p}`));
    }
    console.log();

    // Step 5: Re-optimization during transit
    console.log('🔄 Step 5: Re-optimizing route (mid-transit)...\n');
    const reoptimization = routeOptimizer.reoptimizeRoute(
      { latitude: 40.7250, longitude: -73.9950 },
      hospitalLocation,
      routeAnalysis,
      5 // 5 minutes elapsed
    );
    console.log(`Should Reroute: ${reoptimization.shouldReroute ? 'YES' : 'NO'}`);
    if (reoptimization.shouldReroute) {
      console.log(`New Route Distance: ${reoptimization.newOptimizedRoute.distance} km`);
      console.log(`Estimated Savings: ${reoptimization.estimatedTimeSavings} minutes`);
    }
    console.log();

    // Step 6: Summary statistics
    console.log('📊 Step 6: Dispatch Summary\n');
    console.log(`Total Preemptions: ${signalPreemption.getActivePreemptionsCount() + 1}`);
    console.log(`System Stats:`);
    const stats = signalPreemption.getSystemStats();
    console.log(JSON.stringify(stats, null, 2));

    return {
      ambulanceId,
      route: optimization.recommendedRoute,
      trafficConditions: currentTraffic.aggregated,
      signalsPreempted: signalResponse.affectedIntersections.length,
      estimatedTime: metricsInTransit.totalEstimatedTime
    };
  } catch (error) {
    console.error('❌ Error in emergency scenario:', error.message);
  }
}

/**
 * ============================================
 * Mock Event Listeners
 * ============================================
 */
function setupEventListeners() {
  console.log('\n📡 Setting up event listeners...\n');

  trafficAggregator.on('traffic-data-updated', (data) => {
    console.log('📡 Event: Traffic data updated');
    console.log(`   Location: ${data.location.latitude}, ${data.location.longitude}`);
    console.log(`   Congestion: ${data.data.aggregated.congestionLevel}`);
  });

  signalPreemption.on('preemption-requested', (data) => {
    console.log(`📡 Event: Preemption requested for ambulance ${data.ambulanceId}`);
    console.log(`   Affected Intersections: ${data.affectedIntersections.length}`);
  });

  signalPreemption.on('preemption-updated', (data) => {
    console.log(`📡 Event: Preemption updated for ambulance ${data.ambulanceId}`);
    console.log(`   New Location: ${data.newLocation.latitude}, ${data.newLocation.longitude}`);
  });

  signalPreemption.on('preemption-cancelled', (data) => {
    console.log(`📡 Event: Preemption cancelled for ambulance ${data.ambulanceId}`);
    console.log(`   Signals Affected: ${data.affectedIntersections}`);
  });
}

/**
 * ============================================
 * Main Demo Runner
 * ============================================
 */
async function runAllDemos() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       TRAFFIC API INTEGRATION - COMPREHENSIVE DEMO          ║');
  console.log('║  (Google Maps, TomTom, Local Sensors, Signal Preemption)    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  setupEventListeners();

  try {
    // Run demos sequentially
    const trafficData = await demoTrafficAggregation();
    
    if (trafficData) {
      const congestionAnalysis = await demoCongestionAnalysis(trafficData);
      
      if (congestionAnalysis) {
        await demoRouteOptimization(trafficData, congestionAnalysis);
      }
    }

    await demoSignalPreemption();
    
    await demoCompleteEmergencyScenario();

    // Final summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    DEMO COMPLETED                           ║');
    console.log('║  All traffic modules working with mock data                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Fatal error during demo:', error);
  }
}

// Export for testing
module.exports = {
  trafficAggregator,
  congestionAnalyzer,
  routeOptimizer,
  signalPreemption,
  demoTrafficAggregation,
  demoCongestionAnalysis,
  demoRouteOptimization,
  demoSignalPreemption,
  demoCompleteEmergencyScenario,
  runAllDemos
};

// Run if executed directly
if (require.main === module) {
  runAllDemos().catch(console.error);
}
