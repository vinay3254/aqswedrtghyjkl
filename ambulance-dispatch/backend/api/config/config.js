require('dotenv').config();

const parseIntValue = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildDatabaseConfig = () => {
  const baseConfig = {
    max: parseIntValue(process.env.DB_MAX_POOL, 20),
    idleTimeoutMillis: parseIntValue(process.env.DB_IDLE_TIMEOUT, 30000),
    connectionTimeoutMillis: parseIntValue(process.env.DB_CONNECTION_TIMEOUT, 2000),
  };

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ...baseConfig,
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseIntValue(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || 'ambulance_dispatch',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'changeme',
    ...baseConfig,
  };
};

const buildRedisConfig = () => {
  const baseConfig = {
    ttl: parseIntValue(process.env.REDIS_TTL, 3600),
  };

  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      ...baseConfig,
    };
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseIntValue(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseIntValue(process.env.REDIS_DB, 0),
    ...baseConfig,
  };
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
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001', 'http://localhost:3002'],
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

  database: buildDatabaseConfig(),

  redis: buildRedisConfig(),

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
