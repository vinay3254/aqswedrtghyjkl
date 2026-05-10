const Redis = require('ioredis');
const logger = require('../../api/middleware/logger');

class RouteCache {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_ROUTING_DB || 2, // Use separate DB for routing
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.redis.on('error', (error) => {
      logger.error('Redis cache error', { error: error.message });
    });

    this.redis.on('connect', () => {
      logger.info('Route cache connected to Redis');
    });

    this.defaultTTL = parseInt(process.env.ROUTE_CACHE_TTL || '300', 10); // 5 minutes
  }

  /**
   * Generate cache key from coordinates
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   * @param {Object} options - Additional options to include in key
   * @returns {String} Cache key
   */
  generateKey(coordinates, options = {}) {
    const coordStr = coordinates
      .map(coord => `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`)
      .join('|');
    
    const optionsStr = Object.keys(options)
      .sort()
      .map(key => `${key}:${options[key]}`)
      .join('|');

    return `route:${coordStr}${optionsStr ? ':' + optionsStr : ''}`;
  }

  /**
   * Get cached route
   * @param {String} key - Cache key
   * @returns {Object|null} Cached route data
   */
  async get(key) {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        logger.debug('Route cache hit', { key });
        return JSON.parse(cached);
      }
      logger.debug('Route cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Cache route data
   * @param {String} key - Cache key
   * @param {Object} data - Route data to cache
   * @param {Number} ttl - Time to live in seconds
   * @returns {Boolean} Success status
   */
  async set(key, data, ttl = this.defaultTTL) {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
      logger.debug('Route cached', { key, ttl });
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Invalidate cached route
   * @param {String} key - Cache key
   * @returns {Boolean} Success status
   */
  async invalidate(key) {
    try {
      await this.redis.del(key);
      logger.debug('Route cache invalidated', { key });
      return true;
    } catch (error) {
      logger.error('Cache invalidate error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Invalidate all routes for a specific region
   * @param {String} pattern - Key pattern to match
   * @returns {Number} Number of keys deleted
   */
  async invalidatePattern(pattern) {
    try {
      const keys = await this.redis.keys(`route:${pattern}*`);
      if (keys.length > 0) {
        const deleted = await this.redis.del(...keys);
        logger.info('Route cache pattern invalidated', { pattern, count: deleted });
        return deleted;
      }
      return 0;
    } catch (error) {
      logger.error('Cache pattern invalidate error', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  async getStats() {
    try {
      const info = await this.redis.info('stats');
      const keys = await this.redis.dbsize();
      
      return {
        totalKeys: keys,
        info: info
      };
    } catch (error) {
      logger.error('Cache stats error', { error: error.message });
      return null;
    }
  }

  /**
   * Clear all route cache
   * @returns {Boolean} Success status
   */
  async clear() {
    try {
      await this.redis.flushdb();
      logger.info('Route cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache clear error', { error: error.message });
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}

module.exports = RouteCache;
