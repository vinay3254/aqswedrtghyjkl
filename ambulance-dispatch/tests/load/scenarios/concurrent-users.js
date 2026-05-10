/**
 * K6 Load Test: Concurrent Users Simulation
 * Simulates 1000+ concurrent users performing realistic ambulance dispatch operations
 * 
 * Run: k6 run scenarios/concurrent-users.js
 * Run with options: k6 run -e API_URL=http://localhost:3000/api scenarios/concurrent-users.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend, Gauge } from 'k6/metrics';
import { config, utils, getEnvConfig } from '../k6-config.js';

// Custom metrics
const requestErrors = new Rate('request_errors');
const requestSuccess = new Counter('request_success');
const requestDuration = new Trend('request_duration');
const concurrentActiveUsers = new Gauge('concurrent_active_users');
const dispatchesCreated = new Counter('total_dispatches_created');

const envConfig = getEnvConfig(__ENV.ENVIRONMENT || 'dev');

// Scenarios configuration - Simulate 1000+ concurrent users
export const options = {
  stages: [
    { duration: '2m', target: 100 },     // Ramp-up to 100 users
    { duration: '3m', target: 250 },     // Ramp-up to 250 users
    { duration: '3m', target: 500 },     // Ramp-up to 500 users
    { duration: '5m', target: 1000 },    // Ramp-up to 1000 users
    { duration: '10m', target: 1000 },   // Hold at 1000 users for 10 minutes
    { duration: '3m', target: 500 },     // Ramp-down to 500 users
    { duration: '2m', target: 0 },       // Ramp-down to 0 users
  ],
  
  thresholds: {
    'request_errors': ['rate<0.05'],                    // Less than 5% errors
    'request_duration': ['p(90)<500', 'p(95)<1000', 'p(99)<2000'], // Response time SLOs
    http_req_failed: ['rate<0.1'],                      // HTTP error rate
    'concurrent_active_users': ['value<=1200'],         // Max concurrent users
  },
};

/**
 * User session simulation
 */
export default function () {
  const userId = utils.generateUserId();
  const responderId = utils.generateUserId();
  
  // Track active user
  concurrentActiveUsers.add(1);
  
  try {
    // User Type 1: Dispatcher - Creates and manages dispatches
    if (Math.random() < 0.3) {
      performDispatcherActions(userId);
    }
    // User Type 2: Responder - Accepts and updates dispatch status
    else if (Math.random() < 0.6) {
      performResponderActions(responderId);
    }
    // User Type 3: Administrator - Views analytics and reports
    else {
      performAdminActions(userId);
    }
  } finally {
    concurrentActiveUsers.add(-1);
  }
  
  sleep(Math.random() * 5); // Random think time
}

/**
 * Dispatcher actions: Create and manage dispatches
 */
function performDispatcherActions(userId) {
  group('Dispatcher Actions', () => {
    // Action 1: Create new dispatch
    createDispatch(userId);
    
    sleep(1);
    
    // Action 2: View active dispatches
    getActiveDispatches();
    
    sleep(1);
    
    // Action 3: Search for specific dispatch
    searchDispatches();
    
    sleep(1);
    
    // Action 4: Update dispatch priority
    updateDispatchPriority();
  });
}

/**
 * Responder actions: Accept and update dispatches
 */
function performResponderActions(responderId) {
  group('Responder Actions', () => {
    // Action 1: Get available dispatches
    getAvailableDispatches(responderId);
    
    sleep(1);
    
    // Action 2: Accept dispatch
    acceptDispatch(responderId);
    
    sleep(2);
    
    // Action 3: Update current location
    updateResponderLocation(responderId);
    
    sleep(1);
    
    // Action 4: Update dispatch status
    updateDispatchStatus(responderId);
  });
}

/**
 * Administrator actions: Analytics and reporting
 */
function performAdminActions(userId) {
  group('Admin Actions', () => {
    // Action 1: Get dispatch statistics
    getDispatchStats();
    
    sleep(1);
    
    // Action 2: Get responder performance metrics
    getResponderMetrics();
    
    sleep(1);
    
    // Action 3: Generate incident report
    generateIncidentReport();
  });
}

/**
 * Create a new dispatch
 */
function createDispatch(userId) {
  const payload = utils.generateDispatchPayload();
  payload.createdBy = userId;
  
  const response = http.post(
    `${envConfig.apiBaseUrl}/dispatches`,
    JSON.stringify(payload),
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'dispatch created': (r) => r.status === 201 || r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  recordMetrics(response, 'create_dispatch', success);
  if (success) dispatchesCreated.add(1);
}

/**
 * Get active dispatches
 */
function getActiveDispatches() {
  const response = http.get(
    `${envConfig.apiBaseUrl}/dispatches?status=active&limit=50`,
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'got active dispatches': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  recordMetrics(response, 'get_active_dispatches', success);
}

/**
 * Search for dispatches
 */
function searchDispatches() {
  const searchTerm = ['medical', 'trauma', 'cardiac'][Math.floor(Math.random() * 3)];
  
  const response = http.get(
    `${envConfig.apiBaseUrl}/dispatches/search?query=${searchTerm}`,
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'search successful': (r) => r.status === 200,
    'has results': (r) => r.body.length > 0,
  });
  
  recordMetrics(response, 'search_dispatches', success);
}

/**
 * Update dispatch priority
 */
function updateDispatchPriority() {
  const dispatchId = utils.generateDispatchId();
  const payload = {
    priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
  };
  
  const response = http.patch(
    `${envConfig.apiBaseUrl}/dispatches/${dispatchId}/priority`,
    JSON.stringify(payload),
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'priority updated or not found': (r) => r.status === 200 || r.status === 404,
  });
  
  recordMetrics(response, 'update_priority', success);
}

/**
 * Get available dispatches for responder
 */
function getAvailableDispatches(responderId) {
  const response = http.get(
    `${envConfig.apiBaseUrl}/dispatches/available?responderId=${responderId}`,
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'got available dispatches': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  recordMetrics(response, 'get_available_dispatches', success);
}

/**
 * Accept dispatch
 */
function acceptDispatch(responderId) {
  const dispatchId = utils.generateDispatchId();
  const payload = {
    responderId: responderId,
    acceptedAt: new Date().toISOString(),
  };
  
  const response = http.post(
    `${envConfig.apiBaseUrl}/dispatches/${dispatchId}/accept`,
    JSON.stringify(payload),
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'dispatch accepted or not found': (r) => r.status === 200 || r.status === 404 || r.status === 409,
  });
  
  recordMetrics(response, 'accept_dispatch', success);
}

/**
 * Update responder location
 */
function updateResponderLocation(responderId) {
  const location = utils.generateLocation();
  const payload = {
    responderId: responderId,
    location: location,
    timestamp: new Date().toISOString(),
  };
  
  const response = http.post(
    `${envConfig.apiBaseUrl}/responders/${responderId}/location`,
    JSON.stringify(payload),
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'location updated': (r) => r.status === 200 || r.status === 404,
  });
  
  recordMetrics(response, 'update_location', success);
}

/**
 * Update dispatch status
 */
function updateDispatchStatus(responderId) {
  const dispatchId = utils.generateDispatchId();
  const statuses = ['en_route', 'on_scene', 'patient_care', 'completed'];
  const payload = {
    status: statuses[Math.floor(Math.random() * statuses.length)],
    responderId: responderId,
    timestamp: new Date().toISOString(),
  };
  
  const response = http.patch(
    `${envConfig.apiBaseUrl}/dispatches/${dispatchId}/status`,
    JSON.stringify(payload),
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'status updated or not found': (r) => r.status === 200 || r.status === 404,
  });
  
  recordMetrics(response, 'update_status', success);
}

/**
 * Get dispatch statistics
 */
function getDispatchStats() {
  const response = http.get(
    `${envConfig.apiBaseUrl}/stats/dispatches`,
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'got stats': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  recordMetrics(response, 'get_stats', success);
}

/**
 * Get responder metrics
 */
function getResponderMetrics() {
  const response = http.get(
    `${envConfig.apiBaseUrl}/metrics/responders`,
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'got metrics': (r) => r.status === 200,
  });
  
  recordMetrics(response, 'get_metrics', success);
}

/**
 * Generate incident report
 */
function generateIncidentReport() {
  const payload = {
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  };
  
  const response = http.post(
    `${envConfig.apiBaseUrl}/reports/incidents`,
    JSON.stringify(payload),
    {
      headers: {
        ...envConfig.defaultHeaders,
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      timeout: envConfig.timeout,
    }
  );
  
  const success = check(response, {
    'report generated': (r) => r.status === 200 || r.status === 201,
  });
  
  recordMetrics(response, 'generate_report', success);
}

/**
 * Record metrics for an HTTP request
 */
function recordMetrics(response, action, success) {
  requestDuration.add(response.timings.duration, { action });
  
  if (!success) {
    requestErrors.add(1);
    console.warn(`${action} failed with status ${response.status}`);
  } else {
    requestSuccess.add(1);
  }
}

/**
 * Setup function
 */
export function setup() {
  console.log('Starting concurrent users simulation');
  console.log(`Target API: ${envConfig.apiBaseUrl}`);
  console.log('Ramping up to 1000+ concurrent users');
  
  return {
    startTime: new Date().toISOString(),
  };
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Concurrent users simulation completed');
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
}
