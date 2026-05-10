/**
 * K6 Load Test: Dispatch Endpoint
 * Tests the dispatch API endpoints under increasing load
 * 
 * Run: k6 run scenarios/dispatch-load.js
 * Run with options: k6 run -e API_URL=http://localhost:3000/api scenarios/dispatch-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend, Gauge } from 'k6/metrics';
import { config, utils, getEnvConfig } from '../k6-config.js';

// Custom metrics
const dispatchErrors = new Rate('dispatch_errors');
const dispatchSuccess = new Counter('dispatch_success');
const dispatchDuration = new Trend('dispatch_duration');
const activeDispatches = new Gauge('active_dispatches');

const envConfig = getEnvConfig(__ENV.ENVIRONMENT || 'dev');

// Scenarios configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },      // Ramp-up to 50 users
    { duration: '2m', target: 100 },     // Ramp-up to 100 users
    { duration: '3m', target: 200 },     // Ramp-up to 200 users
    { duration: '5m', target: 200 },     // Stay at 200 users
    { duration: '2m', target: 100 },     // Ramp-down to 100 users
    { duration: '1m', target: 0 },       // Ramp-down to 0 users
  ],
  
  thresholds: {
    'dispatch_errors': ['rate<0.05'],                // Less than 5% errors
    'dispatch_duration': ['p(95)<500', 'p(99)<1000'], // Response time SLOs
    http_req_failed: ['rate<0.1'],                   // HTTP error rate
  },
};

// Setup function - runs once before all tests
export function setup() {
  console.log('Starting dispatch load test');
  console.log(`Target API: ${envConfig.apiBaseUrl}`);
  return {
    startTime: new Date().toISOString(),
  };
}

/**
 * Main test function - runs for each virtual user
 */
export default function (data) {
  // Test 1: Create new dispatch
  group('Create Dispatch', () => {
    const dispatchPayload = utils.generateDispatchPayload();
    
    const response = http.post(
      `${envConfig.apiBaseUrl}/dispatches`,
      JSON.stringify(dispatchPayload),
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
      'has dispatch id': (r) => r.body.includes('dispatchId') || r.body.includes('id'),
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    dispatchDuration.add(response.timings.duration);
    if (!success) {
      dispatchErrors.add(1);
      console.error(`Dispatch creation failed: ${response.status}`);
    } else {
      dispatchSuccess.add(1);
    }
    
    activeDispatches.add(1);
  });
  
  sleep(1);
  
  // Test 2: List all dispatches with pagination
  group('List Dispatches', () => {
    const params = {
      page: Math.floor(Math.random() * 10) + 1,
      limit: 50,
    };
    
    const response = http.get(
      `${envConfig.apiBaseUrl}/dispatches?page=${params.page}&limit=${params.limit}`,
      {
        headers: {
          ...envConfig.defaultHeaders,
          'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
        },
        timeout: envConfig.timeout,
      }
    );
    
    const success = check(response, {
      'list dispatches successful': (r) => r.status === 200,
      'has dispatch list': (r) => r.body.includes('dispatch') || r.body.includes('data'),
      'response time < 1000ms': (r) => r.timings.duration < 1000,
    });
    
    dispatchDuration.add(response.timings.duration);
    if (!success) {
      dispatchErrors.add(1);
    }
  });
  
  sleep(1);
  
  // Test 3: Get dispatch by ID
  group('Get Dispatch Details', () => {
    const dispatchId = utils.generateDispatchId();
    
    const response = http.get(
      `${envConfig.apiBaseUrl}/dispatches/${dispatchId}`,
      {
        headers: {
          ...envConfig.defaultHeaders,
          'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
        },
        timeout: envConfig.timeout,
      }
    );
    
    const success = check(response, {
      'dispatch details retrieved': (r) => r.status === 200 || r.status === 404,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    dispatchDuration.add(response.timings.duration);
    if (!success) {
      dispatchErrors.add(1);
    }
  });
  
  sleep(1);
  
  // Test 4: Update dispatch status
  group('Update Dispatch Status', () => {
    const dispatchId = utils.generateDispatchId();
    const statusPayload = {
      status: ['pending', 'en_route', 'on_scene', 'completed'][Math.floor(Math.random() * 4)],
      updatedAt: new Date().toISOString(),
    };
    
    const response = http.put(
      `${envConfig.apiBaseUrl}/dispatches/${dispatchId}`,
      JSON.stringify(statusPayload),
      {
        headers: {
          ...envConfig.defaultHeaders,
          'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
        },
        timeout: envConfig.timeout,
      }
    );
    
    const success = check(response, {
      'dispatch status updated': (r) => r.status === 200 || r.status === 404 || r.status === 400,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    dispatchDuration.add(response.timings.duration);
    if (!success) {
      dispatchErrors.add(1);
    }
  });
  
  sleep(1);
  
  // Test 5: Cancel dispatch
  group('Cancel Dispatch', () => {
    const dispatchId = utils.generateDispatchId();
    
    const response = http.delete(
      `${envConfig.apiBaseUrl}/dispatches/${dispatchId}`,
      {
        headers: {
          ...envConfig.defaultHeaders,
          'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
        },
        timeout: envConfig.timeout,
      }
    );
    
    const success = check(response, {
      'dispatch cancelled': (r) => r.status === 200 || r.status === 404 || r.status === 204,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    dispatchDuration.add(response.timings.duration);
    if (!success) {
      dispatchErrors.add(1);
    }
    
    activeDispatches.add(-1);
  });
  
  sleep(2);
}

// Teardown function - runs once after all tests
export function teardown(data) {
  console.log('Dispatch load test completed');
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
}
