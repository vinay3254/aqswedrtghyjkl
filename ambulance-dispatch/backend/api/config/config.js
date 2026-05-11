require('dotenv').config();

const parseIntValue = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseIntValue(process.env.PORT, 3000),
  apiVersion: process.env.API_VERSION || 'v1',

  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    bcryptRounds: parseIntValue(process.env.BCRYPT_ROUNDS, 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionsSuccessStatus: 200,
  },

  rateLimit: {
    windowMs: parseIntValue(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: parseIntValue(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ambulance_dispatch',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },

  services: {
    incident: process.env.INCIDENT_SERVICE_URL || 'http://localhost:3010',
    ambulance: process.env.AMBULANCE_SERVICE_URL || 'http://localhost:3011',
    hospital: process.env.HOSPITAL_SERVICE_URL || 'http://localhost:3012',
    tracking: process.env.TRACKING_SERVICE_URL || 'http://localhost:3013',
    analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3014',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  },

  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    healthCheckInterval: parseIntValue(process.env.HEALTH_CHECK_INTERVAL, 30000),
  },

  externalAPIs: {
    geocoding: process.env.GEOCODING_API_KEY,
    maps: process.env.MAPS_API_KEY,
    sms: process.env.SMS_API_KEY,
  },
};

module.exports = config;
