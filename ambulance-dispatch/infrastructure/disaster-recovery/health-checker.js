#!/usr/bin/env node

/**
 * Health Checker Service
 * Ambulance Dispatch System - Disaster Recovery
 * 
 * Monitors health of primary and secondary systems
 * Triggers failover when thresholds are exceeded
 * Provides REST API for health status queries
 */

const express = require('express');
const http = require('http');
const https = require('https');
const axios = require('axios');
const redis = require('redis');
const prometheus = require('prom-client');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Configuration
const config = {
  port: process.env.PORT || 8080,
  metricsPort: process.env.METRICS_PORT || 9090,
  primaryRegion: process.env.PRIMARY_REGION || 'us-east-1',
  secondaryRegion: process.env.SECONDARY_REGION || 'us-west-2',
  failoverThreshold: parseInt(process.env.FAILOVER_THRESHOLD || '3'),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '10') * 1000,
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5') * 1000,
  enableAutoFailover: process.env.ENABLE_AUTO_FAILOVER === 'true',
  enableAutoFailback: process.env.ENABLE_AUTO_FAILBACK === 'true',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  stateFile: process.env.STATE_FILE || '/app/state/failover-state.json',
};

// Prometheus Metrics
const healthCheckCounter = new prometheus.Counter({
  name: 'health_checks_total',
  help: 'Total number of health checks',
  labelNames: ['service', 'region', 'status'],
});

const healthCheckDuration = new prometheus.Histogram({
  name: 'health_check_duration_seconds',
  help: 'Duration of health checks',
  labelNames: ['service', 'region'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const failoverCounter = new prometheus.Counter({
  name: 'failovers_total',
  help: 'Total number of failovers',
  labelNames: ['service', 'reason'],
});

const activeRegionGauge = new prometheus.Gauge({
  name: 'active_region',
  help: 'Currently active region (0=primary, 1=secondary)',
  labelNames: ['service'],
});

const serviceHealthGauge = new prometheus.Gauge({
  name: 'service_health',
  help: 'Service health status (1=healthy, 0=unhealthy)',
  labelNames: ['service', 'region'],
});

const failoverStateGauge = new prometheus.Gauge({
  name: 'failover_state',
  help: 'Failover state machine',
  labelNames: ['state'],
});

// Health Check Service Definition
class HealthCheckService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.redisClient = redis.createClient({ url: config.redisUrl });
    this.failoverState = {
      currentActive: 'primary',
      lastFailover: null,
      failoverCount: 0,
      lastFailback: null,
      failbackCount: 0,
      healthStatus: {
        primary: { healthy: true, consecutiveFailures: 0, lastCheck: null },
        secondary: { healthy: true, consecutiveFailures: 0, lastCheck: null },
      },
    };
    this.services = {};
    this.healthChecks = {};
    this.initialized = false;
  }

  async initialize() {
    try {
      // Connect to Redis
      await this.redisClient.connect();
      console.log('✓ Connected to Redis');

      // Load failover state from file
      this.loadState();

      // Register default services
      this.registerService('dispatch-api', {
        primary: 'http://localhost:3000/health',
        secondary: 'http://localhost:3001/health',
        timeout: this.config.healthCheckTimeout,
        criticalService: true,
      });

      this.registerService('database', {
        primary: 'postgres://dispatch_user@postgres-primary:5432/ambulance_db',
        secondary: 'postgres://dispatch_user@postgres-replica:5432/ambulance_db',
        timeout: this.config.healthCheckTimeout,
        type: 'database',
        criticalService: true,
      });

      this.registerService('cache', {
        primary: 'redis://redis-primary:6379',
        secondary: 'redis://redis-replica:6379',
        timeout: this.config.healthCheckTimeout,
        type: 'redis',
        criticalService: false,
      });

      this.registerService('message-queue', {
        primary: 'amqp://guest:guest@rabbitmq-primary:5672',
        secondary: 'amqp://guest:guest@rabbitmq-secondary:5672',
        timeout: this.config.healthCheckTimeout,
        type: 'amqp',
        criticalService: true,
      });

      this.initialized = true;
      console.log('✓ Health Check Service initialized');
      console.log(`✓ Registered ${Object.keys(this.services).length} services`);
    } catch (error) {
      console.error('✗ Failed to initialize Health Check Service:', error);
      throw error;
    }
  }

  registerService(name, config) {
    this.services[name] = config;
    console.log(`  - Registered service: ${name} (${config.type || 'http'})`);
  }

  loadState() {
    try {
      if (fs.existsSync(this.config.stateFile)) {
        const state = JSON.parse(fs.readFileSync(this.config.stateFile, 'utf8'));
        this.failoverState = { ...this.failoverState, ...state };
        console.log(`✓ Loaded failover state: ${this.failoverState.currentActive}`);
      }
    } catch (error) {
      console.warn('⚠ Could not load failover state:', error.message);
    }
  }

  saveState() {
    try {
      const dir = path.dirname(this.config.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.config.stateFile, JSON.stringify(this.failoverState, null, 2));
    } catch (error) {
      console.error('✗ Failed to save failover state:', error);
    }
  }

  async checkHttpHealth(url, timeout) {
    const startTime = Date.now();
    try {
      const response = await axios.get(url, { timeout });
      const duration = (Date.now() - startTime) / 1000;
      return {
        healthy: response.status === 200,
        statusCode: response.status,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      return {
        healthy: false,
        error: error.message,
        duration,
        timestamp: new Date(),
      };
    }
  }

  async checkDatabaseHealth(connectionString, timeout) {
    const startTime = Date.now();
    try {
      // Implementation depends on database type
      if (connectionString.startsWith('postgres://')) {
        return await this.checkPostgresHealth(connectionString, timeout);
      }
      return { healthy: false, error: 'Unsupported database type' };
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      return {
        healthy: false,
        error: error.message,
        duration,
        timestamp: new Date(),
      };
    }
  }

  async checkPostgresHealth(connectionString, timeout) {
    // Simplified implementation - use pg library in production
    const startTime = Date.now();
    try {
      // In production, use actual PostgreSQL client
      const result = {
        healthy: true,
        statusCode: 200,
        duration: (Date.now() - startTime) / 1000,
        timestamp: new Date(),
      };
      return result;
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        duration: (Date.now() - startTime) / 1000,
        timestamp: new Date(),
      };
    }
  }

  async checkRedisHealth(connectionString, timeout) {
    const startTime = Date.now();
    try {
      const client = redis.createClient({ url: connectionString });
      await client.connect();
      await client.ping();
      await client.disconnect();

      return {
        healthy: true,
        duration: (Date.now() - startTime) / 1000,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        duration: (Date.now() - startTime) / 1000,
        timestamp: new Date(),
      };
    }
  }

  async checkServiceHealth(serviceName) {
    const service = this.services[serviceName];
    if (!service) return null;

    const results = {
      primary: null,
      secondary: null,
    };

    // Check primary
    const startPrimary = Date.now();
    if (service.type === 'database') {
      results.primary = await this.checkDatabaseHealth(
        service.primary,
        service.timeout
      );
    } else if (service.type === 'redis') {
      results.primary = await this.checkRedisHealth(
        service.primary,
        service.timeout
      );
    } else {
      results.primary = await this.checkHttpHealth(
        service.primary,
        service.timeout
      );
    }
    const durationPrimary = (Date.now() - startPrimary) / 1000;

    // Check secondary
    const startSecondary = Date.now();
    if (service.type === 'database') {
      results.secondary = await this.checkDatabaseHealth(
        service.secondary,
        service.timeout
      );
    } else if (service.type === 'redis') {
      results.secondary = await this.checkRedisHealth(
        service.secondary,
        service.timeout
      );
    } else {
      results.secondary = await this.checkHttpHealth(
        service.secondary,
        service.timeout
      );
    }
    const durationSecondary = (Date.now() - startSecondary) / 1000;

    // Update metrics
    healthCheckCounter.inc({
      service: serviceName,
      region: 'primary',
      status: results.primary.healthy ? 'success' : 'failure',
    });
    healthCheckDuration.observe(
      { service: serviceName, region: 'primary' },
      durationPrimary
    );

    healthCheckCounter.inc({
      service: serviceName,
      region: 'secondary',
      status: results.secondary.healthy ? 'success' : 'failure',
    });
    healthCheckDuration.observe(
      { service: serviceName, region: 'secondary' },
      durationSecondary
    );

    serviceHealthGauge.set(
      { service: serviceName, region: 'primary' },
      results.primary.healthy ? 1 : 0
    );
    serviceHealthGauge.set(
      { service: serviceName, region: 'secondary' },
      results.secondary.healthy ? 1 : 0
    );

    return results;
  }

  async evaluateFailover() {
    const criticalServices = Object.entries(this.services)
      .filter(([, config]) => config.criticalService)
      .map(([name]) => name);

    let primaryHealthy = true;
    let secondaryHealthy = true;

    for (const serviceName of criticalServices) {
      const health = await this.checkServiceHealth(serviceName);
      if (!health) continue;

      if (!health.primary.healthy) {
        this.failoverState.healthStatus.primary.consecutiveFailures++;
      } else {
        this.failoverState.healthStatus.primary.consecutiveFailures = 0;
      }

      if (!health.secondary.healthy) {
        this.failoverState.healthStatus.secondary.consecutiveFailures++;
      } else {
        this.failoverState.healthStatus.secondary.consecutiveFailures = 0;
      }

      this.failoverState.healthStatus.primary.healthy =
        health.primary.healthy &&
        this.failoverState.healthStatus.primary.consecutiveFailures <
          this.config.failoverThreshold;
      this.failoverState.healthStatus.secondary.healthy =
        health.secondary.healthy &&
        this.failoverState.healthStatus.secondary.consecutiveFailures <
          this.config.failoverThreshold;

      primaryHealthy = primaryHealthy && this.failoverState.healthStatus.primary.healthy;
      secondaryHealthy =
        secondaryHealthy && this.failoverState.healthStatus.secondary.healthy;
    }

    // Trigger failover if needed
    if (this.config.enableAutoFailover) {
      if (!primaryHealthy && this.failoverState.currentActive === 'primary') {
        if (secondaryHealthy) {
          await this.triggerFailover('primary_unhealthy');
        } else {
          console.error(
            '✗ CRITICAL: Primary failed and secondary is unhealthy!'
          );
          this.emit('criticalFailure', {
            message: 'Both primary and secondary are unhealthy',
            timestamp: new Date(),
          });
        }
      }
    }

    // Trigger failback if needed
    if (this.config.enableAutoFailback) {
      if (primaryHealthy && this.failoverState.currentActive === 'secondary') {
        await this.triggerFailback();
      }
    }
  }

  async triggerFailover(reason) {
    console.warn(`⚠ FAILOVER TRIGGERED: ${reason}`);

    this.failoverState.currentActive = 'secondary';
    this.failoverState.lastFailover = new Date();
    this.failoverState.failoverCount++;
    this.saveState();

    failoverCounter.inc({ service: 'dispatch', reason });
    activeRegionGauge.set({ service: 'dispatch' }, 1);

    this.emit('failover', {
      reason,
      newActive: 'secondary',
      timestamp: new Date(),
    });

    // Notify team
    await this.notifyTeam({
      type: 'failover',
      severity: 'critical',
      message: `Failover triggered: ${reason}`,
      newActive: 'secondary',
    });
  }

  async triggerFailback() {
    console.log('↩ FAILBACK TRIGGERED: Primary is healthy');

    this.failoverState.currentActive = 'primary';
    this.failoverState.lastFailback = new Date();
    this.failoverState.failbackCount++;
    this.saveState();

    activeRegionGauge.set({ service: 'dispatch' }, 0);

    this.emit('failback', {
      newActive: 'primary',
      timestamp: new Date(),
    });

    // Notify team
    await this.notifyTeam({
      type: 'failback',
      severity: 'info',
      message: 'Failback to primary completed',
      newActive: 'primary',
    });
  }

  async notifyTeam(event) {
    try {
      // Slack notification
      if (process.env.SLACK_WEBHOOK_URL) {
        await axios.post(process.env.SLACK_WEBHOOK_URL, {
          text: `${event.type.toUpperCase()}: ${event.message}`,
          attachments: [
            {
              color: event.severity === 'critical' ? 'danger' : 'good',
              fields: [
                { title: 'Type', value: event.type, short: true },
                { title: 'Severity', value: event.severity, short: true },
                { title: 'New Active', value: event.newActive, short: true },
                { title: 'Time', value: new Date().toISOString(), short: true },
              ],
            },
          ],
        });
      }

      // Email notification
      if (process.env.EMAIL_NOTIFICATION_URL) {
        await axios.post(process.env.EMAIL_NOTIFICATION_URL, {
          subject: `[${event.severity.toUpperCase()}] ${event.type} Event`,
          body: event.message,
          recipients: ['ops-team@ambulance-dispatch.local'],
        });
      }

      // PagerDuty integration
      if (process.env.PAGERDUTY_KEY && event.severity === 'critical') {
        await axios.post('https://events.pagerduty.com/v2/enqueue', {
          routing_key: process.env.PAGERDUTY_KEY,
          event_action: 'trigger',
          dedup_key: `failover-${Date.now()}`,
          payload: {
            summary: event.message,
            severity: event.severity,
            source: 'health-checker',
            custom_details: event,
          },
        });
      }
    } catch (error) {
      console.error('✗ Failed to notify team:', error.message);
    }
  }

  startHealthChecks() {
    console.log(`\n▶ Starting health checks (interval: ${this.config.healthCheckInterval / 1000}s)\n`);

    setInterval(async () => {
      try {
        await this.evaluateFailover();
        failoverStateGauge.set(
          { state: this.failoverState.currentActive },
          1
        );
      } catch (error) {
        console.error('✗ Error during health check:', error);
      }
    }, this.config.healthCheckInterval);

    // Initial check
    this.evaluateFailover();
  }

  getStatus() {
    return {
      currentActive: this.failoverState.currentActive,
      healthStatus: this.failoverState.healthStatus,
      failoverCount: this.failoverState.failoverCount,
      failbackCount: this.failoverState.failbackCount,
      lastFailover: this.failoverState.lastFailover,
      lastFailback: this.failoverState.lastFailback,
      timestamp: new Date(),
    };
  }
}

// Express App Setup
const app = express();
const metricsApp = express();
let healthChecker;

app.use(express.json());

// Health Check Endpoints
app.get('/health', (req, res) => {
  const status = healthChecker.getStatus();
  const isHealthy =
    status.healthStatus.primary.healthy ||
    status.healthStatus.secondary.healthy;

  res.status(isHealthy ? 200 : 503).json(status);
});

app.get('/ready', (req, res) => {
  if (healthChecker.initialized) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

app.get('/status', (req, res) => {
  res.json(healthChecker.getStatus());
});

app.get('/services', (req, res) => {
  res.json({
    services: Object.keys(healthChecker.services),
    count: Object.keys(healthChecker.services).length,
  });
});

app.post('/failover/trigger', (req, res) => {
  const { reason } = req.body;
  healthChecker.triggerFailover(reason || 'manual');
  res.json({ status: 'failover triggered', reason });
});

app.post('/failover/failback', (req, res) => {
  healthChecker.triggerFailback();
  res.json({ status: 'failback triggered' });
});

// Metrics Endpoint
metricsApp.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});

// Event Listeners
process.on('SIGTERM', async () => {
  console.log('\n▶ Gracefully shutting down...');
  server.close(() => {
    console.log('✓ HTTP server closed');
    process.exit(0);
  });
});

// Start Services
async function start() {
  try {
    console.log('\n🚑 Ambulance Dispatch - Health Checker Service\n');

    // Initialize health checker
    healthChecker = new HealthCheckService(config);
    await healthChecker.initialize();

    // Start health checks
    healthChecker.startHealthChecks();

    // Listen for events
    healthChecker.on('failover', (event) => {
      console.log(JSON.stringify(event, null, 2));
    });

    healthChecker.on('failback', (event) => {
      console.log(JSON.stringify(event, null, 2));
    });

    healthChecker.on('criticalFailure', (event) => {
      console.error(JSON.stringify(event, null, 2));
    });

    // Start HTTP server
    const server = http.createServer(app);
    server.listen(config.port, () => {
      console.log(`\n✓ Health Checker API listening on http://localhost:${config.port}`);
      console.log(`  - Health: http://localhost:${config.port}/health`);
      console.log(`  - Ready: http://localhost:${config.port}/ready`);
      console.log(`  - Status: http://localhost:${config.port}/status`);
      console.log(`  - Services: http://localhost:${config.port}/services`);
    });

    // Start metrics server
    const metricsServer = http.createServer(metricsApp);
    metricsServer.listen(config.metricsPort, () => {
      console.log(`✓ Metrics listening on http://localhost:${config.metricsPort}/metrics\n`);
    });

  } catch (error) {
    console.error('✗ Failed to start Health Checker:', error);
    process.exit(1);
  }
}

start();

module.exports = HealthCheckService;
