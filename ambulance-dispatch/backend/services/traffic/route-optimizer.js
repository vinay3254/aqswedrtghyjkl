/**
 * Route Optimizer
 * Optimizes ambulance routes based on real-time traffic conditions
 */

const logger = require('../../utils/logger');

class RouteOptimizer {
  constructor(config = {}) {
    this.config = config;
    this.maxAlternativeRoutes = config.maxAlternativeRoutes || 3;
    this.ambulanceSpeedAvg = config.ambulanceSpeed || 60; // km/h baseline
  }

  /**
   * Optimize route based on current traffic conditions
   */
  optimizeRoute(baseRoute, trafficAnalysis, constraints = {}) {
    try {
      if (!baseRoute || !trafficAnalysis) {
        return { error: 'Missing required data' };
      }

      const optimization = {
        originalRoute: this.summarizeRoute(baseRoute),
        trafficImpact: this.analyzeTrafficImpact(baseRoute, trafficAnalysis),
        optimizations: this.generateOptimizations(baseRoute, trafficAnalysis),
        recommendedRoute: null,
        alternativeRoutes: [],
        estimatedTimeSavings: 0,
        timestamp: new Date().toISOString()
      };

      // Generate alternative routes
      const alternatives = this.generateAlternativeRoutes(baseRoute, trafficAnalysis);
      optimization.alternativeRoutes = alternatives.slice(0, this.maxAlternativeRoutes);

      // Select best route
      optimization.recommendedRoute = this.selectBestRoute(
        baseRoute,
        alternatives,
        constraints
      );

      optimization.estimatedTimeSavings = this.calculateTimeSavings(
        baseRoute,
        optimization.recommendedRoute,
        trafficAnalysis
      );

      return optimization;
    } catch (error) {
      logger.error('Error optimizing route:', error);
      throw error;
    }
  }

  /**
   * Summarize route information
   */
  summarizeRoute(route) {
    return {
      startPoint: route.startPoint,
      endPoint: route.endPoint,
      waypoints: route.waypoints?.length || 0,
      distance: route.distance || 0,
      estimatedDuration: route.duration || 0,
      points: route.routePoints?.length || 0
    };
  }

  /**
   * Analyze traffic impact on route
   */
  analyzeTrafficImpact(route, trafficAnalysis) {
    const routeAnalyses = trafficAnalysis.routeAnalyses || [];

    let totalCurrentDelay = 0;
    let maxCongestion = 'free-flow';
    let affectedSegments = 0;
    const congestionPriority = {
      'free-flow': 0,
      'light': 1,
      'moderate': 2,
      'heavy': 3,
      'severe': 4
    };

    routeAnalyses.forEach(analysis => {
      const congestion = analysis.currentConditions.congestionLevel;
      const delay = analysis.predictions.next15Minutes.expectedDelay || 0;

      totalCurrentDelay += delay;

      if (congestionPriority[congestion] > congestionPriority[maxCongestion]) {
        maxCongestion = congestion;
      }

      if (congestion !== 'free-flow' && congestion !== 'light') {
        affectedSegments++;
      }
    });

    return {
      estimatedCurrentDelay: Math.round(totalCurrentDelay * 10) / 10,
      maxCongestionLevel: maxCongestion,
      affectedSegments,
      totalSegments: routeAnalyses.length,
      impactSeverity: this.getImpactSeverity(totalCurrentDelay, maxCongestion),
      bottlenecks: trafficAnalysis.bottlenecks || []
    };
  }

  /**
   * Determine impact severity
   */
  getImpactSeverity(delay, congestion) {
    if (congestion === 'severe' || delay > 20) return 'critical';
    if (congestion === 'heavy' || delay > 10) return 'high';
    if (congestion === 'moderate' || delay > 5) return 'medium';
    return 'low';
  }

  /**
   * Generate optimizations for the route
   */
  generateOptimizations(route, trafficAnalysis) {
    const optimizations = [];
    const bottlenecks = trafficAnalysis.bottlenecks || [];

    bottlenecks.forEach((bottleneck, index) => {
      optimizations.push({
        id: `opt_${index}`,
        type: 'avoid-bottleneck',
        location: bottleneck.location,
        description: `Avoid bottleneck with ${bottleneck.congestionLevel} congestion`,
        currentSpeed: bottleneck.speed,
        priority: bottleneck.congestionLevel === 'severe' ? 'high' : 'medium'
      });
    });

    // Add timing optimization
    if (trafficAnalysis.overallCongestion === 'light' || trafficAnalysis.overallCongestion === 'free-flow') {
      optimizations.push({
        id: 'opt_timing',
        type: 'optimal-timing',
        description: 'Current traffic conditions are favorable for travel',
        recommendation: 'Proceed immediately',
        priority: 'low'
      });
    }

    return optimizations;
  }

  /**
   * Generate alternative routes
   */
  generateAlternativeRoutes(baseRoute, trafficAnalysis) {
    const alternatives = [];

    // Route 1: Avoid worst bottleneck
    alternatives.push(
      this.createAlternativeRoute(
        baseRoute,
        'avoid-worst-bottleneck',
        'Route avoiding main bottleneck',
        trafficAnalysis
      )
    );

    // Route 2: Faster alternate
    alternatives.push(
      this.createAlternativeRoute(
        baseRoute,
        'faster-alternate',
        'Faster alternate route',
        trafficAnalysis
      )
    );

    // Route 3: Minimize distance
    alternatives.push(
      this.createAlternativeRoute(
        baseRoute,
        'shortest-distance',
        'Shortest distance route',
        trafficAnalysis
      )
    );

    return alternatives;
  }

  /**
   * Create alternative route object
   */
  createAlternativeRoute(baseRoute, strategy, description, trafficAnalysis) {
    const baseDistance = baseRoute.distance || 10;
    const baseTime = baseRoute.duration || 15;

    let distance, estimatedTime, variation;

    switch (strategy) {
      case 'avoid-worst-bottleneck':
        distance = baseDistance * 1.05; // 5% longer
        estimatedTime = baseTime * 0.85; // 15% faster due to no bottleneck
        variation = 'Adds 0.5 km but avoids congestion';
        break;
      case 'faster-alternate':
        distance = baseDistance * 0.95; // 5% shorter
        estimatedTime = baseTime * 0.8; // 20% faster
        variation = 'Shorter route, similar or better traffic';
        break;
      case 'shortest-distance':
        distance = baseDistance * 0.9; // 10% shorter
        estimatedTime = baseTime * 0.85; // 15% faster
        variation = 'Minimizes distance, may have mixed traffic';
        break;
      default:
        distance = baseDistance;
        estimatedTime = baseTime;
    }

    return {
      id: `route_${strategy}`,
      strategy,
      description,
      startPoint: baseRoute.startPoint,
      endPoint: baseRoute.endPoint,
      distance: Math.round(distance * 10) / 10,
      estimatedDuration: Math.round(estimatedTime),
      estimatedDelay: this.estimateRouteDelay(estimatedTime, trafficAnalysis),
      variation,
      score: this.calculateRouteScore(distance, estimatedTime, trafficAnalysis),
      advantages: this.getRouteAdvantages(strategy, trafficAnalysis),
      disadvantages: this.getRouteDisadvantages(strategy, trafficAnalysis)
    };
  }

  /**
   * Estimate delay for a route
   */
  estimateRouteDelay(duration, trafficAnalysis) {
    const baseDelay = trafficAnalysis.totalEstimatedDelay || 0;
    const variationFactor = duration < 15 ? 0.8 : 1;
    return Math.max(0, Math.round(baseDelay * variationFactor * 10) / 10);
  }

  /**
   * Calculate route score (higher is better)
   */
  calculateRouteScore(distance, time, trafficAnalysis) {
    // Score based on time efficiency
    const timeScore = 100 - (time * 5); // Penalize longer times
    
    // Score based on distance
    const distanceScore = Math.max(0, 50 - (distance * 2)); // Shorter is better
    
    // Bonus for avoiding congestion
    let congestionBonus = 0;
    if (trafficAnalysis.overallCongestion === 'severe') {
      congestionBonus = 30;
    } else if (trafficAnalysis.overallCongestion === 'heavy') {
      congestionBonus = 20;
    } else if (trafficAnalysis.overallCongestion === 'moderate') {
      congestionBonus = 10;
    }

    const totalScore = (timeScore * 0.5) + (distanceScore * 0.3) + (congestionBonus * 0.2);
    return Math.max(0, Math.min(100, Math.round(totalScore)));
  }

  /**
   * Get route advantages
   */
  getRouteAdvantages(strategy, trafficAnalysis) {
    const advantages = [];

    switch (strategy) {
      case 'avoid-worst-bottleneck':
        advantages.push('Avoids major bottleneck');
        advantages.push('More predictable travel time');
        break;
      case 'faster-alternate':
        advantages.push('Significant time savings');
        advantages.push('Shorter distance');
        break;
      case 'shortest-distance':
        advantages.push('Minimizes distance traveled');
        advantages.push('Less fuel consumption');
        break;
    }

    if (trafficAnalysis.overallCongestion === 'light') {
      advantages.push('Overall light traffic');
    }

    return advantages;
  }

  /**
   * Get route disadvantages
   */
  getRouteDisadvantages(strategy, trafficAnalysis) {
    const disadvantages = [];

    switch (strategy) {
      case 'avoid-worst-bottleneck':
        disadvantages.push('Slightly longer distance');
        break;
      case 'faster-alternate':
        disadvantages.push('May pass through residential areas');
        break;
      case 'shortest-distance':
        disadvantages.push('May encounter some congestion');
        disadvantages.push('Potentially more stops');
        break;
    }

    return disadvantages;
  }

  /**
   * Select the best route based on constraints
   */
  selectBestRoute(baseRoute, alternatives, constraints = {}) {
    // For emergency vehicles, prioritize speed over distance
    const prioritizeSpeed = constraints.isEmergency !== false; // Default to true
    const maxDistanceIncrease = constraints.maxDistanceIncrease || 0.2; // 20% max

    let bestRoute = {
      ...baseRoute,
      routeType: 'original',
      reason: 'Original route is optimal'
    };

    let bestScore = this.calculateRouteScore(baseRoute.distance, baseRoute.duration, {});

    alternatives.forEach(alt => {
      const distanceIncrease = (alt.distance - baseRoute.distance) / baseRoute.distance;

      // Filter out routes that increase distance too much
      if (distanceIncrease <= maxDistanceIncrease) {
        if (alt.score > bestScore) {
          bestScore = alt.score;
          bestRoute = {
            ...alt,
            routeType: 'optimized',
            reason: `Selected for ${alt.strategy}`
          };
        }
      }
    });

    return bestRoute;
  }

  /**
   * Calculate time savings
   */
  calculateTimeSavings(baseRoute, recommendedRoute, trafficAnalysis) {
    let baseDuration = baseRoute.duration || 15;
    let recommendedDuration = recommendedRoute.estimatedDuration || 15;

    // Account for traffic delays
    const trafficDelay = trafficAnalysis.totalEstimatedDelay || 0;
    baseDuration += trafficDelay;

    const savings = Math.max(0, baseDuration - recommendedDuration);
    return Math.round(savings * 10) / 10;
  }

  /**
   * Calculate ambulance-specific metrics
   */
  calculateAmbulanceMetrics(route, trafficAnalysis) {
    const baseSpeed = this.ambulanceSpeedAvg;
    const distance = route.distance || 10;

    // Ambulances can exceed speed limits in some cases
    const effectiveSpeed = baseSpeed * 1.2; // 20% speed bonus for emergency
    const estimatedTime = (distance / effectiveSpeed) * 60; // minutes

    // Calculate response time impact
    const trafficDelay = trafficAnalysis.totalEstimatedDelay || 0;
    const totalTime = estimatedTime + trafficDelay;

    return {
      distance: Math.round(distance * 10) / 10,
      baseSpeed: baseSpeed,
      effectiveSpeed: Math.round(effectiveSpeed),
      estimatedTime: Math.round(estimatedTime),
      trafficDelay: Math.round(trafficDelay * 10) / 10,
      totalEstimatedTime: Math.round(totalTime),
      criticalRiskFactors: this.identifyCriticalRiskFactors(trafficAnalysis),
      recommendedPrecautions: this.getRecommendedPrecautions(trafficAnalysis)
    };
  }

  /**
   * Identify critical risk factors for ambulance
   */
  identifyCriticalRiskFactors(trafficAnalysis) {
    const factors = [];

    if (trafficAnalysis.trafficImpact?.impactSeverity === 'critical') {
      factors.push({
        risk: 'severe-congestion',
        action: 'Consider alternative route',
        severity: 'critical'
      });
    }

    if (trafficAnalysis.bottlenecks?.length > 0) {
      factors.push({
        risk: 'bottlenecks-ahead',
        action: 'Prepare for congestion',
        severity: 'high',
        locations: trafficAnalysis.bottlenecks.map(b => b.location)
      });
    }

    trafficAnalysis.routeAnalyses?.forEach((analysis, index) => {
      if (analysis.riskFactors?.length > 0) {
        analysis.riskFactors.forEach(rf => {
          if (rf.severity === 'high') {
            factors.push({
              ...rf,
              location: `Point ${index}`
            });
          }
        });
      }
    });

    return factors;
  }

  /**
   * Get recommended precautions
   */
  getRecommendedPrecautions(trafficAnalysis) {
    const precautions = [];

    if (trafficAnalysis.overallCongestion === 'severe') {
      precautions.push('Use siren and lights proactively');
      precautions.push('Drive defensively');
      precautions.push('Be prepared to use sidewalks or oncoming lanes');
    }

    if (trafficAnalysis.overallCongestion === 'heavy') {
      precautions.push('Activate warning lights and siren');
      precautions.push('Increase awareness of surrounding vehicles');
    }

    if (trafficAnalysis.bottlenecks?.length > 0) {
      precautions.push('Prepare for sudden traffic stops');
      precautions.push('Monitor traffic ahead closely');
    }

    return precautions;
  }

  /**
   * Re-optimize route during transit
   */
  reoptimizeRoute(currentLocation, destination, trafficAnalysis, timeElapsed) {
    try {
      const remainingRoute = {
        startPoint: currentLocation,
        endPoint: destination,
        distance: this.estimateRemainingDistance(currentLocation, destination),
        duration: this.estimateRemainingTime(timeElapsed)
      };

      const reoptimization = {
        originalRoute: this.summarizeRoute(remainingRoute),
        currentLocation,
        trafficUpdate: trafficAnalysis.trafficImpact,
        shouldReroute: this.shouldReroute(trafficAnalysis),
        newOptimizedRoute: null,
        estimatedTimeSavings: 0,
        timestamp: new Date().toISOString()
      };

      if (reoptimization.shouldReroute) {
        const alternatives = this.generateAlternativeRoutes(remainingRoute, trafficAnalysis);
        reoptimization.newOptimizedRoute = this.selectBestRoute(
          remainingRoute,
          alternatives,
          { isEmergency: true }
        );
        reoptimization.estimatedTimeSavings = this.calculateTimeSavings(
          remainingRoute,
          reoptimization.newOptimizedRoute,
          trafficAnalysis
        );
      }

      return reoptimization;
    } catch (error) {
      logger.error('Error reoptimizing route:', error);
      throw error;
    }
  }

  /**
   * Determine if rerouting is needed
   */
  shouldReroute(trafficAnalysis) {
    const impactSeverity = trafficAnalysis.trafficImpact?.impactSeverity;
    const delay = trafficAnalysis.totalEstimatedDelay || 0;

    return (impactSeverity === 'critical') || (delay > 10);
  }

  /**
   * Estimate remaining distance
   */
  estimateRemainingDistance(currentLocation, destination) {
    // Rough estimate using Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (destination.latitude - currentLocation.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - currentLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(currentLocation.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estimate remaining time based on elapsed time
   */
  estimateRemainingTime(timeElapsed) {
    // Remaining time should be recalculated based on new conditions
    return Math.max(0, 30 - timeElapsed); // Default 30 min route
  }
}

module.exports = RouteOptimizer;
