const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');
const { AppError } = require('../utils/errors');
const config = require('../config/config');
const metrics = require('../utils/metrics');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  metrics.incrementErrorCount();
  metrics.recordStatusCode(err.statusCode || 500);

  logger.error('Error occurred:', {
    message: error.message,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.userId,
    stack: config.env === 'development' ? error.stack : undefined,
  });

  if (err.name === 'CastError') {
    const message = 'Invalid resource ID format';
    error = new AppError(message, 400);
  }

  if (err.code === '23505') {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 409);
  }

  if (err.code === '23503') {
    const message = 'Referenced resource does not exist';
    error = new AppError(message, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401);
  }

  if (err.type === 'entity.parse.failed') {
    const message = 'Invalid JSON payload';
    error = new AppError(message, 400);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  const response = {
    success: false,
    message,
    ...(error.code && { code: error.code }),
    ...(error.errors && { errors: error.errors }),
    ...(config.env === 'development' && { stack: error.stack }),
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
};

const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  logger.warn('404 Not Found', {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });
  
  return errorResponse(res, message, 404);
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  if (config.env === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
