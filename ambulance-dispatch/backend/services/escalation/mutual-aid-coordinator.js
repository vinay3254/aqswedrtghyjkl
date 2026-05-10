/**
 * Mutual Aid Coordinator
 * Manages requests for ambulances from neighboring districts
 */

const EventEmitter = require('events');

class MutualAidCoordinator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      requestTimeout: config.requestTimeout || 30000, // 30 seconds
      maxRetries: config.maxRetries || 3,
      responseWaitTime: config.responseWaitTime || 60000, // 1 minute
      districtRegistry: config.districtRegistry || new Map(),
      ...config,
    };

    this.activeRequests = new Map();
    this.requestHistory = [];
    this.districtResponses = new Map();
  }

  /**
   * Request ambulances from neighboring districts
   * @param {Object} requestData - Request details
   * @returns {Promise<Object>} Request confirmation
   */
  async requestMutualAid(requestData) {
    const {
      incidentId,
      location,
      requiredUnits = 1,
      patientCount = 0,
      severity = 'MODERATE',
      neighboringDistricts = [],
      reason = '',
    } = requestData;

    if (!incidentId || !location) {
      throw new Error('Missing required fields: incidentId, location');
    }

    const requestId = `MR-${incidentId}-${Date.now()}`;

    try {
      // Create request record
      const request = {
        requestId,
        incidentId,
        location,
        requiredUnits,
        patientCount,
        severity,
        reason,
        createdAt: new Date(),
        status: 'PENDING',
        sentTo: [],
        responses: [],
        confirmedUnits: 0,
      };

      this.activeRequests.set(requestId, request);

      // Send to all neighboring districts
      const districts = neighboringDistricts.length > 0
        ? neighboringDistricts
        : this.getNeighboringDistricts(location);

      if (districts.length === 0) {
        throw new Error('No neighboring districts available');
      }

      // Send requests asynchronously
      const sendPromises = districts.map((district) =>
        this.sendRequestToDistrict(requestId, request, district)
      );

      await Promise.allSettled(sendPromises);

      request.sentTo = districts;
      request.status = 'SENT';

      // Emit event
      this.emit('mutual-aid-requested', {
        requestId,
        incidentId,
        districtsContacted: districts.length,
      });

      return {
        success: true,
        requestId,
        districtsContacted: districts.length,
        expectedResponseTime: this.config.responseWaitTime,
      };
    } catch (error) {
      this.emit('mutual-aid-error', {
        requestId,
        incidentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send request to specific district
   * @private
   */
  async sendRequestToDistrict(requestId, request, district) {
    try {
      // Simulate API call to district dispatch center
      const response = await this.callDistrictDispatcher(district, request);

      const record = {
        districtId: district.id,
        districtName: district.name,
        sentAt: new Date(),
        response: response,
        status: 'SENT',
      };

      const req = this.activeRequests.get(requestId);
      if (req) {
        req.responses.push(record);
      }

      return response;
    } catch (error) {
      console.error(`Failed to contact district ${district.id}:`, error);
      
      const record = {
        districtId: district.id,
        districtName: district.name,
        sentAt: new Date(),
        status: 'FAILED',
        error: error.message,
      };

      const req = this.activeRequests.get(requestId);
      if (req) {
        req.responses.push(record);
      }
    }
  }

  /**
   * Handle response from neighboring district
   * @param {string} requestId - Request identifier
   * @param {Object} response - District response
   * @returns {Object} Response confirmation
   */
  handleDistrictResponse(requestId, response) {
    const request = this.activeRequests.get(requestId);

    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const {
      districtId,
      availableUnits = 0,
      estimatedArrival = 0,
      status = 'ACCEPTED',
      notes = '',
    } = response;

    // Update response record
    const responseRecord = request.responses.find(
      (r) => r.districtId === districtId
    );

    if (responseRecord) {
      responseRecord.status = status;
      responseRecord.availableUnits = availableUnits;
      responseRecord.estimatedArrival = estimatedArrival;
      responseRecord.notes = notes;
      responseRecord.respondedAt = new Date();

      // Update confirmed units
      if (status === 'ACCEPTED') {
        request.confirmedUnits += availableUnits;
        request.status = 'CONFIRMED';
      }
    }

    this.emit('mutual-aid-response', {
      requestId,
      districtId,
      status,
      unitsAvailable: availableUnits,
    });

    return {
      success: true,
      totalConfirmed: request.confirmedUnits,
      requestStatus: request.status,
    };
  }

  /**
   * Simulate calling district dispatcher
   * @private
   */
  async callDistrictDispatcher(district, request) {
    return new Promise((resolve, reject) => {
      // Simulate network delay
      const delay = Math.random() * 2000 + 500;

      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout for district ${district.id}`));
      }, this.config.requestTimeout);

      setTimeout(() => {
        clearTimeout(timeout);

        // Simulate response (simplified - in real system would call actual API)
        const hasUnits = Math.random() > 0.3; // 70% chance of available units
        const unitsAvailable = hasUnits ? Math.floor(Math.random() * 3) + 1 : 0;

        resolve({
          districtId: district.id,
          status: unitsAvailable > 0 ? 'ACCEPTED' : 'DECLINED',
          availableUnits: unitsAvailable,
          estimatedArrival: Math.floor(Math.random() * 20) + 5, // 5-25 minutes
        });
      }, delay);
    });
  }

  /**
   * Get neighboring districts for location
   * @private
   */
  getNeighboringDistricts(location) {
    // Query district registry for neighbors based on location
    const neighbors = [];
    
    for (const [districtId, district] of this.config.districtRegistry) {
      if (this.isNeighbor(location, district.location)) {
        neighbors.push({
          id: districtId,
          name: district.name,
          location: district.location,
        });
      }
    }

    return neighbors;
  }

  /**
   * Check if district is neighbor
   * @private
   */
  isNeighbor(location1, location2) {
    if (!location1 || !location2) return false;
    
    // Simplified distance check (real implementation would use actual geo library)
    const distance = Math.sqrt(
      Math.pow(location1.lat - location2.lat, 2) +
      Math.pow(location1.lng - location2.lng, 2)
    );

    return distance < 0.05; // Approximately 5km radius
  }

  /**
   * Cancel mutual aid request
   * @param {string} requestId - Request identifier
   * @returns {Object}
   */
  cancelRequest(requestId) {
    const request = this.activeRequests.get(requestId);

    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    request.status = 'CANCELLED';
    request.cancelledAt = new Date();

    this.emit('mutual-aid-cancelled', { requestId });

    return {
      success: true,
      requestId,
      status: 'CANCELLED',
    };
  }

  /**
   * Get request status
   * @param {string} requestId - Request identifier
   * @returns {Object}
   */
  getRequestStatus(requestId) {
    const request = this.activeRequests.get(requestId);

    if (!request) {
      return null;
    }

    return {
      requestId,
      status: request.status,
      confirmedUnits: request.confirmedUnits,
      requiredUnits: request.requiredUnits,
      responses: request.responses.map((r) => ({
        districtId: r.districtId,
        districtName: r.districtName,
        status: r.status,
        availableUnits: r.availableUnits || 0,
        estimatedArrival: r.estimatedArrival || 0,
      })),
      createdAt: request.createdAt,
    };
  }

  /**
   * Get active requests
   * @returns {Array}
   */
  getActiveRequests() {
    return Array.from(this.activeRequests.values()).filter(
      (r) => r.status !== 'CANCELLED' && r.status !== 'COMPLETED'
    );
  }

  /**
   * Complete request
   * @param {string} requestId - Request identifier
   * @param {string} reason - Completion reason
   */
  completeRequest(requestId, reason = 'RESOLVED') {
    const request = this.activeRequests.get(requestId);

    if (request) {
      request.status = 'COMPLETED';
      request.completedAt = new Date();
      request.completionReason = reason;

      // Store in history
      this.requestHistory.push(request);
      if (this.requestHistory.length > 1000) {
        this.requestHistory = this.requestHistory.slice(-1000);
      }
    }
  }

  /**
   * Register neighboring district
   * @param {string} districtId - District identifier
   * @param {Object} districtInfo - District information
   */
  registerDistrict(districtId, districtInfo) {
    this.config.districtRegistry.set(districtId, districtInfo);
  }

  /**
   * Get request history for incident
   * @param {string} incidentId - Incident identifier
   * @returns {Array}
   */
  getIncidentHistory(incidentId) {
    return this.requestHistory.filter((r) => r.incidentId === incidentId);
  }
}

module.exports = MutualAidCoordinator;
