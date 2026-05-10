/**
 * K6 Load Test: WebSocket Stress Test
 * Tests WebSocket connection handling and real-time message delivery under stress
 * 
 * Run: k6 run scenarios/websocket-stress.js
 * Run with options: k6 run -e WS_URL=ws://localhost:3000 scenarios/websocket-stress.js
 */

import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { config, utils, getEnvConfig } from '../k6-config.js';

// Custom metrics
const wsConnectionErrors = new Rate('ws_connection_errors');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsMessageLatency = new Trend('ws_message_latency');
const wsConnectionDuration = new Trend('ws_connection_duration');

const envConfig = getEnvConfig(__ENV.ENVIRONMENT || 'dev');

// Scenarios configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },      // Ramp-up to 50 concurrent WebSocket connections
    { duration: '2m', target: 100 },     // Ramp-up to 100 connections
    { duration: '2m', target: 200 },     // Ramp-up to 200 connections
    { duration: '5m', target: 500 },     // Ramp-up to 500 connections (stress test)
    { duration: '5m', target: 500 },     // Hold at 500 connections
    { duration: '2m', target: 200 },     // Ramp-down to 200 connections
    { duration: '1m', target: 0 },       // Ramp-down to 0 connections
  ],
  
  thresholds: {
    'ws_connection_errors': ['rate<0.1'],           // Less than 10% connection errors
    'ws_message_latency': ['p(95)<200', 'p(99)<500'], // Message latency SLOs
  },
};

/**
 * Main WebSocket test function
 */
export default function () {
  const userId = utils.generateUserId();
  const token = __ENV.AUTH_TOKEN || 'test-token';
  
  group('WebSocket Stress Test', () => {
    const url = `${envConfig.wsBaseUrl}/ws?userId=${userId}&token=${token}`;
    
    const startTime = new Date().getTime();
    let messageCount = 0;
    let connectionEstablished = false;
    
    const res = ws.connect(url, {
      tags: { name: 'WebSocketStress' },
    }, function (socket) {
      
      // Handle connection open
      socket.on('open', function () {
        connectionEstablished = true;
        
        // Send initial subscription message
        socket.send(JSON.stringify({
          type: 'subscribe',
          channel: 'dispatches',
          userId: userId,
          timestamp: new Date().toISOString(),
        }));
        
        console.log(`WebSocket connected for user ${userId}`);
      });
      
      // Handle incoming messages
      socket.on('message', function (message) {
        const receivedAt = new Date().getTime();
        messageCount++;
        wsMessagesReceived.add(1);
        
        try {
          const data = JSON.parse(message);
          const sentAt = new Date(data.timestamp || new Date()).getTime();
          const latency = receivedAt - sentAt;
          
          wsMessageLatency.add(latency);
          
          // Check message structure
          check(data, {
            'message has type': (m) => m.type !== undefined,
            'message has timestamp': (m) => m.timestamp !== undefined,
          });
        } catch (e) {
          console.error(`Failed to parse message: ${message}`);
        }
      });
      
      // Handle errors
      socket.on('error', function (error) {
        wsConnectionErrors.add(1);
        console.error(`WebSocket error: ${error}`);
      });
      
      // Handle close
      socket.on('close', function () {
        const connectionTime = new Date().getTime() - startTime;
        wsConnectionDuration.add(connectionTime);
        console.log(`WebSocket closed after ${connectionTime}ms, received ${messageCount} messages`);
      });
      
      // Simulate sending periodic status updates
      let sendInterval = setInterval(() => {
        if (socket.readyState === ws.OPEN) {
          socket.send(JSON.stringify({
            type: 'status_update',
            userId: userId,
            status: ['available', 'busy', 'offline'][Math.floor(Math.random() * 3)],
            location: utils.generateLocation(),
            timestamp: new Date().toISOString(),
          }));
        } else {
          clearInterval(sendInterval);
        }
      }, 5000); // Send status every 5 seconds
      
      // Keep connection open for test duration
      socket.setTimeout(() => {
        socket.close();
      }, 30000); // Close after 30 seconds
    });
    
    // Verify connection was successful
    check(res, {
      'WebSocket connection established': (r) => r && r.status === 101,
    });
  });
  
  sleep(1);
}

/**
 * Setup function - runs once before all tests
 */
export function setup() {
  console.log('Starting WebSocket stress test');
  console.log(`Target WebSocket: ${envConfig.wsBaseUrl}`);
  return {
    startTime: new Date().toISOString(),
  };
}

/**
 * Teardown function - runs once after all tests
 */
export function teardown(data) {
  console.log('WebSocket stress test completed');
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
}
