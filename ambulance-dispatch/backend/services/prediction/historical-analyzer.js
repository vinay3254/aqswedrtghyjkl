/**
 * Historical Analyzer - Analyze historical call data for patterns
 * Extracts insights for demand forecasting and trend identification
 */

const mean = require('simple-statistics').mean;
const standardDeviation = require('simple-statistics').standardDeviation;
const median = require('simple-statistics').median;
const quantile = require('simple-statistics').quantile;

class HistoricalAnalyzer {
  constructor() {
    this.analysisCache = new Map();
    this.patterns = {
      hourly: new Map(),
      daily: new Map(),
      weekly: new Map(),
      seasonal: new Map(),
      anomalies: []
    };
    this.cacheExpiry = 3600000; // 1 hour
  }

  /**
   * Analyze historical call data
   * @param {Array} callData - Historical emergency calls
   * @returns {Object} Comprehensive analysis
   */
  analyzeHistoricalData(callData) {
    if (!callData || callData.length === 0) {
      return { success: false, error: 'No call data provided' };
    }

    const cacheKey = this.generateCacheKey(callData);
    const cached = this.analysisCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.analysis;
    }

    const analysis = {
      summary: this.analyzeSummaryStatistics(callData),
      temporal: this.analyzeTemporalPatterns(callData),
      spatial: this.analyzeSpatialPatterns(callData),
      anomalies: this.detectAnomalies(callData),
      trends: this.analyzeTrends(callData),
      predictions: this.generateInsights(callData),
      timestamp: new Date()
    };

    this.analysisCache.set(cacheKey, { analysis, timestamp: Date.now() });

    return {
      success: true,
      analysis
    };
  }

  /**
   * Summary statistics
   */
  analyzeSummaryStatistics(callData) {
    const callCounts = callData.map(c => c.count || 1);
    const responseTimes = callData
      .filter(c => c.responseTime)
      .map(c => c.responseTime);
    const callTypes = this.groupBy(callData, 'type');

    return {
      totalCalls: callData.length,
      averageCallsPerRecord: parseFloat(mean(callCounts).toFixed(2)),
      medianCallsPerRecord: median(callCounts),
      stdDeviation: parseFloat(standardDeviation(callCounts).toFixed(2)),
      minCalls: Math.min(...callCounts),
      maxCalls: Math.max(...callCounts),
      averageResponseTime: responseTimes.length > 0 
        ? parseFloat(mean(responseTimes).toFixed(2)) 
        : null,
      medianResponseTime: responseTimes.length > 0
        ? median(responseTimes)
        : null,
      callTypeBreakdown: this.summarizeCallTypes(callTypes),
      dataQuality: this.assessDataQuality(callData)
    };
  }

  /**
   * Analyze temporal patterns
   */
  analyzeTemporalPatterns(callData) {
    const hourlyPattern = {};
    const dailyPattern = {};
    const monthlyPattern = {};

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

    callData.forEach(call => {
      const date = new Date(call.timestamp);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const month = date.getMonth();

      // Hourly
      if (!hourlyPattern[hour]) hourlyPattern[hour] = [];
      hourlyPattern[hour].push(call.count || 1);

      // Daily (day of week)
      const dayKey = dayNames[dayOfWeek];
      if (!dailyPattern[dayKey]) dailyPattern[dayKey] = [];
      dailyPattern[dayKey].push(call.count || 1);

      // Monthly
      const monthKey = monthNames[month];
      if (!monthlyPattern[monthKey]) monthlyPattern[monthKey] = [];
      monthlyPattern[monthKey].push(call.count || 1);
    });

    return {
      byHour: this.summarizePattern(hourlyPattern),
      byDayOfWeek: this.summarizePattern(dailyPattern),
      byMonth: this.summarizePattern(monthlyPattern),
      peakHours: this.findPeakPeriods(hourlyPattern),
      peakDays: this.findPeakPeriods(dailyPattern),
      peakMonths: this.findPeakPeriods(monthlyPattern),
      lowestDemandHour: this.findLowestDemandPeriod(hourlyPattern),
      lowestDemandDay: this.findLowestDemandPeriod(dailyPattern)
    };
  }

  /**
   * Analyze spatial patterns by zone
   */
  analyzeSpatialPatterns(callData) {
    const zoneData = this.groupBy(callData, 'zone');
    const zoneAnalysis = {};

    for (const [zone, calls] of Object.entries(zoneData)) {
      const counts = calls.map(c => c.count || 1);
      zoneAnalysis[zone] = {
        totalCalls: calls.length,
        averageCallsPerRecord: parseFloat(mean(counts).toFixed(2)),
        stdDeviation: parseFloat(standardDeviation(counts).toFixed(2)),
        percentageOfTotal: parseFloat((calls.length / callData.length * 100).toFixed(1)),
        callTypes: this.countCallTypes(calls),
        riskLevel: this.assessZoneRisk(counts),
        demandTrend: this.calculateTrend(calls)
      };
    }

    return {
      zones: zoneAnalysis,
      highDemandZones: Object.entries(zoneAnalysis)
        .filter(([_, data]) => data.riskLevel === 'HIGH' || data.riskLevel === 'CRITICAL')
        .map(([zone, _]) => zone),
      balancedCoverage: this.assessZoneBalance(zoneAnalysis)
    };
  }

  /**
   * Detect anomalies in call patterns
   */
  detectAnomalies(callData) {
    const callCounts = callData.map(c => c.count || 1);
    const mean_val = mean(callCounts);
    const std_val = standardDeviation(callCounts);

    const anomalies = callData
      .map((call, idx) => ({
        ...call,
        index: idx,
        zscore: (call.count - mean_val) / std_val
      }))
      .filter(item => Math.abs(item.zscore) > 2.5) // Z-score > 2.5 standard deviations
      .map(item => ({
        timestamp: item.timestamp,
        zone: item.zone,
        callCount: item.count,
        zscore: parseFloat(item.zscore.toFixed(2)),
        severity: Math.abs(item.zscore) > 4 ? 'CRITICAL' : 'HIGH',
        expectedCount: Math.round(mean_val),
        explanation: this.explainAnomaly(item, callData)
      }));

    this.patterns.anomalies = anomalies;

    return {
      detectedAnomalies: anomalies.length,
      anomalies: anomalies.slice(0, 10), // Top 10
      anomalyRate: parseFloat((anomalies.length / callData.length * 100).toFixed(2)),
      criticalAnomalies: anomalies.filter(a => a.severity === 'CRITICAL').length
    };
  }

  /**
   * Analyze trends
   */
  analyzeTrends(callData) {
    const sortedData = callData
      .filter(c => c.timestamp && c.count !== undefined)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (sortedData.length < 2) {
      return { trend: 'insufficient_data' };
    }

    const counts = sortedData.map(d => d.count);
    const firstHalf = mean(counts.slice(0, Math.floor(counts.length / 2)));
    const secondHalf = mean(counts.slice(Math.floor(counts.length / 2)));
    const trendDirection = secondHalf > firstHalf ? 'increasing' : secondHalf < firstHalf ? 'decreasing' : 'stable';
    const percentageChange = ((secondHalf - firstHalf) / firstHalf * 100).toFixed(1);

    // Moving average
    const movingAvg = this.calculateMovingAverage(counts, 7);

    return {
      direction: trendDirection,
      percentageChange: parseFloat(percentageChange),
      firstPeriodAverage: parseFloat(firstHalf.toFixed(2)),
      secondPeriodAverage: parseFloat(secondHalf.toFixed(2)),
      volatility: parseFloat(standardDeviation(counts).toFixed(2)),
      movingAverageLatest: movingAvg.length > 0 ? parseFloat(movingAvg[movingAvg.length - 1].toFixed(2)) : null,
      forecastedDirection: secondHalf > firstHalf ? 'expect_increase' : 'expect_decrease'
    };
  }

  /**
   * Generate predictive insights
   */
  generateInsights(callData) {
    const insights = [];

    const summary = this.analyzeSummaryStatistics(callData);
    const temporal = this.analyzeTemporalPatterns(callData);
    const spatial = this.analyzeSpatialPatterns(callData);
    const anomalies = this.detectAnomalies(callData);

    // Insight 1: Peak demand periods
    if (temporal.peakHours && temporal.peakHours.length > 0) {
      insights.push({
        type: 'peak_demand',
        severity: 'medium',
        insight: `Peak call volume occurs during ${temporal.peakHours.join(', ')} hours`,
        recommendation: 'Increase ambulance availability during these hours'
      });
    }

    // Insight 2: High-risk zones
    if (spatial.highDemandZones.length > 0) {
      insights.push({
        type: 'zone_concentration',
        severity: 'high',
        insight: `High call concentration in zones: ${spatial.highDemandZones.join(', ')}`,
        recommendation: `Consider increasing ambulance allocation to ${spatial.highDemandZones[0]}`
      });
    }

    // Insight 3: Anomalies
    if (anomalies.detectedAnomalies > 0) {
      insights.push({
        type: 'anomaly_detected',
        severity: 'medium',
        insight: `${anomalies.detectedAnomalies} anomalies detected in call patterns`,
        recommendation: 'Investigate causes and implement preventive measures'
      });
    }

    // Insight 4: Call type distribution
    const topCallType = Object.entries(summary.callTypeBreakdown)
      .sort((a, b) => b[1] - a[1])[0];
    if (topCallType) {
      insights.push({
        type: 'call_type_prevalence',
        severity: 'low',
        insight: `Most common call type: ${topCallType[0]} (${topCallType[1]}%)`,
        recommendation: 'Ensure specialized training for handling this call type'
      });
    }

    return {
      insights,
      insightCount: insights.length,
      highSeverityCount: insights.filter(i => i.severity === 'high').length
    };
  }

  /**
   * Predict call volume for future time period
   */
  predictCallVolume(callData, futureDate) {
    const hourlyPattern = this.analyzeTemporalPatterns(callData).byHour;
    const summary = this.analyzeSummaryStatistics(callData);

    const hour = futureDate.getHours();
    const dayOfWeek = futureDate.getDay();
    const dailyPattern = this.analyzeTemporalPatterns(callData).byDayOfWeek;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayPattern = dailyPattern[dayNames[dayOfWeek]];

    const baseForecast = summary.averageCallsPerRecord;
    const hourFactor = (hourlyPattern[hour] || baseForecast) / baseForecast;
    const dayFactor = (dayPattern || baseForecast) / baseForecast;

    const prediction = Math.round(baseForecast * hourFactor * dayFactor);
    const confidence = 0.75; // 75% confidence for 1-step ahead

    return {
      forecastedCalls: prediction,
      confidence,
      hourFactor: parseFloat(hourFactor.toFixed(2)),
      dayFactor: parseFloat(dayFactor.toFixed(2)),
      forecastDate: futureDate,
      confidenceInterval: {
        lower: Math.max(0, Math.round(prediction * 0.8)),
        upper: Math.round(prediction * 1.2)
      }
    };
  }

  /**
   * Compare periods
   */
  comparePeriods(callData, period1Start, period1End, period2Start, period2End) {
    const period1Data = callData.filter(c => {
      const date = new Date(c.timestamp);
      return date >= period1Start && date <= period1End;
    });

    const period2Data = callData.filter(c => {
      const date = new Date(c.timestamp);
      return date >= period2Start && date <= period2End;
    });

    const stats1 = this.analyzeSummaryStatistics(period1Data);
    const stats2 = this.analyzeSummaryStatistics(period2Data);

    const percentChange = ((stats2.averageCallsPerRecord - stats1.averageCallsPerRecord) / stats1.averageCallsPerRecord * 100).toFixed(1);

    return {
      period1: {
        start: period1Start,
        end: period1End,
        statistics: stats1
      },
      period2: {
        start: period2Start,
        end: period2End,
        statistics: stats2
      },
      comparison: {
        percentageChange: parseFloat(percentChange),
        direction: percentChange > 0 ? 'increase' : percentChange < 0 ? 'decrease' : 'no_change',
        significantDifference: Math.abs(percentChange) > 10
      }
    };
  }

  /**
   * Get zone performance report
   */
  getZonePerformanceReport(callData) {
    const spatial = this.analyzeSpatialPatterns(callData);
    
    const report = {
      timestamp: new Date(),
      zones: {}
    };

    for (const [zone, data] of Object.entries(spatial.zones)) {
      report.zones[zone] = {
        totalCalls: data.totalCalls,
        averageCallsPerRecord: data.averageCallsPerRecord,
        percentageOfTotal: data.percentageOfTotal,
        riskLevel: data.riskLevel,
        demandTrend: data.demandTrend,
        recommendation: this.getZoneRecommendation(data)
      };
    }

    return report;
  }

  // ============ Helper Methods ============

  /**
   * Summarize call types
   */
  summarizeCallTypes(callTypes) {
    const summary = {};
    let total = 0;

    for (const [type, calls] of Object.entries(callTypes)) {
      summary[type] = calls.length;
      total += calls.length;
    }

    const percentages = {};
    for (const [type, count] of Object.entries(summary)) {
      percentages[type] = parseFloat((count / total * 100).toFixed(1));
    }

    return percentages;
  }

  /**
   * Count call types in array
   */
  countCallTypes(calls) {
    const types = {};
    calls.forEach(c => {
      types[c.type || 'unknown'] = (types[c.type || 'unknown'] || 0) + 1;
    });
    return types;
  }

  /**
   * Assess data quality
   */
  assessDataQuality(callData) {
    const totalRecords = callData.length;
    const withTimestamp = callData.filter(c => c.timestamp).length;
    const withZone = callData.filter(c => c.zone).length;
    const withCount = callData.filter(c => c.count !== undefined).length;

    const completeness = {
      timestamp: (withTimestamp / totalRecords * 100).toFixed(1),
      zone: (withZone / totalRecords * 100).toFixed(1),
      count: (withCount / totalRecords * 100).toFixed(1)
    };

    const overallQuality = (Object.values(completeness).reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / 3).toFixed(1);

    return {
      completeness,
      overallQuality: parseFloat(overallQuality),
      qualityRating: overallQuality >= 95 ? 'EXCELLENT' : overallQuality >= 80 ? 'GOOD' : 'POOR'
    };
  }

  /**
   * Summarize a pattern object
   */
  summarizePattern(pattern) {
    const summary = {};
    for (const [key, values] of Object.entries(pattern)) {
      summary[key] = {
        average: parseFloat(mean(values).toFixed(2)),
        median: median(values),
        max: Math.max(...values),
        min: Math.min(...values)
      };
    }
    return summary;
  }

  /**
   * Find peak periods
   */
  findPeakPeriods(pattern) {
    const means = {};
    for (const [key, values] of Object.entries(pattern)) {
      means[key] = mean(values);
    }

    return Object.entries(means)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key);
  }

  /**
   * Find lowest demand period
   */
  findLowestDemandPeriod(pattern) {
    const means = {};
    for (const [key, values] of Object.entries(pattern)) {
      means[key] = mean(values);
    }

    return Object.entries(means)
      .sort((a, b) => a[1] - b[1])[0][0];
  }

  /**
   * Group array by property
   */
  groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property] || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  }

  /**
   * Assess zone risk
   */
  assessZoneRisk(counts) {
    const avg = mean(counts);
    const std = standardDeviation(counts);
    const max = Math.max(...counts);

    if (max > avg + 2 * std) return 'CRITICAL';
    if (max > avg + std) return 'HIGH';
    if (max > avg) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate trend
   */
  calculateTrend(calls) {
    const sorted = calls.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const counts = sorted.map(c => c.count || 1);
    const firstHalf = mean(counts.slice(0, Math.floor(counts.length / 2)));
    const secondHalf = mean(counts.slice(Math.floor(counts.length / 2)));

    if (secondHalf > firstHalf * 1.1) return 'INCREASING';
    if (secondHalf < firstHalf * 0.9) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * Assess zone balance
   */
  assessZoneBalance(zoneAnalysis) {
    const percentages = Object.values(zoneAnalysis).map(z => z.percentageOfTotal);
    const maxPercentage = Math.max(...percentages);
    const minPercentage = Math.min(...percentages);
    const balanced = maxPercentage - minPercentage < 20;

    return {
      balanced,
      maxZonePercentage: parseFloat(maxPercentage.toFixed(1)),
      minZonePercentage: parseFloat(minPercentage.toFixed(1)),
      recommendation: balanced ? 'Zone distribution is balanced' : 'Consider rebalancing zone allocations'
    };
  }

  /**
   * Explain anomaly
   */
  explainAnomaly(anomaly, callData) {
    const date = new Date(anomaly.timestamp);
    const explanations = [];

    // Check if it's a weekend
    if (date.getDay() === 0 || date.getDay() === 6) {
      explanations.push('weekend');
    }

    // Check if it's a holiday
    const month = date.getMonth();
    const day = date.getDate();
    if ((month === 11 && day === 25) || (month === 0 && day === 1)) {
      explanations.push('holiday');
    }

    // Check surrounding data
    const surrounding = callData.filter(c => {
      const cDate = new Date(c.timestamp);
      return Math.abs(cDate - date) < 86400000 && cDate !== date;
    });

    if (surrounding.length > 0) {
      const surroundingAvg = mean(surrounding.map(c => c.count || 1));
      if (anomaly.count > surroundingAvg * 2) {
        explanations.push('spike_in_area');
      }
    }

    return explanations.length > 0 ? explanations.join(', ') : 'unknown_cause';
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(values, window) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const subset = values.slice(start, i + 1);
      result.push(mean(subset));
    }
    return result;
  }

  /**
   * Get zone recommendation
   */
  getZoneRecommendation(zoneData) {
    if (zoneData.riskLevel === 'CRITICAL') {
      return 'URGENT: Increase ambulance allocation and consider establishing additional station';
    }
    if (zoneData.riskLevel === 'HIGH') {
      return 'Increase ambulance allocation during peak hours';
    }
    if (zoneData.demandTrend === 'INCREASING') {
      return 'Monitor demand trend; consider proactive allocation increase';
    }
    return 'Maintain current allocation; monitor trends';
  }

  /**
   * Generate cache key
   */
  generateCacheKey(data) {
    return `analysis_${data.length}_${data[0]?.timestamp || 'unknown'}`;
  }
}

module.exports = HistoricalAnalyzer;
