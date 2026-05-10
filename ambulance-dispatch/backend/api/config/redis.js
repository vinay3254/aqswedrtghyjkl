const Redis = require('ioredis');
const config = require('./config');
const logger = require('../utils/logger');

const baseOptions = {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};

const redis = config.redis.url
  ? new Redis(config.redis.url, baseOptions)
  : new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      ...baseOptions,
    });

redis.on('connect', () => {
  logger.info('Redis connection established');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('ready', () => {
  logger.info('Redis is ready');
});

const get = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis GET error:', { key, error: error.message });
    return null;
  }
};

const set = async (key, value, ttl = config.redis.ttl) => {
  try {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.error('Redis SET error:', { key, error: error.message });
    return false;
  }
};

const del = async (key) => {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('Redis DEL error:', { key, error: error.message });
    return false;
  }
};

const exists = async (key) => {
  try {
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error('Redis EXISTS error:', { key, error: error.message });
    return false;
  }
};

const healthCheck = async () => {
  try {
    const pong = await redis.ping();
    return { healthy: pong === 'PONG', response: pong };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return { healthy: false, error: error.message };
  }
};

module.exports = {
  redis,
  get,
  set,
  del,
  exists,
  healthCheck,
};
