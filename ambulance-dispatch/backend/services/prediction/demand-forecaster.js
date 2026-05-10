/**
 * Demand Forecaster - ML Model for Emergency Demand Prediction
 * Predicts emergency demand by geographic zone and time
 */

const SimpleLinearRegression = require('simple-statistics').linearRegression;
const mean = require('simple-statistics').mean;
const standardDeviation = require('simple-statistics').standardDeviation;

class DemandForecaster {
  constructor() {
    this.zoneModels = new Map(); // Models per zone
    this.hourlyPatterns = new Map(); // Hour of day patterns
    this.dayPatterns = new Map(); // Day of week patterns
    this.seasonalFactors = new Map(); // Seasonal adjustments
    this.minHistoryRequired = 30; // Minimum days of history for model
  }

  /**
   * Train demand model with historical call data
   * @param {Array} historicalData - [{zone, timestamp, callCount, ...}]
   * @param {String} zone - Geographic zone identifier
   */
  trainZoneModel(historicalData, zone) {
    if (!historicalData || historicalData.length < this.minHistoryRequired) {
      console.warn(`Insufficient data for zone ${zone}. Need ${this.minHistoryRequired} days, got ${historicalData?.length || 0}`);
      return false;
    }

    const zoneData = historicalData.filter(d => d.zone === zone);
    
    if (zoneData.length === 0) {
      return false;
    }

    // Extract time-series data
    const timeSeries = zoneData
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(d => ({
        timestamp: new Date(d.timestamp),
        calls: d.callCount || 0
      }));

    // Calculate base demand (average)
    const baseDemand = mean(timeSeries.map(t => t.calls));

    // Extract hourly patterns (average calls by hour)
    const hourlyData = this.extractHourlyPatterns(timeSeries);
    
    // Extract daily patterns (average calls by day of week)
    const dailyData = this.extractDailyPatterns(timeSeries);

    // Calculate trend using linear regression
    const dataPoints = timeSeries.map((t, idx) => [idx, t.calls]);
    const trend = SimpleLinearRegression(dataPoints);

    // Store zone model
    this.zoneModels.set(zone, {
      baseDemand,
      trend,
      hourlyPattern: hourlyData,
      dailyPattern: dailyData,
      standardDeviation: standardDeviation(timeSeries.map(t => t.calls)),
      lastUpdated: new Date(),
      trainingDataPoints: timeSeries.length
    });

    return true;
  }

  /**
   * Extract hourly demand patterns
   */
  extractHourlyPatterns(timeSeries) {
    const hourlyBuckets = new Map();

    timeSeries.forEach(t => {
      const hour = t.timestamp.getHours();
      if (!hourlyBuckets.has(hour)) {
        hourlyBuckets.set(hour, []);
      }
      hourlyBuckets.get(hour).push(t.calls);
    });

    const patterns = {};
    for (let hour = 0; hour < 24; hour++) {
      const values = hourlyBuckets.get(hour) || [0];
      patterns[hour] = mean(values);
    }

    return patterns;
  }

  /**
   * Extract daily (day of week) demand patterns
   */
  extractDailyPatterns(timeSeries) {
    const dayBuckets = new Map();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    timeSeries.forEach(t => {
      const dayOfWeek = t.timestamp.getDay();
      if (!dayBuckets.has(dayOfWeek)) {
        dayBuckets.set(dayOfWeek, []);
      }
      dayBuckets.get(dayOfWeek).push(t.calls);
    });

    const patterns = {};
    for (let day = 0; day < 7; day++) {
      const values = dayBuckets.get(day) || [0];
      patterns[day] = mean(values);
    }

    return patterns;
  }

  /**
   * Forecast demand for a specific zone and time
   * @param {String} zone - Geographic zone
   * @param {Date} forecastTime - Time to forecast for
   * @param {Object} eventFactors - Optional event surge multipliers
   * @returns {Object} Forecast with confidence interval
   */
  forecastDemand(zone, forecastTime, eventFactors = {}) {
    const model = this.zoneModels.get(zone);

    if (!model) {
      return {
        forecast: null,
        confidence: 0,
        error: `No model trained for zone ${zone}`
      };
    }

    let baseForecast = model.baseDemand;

    // Apply hourly factor
    const hour = forecastTime.getHours();
    const hourlyFactor = (model.hourlyPattern[hour] || model.baseDemand) / model.baseDemand;
    baseForecast *= hourlyFactor;

    // Apply daily (day of week) factor
    const dayOfWeek = forecastTime.getDay();
    const dailyFactor = (model.dailyPattern[dayOfWeek] || model.baseDemand) / model.baseDemand;
    baseForecast *= dailyFactor;

    // Apply event factors (surge multipliers)
    let eventMultiplier = 1.0;
    if (eventFactors && eventFactors.multiplier) {
      eventMultiplier = eventFactors.multiplier;
      baseForecast *= eventMultiplier;
    }

    // Apply seasonal adjustment if available
    const seasonalFactor = this.getSeasonalFactor(forecastTime, zone) || 1.0;
    baseForecast *= seasonalFactor;

    // Calculate confidence interval (95%)
    const confidenceMargin = 1.96 * model.standardDeviation;
    const confidence = Math.max(0.5, 1 - (confidenceMargin / (baseForecast || 1)));

    return {
      forecast: Math.round(baseForecast),
      confidenceLower: Math.max(0, Math.round(baseForecast - confidenceMargin)),
      confidenceUpper: Math.round(baseForecast + confidenceMargin),
      confidence: Math.min(1, confidence),
      hourlyFactor: parseFloat(hourlyFactor.toFixed(2)),
      dailyFactor: parseFloat(dailyFactor.toFixed(2)),
      eventMultiplier: parseFloat(eventMultiplier.toFixed(2)),
      seasonalFactor: parseFloat(seasonalFactor.toFixed(2)),
      modelAge: Date.now() - model.lastUpdated.getTime(),
      trainingDataPoints: model.trainingDataPoints
    };
  }

  /**
   * Forecast demand for next 24 hours
   */
  forecast24Hours(zone, startTime = new Date(), eventFactors = {}) {
    const forecasts = [];
    const currentTime = new Date(startTime);

    for (let i = 0; i < 24; i++) {
      const forecast = this.forecastDemand(zone, currentTime, eventFactors[i] || {});
      forecasts.push({
        timestamp: new Date(currentTime),
        ...forecast
      });

      currentTime.setHours(currentTime.getHours() + 1);
    }

    return forecasts;
  }

  /**
   * Forecast demand for multiple zones
   */
  forecastMultiZone(zones, forecastTime, eventFactors = {}) {
    const zoneForecasts = {};

    zones.forEach(zone => {
      zoneForecasts[zone] = this.forecastDemand(
        zone,
        forecastTime,
        eventFactors[zone] || {}
      );
    });

    return zoneForecasts;
  }

  /**
   * Get seasonal adjustment factor
   */
  getSeasonalFactor(date, zone) {
    const seasonalFactors = this.seasonalFactors.get(zone) || {};
    const month = date.getMonth();

    // Default seasonal patterns (can be trained)
    const defaultSeasons = {
      0: 1.1,  // January - winter
      1: 1.1,  // February - winter
      2: 0.95, // March - spring
      3: 0.9,  // April - spring
      4: 1.0,  // May - summer
      5: 1.2,  // June - summer events
      6: 1.3,  // July - summer peak
      7: 1.25, // August - summer
      8: 1.05, // September - fall
      9: 1.0,  // October
      10: 1.1, // November
      11: 1.4  // December - holidays
    };

    return seasonalFactors[month] || defaultSeasons[month] || 1.0;
  }

  /**
   * Update seasonal factors based on actual data
   */
  updateSeasonalFactors(historicalData, zone) {
    const zoneData = historicalData.filter(d => d.zone === zone);
    const monthlyAverages = new Map();

    zoneData.forEach(d => {
      const month = new Date(d.timestamp).getMonth();
      if (!monthlyAverages.has(month)) {
        monthlyAverages.set(month, []);
      }
      monthlyAverages.get(month).push(d.callCount || 0);
    });

    const seasonalData = {};
    const allMonthlyMeans = [];

    for (let month = 0; month < 12; month++) {
      const values = monthlyAverages.get(month) || [];
      if (values.length > 0) {
        seasonalData[month] = mean(values);
        allMonthlyMeans.push(mean(values));
      }
    }

    // Normalize to get factors
    const overallMean = mean(allMonthlyMeans);
    const factors = {};

    for (let month = 0; month < 12; month++) {
      factors[month] = seasonalData[month] ? seasonalData[month] / overallMean : 1.0;
    }

    this.seasonalFactors.set(zone, factors);
  }

  /**
   * Get model information for a zone
   */
  getModelInfo(zone) {
    const model = this.zoneModels.get(zone);
    if (!model) {
      return { status: 'not_trained', zone };
    }

    return {
      status: 'trained',
      zone,
      baseDemand: model.baseDemand,
      standardDeviation: model.standardDeviation,
      lastUpdated: model.lastUpdated,
      trainingDataPoints: model.trainingDataPoints,
      modelAge: Date.now() - model.lastUpdated.getTime()
    };
  }

  /**
   * Get all trained zones
   */
  getTrainedZones() {
    return Array.from(this.zoneModels.keys());
  }

  /**
   * Reset models for retraining
   */
  resetModels() {
    this.zoneModels.clear();
    this.seasonalFactors.clear();
  }
}

module.exports = DemandForecaster;
