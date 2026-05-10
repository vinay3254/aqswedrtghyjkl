/**
 * Traffic Module Index
 * Exports all traffic-related classes and utilities
 */

const TrafficAggregator = require('./traffic-aggregator');
const CongestionAnalyzer = require('./congestion-analyzer');
const RouteOptimizer = require('./route-optimizer');
const SignalPreemptionAPI = require('./signal-preemption-api');

/**
 * Initialize all traffic modules with default configuration
 */
function initializeTrafficSystem(config = {}) {
  const aggregator = new TrafficAggregator(config.aggregator || {});
  const analyzer = new CongestionAnalyzer(config.analyzer || {});
  const optimizer = new RouteOptimizer(config.optimizer || {});
  const preemption = new SignalPreemptionAPI(config.preemption || {});

  return {
    aggregator,
    analyzer,
    optimizer,
    preemption,

    /**
     * Complete traffic analysis for emergency dispatch
     */
    async analyzeEmergencyRoute(
      startLocation,
      endLocation,
      ambulanceId = null
    ) {
      try {
        // Step 1: Aggregate traffic data for route
        const baseRoute = {
          startPoint: startLocation,
          endPoint: endLocation,
          distance: this.estimateDistance(startLocation, endLocation),
          duration: 15
        };

        // Create route points along the path
        const routePoints = this.generateRoutePoints(startLocation, endLocation);
        const trafficData = await aggregator.getTrafficDataForRoute(routePoints);

        // Step 2: Analyze congestion
        const congestionAnalysis = analyzer.analyzeRouteConditions(trafficData);

        // Step 3: Optimize route
        const optimization = optimizer.optimizeRoute(
          baseRoute,
          congestionAnalysis,
          { isEmergency: true, maxDistanceIncrease: 0.2 }
        );

        // Step 4: Get ambulance metrics
        const ambulanceMetrics = optimizer.calculateAmbulanceMetrics(
          optimization.recommendedRoute,
          congestionAnalysis
        );

        // Step 5: Request signal preemption
        let preemptionData = null;
        if (ambulanceId) {
          preemptionData = await preemption.requestPreemption(
            ambulanceId,
            startLocation,
            endLocation,
            'high'
          );
        }

        return {
          startLocation,
          endLocation,
          ambulanceId,
          trafficAnalysis: congestionAnalysis,
          routeOptimization: optimization,
          ambulanceMetrics,
          signalPreemption: preemptionData,
          recommendations: this.generateDispatchRecommendations(
            congestionAnalysis,
            optimization,
            ambulanceMetrics
          ),
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('Error in emergency route analysis:', error);
        throw error;
      }
    },

    /**
     * Update ambulance location and reoptimize
     */
    async updateAmbulanceProgress(
      ambulanceId,
      currentLocation,
      destination,
      timeElapsedMinutes = 0
    ) {
      try {
        // Get current traffic
        const currentTraffic = await aggregator.getTrafficData(
          currentLocation.latitude,
          currentLocation.longitude
        );

        // Analyze current conditions
        const analysis = analyzer.analyzeCongestion(currentTraffic, currentLocation);

        // Create route for remaining distance
        const remainingRoute = {
          startPoint: currentLocation,
          endPoint: destination,
          distance: this.estimateDistance(currentLocation, destination),
          duration: 15
        };

        // Reoptimize
        const reoptimization = optimizer.reoptimizeRoute(
          currentLocation,
          destination,
          analysis,
          timeElapsedMinutes
        );

        // Update signal preemption location
        await preemption.updatePreemptionLocation(ambulanceId, currentLocation);

        return {
          ambulanceId,
          currentLocation,
          trafficConditions: analysis.currentConditions,
          shouldReroute: reoptimization.shouldReroute,
          newRoute: reoptimization.newOptimizedRoute,
          estimatedTimeSavings: reoptimization.estimatedTimeSavings,
          preemptionStatus: preemption.getPreemptionStatus(ambulanceId),
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('Error updating ambulance progress:', error);
        throw error;
      }
    },

    /**
     * Cancel emergency dispatch
     */
    async cancelEmergencyDispatch(ambulanceId) {
      try {
        const cancelResponse = await preemption.cancelPreemption(ambulanceId);
        return {
          ambulanceId,
          preemptionCancelled: cancelResponse.success,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('Error cancelling emergency dispatch:', error);
        throw error;
      }
    },

    /**
     * Get system status
     */
    getSystemStatus() {
      return {
        aggregator: {
          cacheSize: aggregator.cacheData.size
        },
        analyzer: {
          trackedLocations: analyzer.trafficHistory.size
        },
        optimizer: {
          configuration: optimizer.config
        },
        preemption: preemption.getSystemStats(),
        activeAmbulances: preemption.getActivePreemptionsCount(),
        timestamp: new Date().toISOString()
      };
    },

    /**
     * Estimate distance between two points
     */
    estimateDistance(start, end) {
      const R = 6371;
      const dLat = (end.latitude - start.latitude) * Math.PI / 180;
      const dLon = (end.longitude - start.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(start.latitude * Math.PI / 180) * Math.cos(end.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },

    /**
     * Generate route points between start and end
     */
    generateRoutePoints(start, end, pointCount = 5) {
      const points = [];
      for (let i = 0; i < pointCount; i++) {
        const ratio = i / (pointCount - 1);
        points.push({
          latitude: start.latitude + (end.latitude - start.latitude) * ratio,
          longitude: start.longitude + (end.longitude - start.longitude) * ratio
        });
      }
      return points;
    },

    /**
     * Generate dispatch recommendations
     */
    generateDispatchRecommendations(congestion, optimization, metrics) {
      const recommendations = [];

      // Route recommendation
      if (optimization.estimatedTimeSavings > 5) {
        recommendations.push({
          type: 'route',
          priority: 'high',
          message: `Take ${optimization.recommendedRoute.strategy}`,
          estimatedSavings: `${optimization.estimatedTimeSavings} minutes`
        });
      }

      // Traffic-based recommendations
      if (congestion.trafficImpact?.impactSeverity === 'critical') {
        recommendations.push({
          type: 'traffic',
          priority: 'critical',
          message: 'Severe congestion ahead - prepare for delays',
          affectedSegments: congestion.trafficImpact.affectedSegments
        });
      }

      // Safety recommendations
      if (metrics.criticalRiskFactors.length > 0) {
        recommendations.push({
          type: 'safety',
          priority: 'high',
          message: 'Critical risk factors identified',
          precautions: metrics.recommendedPrecautions
        });
      }

      // Timing recommendation
      if (metrics.totalEstimatedTime > 20) {
        recommendations.push({
          type: 'timing',
          priority: 'medium',
          message: 'Extended travel time expected',
          estimatedTime: `${metrics.totalEstimatedTime} minutes`
        });
      }

      return recommendations;
    }
  };
}

// Export individual classes
module.exports = {
  TrafficAggregator,
  CongestionAnalyzer,
  RouteOptimizer,
  SignalPreemptionAPI,
  initializeTrafficSystem
};
