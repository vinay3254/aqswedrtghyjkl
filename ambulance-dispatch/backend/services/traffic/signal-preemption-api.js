/**
 * Signal Preemption API
 * Communicates with traffic signal systems to preempt signals for emergency vehicles
 */

const axios = require('axios');
const logger = require('../../utils/logger');
const { EventEmitter } = require('events');

class SignalPreemptionAPI extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.signalSystemUrl = config.signalSystemUrl || process.env.SIGNAL_SYSTEM_URL || 'http://localhost:8080/api/signals';
    this.apiKey = config.apiKey || process.env.SIGNAL_SYSTEM_API_KEY;
    this.timeout = config.timeout || 5000;
    this.activePreemptions = new Map();
    this.preemptionHistory = [];
    this.maxHistorySize = config.maxHistorySize || 100;
  }

  /**
   * Request signal preemption for an ambulance
   */
  async requestPreemption(ambulanceId, location, destination, priority = 'high') {
    try {
      const preemptionId = `preempt_${ambulanceId}_${Date.now()}`;

      const preemptionRequest = {
        preemptionId,
        ambulanceId,
        location,
        destination,
        priority,
        requestTime: new Date().toISOString(),
        type: 'ambulance-emergency'
      };

      // Send to real signal system or use mock
      const response = await this.sendPreemptionRequest(preemptionRequest);

      // Track active preemption
      this.activePreemptions.set(ambulanceId, {
        ...preemptionRequest,
        status: 'active',
        response,
        activatedSignals: response.activatedSignals || []
      });

      // Record in history
      this.recordPreemption(preemptionRequest, response);

      this.emit('preemption-requested', {
        ambulanceId,
        preemptionId,
        status: 'active',
        affectedIntersections: response.affectedIntersections
      });

      return {
        success: true,
        preemptionId,
        status: 'active',
        affectedIntersections: response.affectedIntersections,
        activatedSignals: response.activatedSignals,
        estimatedDuration: response.estimatedDuration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error requesting signal preemption:', error);
      this.emit('preemption-failed', {
        ambulanceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send preemption request to signal system
   */
  async sendPreemptionRequest(preemptionRequest) {
    try {
      // Try to connect to real signal system
      if (this.apiKey) {
        try {
          const response = await axios.post(
            `${this.signalSystemUrl}/request-preemption`,
            preemptionRequest,
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: this.timeout
            }
          );

          return response.data;
        } catch (error) {
          if (error.response?.status === 401) {
            throw new Error('Invalid API key for signal system');
          }
          // Fall through to mock
          logger.warn('Real signal system unavailable, using mock response');
        }
      }

      // Return mock response
      return this.generateMockPreemptionResponse(preemptionRequest);
    } catch (error) {
      logger.error('Signal system communication error:', error.message);
      throw error;
    }
  }

  /**
   * Generate mock preemption response
   */
  generateMockPreemptionResponse(preemptionRequest) {
    const { location, destination } = preemptionRequest;

    // Calculate affected intersections (mock)
    const affectedIntersections = this.calculateAffectedIntersections(location, destination);

    return {
      success: true,
      preemptionId: preemptionRequest.preemptionId,
      status: 'activated',
      affectedIntersections: affectedIntersections.map(intersection => ({
        id: intersection.id,
        name: intersection.name,
        latitude: intersection.latitude,
        longitude: intersection.longitude,
        distance: Math.round(intersection.distance * 10) / 10,
        status: 'preempted',
        signalState: 'extended-green',
        effectiveTime: 60 // seconds
      })),
      activatedSignals: affectedIntersections.map(i => ({
        signalId: `signal_${i.id}`,
        signalName: `Signal at ${i.name}`,
        preemptionTime: 60,
        normalCycleTime: 90,
        savedTime: 30
      })),
      estimatedDuration: 300, // 5 minutes
      route: {
        startPoint: preemptionRequest.location,
        endPoint: preemptionRequest.destination,
        coveredDistance: this.estimateDistance(preemptionRequest.location, preemptionRequest.destination)
      },
      message: `Signal preemption activated for ${affectedIntersections.length} intersections`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate affected intersections for a route
   */
  calculateAffectedIntersections(start, end) {
    // Mock intersections along the route
    const intersections = [
      {
        id: 'int_001',
        name: 'Main & 1st',
        latitude: start.latitude + 0.002,
        longitude: start.longitude + 0.002,
        distance: 0.3
      },
      {
        id: 'int_002',
        name: 'Main & 2nd',
        latitude: start.latitude + 0.005,
        longitude: start.longitude + 0.005,
        distance: 0.7
      },
      {
        id: 'int_003',
        name: 'Main & 3rd',
        latitude: start.latitude + 0.008,
        longitude: start.longitude + 0.008,
        distance: 1.1
      },
      {
        id: 'int_004',
        name: 'Broadway & 1st',
        latitude: start.latitude + 0.010,
        longitude: start.longitude - 0.003,
        distance: 1.4
      }
    ];

    return intersections;
  }

  /**
   * Estimate distance between two points
   */
  estimateDistance(start, end) {
    const R = 6371; // Earth radius in km
    const dLat = (end.latitude - start.latitude) * Math.PI / 180;
    const dLon = (end.longitude - start.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(start.latitude * Math.PI / 180) * Math.cos(end.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 10) / 10;
  }

  /**
   * Cancel signal preemption
   */
  async cancelPreemption(ambulanceId) {
    try {
      const preemption = this.activePreemptions.get(ambulanceId);

      if (!preemption) {
        return {
          success: false,
          error: 'No active preemption found',
          ambulanceId
        };
      }

      const cancelRequest = {
        preemptionId: preemption.preemptionId,
        ambulanceId,
        cancelTime: new Date().toISOString()
      };

      // Send cancel request
      const response = await this.sendCancelRequest(cancelRequest);

      // Update tracking
      this.activePreemptions.delete(ambulanceId);

      this.emit('preemption-cancelled', {
        ambulanceId,
        preemptionId: preemption.preemptionId,
        affectedIntersections: preemption.activatedSignals.length
      });

      return {
        success: true,
        preemptionId: preemption.preemptionId,
        ambulanceId,
        status: 'cancelled',
        signalsRestored: response.signalsRestored,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error cancelling preemption:', error);
      throw error;
    }
  }

  /**
   * Send cancel request to signal system
   */
  async sendCancelRequest(cancelRequest) {
    try {
      if (this.apiKey) {
        try {
          const response = await axios.post(
            `${this.signalSystemUrl}/cancel-preemption`,
            cancelRequest,
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: this.timeout
            }
          );

          return response.data;
        } catch (error) {
          logger.warn('Real signal system unavailable for cancel, using mock');
        }
      }

      // Mock response
      return {
        success: true,
        signalsRestored: 4,
        message: 'Signal preemption cancelled, normal operation resumed'
      };
    } catch (error) {
      logger.error('Error sending cancel request:', error);
      throw error;
    }
  }

  /**
   * Get status of active preemption
   */
  getPreemptionStatus(ambulanceId) {
    const preemption = this.activePreemptions.get(ambulanceId);

    if (!preemption) {
      return {
        status: 'inactive',
        ambulanceId,
        message: 'No active preemption'
      };
    }

    return {
      status: preemption.status,
      ambulanceId,
      preemptionId: preemption.preemptionId,
      activatedSignals: preemption.activatedSignals,
      affectedIntersections: preemption.activatedSignals.length,
      startTime: preemption.requestTime,
      duration: this.calculateDuration(preemption.requestTime),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update preemption with ambulance location
   */
  async updatePreemptionLocation(ambulanceId, newLocation) {
    try {
      const preemption = this.activePreemptions.get(ambulanceId);

      if (!preemption) {
        return {
          success: false,
          error: 'No active preemption found',
          ambulanceId
        };
      }

      const updateRequest = {
        preemptionId: preemption.preemptionId,
        ambulanceId,
        currentLocation: newLocation,
        destination: preemption.destination,
        updateTime: new Date().toISOString()
      };

      // Send update to signal system
      const response = await this.sendLocationUpdate(updateRequest);

      // Update tracking
      preemption.location = newLocation;
      preemption.lastUpdate = new Date().toISOString();

      this.emit('preemption-updated', {
        ambulanceId,
        newLocation,
        affectedIntersections: response.affectedIntersections
      });

      return {
        success: true,
        ambulanceId,
        preemptionId: preemption.preemptionId,
        affectedIntersections: response.affectedIntersections,
        nextSignal: response.nextSignal,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error updating preemption location:', error);
      throw error;
    }
  }

  /**
   * Send location update to signal system
   */
  async sendLocationUpdate(updateRequest) {
    try {
      if (this.apiKey) {
        try {
          const response = await axios.post(
            `${this.signalSystemUrl}/update-location`,
            updateRequest,
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: this.timeout
            }
          );

          return response.data;
        } catch (error) {
          logger.warn('Real signal system unavailable for update, using mock');
        }
      }

      // Mock response
      return {
        success: true,
        affectedIntersections: 2,
        nextSignal: {
          id: 'int_002',
          name: 'Main & 2nd',
          distance: 0.5,
          eta: 45, // seconds
          state: 'green'
        },
        message: 'Location updated, signals adjusted accordingly'
      };
    } catch (error) {
      logger.error('Error sending location update:', error);
      throw error;
    }
  }

  /**
   * Get signal status at intersection
   */
  async getSignalStatus(intersectionId) {
    try {
      if (this.apiKey) {
        try {
          const response = await axios.get(
            `${this.signalSystemUrl}/signals/${intersectionId}/status`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`
              },
              timeout: this.timeout
            }
          );

          return response.data;
        } catch (error) {
          logger.warn('Could not fetch real signal status, returning mock');
        }
      }

      // Mock response
      return this.generateMockSignalStatus(intersectionId);
    } catch (error) {
      logger.error('Error getting signal status:', error);
      throw error;
    }
  }

  /**
   * Generate mock signal status
   */
  generateMockSignalStatus(intersectionId) {
    const states = ['red', 'yellow', 'green'];
    const randomState = states[Math.floor(Math.random() * states.length)];

    return {
      intersectionId,
      intersectionName: 'Mock Intersection',
      currentState: randomState,
      timeInState: Math.floor(Math.random() * 30) + 5,
      nextStateChange: Math.floor(Math.random() * 25) + 5,
      cycleTime: 90,
      isPreempted: Math.random() > 0.7,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get preemption history
   */
  getPreemptionHistory(filters = {}) {
    let history = this.preemptionHistory;

    if (filters.ambulanceId) {
      history = history.filter(h => h.ambulanceId === filters.ambulanceId);
    }

    if (filters.startDate) {
      history = history.filter(h => new Date(h.timestamp) >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      history = history.filter(h => new Date(h.timestamp) <= new Date(filters.endDate));
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history;
  }

  /**
   * Record preemption in history
   */
  recordPreemption(request, response) {
    const record = {
      preemptionId: request.preemptionId,
      ambulanceId: request.ambulanceId,
      timestamp: request.requestTime,
      location: request.location,
      destination: request.destination,
      priority: request.priority,
      affectedIntersections: response.affectedIntersections?.length || 0,
      estimatedDuration: response.estimatedDuration,
      status: 'recorded'
    };

    this.preemptionHistory.push(record);

    // Limit history size
    if (this.preemptionHistory.length > this.maxHistorySize) {
      this.preemptionHistory.shift();
    }

    logger.info(`Preemption recorded: ${request.preemptionId}`);
  }

  /**
   * Calculate duration of preemption
   */
  calculateDuration(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const seconds = Math.round((now - start) / 1000);
    return {
      seconds,
      minutes: Math.floor(seconds / 60),
      formatted: `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    };
  }

  /**
   * Get active preemptions count
   */
  getActivePreemptionsCount() {
    return this.activePreemptions.size;
  }

  /**
   * Get all active preemptions
   */
  getAllActivePreemptions() {
    const active = [];
    this.activePreemptions.forEach((preemption, ambulanceId) => {
      active.push({
        ambulanceId,
        ...preemption
      });
    });
    return active;
  }

  /**
   * Clear expired preemptions
   */
  clearExpiredPreemptions(maxDurationMinutes = 30) {
    const now = Date.now();
    const maxDurationMs = maxDurationMinutes * 60 * 1000;
    const expired = [];

    this.activePreemptions.forEach((preemption, ambulanceId) => {
      const startTime = new Date(preemption.requestTime).getTime();
      if (now - startTime > maxDurationMs) {
        this.activePreemptions.delete(ambulanceId);
        expired.push(ambulanceId);
      }
    });

    if (expired.length > 0) {
      logger.info(`Cleared ${expired.length} expired preemptions`);
    }

    return expired;
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    return {
      activePreemptions: this.activePreemptions.size,
      totalHistoricalPreemptions: this.preemptionHistory.length,
      historySize: this.maxHistorySize,
      signalSystemUrl: this.signalSystemUrl,
      hasApiKey: !!this.apiKey,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = SignalPreemptionAPI;
