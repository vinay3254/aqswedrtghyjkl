/**
 * Location Resolver Service
 * Resolves user location from multiple sources:
 * 1. Cell tower triangulation (primary)
 * 2. GPS data (if available)
 * 3. Manual input (fallback)
 * 4. Network operator data
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class LocationResolver {
  constructor(config = {}) {
    this.config = {
      cellTowerApi: config.cellTowerApi || 'https://api.cellinfo.io',
      cellTowerKey: config.cellTowerKey || process.env.CELL_TOWER_API_KEY,
      googleMapsApi: config.googleMapsApi || 'https://maps.googleapis.com/maps/api',
      googleMapsKey: config.googleMapsKey || process.env.GOOGLE_MAPS_API_KEY,
      openCageApi: config.openCageApi || 'https://api.opencagedata.com',
      openCageKey: config.openCageKey || process.env.OPENCAGE_API_KEY,
      cacheLocationTTL: config.cacheLocationTTL || 3600000, // 1 hour
      // Network operator codes to location mappings
      operatorLocations: config.operatorLocations || {
        '63902': { carrier: 'Safaricom', region: 'Kenya' },
        '63907': { carrier: 'Airtel', region: 'Kenya' },
        '63904': { carrier: 'Idea', region: 'Kenya' },
      },
      ...config,
    };

    // Simple location cache
    this.locationCache = new Map();
  }

  /**
   * Resolve location from all available sources
   * Attempts in order: cell tower -> GPS -> network -> manual
   */
  async resolveLocation(phoneNumber, networkCode, additionalData = {}) {
    try {
      // Check cache first
      const cacheKey = `${phoneNumber}:${networkCode}`;
      const cached = this.locationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheLocationTTL) {
        logger.info('Location resolved from cache', { phoneNumber });
        return cached.location;
      }

      let location = null;

      // Try cell tower triangulation (primary method for rural areas)
      try {
        location = await this.resolveCellTowerLocation(networkCode, additionalData.cellId);
        if (location) {
          this.cacheLocation(cacheKey, location);
          return location;
        }
      } catch (error) {
        logger.warn('Cell tower location resolution failed:', error.message);
      }

      // Try GPS data if available
      if (additionalData.latitude && additionalData.longitude) {
        try {
          location = await this.resolveGPSLocation(
            additionalData.latitude,
            additionalData.longitude
          );
          if (location) {
            this.cacheLocation(cacheKey, location);
            return location;
          }
        } catch (error) {
          logger.warn('GPS location resolution failed:', error.message);
        }
      }

      // Try network operator data
      try {
        location = await this.resolveNetworkOperatorLocation(networkCode);
        if (location) {
          this.cacheLocation(cacheKey, location);
          return location;
        }
      } catch (error) {
        logger.warn('Network operator location resolution failed:', error.message);
      }

      logger.warn('Unable to resolve location for phone:', { phoneNumber });
      return null;
    } catch (error) {
      logger.error('Location resolution error:', error);
      return null;
    }
  }

  /**
   * Resolve location from cell tower data
   * Uses cell tower triangulation for location estimation
   */
  async resolveCellTowerLocation(networkCode, cellId) {
    try {
      if (!networkCode && !cellId) {
        return null;
      }

      // Construct request to cell tower API
      const params = {
        mcc: this.extractMCC(networkCode),
        mnc: this.extractMNC(networkCode),
      };

      if (cellId) {
        params.cellId = cellId;
      }

      // Add API key if configured
      if (this.config.cellTowerKey) {
        params.key = this.config.cellTowerKey;
      }

      const response = await axios.get(
        `${this.config.cellTowerApi}/location/cell`,
        { params, timeout: 5000 }
      );

      if (response.data && response.data.location) {
        const { lat, lng, accuracy } = response.data.location;

        // Ensure accuracy is reasonable (within ~5km for rural areas)
        if (accuracy && accuracy < 5000) {
          return {
            latitude: lat,
            longitude: lng,
            accuracy: accuracy,
            method: 'cell-tower',
            provider: 'cell-info',
            timestamp: new Date(),
            area: await this.reverseGeocode(lat, lng),
          };
        }
      }

      return null;
    } catch (error) {
      logger.warn('Cell tower location resolution failed:', error.message);
      return null;
    }
  }

  /**
   * Resolve location from GPS coordinates
   * Uses reverse geocoding to get address information
   */
  async resolveGPSLocation(latitude, longitude) {
    try {
      if (!latitude || !longitude) {
        return null;
      }

      // Validate GPS coordinates
      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return null;
      }

      const area = await this.reverseGeocode(latitude, longitude);

      return {
        latitude,
        longitude,
        accuracy: 10, // Meters
        method: 'gps',
        provider: 'gps-device',
        timestamp: new Date(),
        area,
      };
    } catch (error) {
      logger.warn('GPS location resolution failed:', error.message);
      return null;
    }
  }

  /**
   * Resolve location from network operator data
   * Basic network-level location based on operator and region
   */
  async resolveNetworkOperatorLocation(networkCode) {
    try {
      if (!networkCode) {
        return null;
      }

      const operatorData = this.config.operatorLocations[networkCode];
      if (!operatorData) {
        return null;
      }

      // This returns only approximate region data
      return {
        carrier: operatorData.carrier,
        region: operatorData.region,
        method: 'network-operator',
        provider: 'network-data',
        timestamp: new Date(),
        accuracy: 50000, // ~50km accuracy
        area: operatorData.region,
      };
    } catch (error) {
      logger.warn('Network operator location resolution failed:', error.message);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to get address information
   * Attempts multiple providers for redundancy
   */
  async reverseGeocode(latitude, longitude) {
    try {
      // Try OpenCage first (good coverage in Africa)
      if (this.config.openCageKey) {
        try {
          return await this.reverseGeocodeOpenCage(latitude, longitude);
        } catch (error) {
          logger.warn('OpenCage reverse geocoding failed:', error.message);
        }
      }

      // Fallback to Google Maps
      if (this.config.googleMapsKey) {
        try {
          return await this.reverseGeocodeGoogle(latitude, longitude);
        } catch (error) {
          logger.warn('Google Maps reverse geocoding failed:', error.message);
        }
      }

      // Fallback: return coordinates as string
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch (error) {
      logger.warn('Reverse geocoding failed:', error.message);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  }

  /**
   * Reverse geocode using OpenCage Data API
   * Good coverage in Africa with multiple languages
   */
  async reverseGeocodeOpenCage(latitude, longitude) {
    const response = await axios.get(`${this.config.openCageApi}/geocode/v1/reverse`, {
      params: {
        q: `${latitude},${longitude}`,
        key: this.config.openCageKey,
        language: 'en',
        limit: 1,
      },
      timeout: 5000,
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      const components = result.components || {};

      // Build address from components
      const address =
        components.road ||
        components.suburb ||
        components.neighbourhood ||
        components.village ||
        components.town ||
        components.city ||
        result.formatted;

      return address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }

  /**
   * Reverse geocode using Google Maps API
   */
  async reverseGeocodeGoogle(latitude, longitude) {
    const response = await axios.get(
      `${this.config.googleMapsApi}/geocode/json`,
      {
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.config.googleMapsKey,
          language: 'en',
        },
        timeout: 5000,
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      const address = response.data.results[0].formatted_address;
      return address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }

  /**
   * Extract MCC (Mobile Country Code) from network code
   */
  extractMCC(networkCode) {
    // Network code format: MCC+MNC (e.g., "63902" = MCC 639, MNC 02)
    if (!networkCode || networkCode.length < 5) {
      return null;
    }
    return networkCode.substring(0, 3);
  }

  /**
   * Extract MNC (Mobile Network Code) from network code
   */
  extractMNC(networkCode) {
    if (!networkCode || networkCode.length < 5) {
      return null;
    }
    return networkCode.substring(3);
  }

  /**
   * Cache location data with TTL
   */
  cacheLocation(key, location) {
    this.locationCache.set(key, {
      location,
      timestamp: Date.now(),
    });

    // Auto-expire cache entry
    setTimeout(() => {
      this.locationCache.delete(key);
    }, this.config.cacheLocationTTL);
  }

  /**
   * Validate location data quality
   */
  validateLocation(location) {
    if (!location) {
      return { valid: false, error: 'Location is null' };
    }

    // Check required fields based on method
    if (location.method === 'gps' || location.method === 'cell-tower') {
      if (!location.latitude || !location.longitude) {
        return {
          valid: false,
          error: 'Missing latitude or longitude',
        };
      }

      if (
        location.latitude < -90 ||
        location.latitude > 90 ||
        location.longitude < -180 ||
        location.longitude > 180
      ) {
        return {
          valid: false,
          error: 'Invalid coordinate values',
        };
      }

      // Check accuracy
      if (location.accuracy && location.accuracy > 10000) {
        return {
          valid: true,
          warning: 'Low accuracy location',
          confidence: 'low',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get location quality metrics
   */
  getLocationQuality(location) {
    if (!location) {
      return { quality: 0, reason: 'No location data' };
    }

    let quality = 100;
    let details = [];

    // Accuracy penalty
    if (location.accuracy) {
      if (location.accuracy > 10000) {
        quality -= 50;
        details.push('Low accuracy (>10km)');
      } else if (location.accuracy > 1000) {
        quality -= 25;
        details.push('Medium accuracy (1-10km)');
      }
    } else {
      quality -= 30;
      details.push('Unknown accuracy');
    }

    // Method quality
    const methodQuality = {
      'gps': 100,
      'cell-tower': 75,
      'network-operator': 40,
      'manual': 30,
    };

    quality = Math.min(quality, methodQuality[location.method] || 0);

    return {
      quality: Math.max(0, quality),
      method: location.method,
      accuracy: location.accuracy,
      details,
      recommendation:
        quality >= 75
          ? 'Use for dispatch'
          : quality >= 50
            ? 'Use with caution'
            : 'Request confirmation',
    };
  }

  /**
   * Clear location cache
   */
  clearCache() {
    this.locationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedLocations: this.locationCache.size,
      entries: Array.from(this.locationCache.entries()).map(([key, value]) => ({
        key,
        timestamp: value.timestamp,
        method: value.location.method,
      })),
    };
  }
}

module.exports = LocationResolver;
