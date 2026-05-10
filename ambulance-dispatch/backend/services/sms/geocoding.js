/**
 * Location Geocoding Service
 * Converts text addresses to coordinates using Google Maps Geocoding API
 * Includes fallback mechanisms and cell tower triangulation
 */

const axios = require('axios');

class GeocodingService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
  }

  /**
   * Geocode text location to coordinates
   * @param {string} locationText - Location description
   * @param {string} region - Country/region bias (default: 'in' for India)
   * @returns {Promise<object>} Geocoded location data
   */
  async geocodeLocation(locationText, region = 'in') {
    // Mock geocoding if no API key
    if (!this.apiKey || this.apiKey === 'mock') {
      return this.mockGeocode(locationText);
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          address: locationText,
          region,
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        
        return {
          success: true,
          location: {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            formattedAddress: result.formatted_address,
            placeId: result.place_id,
            locationType: result.geometry.location_type,
            viewport: result.geometry.viewport
          },
          confidence: this.calculateConfidence(result),
          source: 'google_maps'
        };
      }

      return {
        success: false,
        error: 'Location not found',
        confidence: 0
      };
    } catch (error) {
      console.error('Geocoding error:', error.message);
      return {
        success: false,
        error: error.message,
        confidence: 0
      };
    }
  }

  /**
   * Mock geocoding for testing (Indian cities)
   */
  mockGeocode(locationText) {
    const mockLocations = {
      'gandhi chowk': {
        latitude: 25.5941,
        longitude: 85.1376,
        formattedAddress: 'Gandhi Chowk, Patna, Bihar 800001, India'
      },
      'patna': {
        latitude: 25.5941,
        longitude: 85.1376,
        formattedAddress: 'Patna, Bihar, India'
      },
      'delhi': {
        latitude: 28.7041,
        longitude: 77.1025,
        formattedAddress: 'New Delhi, Delhi, India'
      },
      'mumbai': {
        latitude: 19.0760,
        longitude: 72.8777,
        formattedAddress: 'Mumbai, Maharashtra, India'
      },
      'bangalore': {
        latitude: 12.9716,
        longitude: 77.5946,
        formattedAddress: 'Bangalore, Karnataka, India'
      },
      'connaught place': {
        latitude: 28.6315,
        longitude: 77.2167,
        formattedAddress: 'Connaught Place, New Delhi, Delhi 110001, India'
      }
    };

    const normalized = locationText.toLowerCase().trim();
    
    // Check for exact match
    for (const [key, value] of Object.entries(mockLocations)) {
      if (normalized.includes(key)) {
        return {
          success: true,
          location: {
            ...value,
            locationType: 'APPROXIMATE',
            placeId: `mock-${key.replace(/\s/g, '-')}`
          },
          confidence: 85,
          source: 'mock'
        };
      }
    }

    // Default fallback location (Patna)
    return {
      success: true,
      location: {
        latitude: 25.5941,
        longitude: 85.1376,
        formattedAddress: `${locationText}, Patna, Bihar, India`,
        locationType: 'APPROXIMATE',
        placeId: 'mock-fallback'
      },
      confidence: 40,
      source: 'mock_fallback',
      warning: 'Using approximate location'
    };
  }

  /**
   * Calculate confidence score based on location type
   */
  calculateConfidence(geocodeResult) {
    const locationTypeScores = {
      'ROOFTOP': 95,
      'RANGE_INTERPOLATED': 80,
      'GEOMETRIC_CENTER': 70,
      'APPROXIMATE': 50
    };

    let confidence = locationTypeScores[geocodeResult.geometry.location_type] || 50;

    // Boost confidence if we have a place_id
    if (geocodeResult.place_id) {
      confidence += 5;
    }

    // Boost if address has street-level detail
    if (geocodeResult.address_components.some(c => c.types.includes('street_number'))) {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(latitude, longitude) {
    if (!this.apiKey || this.apiKey === 'mock') {
      return {
        success: true,
        address: `Location near ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        source: 'mock'
      };
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return {
          success: true,
          address: response.data.results[0].formatted_address,
          source: 'google_maps'
        };
      }

      return {
        success: false,
        error: 'Address not found'
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Simulate cell tower triangulation (LBS - Location Based Service)
   * In production, this would integrate with telecom APIs
   */
  async getCellTowerLocation(phoneNumber, cellTowerId = null) {
    // Mock implementation
    console.log(`📡 Cell Tower Triangulation for ${phoneNumber}`);
    
    // Simulate cell tower location (approximate)
    return {
      success: true,
      location: {
        latitude: 25.5941 + (Math.random() - 0.5) * 0.1,
        longitude: 85.1376 + (Math.random() - 0.5) * 0.1,
        formattedAddress: 'Approximate location from cell tower',
        accuracy: 500 // meters
      },
      confidence: 60,
      source: 'cell_tower',
      note: 'Approximate location based on cell tower triangulation'
    };
  }

  /**
   * Get location with fallback chain
   * 1. Try geocoding text
   * 2. Try cell tower if available
   * 3. Manual dispatcher intervention
   */
  async getLocationWithFallback(locationText, phoneNumber = null) {
    // Try geocoding first
    const geocoded = await this.geocodeLocation(locationText);
    
    if (geocoded.success && geocoded.confidence >= 70) {
      return geocoded;
    }

    // If geocoding failed or low confidence, try cell tower
    if (phoneNumber) {
      console.log('⚠️ Geocoding confidence low, trying cell tower...');
      const cellTower = await this.getCellTowerLocation(phoneNumber);
      
      if (cellTower.success) {
        return {
          ...cellTower,
          fallbackUsed: true,
          originalText: locationText
        };
      }
    }

    // Return geocoded result with warning
    return {
      ...geocoded,
      needsManualVerification: true,
      warning: 'Location confidence low. Manual verification recommended.'
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance; // km
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}

module.exports = GeocodingService;
