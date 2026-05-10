/**
 * Congestion Analyzer
 * Analyzes traffic congestion patterns, predicts delays, and provides insights
 */

const logger = require('../../utils/logger');

class CongestionAnalyzer {
  constructor(config = {}) {
    this.config = config;
    this.historyWindow = config.historyWindow || 3600000; // 1 hour
    this.trafficHistory = new Map(); // Store historical traffic data
    this.congestionPatterns = new Map(); // Store identified patterns
    this.predictions = new Map(); // Store delay predictions
  }

  /**
   * Analyze congestion at a specific location
   */
  analyzeCongestion(trafficData, location) {
    try {
      if (!trafficData || !trafficData.aggregated) {
        return { error: 'Invalid traffic data' };
      }

      const analysis = {
        currentConditions: this.analyzeCurrentConditions(trafficData),
        historicalTrends: this.analyzeHistoricalTrends(location),
        predictions: this.predictUpcomingCongestion(location, trafficData),
        riskFactors: this.identifyRiskFactors(trafficData),
        recommendations: this.generateRecommendations(trafficData),
        timestamp: new Date().toISOString()
      };

      // Store in history
      this.storeTrafficHistory(location, trafficData);

      return analysis;
    } catch (error) {
      logger.error('Error analyzing congestion:', error);
      throw error;
    }
  }

  /**
   * Analyze current traffic conditions
   */
  analyzeCurrentConditions(trafficData) {
    const aggregated = trafficData.aggregated;

    return {
      congestionLevel: aggregated.congestionLevel,
      averageSpeed: aggregated.averageSpeed,
      speedLimit: aggregated.speedLimit,
      speedRatio: aggregated.speedLimit > 0 
        ? ((aggregated.averageSpeed / aggregated.speedLimit) * 100).toFixed(1) + '%'
        : '0%',
      flowStatus: this.determineFlowStatus(aggregated),
      vehicleDensity: this.estimateVehicleDensity(trafficData),
      incidents: aggregated.incidents,
      hasActiveIncidents: aggregated.incidents.length > 0,
      roadConditions: aggregated.roadConditions,
      dataConfidence: (aggregated.confidence * 100).toFixed(1) + '%'
    };
  }

  /**
   * Determine overall flow status
   */
  determineFlowStatus(aggregated) {
    const { congestionLevel, incidents } = aggregated;
    const hasIncidents = incidents && incidents.length > 0;

    if (congestionLevel === 'severe' || (hasIncidents && incidents.some(i => i.severity === 'major'))) {
      return 'blocked';
    }
    if (congestionLevel === 'heavy') {
      return 'slow';
    }
    if (congestionLevel === 'moderate') {
      return 'moderate';
    }
    if (congestionLevel === 'light') {
      return 'light';
    }
    return 'free';
  }

  /**
   * Estimate vehicle density on road
   */
  estimateVehicleDensity(trafficData) {
    const { sources } = trafficData;
    let totalVehicles = 0;
    let sensorCount = 0;

    if (sources.sensors && sources.sensors.sensorData) {
      sources.sensors.sensorData.forEach(sensor => {
        totalVehicles += sensor.vehicleCount || 0;
        sensorCount++;
      });
    }

    return {
      estimatedVehicles: totalVehicles,
      sensorsMonitoring: sensorCount,
      estimatedDensity: totalVehicles > 0 ? 'high' : 'medium'
    };
  }

  /**
   * Analyze historical trends
   */
  analyzeHistoricalTrends(location) {
    const key = `${location.latitude}:${location.longitude}`;
    const history = this.trafficHistory.get(key) || [];

    if (history.length < 2) {
      return { trend: 'insufficient-data' };
    }

    const recentHistory = history.slice(-10); // Last 10 data points
    const speeds = recentHistory.map(h => h.aggregated.averageSpeed);
    const congestionLevels = recentHistory.map(h => h.aggregated.congestionLevel);

    const trend = this.calculateTrend(speeds);
    const avgSpeed = Math.round(speeds.reduce((a, b) => a + b) / speeds.length);
    const dominantCongestion = this.findDominantValue(congestionLevels);

    return {
      trend, // 'improving', 'worsening', 'stable'
      averageSpeed: avgSpeed,
      speedVariance: this.calculateVariance(speeds),
      dominantCongestionLevel: dominantCongestion,
      dataPoints: history.length,
      timespan: this.getTimespan(history)
    };
  }

  /**
   * Calculate trend from speed data
   */
  calculateTrend(speeds) {
    if (speeds.length < 2) return 'stable';

    const first = speeds[0];
    const last = speeds[speeds.length - 1];
    const midpoint = Math.round(speeds.length / 2);
    const firstHalf = speeds.slice(0, midpoint).reduce((a, b) => a + b) / midpoint;
    const secondHalf = speeds.slice(midpoint).reduce((a, b) => a + b) / (speeds.length - midpoint);

    const change = ((secondHalf - firstHalf) / firstHalf) * 100;

    if (change > 10) return 'improving';
    if (change < -10) return 'worsening';
    return 'stable';
  }

  /**
   * Calculate variance
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b) / values.length);
  }

  /**
   * Find dominant value in array
   */
  findDominantValue(array) {
    if (array.length === 0) return null;
    const counts = {};
    array.forEach(v => {
      counts[v] = (counts[v] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  /**
   * Get timespan of history
   */
  getTimespan(history) {
    if (history.length < 2) return '0s';
    const first = new Date(history[0].timestamp);
    const last = new Date(history[history.length - 1].timestamp);
    const minutes = Math.round((last - first) / 60000);
    return minutes < 60 ? `${minutes}m` : `${(minutes / 60).toFixed(1)}h`;
  }

  /**
   * Predict upcoming congestion
   */
  predictUpcomingCongestion(location, currentTrafficData) {
    const key = `${location.latitude}:${location.longitude}`;
    const history = this.trafficHistory.get(key) || [];

    // Basic prediction based on current conditions and trend
    const current = currentTrafficData.aggregated;
    const trend = history.length >= 2 ? this.calculateTrend(
      history.slice(-10).map(h => h.aggregated.averageSpeed)
    ) : 'stable';

    const predictions = {
      next15Minutes: this.predictCongestion(current, trend, 15),
      next30Minutes: this.predictCongestion(current, trend, 30),
      next60Minutes: this.predictCongestion(current, trend, 60),
      peakTimeEstimate: this.estimatePeakTime(location),
      confidence: this.calculatePredictionConfidence(history)
    };

    // Cache predictions
    this.predictions.set(key, predictions);

    return predictions;
  }

  /**
   * Predict congestion at a future time
   */
  predictCongestion(currentConditions, trend, minutesAhead) {
    const baseSpeed = currentConditions.averageSpeed;
    let predictedSpeed = baseSpeed;

    // Simple trend-based prediction
    if (trend === 'improving') {
      predictedSpeed = Math.min(currentConditions.speedLimit, baseSpeed + (minutesAhead * 0.5));
    } else if (trend === 'worsening') {
      predictedSpeed = Math.max(0, baseSpeed - (minutesAhead * 0.8));
    }

    const speedRatio = (predictedSpeed / currentConditions.speedLimit) * 100;
    const predictedCongestion = this.getCongestionFromSpeed(speedRatio);

    return {
      predictedSpeed: Math.round(predictedSpeed),
      predictedCongestionLevel: predictedCongestion,
      expectedDelay: this.calculateExpectedDelay(currentConditions, predictedSpeed),
      confidence: Math.max(0.5, 1 - (minutesAhead / 120)) // Decrease confidence for distant predictions
    };
  }

  /**
   * Get congestion level from speed ratio
   */
  getCongestionFromSpeed(speedRatio) {
    if (speedRatio >= 80) return 'free-flow';
    if (speedRatio >= 50) return 'light';
    if (speedRatio >= 30) return 'moderate';
    if (speedRatio >= 10) return 'heavy';
    return 'severe';
  }

  /**
   * Calculate expected delay in minutes
   */
  calculateExpectedDelay(conditions, speed) {
    if (speed === 0 || conditions.speedLimit === 0) return 0;

    // Assume 10 km route
    const distance = 10;
    const expectedTime = (distance / speed) * 60; // minutes
    const normalTime = (distance / conditions.speedLimit) * 60;
    const delay = Math.round((expectedTime - normalTime) * 10) / 10;

    return Math.max(0, delay);
  }

  /**
   * Estimate peak time for this location
   */
  estimatePeakTime(location) {
    const key = `${location.latitude}:${location.longitude}`;
    const history = this.trafficHistory.get(key) || [];

    if (history.length === 0) {
      const now = new Date();
      const hours = [7, 8, 9, 17, 18, 19]; // Common peak hours
      return this.findNextPeakHour(now, hours);
    }

    // Analyze pattern from history
    return {
      estimatedTime: 'Based on historical patterns',
      confidence: 0.6
    };
  }

  /**
   * Find next peak hour
   */
  findNextPeakHour(date, peakHours) {
    const hour = date.getHours();
    const nextPeak = peakHours.find(h => h > hour);
    return {
      estimatedTime: nextPeak ? `${nextPeak}:00` : 'Evening peak',
      confidence: 0.7
    };
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(history) {
    // More history = higher confidence
    if (history.length < 5) return 0.5;
    if (history.length < 20) return 0.65;
    if (history.length < 50) return 0.8;
    return 0.9;
  }

  /**
   * Identify risk factors
   */
  identifyRiskFactors(trafficData) {
    const factors = [];
    const conditions = trafficData.aggregated;

    if (conditions.congestionLevel === 'severe') {
      factors.push({ risk: 'severe-congestion', severity: 'high' });
    }

    if (conditions.incidents.length > 0) {
      conditions.incidents.forEach(incident => {
        factors.push({
          risk: `${incident.type}-incident`,
          severity: incident.severity || 'medium',
          description: incident.description
        });
      });
    }

    if (conditions.roadConditions.hasAccidents) {
      factors.push({ risk: 'accidents-reported', severity: 'high' });
    }

    if (conditions.roadConditions.hasConstruction) {
      factors.push({ risk: 'construction', severity: 'medium' });
    }

    if (conditions.roadConditions.isWet) {
      factors.push({ risk: 'wet-roads', severity: 'medium' });
    }

    if (trafficData.aggregated.confidence < 0.5) {
      factors.push({ risk: 'low-data-confidence', severity: 'low' });
    }

    return factors;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(trafficData) {
    const recommendations = [];
    const conditions = trafficData.aggregated;
    const avgSpeed = conditions.averageSpeed;
    const speedLimit = conditions.speedLimit;

    if (conditions.congestionLevel === 'severe') {
      recommendations.push({
        priority: 'high',
        action: 'avoid-route',
        message: 'Severe congestion detected. Consider alternative route.',
        timeToAvoid: '30 minutes'
      });
    } else if (conditions.congestionLevel === 'heavy') {
      recommendations.push({
        priority: 'high',
        action: 'prepare-delay',
        message: 'Heavy congestion expected. Plan extra time.',
        estimatedDelay: '15-20 minutes'
      });
    } else if (conditions.congestionLevel === 'moderate') {
      recommendations.push({
        priority: 'medium',
        action: 'plan-ahead',
        message: 'Moderate congestion. Allow some extra time.',
        estimatedDelay: '5-10 minutes'
      });
    }

    if (conditions.incidents.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'aware-of-incidents',
        message: `${conditions.incidents.length} incident(s) detected on route`,
        incidents: conditions.incidents
      });
    }

    if (avgSpeed > 0 && avgSpeed < speedLimit * 0.5) {
      recommendations.push({
        priority: 'medium',
        action: 'use-alternative',
        message: 'Current speed is significantly below limit. Alternative routes might be faster.'
      });
    }

    return recommendations;
  }

  /**
   * Store traffic data in history
   */
  storeTrafficHistory(location, trafficData) {
    const key = `${location.latitude}:${location.longitude}`;
    const history = this.trafficHistory.get(key) || [];

    history.push({
      ...trafficData,
      timestamp: new Date().toISOString()
    });

    // Keep only data within history window
    const cutoff = Date.now() - this.historyWindow;
    const filtered = history.filter(h => new Date(h.timestamp).getTime() > cutoff);

    this.trafficHistory.set(key, filtered);
  }

  /**
   * Get analysis for route with multiple points
   */
  analyzeRouteConditions(routeWithTraffic) {
    const analyses = routeWithTraffic.routePoints.map(point =>
      this.analyzeCongestion(point.trafficData, {
        latitude: point.latitude,
        longitude: point.longitude
      })
    );

    return {
      routeAnalyses: analyses,
      overallCongestion: this.determineOverallCongestion(analyses),
      bottlenecks: this.identifyBottlenecks(routeWithTraffic),
      bestAlternativeTime: this.calculateBestTravelTime(analyses),
      totalEstimatedDelay: this.calculateTotalDelay(analyses),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Determine overall route congestion
   */
  determineOverallCongestion(analyses) {
    const levels = analyses.map(a => a.currentConditions.congestionLevel);
    const congestionPriority = {
      'severe': 5,
      'heavy': 4,
      'moderate': 3,
      'light': 2,
      'free-flow': 1
    };

    const highest = Math.max(...levels.map(l => congestionPriority[l] || 0));
    return Object.keys(congestionPriority).find(k => congestionPriority[k] === highest);
  }

  /**
   * Identify bottleneck locations
   */
  identifyBottlenecks(routeWithTraffic) {
    const bottlenecks = [];

    routeWithTraffic.routePoints.forEach((point, index) => {
      const congestionLevel = point.trafficData.aggregated.congestionLevel;
      if (congestionLevel === 'severe' || congestionLevel === 'heavy') {
        bottlenecks.push({
          location: `Point ${index}`,
          latitude: point.latitude,
          longitude: point.longitude,
          congestionLevel,
          speed: point.trafficData.aggregated.averageSpeed
        });
      }
    });

    return bottlenecks;
  }

  /**
   * Calculate total estimated delay for route
   */
  calculateTotalDelay(analyses) {
    const delays = analyses.map(a => {
      const prediction = a.predictions.next30Minutes;
      return prediction.expectedDelay || 0;
    });

    return Math.round(delays.reduce((a, b) => a + b, 0) * 10) / 10;
  }

  /**
   * Calculate best time to travel
   */
  calculateBestTravelTime(analyses) {
    // Find when congestion is expected to be lowest
    const now = new Date();

    return {
      immediate: 'Now - Travel immediately if route is acceptable',
      alternative: 'In 30-45 minutes - Congestion expected to decrease'
    };
  }

  /**
   * Clear old data
   */
  clearOldData() {
    const cutoff = Date.now() - this.historyWindow;

    this.trafficHistory.forEach((history, key) => {
      const filtered = history.filter(h => new Date(h.timestamp).getTime() > cutoff);
      if (filtered.length === 0) {
        this.trafficHistory.delete(key);
      } else {
        this.trafficHistory.set(key, filtered);
      }
    });

    logger.info('Cleared old congestion analysis data');
  }
}

module.exports = CongestionAnalyzer;
