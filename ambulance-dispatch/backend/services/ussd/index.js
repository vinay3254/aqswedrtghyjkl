/**
 * USSD Service - Main Export
 * Exports all services for use in the ambulance dispatch system
 */

const USSDServer = require('./ussd-server');
const MenuFlow = require('./menu-flow');
const LocationResolver = require('./location-resolver');
const SMSFallback = require('./sms-fallback');

module.exports = {
  // Main server
  USSDServer,

  // Individual services
  MenuFlow,
  LocationResolver,
  SMSFallback,

  // Factory function for easy initialization
  createUSSDService: (config = {}) => {
    return new USSDServer(config);
  },

  // Version info
  version: '1.0.0',
  name: '@ambulance-dispatch/ussd-service',

  // Helper utilities
  utils: {
    // Create a complete USSD setup with all services
    createCompleteService: async (config = {}) => {
      const server = new USSDServer(config);
      await server.start();
      return {
        server,
        menuFlow: server.menuFlow,
        locationResolver: server.locationResolver,
        smsFallback: server.smsFallback,
        stop: () => server.stop(),
      };
    },

    // Get service health status
    getHealthStatus: (server) => {
      return {
        status: 'ok',
        service: 'ussd-server',
        timestamp: new Date().toISOString(),
      };
    },

    // Create test session
    createTestSession: (phoneNumber, networkCode) => {
      return {
        sessionId: `test-${Date.now()}`,
        phoneNumber,
        networkCode,
        currentMenu: 'main',
        context: {},
        attempts: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
        isComplete: false,
      };
    },
  },

  // Documentation
  docs: {
    readme: './README.md',
    samples: './SAMPLE_SESSIONS.js',
    config: './config.example.js',
    quickReference: './QUICK_REFERENCE.js',
  },
};
