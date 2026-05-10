/**
 * Traffic Aggregator
 * Aggregates traffic data from multiple sources (Google Maps, TomTom, local sensors)
 * Provides unified interface for traffic data access
 */

const axios = require('axios');
const logger = require('../../utils/logger');
const { EventEmitter } = require('events');

class TrafficAggregator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.googleMapsApiKey = config.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY;
    this.tomtomApiKey = config.tomtomApiKey || process.env.TOMTOM_API_KEY;
    this.localSensorEndpoint = config.localSensorEndpoint || 'http://localhost:3001/api/sensors';
    this.cacheData = new Map();
    this.cacheTTL = config.cacheTTL || 60000; // 60 seconds
    this.lastUpdate = new Map();
  }

  /**
   * Aggregate traffic data from all sources for a given location
   */
  async getTrafficData(latitude, longitude, radius = 5000) {
    try {
      const cacheKey = `traffic_${latitude}_${longitude}_${radius}`;

      // Check cache
      if (this.isCacheValid(cacheKey)) {
        logger.debug(`Using cached traffic data for ${cacheKey}`);
        return this.cacheData.get(cacheKey);
      }

      // Fetch from all sources in parallel
      const [googleData, tomtomData, sensorData] = await Promise.allSettled([
        this.fetchGoogleMapsTraffic(latitude, longitude),
        this.fetchTomTomTraffic(latitude, longitude),
        this.fetchLocalSensorData(latitude, longitude, radius)
      ]);

      const aggregatedData = this.mergeTrafficData(
        this.handlePromiseResult(googleData),
        this.handlePromiseResult(tomtomData),
        this.handlePromiseResult(sensorData)
      );

      // Cache the result
      this.cacheData.set(cacheKey, aggregatedData);
      this.lastUpdate.set(cacheKey, Date.now());

      this.emit('traffic-data-updated', {
        location: { latitude, longitude },
        data: aggregatedData,
        timestamp: new Date()
      });

      return aggregatedData;
    } catch (error) {
      logger.error('Error aggregating traffic data:', error);
      throw error;
    }
  }

  /**
   * Fetch traffic data from Google Maps API
   */
  async fetchGoogleMapsTraffic(latitude, longitude) {
    try {
      // If no API key, return mock data
      if (!this.googleMapsApiKey) {
        logger.debug('No Google Maps API key, returning mock data');
        return this.getMockGoogleTrafficData(latitude, longitude);
      }

      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json`,
        {
          params: {
            origin: `${latitude},${longitude}`,
            destination: `${latitude + 0.05},${longitude + 0.05}`,
            key: this.googleMapsApiKey,
            departure_time: 'now'
          },
          timeout: 5000
        }
      );

      return this.parseGoogleMapsResponse(response.data);
    } catch (error) {
      logger.warn('Google Maps API error:', error.message);
      return this.getMockGoogleTrafficData(latitude, longitude);
    }
  }

  /**
   * Fetch traffic data from TomTom API
   */
  async fetchTomTomTraffic(latitude, longitude) {
    try {
      // If no API key, return mock data
      if (!this.tomtomApiKey) {
        logger.debug('No TomTom API key, returning mock data');
        return this.getMockTomTomTrafficData(latitude, longitude);
      }

      const response = await axios.get(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/json`,
        {
          params: {
            key: this.tomtomApiKey,
            point: `${latitude},${longitude}`,
            unit: 'KMPH'
          },
          timeout: 5000
        }
      );

      return this.parseTomTomResponse(response.data);
    } catch (error) {
      logger.warn('TomTom API error:', error.message);
      return this.getMockTomTomTrafficData(latitude, longitude);
    }
  }

  /**
   * Fetch data from local traffic sensors
   */
  async fetchLocalSensorData(latitude, longitude, radius) {
    try {
      const response = await axios.get(
        `${this.localSensorEndpoint}/nearby`,
        {
          params: {
            latitude,
            longitude,
            radius
          },
          timeout: 3000
        }
      );

      return this.parseLocalSensorResponse(response.data);
    } catch (error) {
      logger.warn('Local sensor API error:', error.message);
      return this.getMockLocalSensorData(latitude, longitude);
    }
  }

  /**
   * Merge traffic data from multiple sources
   */
  mergeTrafficData(googleData, tomtomData, sensorData) {
    return {
      sources: {
        google: googleData,
        tomtom: tomtomData,
        sensors: sensorData
      },
      aggregated: {
        averageSpeed: this.calculateAverageSpeed(googleData, tomtomData, sensorData),
        congestionLevel: this.determineCongestionLevel(googleData, tomtomData, sensorData),
        incidents: this.mergeIncidents(googleData, tomtomData, sensorData),
        speedLimit: this.determineSpeedLimit(googleData, tomtomData),
        roadConditions: this.mergeRoadConditions(googleData, tomtomData, sensorData),
        confidence: this.calculateDataConfidence(googleData, tomtomData, sensorData)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate average speed from multiple sources
   */
  calculateAverageSpeed(googleData, tomtomData, sensorData) {
    const speeds = [];

    if (googleData?.speed) speeds.push(googleData.speed);
    if (tomtomData?.speed) speeds.push(tomtomData.speed);
    if (sensorData?.averageSpeed) speeds.push(sensorData.averageSpeed);

    if (speeds.length === 0) return 0;
    return Math.round(speeds.reduce((a, b) => a + b) / speeds.length);
  }

  /**
   * Determine congestion level based on speed and traffic density
   */
  determineCongestionLevel(googleData, tomtomData, sensorData) {
    const speedLimit = this.determineSpeedLimit(googleData, tomtomData);
    const avgSpeed = this.calculateAverageSpeed(googleData, tomtomData, sensorData);

    if (avgSpeed === 0) return 'unknown';

    const speedRatio = (avgSpeed / speedLimit) * 100;

    if (speedRatio >= 80) return 'free-flow';
    if (speedRatio >= 50) return 'light';
    if (speedRatio >= 30) return 'moderate';
    if (speedRatio >= 10) return 'heavy';
    return 'severe';
  }

  /**
   * Merge incidents from multiple sources
   */
  mergeIncidents(googleData, tomtomData, sensorData) {
    const incidents = [];
    const seenIncidents = new Set();

    const addIncident = (incident) => {
      const key = `${incident.location}:${incident.type}`;
      if (!seenIncidents.has(key)) {
        incidents.push(incident);
        seenIncidents.add(key);
      }
    };

    if (googleData?.incidents) googleData.incidents.forEach(addIncident);
    if (tomtomData?.incidents) tomtomData.incidents.forEach(addIncident);
    if (sensorData?.incidents) sensorData.incidents.forEach(addIncident);

    return incidents;
  }

  /**
   * Determine speed limit from traffic data
   */
  determineSpeedLimit(googleData, tomtomData) {
    if (googleData?.speedLimit) return googleData.speedLimit;
    if (tomtomData?.speedLimit) return tomtomData.speedLimit;
    return 60; // Default speed limit in km/h
  }

  /**
   * Merge road conditions from multiple sources
   */
  mergeRoadConditions(googleData, tomtomData, sensorData) {
    return {
      visibility: Math.min(
        googleData?.visibility || 1000,
        tomtomData?.visibility || 1000,
        sensorData?.visibility || 1000
      ),
      weatherConditions: [
        googleData?.weather,
        tomtomData?.weather,
        sensorData?.weather
      ].filter(Boolean),
      roadSurface: googleData?.roadSurface || tomtomData?.roadSurface || 'asphalt',
      isWet: (sensorData?.isWet || googleData?.isWet || tomtomData?.isWet) ?? false,
      hasAccidents: !!(googleData?.hasAccidents || tomtomData?.hasAccidents),
      hasConstruction: !!(googleData?.hasConstruction || tomtomData?.hasConstruction)
    };
  }

  /**
   * Calculate confidence score based on number of data sources
   */
  calculateDataConfidence(googleData, tomtomData, sensorData) {
    const sources = [googleData, tomtomData, sensorData].filter(d => d && d.confidence !== undefined);
    if (sources.length === 0) return 0.5;
    return sources.reduce((a, b) => a + b.confidence, 0) / sources.length;
  }

  /**
   * Parse Google Maps response
   */
  parseGoogleMapsResponse(data) {
    if (data.status !== 'OK' || data.routes.length === 0) {
      return { confidence: 0 };
    }

    const route = data.routes[0];
    const leg = route.legs[0];
    const duration = leg.duration.value;
    const distance = leg.distance.value;
    const speed = distance > 0 ? (distance / duration) * 3.6 : 0; // Convert m/s to km/h

    return {
      speed: Math.round(speed),
      duration,
      distance,
      confidence: 0.8,
      source: 'google-maps'
    };
  }

  /**
   * Parse TomTom response
   */
  parseTomTomResponse(data) {
    if (!data.flowSegmentData) {
      return { confidence: 0 };
    }

    const flow = data.flowSegmentData;
    return {
      speed: Math.round(flow.currentSpeed || 0),
      speedLimit: flow.freeFlowSpeed || 60,
      confidence: (flow.confidence || 0.5),
      source: 'tomtom',
      currentTravelTime: flow.currentTravelTime
    };
  }

  /**
   * Parse local sensor response
   */
  parseLocalSensorResponse(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { confidence: 0 };
    }

    const totalSpeed = data.reduce((sum, sensor) => sum + sensor.speed, 0);
    const avgSpeed = totalSpeed / data.length;
    const confidence = Math.min(data.length / 10, 1); // Higher confidence with more sensors

    return {
      averageSpeed: Math.round(avgSpeed),
      sensorCount: data.length,
      confidence,
      source: 'local-sensors',
      sensorData: data
    };
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid(key) {
    const lastUpdate = this.lastUpdate.get(key);
    if (!lastUpdate) return false;
    return Date.now() - lastUpdate < this.cacheTTL;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cacheData.clear();
    this.lastUpdate.clear();
    logger.info('Traffic cache cleared');
  }

  /**
   * Handle promise results
   */
  handlePromiseResult(result) {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    logger.warn('Promise rejected:', result.reason);
    return { confidence: 0 };
  }

  /**
   * Mock data generators for demo purposes
   */
  getMockGoogleTrafficData(latitude, longitude) {
    return {
      speed: Math.floor(Math.random() * 60) + 20,
      speedLimit: 60,
      confidence: 0.85,
      source: 'google-maps-mock',
      incidents: this.generateMockIncidents()
    };
  }

  getMockTomTomTrafficData(latitude, longitude) {
    return {
      speed: Math.floor(Math.random() * 70) + 15,
      speedLimit: 60,
      confidence: 0.8,
      source: 'tomtom-mock',
      weather: Math.random() > 0.7 ? 'rainy' : 'clear'
    };
  }

  getMockLocalSensorData(latitude, longitude) {
    const sensorCount = Math.floor(Math.random() * 8) + 2;
    const sensors = Array.from({ length: sensorCount }, (_, i) => ({
      id: `sensor_${i}`,
      speed: Math.floor(Math.random() * 80) + 10,
      vehicleCount: Math.floor(Math.random() * 50) + 5
    }));

    return {
      averageSpeed: Math.round(sensors.reduce((sum, s) => sum + s.speed, 0) / sensors.length),
      sensorCount,
      confidence: Math.min(sensorCount / 10, 0.95),
      source: 'local-sensors-mock',
      sensorData: sensors,
      isWet: Math.random() > 0.8
    };
  }

  generateMockIncidents() {
    const incidents = [];
    if (Math.random() > 0.7) {
      incidents.push({
        type: 'accident',
        severity: Math.random() > 0.5 ? 'major' : 'minor',
        location: 'Main Street',
        description: 'Vehicle collision blocking lanes'
      });
    }
    if (Math.random() > 0.85) {
      incidents.push({
        type: 'construction',
        severity: 'moderate',
        location: 'Broadway',
        description: 'Road construction ongoing'
      });
    }
    return incidents;
  }

  /**
   * Get traffic data for multiple locations
   */
  async getTrafficDataForRoute(routePoints) {
    try {
      const trafficDataPoints = await Promise.all(
        routePoints.map(point => this.getTrafficData(point.latitude, point.longitude))
      );

      return {
        routePoints: routePoints.map((point, index) => ({
          ...point,
          trafficData: trafficDataPoints[index]
        })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting traffic for route:', error);
      throw error;
    }
  }
}

module.exports = TrafficAggregator;
