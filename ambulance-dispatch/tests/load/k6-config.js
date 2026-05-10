/**
 * K6 Load Testing Configuration
 * Central configuration for all load testing scenarios
 */

export const config = {
  // API Base URL - Change based on environment
  apiBaseUrl: __ENV.API_URL || 'http://localhost:3000/api',
  
  // WebSocket URL - Change based on environment
  wsBaseUrl: __ENV.WS_URL || 'ws://localhost:3000',
  
  // Test timeouts
  timeout: 30000, // 30 seconds
  
  // Thresholds for test success/failure
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    'http_req_failed': ['rate<0.1'],                   // Error rate < 10%
    'ws_connecting': ['p(95)<1000'],                   // WebSocket connect time
    'ws_session_duration': ['p(99)<5000'],             // WebSocket session duration
  },
  
  // Common request headers
  defaultHeaders: {
    'Content-Type': 'application/json',
    'User-Agent': 'k6-load-test/1.0',
  },
  
  // Test scenarios configuration
  scenarios: {
    // Dispatch endpoint load test
    dispatch: {
      duration: '5m',
      arrivalRate: 100, // requests per second
      rampUp: '1m',
      rampDown: '30s',
    },
    
    // WebSocket stress test
    websocket: {
      connections: 500,
      rampUp: '2m',
      messageRate: 10, // messages per second per connection
      duration: '10m',
    },
    
    // Concurrent users simulation
    concurrent: {
      maxVUsers: 1000,
      rampUp: '5m',
      steadyState: '10m',
      rampDown: '2m',
    },
  },
  
  // Alert thresholds
  alerts: {
    responseTime95: 500,    // milliseconds
    responseTime99: 1000,   // milliseconds
    errorRate: 0.01,        // 1%
    availabilityRate: 0.99, // 99%
  },
  
  // Logging configuration
  logging: {
    enabled: true,
    level: 'info', // 'debug', 'info', 'warn', 'error'
    verbose: __ENV.VERBOSE === 'true',
  },
};

/**
 * Get environment-specific configuration
 * @param {string} env - Environment name (dev, staging, production)
 * @returns {object} Environment-specific config
 */
export function getEnvConfig(env = 'dev') {
  const envConfigs = {
    dev: {
      apiBaseUrl: 'http://localhost:3000/api',
      wsBaseUrl: 'ws://localhost:3000',
    },
    staging: {
      apiBaseUrl: process.env.STAGING_API_URL || 'https://staging-api.ambulance.local/api',
      wsBaseUrl: process.env.STAGING_WS_URL || 'wss://staging-api.ambulance.local',
    },
    production: {
      apiBaseUrl: process.env.PROD_API_URL || 'https://api.ambulance.com/api',
      wsBaseUrl: process.env.PROD_WS_URL || 'wss://api.ambulance.com',
    },
  };
  
  return { ...config, ...envConfigs[env] };
}

/**
 * Utility functions for load testing
 */
export const utils = {
  /**
   * Generate random dispatch ID
   */
  generateDispatchId: () => {
    return `DISP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
  
  /**
   * Generate random user ID
   */
  generateUserId: () => {
    return `USER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  },
  
  /**
   * Generate random location
   */
  generateLocation: () => {
    const lat = (Math.random() * 180 - 90).toFixed(6);
    const lng = (Math.random() * 360 - 180).toFixed(6);
    return { latitude: parseFloat(lat), longitude: parseFloat(lng) };
  },
  
  /**
   * Generate random priority (1-5)
   */
  generatePriority: () => {
    return Math.floor(Math.random() * 5) + 1;
  },
  
  /**
   * Generate realistic dispatch payload
   */
  generateDispatchPayload: () => {
    const priorityLevels = ['low', 'medium', 'high', 'critical'];
    const locations = [
      { latitude: 40.7128, longitude: -74.0060 }, // NYC
      { latitude: 34.0522, longitude: -118.2437 }, // LA
      { latitude: 41.8781, longitude: -87.6298 }, // Chicago
      { latitude: 29.7604, longitude: -95.3698 }, // Houston
      { latitude: 33.7490, longitude: -84.3880 }, // Atlanta
    ];
    
    const randomLocation = locations[Math.floor(Math.random() * locations.length)];
    
    return {
      dispatchId: this.generateDispatchId(),
      responderId: this.generateUserId(),
      location: randomLocation,
      priority: priorityLevels[Math.floor(Math.random() * priorityLevels.length)],
      incidentType: ['medical', 'trauma', 'cardiac', 'respiratory'][Math.floor(Math.random() * 4)],
      patientCount: Math.floor(Math.random() * 5) + 1,
      description: `Emergency dispatch for incident type at ${randomLocation.latitude}, ${randomLocation.longitude}`,
      timestamp: new Date().toISOString(),
    };
  },
};

export default config;
