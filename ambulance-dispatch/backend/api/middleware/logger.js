const morgan = require('morgan');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const { v4: uuidv4 } = require('uuid');

const requestLogger = morgan(
  ':remote-addr :method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }
);

const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  metrics.incrementRequestCount();
  metrics.recordMethod(req.method);
  
  const originalPath = req.route?.path || req.path;
  metrics.recordEndpoint(originalPath);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.recordResponseTime(duration);
    metrics.recordStatusCode(res.statusCode);

    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.userId,
    });
  });

  next();
};

const loggerMiddleware = (req, res, next) => {
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
  });
  next();
};

const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });
  
  return sanitized;
};

module.exports = {
  requestLogger,
  requestId,
  metricsMiddleware,
  loggerMiddleware,
};
