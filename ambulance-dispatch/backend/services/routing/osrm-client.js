const axios = require('axios');
const logger = require('../../api/middleware/logger');

class OSRMClient {
  constructor(baseURL = process.env.OSRM_URL || 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Calculate route between two or more points
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   * @param {Object} options - Routing options
   * @returns {Object} Route information
   */
  async getRoute(coordinates, options = {}) {
    try {
      const {
        alternatives = false,
        steps = false,
        geometries = 'geojson',
        overview = 'full',
        continue_straight = false
      } = options;

      // Format coordinates as lng,lat;lng,lat
      const coordString = coordinates
        .map(coord => `${coord[0]},${coord[1]}`)
        .join(';');

      const params = {
        alternatives: alternatives ? 'true' : 'false',
        steps: steps ? 'true' : 'false',
        geometries,
        overview,
        continue_straight: continue_straight ? 'true' : 'false'
      };

      const url = `/route/v1/driving/${coordString}`;
      const response = await this.client.get(url, { params });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM Error: ${response.data.code} - ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      logger.error('OSRM route calculation failed', {
        error: error.message,
        coordinates,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get travel time table between multiple points
   * @param {Array} sources - Array of [lng, lat] source coordinates
   * @param {Array} destinations - Array of [lng, lat] destination coordinates
   * @returns {Object} Duration and distance tables
   */
  async getTable(sources, destinations = null) {
    try {
      const allCoords = destinations 
        ? [...sources, ...destinations]
        : sources;

      const coordString = allCoords
        .map(coord => `${coord[0]},${coord[1]}`)
        .join(';');

      const params = {};
      
      if (destinations) {
        params.sources = sources.map((_, i) => i).join(';');
        params.destinations = destinations
          .map((_, i) => i + sources.length)
          .join(';');
      }

      const url = `/table/v1/driving/${coordString}`;
      const response = await this.client.get(url, { params });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM Error: ${response.data.code}`);
      }

      return response.data;
    } catch (error) {
      logger.error('OSRM table calculation failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Match coordinates to nearest road
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   * @returns {Object} Matched route
   */
  async match(coordinates) {
    try {
      const coordString = coordinates
        .map(coord => `${coord[0]},${coord[1]}`)
        .join(';');

      const url = `/match/v1/driving/${coordString}`;
      const response = await this.client.get(url, {
        params: {
          geometries: 'geojson',
          overview: 'full'
        }
      });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM Error: ${response.data.code}`);
      }

      return response.data;
    } catch (error) {
      logger.error('OSRM match failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get nearest road point for a coordinate
   * @param {Array} coordinates - Array of [lng, lat] coordinates to snap
   * @param {Number} number - Number of nearest points to return
   * @returns {Object} Nearest points
   */
  async nearest(coordinates, number = 1) {
    try {
      const coordString = coordinates
        .map(coord => `${coord[0]},${coord[1]}`)
        .join(';');

      const url = `/nearest/v1/driving/${coordString}`;
      const response = await this.client.get(url, {
        params: { number }
      });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM Error: ${response.data.code}`);
      }

      return response.data;
    } catch (error) {
      logger.error('OSRM nearest failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if OSRM service is available
   * @returns {Boolean} Service availability
   */
  async isAvailable() {
    try {
      // Simple route query to check if service is up
      const testCoords = [[77.2090, 28.6139], [77.1025, 28.7041]]; // Delhi coordinates
      const coordString = testCoords
        .map(coord => `${coord[0]},${coord[1]}`)
        .join(';');

      const response = await this.client.get(
        `/route/v1/driving/${coordString}`,
        { timeout: 3000 }
      );

      return response.data.code === 'Ok';
    } catch (error) {
      logger.warn('OSRM service unavailable', { error: error.message });
      return false;
    }
  }
}

module.exports = OSRMClient;
