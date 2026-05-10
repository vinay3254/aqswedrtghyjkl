/**
 * Repositioning Optimizer - Optimize ambulance positions based on predictions
 * Uses demand forecasts and event surge predictions to recommend fleet movements
 */

class RepositioningOptimizer {
  constructor() {
    this.optimizationStrategies = {
      'reactive': this.reactiveStrategy.bind(this),
      'predictive': this.predictiveStrategy.bind(this),
      'proactive': this.proactiveStrategy.bind(this),
      'hybrid': this.hybridStrategy.bind(this)
    };
    this.currentStrategy = 'hybrid';
    this.repositioningHistory = [];
    this.costFactors = {
      movementCost: 1.0,        // Cost per km moved
      unavailabilityPenalty: 5.0, // Penalty for ambulance in transit
      responseTimeWeight: 2.0,  // Weight for response time optimization
      coveragePenalty: 10.0     // Penalty for uncovered zones
    };
    this.constraints = {
      maxMoveDistance: 15,       // Max km to reposition
      minCoverageRequired: 0.9,  // 90% zone coverage
      maxAmbuancesPerZone: 8,
      minAmbulancesPerZone: 1
    };
  }

  /**
   * Generate repositioning recommendations
   * @param {Object} state - Current ambulance positions and demand forecast
   * @returns {Array} List of repositioning actions
   */
  generateRepositioningPlan(state) {
    const {
      currentAmbulances,      // [{id, zone, latitude, longitude, available}]
      demandForecast,         // {zone: {forecast, confidence}}
      eventSurges,            // {zone: multiplier}
      timeHorizon = 4,        // Hours ahead
      strategy = this.currentStrategy
    } = state;

    if (!currentAmbulances || currentAmbulances.length === 0) {
      return { success: false, error: 'No ambulances available' };
    }

    // Use selected strategy
    const strategyFunc = this.optimizationStrategies[strategy];
    if (!strategyFunc) {
      return { success: false, error: `Unknown strategy: ${strategy}` };
    }

    const plan = strategyFunc(currentAmbulances, demandForecast, eventSurges, timeHorizon);

    return {
      success: true,
      strategy,
      plan,
      timestamp: new Date(),
      metrics: this.calculatePlanMetrics(plan, currentAmbulances, demandForecast)
    };
  }

  /**
   * Reactive Strategy - Respond to current high demand
   */
  reactiveStrategy(ambulances, demandForecast, eventSurges) {
    const moves = [];

    // Identify zones with high demand and few ambulances
    const zoneStats = this.analyzeZoneDemand(ambulances, demandForecast, eventSurges);

    zoneStats
      .filter(z => z.demandRatio > 1.2 && z.availableAmbulances < z.recommendedCount)
      .sort((a, b) => b.demandRatio - a.demandRatio)
      .slice(0, 3) // Top 3 zones
      .forEach(zone => {
        const movesNeeded = zone.recommendedCount - zone.availableAmbulances;
        const nearbyAmbulances = this.findNearbyAmbulances(ambulances, zone, 10);

        for (let i = 0; i < movesNeeded && i < nearbyAmbulances.length; i++) {
          moves.push({
            ambulanceId: nearbyAmbulances[i].id,
            fromZone: nearbyAmbulances[i].zone,
            toZone: zone.zone,
            reason: 'high_demand_reactive',
            priority: 'high',
            distance: nearbyAmbulances[i].distance,
            estimatedDuration: this.estimateMoveDuration(nearbyAmbulances[i].distance)
          });
        }
      });

    return {
      moves,
      repositioningCount: moves.length,
      expectedCoverage: this.calculateExpectedCoverage(ambulances, moves, demandForecast)
    };
  }

  /**
   * Predictive Strategy - Position based on forecasted demand
   */
  predictiveStrategy(ambulances, demandForecast, eventSurges) {
    const moves = [];
    const optimalDistribution = this.calculateOptimalDistribution(
      ambulances,
      demandForecast,
      eventSurges
    );

    // Calculate reposition moves to reach optimal distribution
    for (const zone in optimalDistribution) {
      const targetCount = optimalDistribution[zone];
      const currentCount = ambulances.filter(a => a.zone === zone && a.available).length;
      const deficit = targetCount - currentCount;

      if (deficit > 0) {
        const candidates = ambulances
          .filter(a => a.available && a !== zone)
          .sort((a, b) => this.calculateDistance(a, zone) - this.calculateDistance(b, zone));

        for (let i = 0; i < deficit && i < candidates.length; i++) {
          moves.push({
            ambulanceId: candidates[i].id,
            fromZone: candidates[i].zone,
            toZone: zone,
            reason: 'demand_forecast',
            priority: 'medium',
            distance: this.calculateDistance(candidates[i], zone),
            estimatedDuration: this.estimateMoveDuration(this.calculateDistance(candidates[i], zone))
          });
        }
      }
    }

    return {
      moves,
      repositioningCount: moves.length,
      targetDistribution: optimalDistribution,
      expectedCoverage: this.calculateExpectedCoverage(ambulances, moves, demandForecast)
    };
  }

  /**
   * Proactive Strategy - Pre-position for predicted events
   */
  proactiveStrategy(ambulances, demandForecast, eventSurges) {
    const moves = [];

    // Find zones with significant event surges
    const surgeZones = Object.entries(eventSurges)
      .filter(([zone, multiplier]) => multiplier > 1.5)
      .sort((a, b) => b[1] - a[1]);

    surgeZones.forEach(([zone, multiplier]) => {
      const currentCount = ambulances.filter(a => a.zone === zone && a.available).length;
      const targetCount = Math.ceil(currentCount * multiplier);
      const needed = targetCount - currentCount;

      if (needed > 0) {
        const farAmbulances = ambulances
          .filter(a => a.available && a.zone !== zone)
          .sort((a, b) => this.calculateDistance(b, zone) - this.calculateDistance(a, zone))
          .slice(0, Math.min(needed, 3)); // Limit to 3 moves per zone

        farAmbulances.forEach(ambulance => {
          moves.push({
            ambulanceId: ambulance.id,
            fromZone: ambulance.zone,
            toZone: zone,
            reason: 'event_surge_preparation',
            priority: 'critical',
            eventMultiplier: multiplier,
            distance: this.calculateDistance(ambulance, zone),
            estimatedDuration: this.estimateMoveDuration(this.calculateDistance(ambulance, zone))
          });
        });
      }
    });

    return {
      moves,
      repositioningCount: moves.length,
      eventPreparation: Object.fromEntries(surgeZones),
      expectedCoverage: this.calculateExpectedCoverage(ambulances, moves, demandForecast)
    };
  }

  /**
   * Hybrid Strategy - Combine all approaches with cost optimization
   */
  hybridStrategy(ambulances, demandForecast, eventSurges) {
    // Weight: 40% predictive, 30% proactive, 20% reactive, 10% cost optimization
    const predictiveMoves = this.predictiveStrategy(ambulances, demandForecast, eventSurges).moves;
    const proactiveMoves = this.proactiveStrategy(ambulances, demandForecast, eventSurges).moves;
    const reactiveMoves = this.reactiveStrategy(ambulances, demandForecast, eventSurges).moves;

    // Merge and deduplicate
    const allMoves = [...predictiveMoves, ...proactiveMoves, ...reactiveMoves];
    const mergedMoves = this.deduplicateAndPrioritize(allMoves);

    // Apply cost optimization to limit total repositioning
    const optimizedMoves = this.optimizeByTotalCost(mergedMoves, ambulances, 0.3);

    return {
      moves: optimizedMoves,
      repositioningCount: optimizedMoves.length,
      breakdown: {
        predictiveCount: predictiveMoves.length,
        proactiveCount: proactiveMoves.length,
        reactiveCount: reactiveMoves.length
      },
      expectedCoverage: this.calculateExpectedCoverage(ambulances, optimizedMoves, demandForecast)
    };
  }

  /**
   * Calculate optimal distribution of ambulances
   */
  calculateOptimalDistribution(ambulances, demandForecast, eventSurges) {
    const totalAmbulances = ambulances.length;
    const distribution = {};

    // Start with base proportional distribution
    const totalDemand = Object.values(demandForecast)
      .reduce((sum, zone) => sum + (zone.forecast || 0), 0);

    for (const zone in demandForecast) {
      const proportion = (demandForecast[zone].forecast || 0) / totalDemand;
      const baseForecast = Math.ceil(totalAmbulances * proportion);
      const surge = eventSurges[zone] || 1.0;
      const target = Math.ceil(baseForecast * surge);

      // Apply constraints
      distribution[zone] = Math.max(
        this.constraints.minAmbulancesPerZone,
        Math.min(this.constraints.maxAmbuancesPerZone, target)
      );
    }

    return distribution;
  }

  /**
   * Analyze zone demand and supply
   */
  analyzeZoneDemand(ambulances, demandForecast, eventSurges) {
    const zoneStats = [];

    for (const zone in demandForecast) {
      const forecast = demandForecast[zone].forecast || 0;
      const availableAmbulances = ambulances.filter(a => a.zone === zone && a.available).length;
      const surge = eventSurges[zone] || 1.0;
      const adjustedForecast = forecast * surge;
      const recommendedCount = Math.ceil(adjustedForecast / 10); // 1 ambulance per 10 expected calls

      zoneStats.push({
        zone,
        forecast,
        adjustedForecast: parseFloat(adjustedForecast.toFixed(1)),
        surge,
        availableAmbulances,
        recommendedCount,
        demandRatio: adjustedForecast / (availableAmbulances * 10 || 1),
        coverage: availableAmbulances / recommendedCount
      });
    }

    return zoneStats.sort((a, b) => b.demandRatio - a.demandRatio);
  }

  /**
   * Find nearby available ambulances
   */
  findNearbyAmbulances(ambulances, zone, maxDistance) {
    return ambulances
      .filter(a => a.available && a.zone !== zone)
      .map(a => ({
        ...a,
        distance: this.calculateDistance(a, zone)
      }))
      .filter(a => a.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Calculate distance between ambulance and zone
   */
  calculateDistance(ambulance, zone) {
    // Simple Euclidean distance for demo
    // In production, use proper geo-distance calculation
    const zoneCenter = this.getZoneCenter(zone);
    const lat1 = ambulance.latitude || 0;
    const lon1 = ambulance.longitude || 0;
    const lat2 = zoneCenter.latitude;
    const lon2 = zoneCenter.longitude;

    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estimate move duration in minutes
   */
  estimateMoveDuration(distance) {
    // Average speed: 40 km/h in urban area
    return Math.ceil((distance / 40) * 60);
  }

  /**
   * Deduplicate and prioritize moves
   */
  deduplicateAndPrioritize(moves) {
    const seen = new Set();
    const unique = [];

    moves.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    moves.forEach(move => {
      const key = `${move.ambulanceId}_${move.toZone}`;
      if (!seen.has(key)) {
        unique.push(move);
        seen.add(key);
      }
    });

    return unique;
  }

  /**
   * Optimize moves by total cost
   */
  optimizeByTotalCost(moves, ambulances, costLimitRatio) {
    const totalMovementCost = moves.reduce((sum, move) => sum + move.distance * this.costFactors.movementCost, 0);
    const allowedCost = totalMovementCost * costLimitRatio;

    let costUsed = 0;
    const optimized = [];

    for (const move of moves) {
      const moveCost = move.distance * this.costFactors.movementCost;
      if (costUsed + moveCost <= allowedCost) {
        optimized.push(move);
        costUsed += moveCost;
      } else if (optimized.length < ambulances.length * 0.3) {
        // Always include high-priority moves
        if (move.priority === 'critical') {
          optimized.push(move);
          costUsed += moveCost;
        }
      }
    }

    return optimized;
  }

  /**
   * Calculate expected coverage after repositioning
   */
  calculateExpectedCoverage(ambulances, moves, demandForecast) {
    const projectedAmbulances = JSON.parse(JSON.stringify(ambulances));

    // Apply moves
    moves.forEach(move => {
      const ambulance = projectedAmbulances.find(a => a.id === move.ambulanceId);
      if (ambulance) {
        ambulance.zone = move.toZone;
      }
    });

    // Calculate coverage per zone
    const coverage = {};
    const totalCoverage = [];

    for (const zone in demandForecast) {
      const count = projectedAmbulances.filter(a => a.zone === zone && a.available).length;
      const forecast = demandForecast[zone].forecast || 0;
      const adequacy = forecast > 0 ? count / (forecast / 10) : 1;
      coverage[zone] = {
        ambulancesAvailable: count,
        demandForecast: forecast,
        adequacy: parseFloat(adequacy.toFixed(2)),
        adequate: adequacy >= 0.9
      };
      totalCoverage.push(adequacy);
    }

    const avgAdequacy = totalCoverage.reduce((a, b) => a + b, 0) / totalCoverage.length;

    return {
      byZone: coverage,
      averageAdequacy: parseFloat(avgAdequacy.toFixed(2)),
      meetsMinimumCoverage: avgAdequacy >= this.constraints.minCoverageRequired,
      coveragePercentage: (avgAdequacy * 100).toFixed(1)
    };
  }

  /**
   * Calculate plan metrics and efficiency
   */
  calculatePlanMetrics(plan, ambulances, demandForecast) {
    const totalDistance = plan.moves.reduce((sum, m) => sum + m.distance, 0);
    const totalMovementTime = plan.moves.reduce((sum, m) => sum + m.estimatedDuration, 0);
    const totalMovementCost = totalDistance * this.costFactors.movementCost;

    return {
      totalRepositioningMoves: plan.repositioningCount,
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      totalMovementTime: totalMovementTime,
      estimatedMovementCost: parseFloat(totalMovementCost.toFixed(2)),
      averageMoveDistance: plan.repositioningCount > 0 
        ? parseFloat((totalDistance / plan.repositioningCount).toFixed(2))
        : 0,
      expectedCoverageImprovement: plan.expectedCoverage.coveragePercentage
    };
  }

  /**
   * Get repositioning status
   */
  getRepositioningStatus(recentMoves) {
    if (!recentMoves || recentMoves.length === 0) {
      return {
        status: 'idle',
        activeRepositioning: 0,
        message: 'No repositioning in progress'
      };
    }

    const now = Date.now();
    const activeMoves = recentMoves.filter(m => {
      const moveStart = new Date(m.startTime).getTime();
      const moveEnd = moveStart + m.estimatedDuration * 60000;
      return now >= moveStart && now <= moveEnd;
    });

    return {
      status: activeMoves.length > 0 ? 'repositioning_in_progress' : 'idle',
      activeRepositioning: activeMoves.length,
      totalInProgress: activeMoves.length + (recentMoves.length - activeMoves.length)
    };
  }

  // Utility functions
  getZoneCenter(zone) {
    // Placeholder - in production, retrieve from zone database
    const zones = {
      'zone_1': { latitude: 40.7128, longitude: -74.0060 },
      'zone_2': { latitude: 40.7480, longitude: -73.9862 },
      'zone_3': { latitude: 40.7589, longitude: -73.9851 }
    };
    return zones[zone] || { latitude: 40.7128, longitude: -74.0060 };
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  setStrategy(strategy) {
    if (this.optimizationStrategies[strategy]) {
      this.currentStrategy = strategy;
      return true;
    }
    return false;
  }

  getCostFactors() {
    return this.costFactors;
  }

  setCostFactors(factors) {
    this.costFactors = { ...this.costFactors, ...factors };
  }
}

module.exports = RepositioningOptimizer;
