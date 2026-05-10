const OSRMClient = require('./osrm-client');
const RouteCache = require('./cache');
const TrafficService = require('./traffic');
const fallback = require('./fallback');
const logger = require('../../api/middleware/logger');

class RoutingService {
  constructor() {
    this.osrmClient = new OSRMClient();
    this.cache = new RouteCache();
    this.trafficService = new TrafficService();
    this.osrmAvailable = true;
    this.checkOSRMAvailability();
  }

  /**
   * Periodically check OSRM availability
   */
  async checkOSRMAvailability() {
    setInterval(async () => {
      this.osrmAvailable = await this.osrmClient.isAvailable();
      if (!this.osrmAvailable) {
        logger.warn('OSRM service is unavailable, using fallback calculations');
      }
    }, 60000); // Check every minute
  }

  /**
   * Calculate route between two or more points
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   * @param {Object} options - Routing options
   * @returns {Object} Route information
   */
  async calculateRoute(coordinates, options = {}) {
    try {
      const {
        alternatives = false,
        useCache = true,
        trafficMultiplier = null,
        simplify = false
      } = options;

      // Validate coordinates
      if (!coordinates || coordinates.length < 2) {
        throw new Error('At least 2 coordinates required');
      }

      // Check cache if enabled
      if (useCache) {
        const cacheKey = this.cache.generateKey(coordinates, { alternatives });
        const cached = await this.cache.get(cacheKey);
        
        if (cached) {
          // Apply current traffic if not specified
          if (trafficMultiplier === null) {
            const traffic = this.trafficService.getCurrentMultiplier();
            cached.routes = cached.routes.map(route => ({
              ...route,
              duration: this.trafficService.applyTraffic(route.baselineDuration || route.duration, traffic),
              trafficMultiplier: traffic
            }));
          }
          
          return { ...cached, cached: true };
        }
      }

      let routeData;

      // Try OSRM if available
      if (this.osrmAvailable) {
        try {
          routeData = await this.osrmClient.getRoute(coordinates, {
            alternatives,
            steps: true,
            geometries: 'geojson',
            overview: 'full'
          });

          // Store baseline duration
          routeData.routes = routeData.routes.map(route => ({
            ...route,
            baselineDuration: route.duration
          }));

        } catch (error) {
          logger.error('OSRM route failed, using fallback', { error: error.message });
          this.osrmAvailable = false;
          routeData = null;
        }
      }

      // Use fallback if OSRM unavailable
      if (!routeData) {
        const traffic = trafficMultiplier !== null ? trafficMultiplier : this.trafficService.getCurrentMultiplier();
        routeData = fallback.calculateFallbackRoute(coordinates, { trafficMultiplier: traffic });
        routeData.routes = routeData.routes.map(route => ({
          ...route,
          baselineDuration: route.duration / traffic
        }));
      }

      // Apply traffic multiplier
      const traffic = trafficMultiplier !== null ? trafficMultiplier : this.trafficService.getCurrentMultiplier();
      routeData.routes = routeData.routes.map(route => ({
        ...route,
        duration: this.trafficService.applyTraffic(route.baselineDuration, traffic),
        trafficMultiplier: traffic
      }));

      // Simplify geometry if requested
      if (simplify && routeData.routes[0]) {
        routeData.routes = routeData.routes.map(route => ({
          ...route,
          geometry: this.simplifyGeometry(route.geometry)
        }));
      }

      // Cache result
      if (useCache) {
        const cacheKey = this.cache.generateKey(coordinates, { alternatives });
        await this.cache.set(cacheKey, routeData);
      }

      return routeData;

    } catch (error) {
      logger.error('Route calculation failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Calculate ETA with traffic consideration
   * @param {Array} origin - [lng, lat]
   * @param {Array} destination - [lng, lat]
   * @param {Object} options - Options
   * @returns {Object} ETA information
   */
  async calculateETA(origin, destination, options = {}) {
    try {
      const { trafficMultiplier = null, datetime = new Date() } = options;

      const routeData = await this.calculateRoute([origin, destination], {
        useCache: true,
        trafficMultiplier
      });

      const route = routeData.routes[0];
      
      // Get traffic if not specified
      const traffic = trafficMultiplier !== null 
        ? trafficMultiplier 
        : (await this.trafficService.getRouteTraffic(origin, destination, datetime)).multiplier;

      const durationSeconds = route.duration;
      const eta = new Date(datetime.getTime() + durationSeconds * 1000);

      return {
        distance: route.distance,
        duration: durationSeconds,
        durationMinutes: Math.round(durationSeconds / 60),
        eta: eta.toISOString(),
        trafficMultiplier: traffic,
        trafficLevel: this.trafficService.getTrafficLevel(traffic),
        fallback: routeData.fallback || false
      };

    } catch (error) {
      logger.error('ETA calculation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get alternative routes
   * @param {Array} origin - [lng, lat]
   * @param {Array} destination - [lng, lat]
   * @param {Number} maxAlternatives - Maximum number of alternatives
   * @returns {Object} Routes with alternatives
   */
  async getAlternativeRoutes(origin, destination, maxAlternatives = 3) {
    try {
      const routeData = await this.calculateRoute([origin, destination], {
        alternatives: true,
        useCache: true
      });

      const routes = routeData.routes.slice(0, maxAlternatives).map((route, index) => ({
        routeIndex: index,
        distance: route.distance,
        duration: route.duration,
        durationMinutes: Math.round(route.duration / 60),
        trafficMultiplier: route.trafficMultiplier,
        geometry: route.geometry,
        primary: index === 0
      }));

      return {
        routes,
        origin,
        destination,
        fallback: routeData.fallback || false
      };

    } catch (error) {
      logger.error('Alternative routes failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate distance only (no route geometry)
   * @param {Array} origin - [lng, lat]
   * @param {Array} destination - [lng, lat]
   * @returns {Object} Distance information
   */
  async calculateDistance(origin, destination) {
    try {
      // Check cache first
      const cacheKey = this.cache.generateKey([origin, destination], { distanceOnly: true });
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return { ...cached, cached: true };
      }

      // Use OSRM table service for faster distance-only calculation
      let distance, duration;

      if (this.osrmAvailable) {
        try {
          const tableData = await this.osrmClient.getTable([origin], [destination]);
          duration = tableData.durations[0][0];
          distance = tableData.distances ? tableData.distances[0][0] : null;

          // If distance not available, calculate from route
          if (!distance) {
            const routeData = await this.calculateRoute([origin, destination], { useCache: false });
            distance = routeData.routes[0].distance;
          }

        } catch (error) {
          logger.error('OSRM table failed, using fallback', { error: error.message });
          this.osrmAvailable = false;
        }
      }

      // Fallback calculation
      if (!distance) {
        const fallbackData = fallback.calculateFallbackETA(origin, destination);
        distance = fallbackData.distance;
        duration = fallbackData.duration;
      }

      const result = {
        distance,
        distanceKm: Math.round(distance / 10) / 100,
        duration,
        durationMinutes: Math.round(duration / 60)
      };

      // Cache result
      await this.cache.set(cacheKey, result);

      return result;

    } catch (error) {
      logger.error('Distance calculation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Batch routing requests
   * @param {Array} requests - Array of {origin, destination} objects
   * @returns {Array} Route results
   */
  async batchCalculate(requests) {
    try {
      const results = await Promise.allSettled(
        requests.map(req => 
          this.calculateRoute([req.origin, req.destination], {
            useCache: true,
            simplify: true
          })
        )
      );

      return results.map((result, index) => ({
        index,
        request: requests[index],
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
      }));

    } catch (error) {
      logger.error('Batch calculation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate full route: Ambulance -> Incident -> Hospital
   * @param {Array} ambulanceLocation - [lng, lat]
   * @param {Array} incidentLocation - [lng, lat]
   * @param {Array} hospitalLocation - [lng, lat]
   * @returns {Object} Complete route information
   */
  async calculateFullRoute(ambulanceLocation, incidentLocation, hospitalLocation) {
    try {
      const [leg1, leg2, total] = await Promise.all([
        this.calculateRoute([ambulanceLocation, incidentLocation]),
        this.calculateRoute([incidentLocation, hospitalLocation]),
        this.calculateRoute([ambulanceLocation, incidentLocation, hospitalLocation])
      ]);

      return {
        legs: [
          {
            name: 'Ambulance to Incident',
            distance: leg1.routes[0].distance,
            duration: leg1.routes[0].duration,
            durationMinutes: Math.round(leg1.routes[0].duration / 60),
            geometry: leg1.routes[0].geometry
          },
          {
            name: 'Incident to Hospital',
            distance: leg2.routes[0].distance,
            duration: leg2.routes[0].duration,
            durationMinutes: Math.round(leg2.routes[0].duration / 60),
            geometry: leg2.routes[0].geometry
          }
        ],
        total: {
          distance: total.routes[0].distance,
          duration: total.routes[0].duration,
          durationMinutes: Math.round(total.routes[0].duration / 60),
          geometry: total.routes[0].geometry,
          trafficMultiplier: total.routes[0].trafficMultiplier
        }
      };

    } catch (error) {
      logger.error('Full route calculation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Simplify route geometry for mobile apps
   * @param {Object} geometry - GeoJSON LineString
   * @param {Number} tolerance - Simplification tolerance
   * @returns {Object} Simplified geometry
   */
  simplifyGeometry(geometry, tolerance = 0.0001) {
    if (!geometry || !geometry.coordinates) return geometry;

    // Simple Douglas-Peucker-like simplification
    const coords = geometry.coordinates;
    if (coords.length <= 2) return geometry;

    const simplified = [coords[0]];
    
    // Keep every Nth point based on total length
    const keepEvery = Math.max(1, Math.floor(coords.length / 100));
    
    for (let i = keepEvery; i < coords.length - 1; i += keepEvery) {
      simplified.push(coords[i]);
    }
    
    simplified.push(coords[coords.length - 1]);

    return {
      ...geometry,
      coordinates: simplified
    };
  }

  /**
   * Get service health status
   * @returns {Object} Health information
   */
  async getHealthStatus() {
    const osrmAvailable = await this.osrmClient.isAvailable();
    const cacheStats = await this.cache.getStats();

    return {
      osrm: {
        available: osrmAvailable,
        url: this.osrmClient.baseURL
      },
      cache: {
        available: cacheStats !== null,
        stats: cacheStats
      },
      traffic: {
        currentMultiplier: this.trafficService.getCurrentMultiplier(),
        source: 'mock'
      }
    };
  }
}

module.exports = RoutingService;
