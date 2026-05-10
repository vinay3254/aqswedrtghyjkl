const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const { RateLimitError } = require('../utils/errors');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const defaultLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: config.rateLimit.message,
  standardHeaders: config.rateLimit.standardHeaders,
  legacyHeaders: config.rateLimit.legacyHeaders,
  handler: (req, res, next) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    next(new RateLimitError());
  },
  skip: (req) => {
    return req.user && req.user.role === 'super_admin';
  },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many requests, please try again later',
  handler: (req, res, next) => {
    logger.warn('Strict rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    next(new RateLimitError('Too many attempts, please try again after 15 minutes'));
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true,
  handler: (req, res, next) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body.email,
    });
    next(new RateLimitError('Too many login attempts, please try again later'));
  },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'API rate limit exceeded',
});

const emergencyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: 'Emergency creation rate limit exceeded',
  handler: (req, res, next) => {
    logger.warn('Emergency rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.userId,
    });
    next(new RateLimitError('Too many emergency reports, please contact support'));
  },
});

const redisRateLimiter = (options = {}) => {
  const {
    windowMs = 60000,
    max = 100,
    prefix = 'rl',
    keyGenerator = (req) => req.ip,
  } = options;

  return async (req, res, next) => {
    try {
      const key = `${prefix}:${keyGenerator(req)}`;
      const current = await redis.redis.incr(key);
      
      if (current === 1) {
        await redis.redis.expire(key, Math.ceil(windowMs / 1000));
      }
      
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
      
      if (current > max) {
        logger.warn('Redis rate limit exceeded', {
          key,
          current,
          max,
        });
        return next(new RateLimitError());
      }
      
      next();
    } catch (error) {
      logger.error('Redis rate limiter error:', error);
      next();
    }
  };
};

module.exports = {
  defaultLimiter,
  strictLimiter,
  authLimiter,
  apiLimiter,
  emergencyLimiter,
  redisRateLimiter,
};
