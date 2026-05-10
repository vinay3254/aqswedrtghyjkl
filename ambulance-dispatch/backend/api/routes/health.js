const express = require('express');
const router = express.Router();
const db = require('../config/database');
const redis = require('../config/redis');
const config = require('../config/config');
const { successResponse, errorResponse } = require('../utils/response');
const axios = require('axios');

router.get('/', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    const redisHealth = await redis.healthCheck();

    const services = {};
    
    const serviceChecks = Object.entries(config.services).map(async ([name, url]) => {
      try {
        await axios.get(`${url}/health`, { timeout: 2000 });
        services[name] = 'healthy';
      } catch (error) {
        services[name] = 'unhealthy';
      }
    });

    await Promise.allSettled(serviceChecks);

    const isHealthy = dbHealth.healthy && redisHealth.healthy;

    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
      database: {
        status: dbHealth.healthy ? 'connected' : 'disconnected',
        ...dbHealth,
      },
      redis: {
        status: redisHealth.healthy ? 'connected' : 'disconnected',
        ...redisHealth,
      },
      services,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };

    if (isHealthy) {
      return successResponse(res, healthData, 'Service is healthy');
    } else {
      return errorResponse(res, 'Service is degraded', 503, healthData);
    }
  } catch (error) {
    return errorResponse(res, 'Health check failed', 503, {
      error: error.message,
    });
  }
});

router.get('/ready', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    const redisHealth = await redis.healthCheck();

    if (dbHealth.healthy && redisHealth.healthy) {
      return successResponse(res, { ready: true }, 'Service is ready');
    } else {
      return errorResponse(res, 'Service is not ready', 503, {
        ready: false,
        database: dbHealth.healthy,
        redis: redisHealth.healthy,
      });
    }
  } catch (error) {
    return errorResponse(res, 'Readiness check failed', 503);
  }
});

router.get('/live', (req, res) => {
  successResponse(res, { alive: true }, 'Service is alive');
});

module.exports = router;
