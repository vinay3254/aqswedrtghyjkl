const logger = require('../../api/middleware/logger');

/**
 * Traffic multiplier service
 * In production, this would integrate with Google Maps Traffic API, TomTom, or HERE
 * For now, uses mock data and time-based estimates
 */

class TrafficService {
  constructor() {
    // Default traffic multipliers by hour (24-hour format)
    this.hourlyMultipliers = {
      0: 1.0,   // Midnight - no traffic
      1: 1.0,
      2: 1.0,
      3: 1.0,
      4: 1.0,
      5: 1.1,   // Early morning - light traffic
      6: 1.3,   // Morning commute starts
      7: 1.5,   // Peak morning traffic
      8: 1.6,   // Peak continues
      9: 1.4,   // Traffic easing
      10: 1.2,
      11: 1.2,
      12: 1.3,  // Lunch hour
      13: 1.2,
      14: 1.2,
      15: 1.3,  // Afternoon pickup
      16: 1.4,  // Evening commute starts
      17: 1.6,  // Peak evening traffic
      18: 1.7,  // Peak evening traffic
      19: 1.5,  // Traffic easing
      20: 1.3,
      21: 1.2,
      22: 1.1,
      23: 1.0
    };

    // Day of week multipliers (0 = Sunday)
    this.dayMultipliers = {
      0: 0.7,   // Sunday - less traffic
      1: 1.0,   // Monday
      2: 1.0,   // Tuesday
      3: 1.0,   // Wednesday
      4: 1.0,   // Thursday
      5: 1.05,  // Friday - slightly more
      6: 0.8    // Saturday - less traffic
    };
  }

  /**
   * Get traffic multiplier for current time
   * @param {Date} datetime - Date/time to check (defaults to now)
   * @returns {Number} Traffic multiplier
   */
  getCurrentMultiplier(datetime = new Date()) {
    const hour = datetime.getHours();
    const day = datetime.getDay();

    const hourMultiplier = this.hourlyMultipliers[hour] || 1.0;
    const dayMultiplier = this.dayMultipliers[day] || 1.0;

    // Combine multipliers (not strictly multiplicative, use weighted average)
    const combined = (hourMultiplier * 0.8) + (dayMultiplier * 0.2);

    logger.debug('Traffic multiplier calculated', {
      hour,
      day,
      hourMultiplier,
      dayMultiplier,
      combined
    });

    return Math.round(combined * 100) / 100; // Round to 2 decimals
  }

  /**
   * Get traffic multiplier for a specific route
   * In production, this would call external traffic API
   * @param {Array} origin - [lng, lat]
   * @param {Array} destination - [lng, lat]
   * @param {Date} datetime - Date/time for prediction
   * @returns {Promise<Object>} Traffic information
   */
  async getRouteTraffic(origin, destination, datetime = new Date()) {
    // Mock implementation - in production, call Google Maps API:
    // const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
    //   params: {
    //     origin: `${origin[1]},${origin[0]}`,
    //     destination: `${destination[1]},${destination[0]}`,
    //     departure_time: Math.floor(datetime.getTime() / 1000),
    //     traffic_model: 'best_guess',
    //     key: process.env.GOOGLE_MAPS_API_KEY
    //   }
    // });

    const baseMultiplier = this.getCurrentMultiplier(datetime);
    
    // Add some randomness to simulate real conditions (±10%)
    const randomFactor = 0.9 + Math.random() * 0.2;
    const multiplier = baseMultiplier * randomFactor;

    const trafficLevel = this.getTrafficLevel(multiplier);

    return {
      multiplier: Math.round(multiplier * 100) / 100,
      level: trafficLevel,
      timestamp: datetime.toISOString(),
      source: 'mock' // Change to 'google_maps' in production
    };
  }

  /**
   * Get traffic level description from multiplier
   * @param {Number} multiplier - Traffic multiplier
   * @returns {String} Traffic level
   */
  getTrafficLevel(multiplier) {
    if (multiplier >= 1.5) return 'heavy';
    if (multiplier >= 1.3) return 'moderate';
    if (multiplier >= 1.1) return 'light';
    return 'clear';
  }

  /**
   * Predict traffic for next N hours
   * @param {Number} hours - Number of hours to predict
   * @returns {Array} Hourly predictions
   */
  predictTraffic(hours = 24) {
    const predictions = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const future = new Date(now.getTime() + i * 60 * 60 * 1000);
      const multiplier = this.getCurrentMultiplier(future);
      
      predictions.push({
        hour: future.toISOString(),
        multiplier,
        level: this.getTrafficLevel(multiplier)
      });
    }

    return predictions;
  }

  /**
   * Get optimal departure time to minimize traffic
   * @param {Date} startTime - Earliest departure time
   * @param {Number} windowHours - Time window to check
   * @returns {Object} Optimal departure info
   */
  getOptimalDepartureTime(startTime = new Date(), windowHours = 6) {
    let minMultiplier = Infinity;
    let optimalTime = startTime;

    for (let i = 0; i < windowHours * 60; i += 15) { // Check every 15 minutes
      const checkTime = new Date(startTime.getTime() + i * 60 * 1000);
      const multiplier = this.getCurrentMultiplier(checkTime);

      if (multiplier < minMultiplier) {
        minMultiplier = multiplier;
        optimalTime = checkTime;
      }
    }

    return {
      optimalTime: optimalTime.toISOString(),
      multiplier: minMultiplier,
      level: this.getTrafficLevel(minMultiplier),
      savings: this.getCurrentMultiplier(startTime) - minMultiplier
    };
  }

  /**
   * Apply traffic multiplier to duration
   * @param {Number} baseDuration - Base duration in seconds
   * @param {Number} multiplier - Traffic multiplier
   * @returns {Number} Adjusted duration in seconds
   */
  applyTraffic(baseDuration, multiplier = null) {
    const actualMultiplier = multiplier || this.getCurrentMultiplier();
    return Math.round(baseDuration * actualMultiplier);
  }

  /**
   * Get traffic incidents (mock)
   * In production, this would fetch real incidents
   * @param {Array} bounds - Bounding box [minLng, minLat, maxLng, maxLat]
   * @returns {Array} Traffic incidents
   */
  async getIncidents(bounds) {
    // Mock data - in production, fetch from traffic API
    const mockIncidents = [
      {
        id: 'incident-1',
        type: 'accident',
        severity: 'major',
        location: [77.2090, 28.6139],
        description: 'Traffic accident on Ring Road',
        delayMinutes: 15,
        timestamp: new Date().toISOString()
      }
    ];

    // Filter incidents within bounds
    return mockIncidents.filter(incident => {
      const [lng, lat] = incident.location;
      return lng >= bounds[0] && lng <= bounds[2] &&
             lat >= bounds[1] && lat <= bounds[3];
    });
  }
}

module.exports = TrafficService;
