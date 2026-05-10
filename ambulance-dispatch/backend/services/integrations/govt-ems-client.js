/**
 * Government EMS API Client
 * Handles integration with Indian emergency services (108, 102, 1099 etc.)
 * Supports operations: registration, incident handling, status sync, heartbeat
 */

const logger = require('../../utils/logger');
const { EMSError, NetworkError, ValidationError } = require('../../errors');

class GovernmentEMSClient {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://api.ems-govservices.in',
      apiKey: config.apiKey || 'mock-api-key',
      serviceCode: config.serviceCode || '108', // 108, 102, 1099, etc.
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      enableMock: config.enableMock !== false, // Enable mock by default
      heartbeatInterval: config.heartbeatInterval || 60000, // 1 minute
    };

    this.ambulanceId = null;
    this.isRegistered = false;
    this.lastHeartbeatTime = null;
    this.heartbeatTimer = null;

    logger.info('[GovernmentEMSClient] Initialized', { serviceCode: this.config.serviceCode });
  }

  /**
   * Register ambulance with government EMS system
   * @param {Object} ambulanceData - Ambulance information
   * @returns {Promise<Object>} Registration response with ambulance ID
   */
  async registerAmbulance(ambulanceData) {
    try {
      logger.info('[GovernmentEMSClient] Registering ambulance', { ambulanceData });

      if (!ambulanceData.name || !ambulanceData.phone) {
        throw new ValidationError('Ambulance name and phone are required');
      }

      const payload = {
        name: ambulanceData.name,
        phone: ambulanceData.phone,
        type: ambulanceData.type || 'Basic Life Support',
        location: {
          lat: ambulanceData.latitude,
          lng: ambulanceData.longitude,
        },
        driverLicense: ambulanceData.driverLicense,
        vehicleRegistration: ambulanceData.vehicleRegistration,
        status: 'available',
      };

      const response = await this._makeRequest(
        'POST',
        '/api/v1/ambulances/register',
        payload
      );

      this.ambulanceId = response.ambulanceId || `AMB-${Date.now()}`;
      this.isRegistered = true;

      logger.info('[GovernmentEMSClient] Ambulance registered successfully', {
        ambulanceId: this.ambulanceId,
      });

      // Start heartbeat after registration
      this._startHeartbeat();

      return {
        success: true,
        ambulanceId: this.ambulanceId,
        registeredAt: new Date().toISOString(),
        status: 'registered',
      };
    } catch (error) {
      logger.error('[GovernmentEMSClient] Ambulance registration failed', { error });
      throw error;
    }
  }

  /**
   * Receive incident from government EMS system
   * @param {Object} incidentData - Incident information
   * @returns {Promise<Object>} Acknowledgment response
   */
  async receiveIncident(incidentData) {
    try {
      if (!this.isRegistered) {
        throw new EMSError('Ambulance not registered with EMS system');
      }

      logger.info('[GovernmentEMSClient] Receiving incident', { incidentData });

      const normalizedIncident = {
        incidentId: incidentData.incidentId || `INC-${Date.now()}`,
        type: incidentData.type || 'medical',
        severity: incidentData.severity || 'moderate',
        location: {
          address: incidentData.address,
          lat: incidentData.latitude,
          lng: incidentData.longitude,
        },
        patientInfo: {
          age: incidentData.patientAge,
          gender: incidentData.patientGender,
          condition: incidentData.condition,
        },
        contactPhone: incidentData.contactPhone,
        timestamp: new Date().toISOString(),
      };

      const response = await this._makeRequest(
        'POST',
        '/api/v1/incidents/acknowledge',
        {
          ambulanceId: this.ambulanceId,
          incident: normalizedIncident,
        }
      );

      logger.info('[GovernmentEMSClient] Incident acknowledged', {
        incidentId: normalizedIncident.incidentId,
      });

      return {
        success: true,
        incidentId: normalizedIncident.incidentId,
        acknowledgedAt: new Date().toISOString(),
        status: 'acknowledged',
      };
    } catch (error) {
      logger.error('[GovernmentEMSClient] Failed to receive incident', { error });
      throw error;
    }
  }

  /**
   * Sync ambulance status with government EMS system
   * @param {Object} statusData - Current ambulance status
   * @returns {Promise<Object>} Sync response
   */
  async syncStatus(statusData) {
    try {
      if (!this.isRegistered) {
        throw new EMSError('Ambulance not registered with EMS system');
      }

      logger.info('[GovernmentEMSClient] Syncing ambulance status', { statusData });

      const payload = {
        ambulanceId: this.ambulanceId,
        status: statusData.status || 'available', // available, busy, maintenance
        location: {
          lat: statusData.latitude,
          lng: statusData.longitude,
          timestamp: new Date().toISOString(),
        },
        driver: {
          name: statusData.driverName,
          phone: statusData.driverPhone,
        },
        currentIncident: statusData.currentIncidentId || null,
        patientCount: statusData.patientCount || 0,
        fuelLevel: statusData.fuelLevel || 100,
        equipmentStatus: statusData.equipmentStatus || 'operational',
      };

      const response = await this._makeRequest(
        'PUT',
        `/api/v1/ambulances/${this.ambulanceId}/status`,
        payload
      );

      logger.info('[GovernmentEMSClient] Status synced successfully', {
        ambulanceId: this.ambulanceId,
      });

      return {
        success: true,
        ambulanceId: this.ambulanceId,
        syncedAt: new Date().toISOString(),
        acknowledged: response.acknowledged || true,
      };
    } catch (error) {
      logger.error('[GovernmentEMSClient] Failed to sync status', { error });
      throw error;
    }
  }

  /**
   * Send heartbeat to keep registration alive
   * @returns {Promise<Object>} Heartbeat response
   */
  async heartbeat() {
    try {
      if (!this.isRegistered) {
        logger.warn('[GovernmentEMSClient] Heartbeat skipped - not registered');
        return null;
      }

      logger.debug('[GovernmentEMSClient] Sending heartbeat', {
        ambulanceId: this.ambulanceId,
      });

      const response = await this._makeRequest(
        'POST',
        `/api/v1/ambulances/${this.ambulanceId}/heartbeat`,
        {
          timestamp: new Date().toISOString(),
          connectionState: 'active',
        }
      );

      this.lastHeartbeatTime = new Date();

      logger.debug('[GovernmentEMSClient] Heartbeat acknowledged', {
        ambulanceId: this.ambulanceId,
      });

      return {
        success: true,
        ambulanceId: this.ambulanceId,
        heartbeatAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[GovernmentEMSClient] Heartbeat failed', { error });
      // Don't throw - heartbeat failures shouldn't break the application
      return { success: false, error: error.message };
    }
  }

  /**
   * Unregister ambulance from government EMS system
   * @returns {Promise<Object>} Unregistration response
   */
  async unregister() {
    try {
      if (!this.isRegistered) {
        return { success: true, message: 'Not registered' };
      }

      logger.info('[GovernmentEMSClient] Unregistering ambulance', {
        ambulanceId: this.ambulanceId,
      });

      this._stopHeartbeat();

      await this._makeRequest(
        'POST',
        `/api/v1/ambulances/${this.ambulanceId}/unregister`,
        {}
      );

      this.isRegistered = false;
      this.ambulanceId = null;

      logger.info('[GovernmentEMSClient] Ambulance unregistered');

      return {
        success: true,
        unregisteredAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[GovernmentEMSClient] Failed to unregister', { error });
      throw error;
    }
  }

  /**
   * Get registration status
   * @returns {Object} Registration status
   */
  getStatus() {
    return {
      isRegistered: this.isRegistered,
      ambulanceId: this.ambulanceId,
      lastHeartbeat: this.lastHeartbeatTime,
      serviceCode: this.config.serviceCode,
    };
  }

  /**
   * Make HTTP request to EMS API
   * @private
   */
  async _makeRequest(method, endpoint, body = null) {
    // Mock implementation
    if (this.config.enableMock) {
      return this._mockRequest(method, endpoint, body);
    }

    // Real implementation would use fetch/axios
    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Service-Code': this.config.serviceCode,
        },
        timeout: this.config.timeout,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      logger.debug('[GovernmentEMSClient] Making request', { method, endpoint });

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new NetworkError(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('[GovernmentEMSClient] Request failed', {
        method,
        endpoint,
        error: error.message,
      });
      throw new NetworkError(error.message);
    }
  }

  /**
   * Mock request implementation
   * @private
   */
  _mockRequest(method, endpoint, body) {
    logger.debug('[GovernmentEMSClient] Mock request', { method, endpoint });

    // Simulate network latency
    const delay = Math.random() * 100 + 50;

    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock responses based on endpoint
        if (endpoint.includes('/register')) {
          resolve({
            ambulanceId: `AMB-${Date.now()}`,
            registrationId: `REG-${Date.now()}`,
            status: 'registered',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        } else if (endpoint.includes('/acknowledge')) {
          resolve({
            acknowledged: true,
            assignmentId: `ASN-${Date.now()}`,
            estimatedArrivalTime: 8,
          });
        } else if (endpoint.includes('/status')) {
          resolve({
            statusCode: 200,
            lastUpdated: new Date().toISOString(),
            acknowledged: true,
          });
        } else if (endpoint.includes('/heartbeat')) {
          resolve({
            status: 'alive',
            nextHeartbeat: Date.now() + this.config.heartbeatInterval,
          });
        } else if (endpoint.includes('/unregister')) {
          resolve({
            status: 'unregistered',
            timestamp: new Date().toISOString(),
          });
        } else {
          resolve({ success: true, data: body });
        }
      }, delay);
    });
  }

  /**
   * Start automatic heartbeat
   * @private
   */
  _startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat().catch((err) => {
        logger.error('[GovernmentEMSClient] Heartbeat error', { error: err.message });
      });
    }, this.config.heartbeatInterval);

    logger.info('[GovernmentEMSClient] Heartbeat started', {
      interval: this.config.heartbeatInterval,
    });
  }

  /**
   * Stop automatic heartbeat
   * @private
   */
  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      logger.info('[GovernmentEMSClient] Heartbeat stopped');
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this._stopHeartbeat();
    logger.info('[GovernmentEMSClient] Client destroyed');
  }
}

module.exports = GovernmentEMSClient;
