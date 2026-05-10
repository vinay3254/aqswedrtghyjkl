const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { AuthenticationError } = require('../utils/errors');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    const blacklisted = await redis.exists(`blacklist:${token}`);
    if (blacklisted) {
      throw new AuthenticationError('Token has been revoked');
    }

    jwt.verify(token, config.security.jwtSecret, async (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new AuthenticationError('Token has expired'));
        }
        if (err.name === 'JsonWebTokenError') {
          return next(new AuthenticationError('Invalid token'));
        }
        return next(new AuthenticationError('Token verification failed'));
      }

      req.user = decoded;
      
      const cachedUser = await redis.get(`user:${decoded.userId}`);
      if (cachedUser) {
        req.user.userData = cachedUser;
      }

      logger.debug('User authenticated', { userId: decoded.userId, role: decoded.role });
      next();
    });
  } catch (error) {
    next(error);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    jwt.verify(token, config.security.jwtSecret, (err, decoded) => {
      if (!err) {
        req.user = decoded;
      }
      next();
    });
  } catch (error) {
    next();
  }
};

const generateToken = (payload, expiresIn = config.security.jwtExpiresIn) => {
  return jwt.sign(payload, config.security.jwtSecret, { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, config.security.jwtSecret);
};

const blacklistToken = async (token, expiresIn = 86400) => {
  await redis.set(`blacklist:${token}`, true, expiresIn);
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  verifyToken,
  blacklistToken,
};
