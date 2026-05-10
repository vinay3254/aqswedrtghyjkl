const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config/config');
const logger = require('./utils/logger');
const db = require('./config/database');
const redis = require('./config/redis');

const { requestLogger, requestId, metricsMiddleware, loggerMiddleware } = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { defaultLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/auth');
const incidentRoutes = require('./routes/incidents');
const ambulanceRoutes = require('./routes/ambulances');
const hospitalRoutes = require('./routes/hospitals');
const assignmentRoutes = require('./routes/assignments');
const driverRoutes = require('./routes/drivers');
const trackingRoutes = require('./routes/tracking');
const analyticsRoutes = require('./routes/analytics');
const healthRoutes = require('./routes/health');
const metricsRoutes = require('./routes/metrics');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.use(cors(config.cors));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestId);

app.use(requestLogger);

app.use(loggerMiddleware);

app.use(metricsMiddleware);

app.set('trust proxy', 1);

app.get('/', (req, res) => {
  res.json({
    service: 'Ambulance Dispatch API Gateway',
    version: '1.0.0',
    status: 'running',
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
});

app.use('/health', healthRoutes);
app.use('/metrics', metricsRoutes);

app.use(defaultLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`🚑 API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${config.env}`);
  logger.info(`API Version: ${config.apiVersion}`);
});

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await db.pool.end();
      logger.info('Database connections closed');
      
      redis.redis.disconnect();
      logger.info('Redis connection closed');
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
