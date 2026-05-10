/**
 * USSD Service Configuration Examples
 * Copy this file to config.js and update with your credentials
 */

module.exports = {
  // ============================================================================
  // USSD SERVER CONFIGURATION
  // ============================================================================
  ussdServer: {
    port: process.env.USSD_PORT || 3001,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    sessionTimeout: 600, // 10 minutes in seconds
    maxRetries: 3,
    ussdProviders: ['africas-talking', 'twilio'],
    // Webhook endpoints
    webhooks: {
      africasTalking: '/webhook/africas-talking',
      twilio: '/webhook/twilio',
      generic: '/webhook/generic',
    },
  },

  // ============================================================================
  // AFRICA'S TALKING CONFIGURATION
  // ============================================================================
  africasTalking: {
    enabled: true,
    apiKey: process.env.AFRICAS_TALKING_API_KEY || 'your_api_key',
    username: process.env.AFRICAS_TALKING_USERNAME || 'your_username',
    endpoint: 'https://api.sandbox.africastalking.com', // or production
    // USSD short code configuration
    ussd: {
      shortCode: '*384*5436#', // Your USSD short code
      timeout: 180, // Session timeout in Africa's Talking (seconds)
    },
  },

  // ============================================================================
  // TWILIO CONFIGURATION
  // ============================================================================
  twilio: {
    enabled: false,
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'your_account_sid',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'your_auth_token',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
    conversationSid: 'your_conversation_sid',
  },

  // ============================================================================
  // LOCATION RESOLVER CONFIGURATION
  // ============================================================================
  locationConfig: {
    // Cell Tower API Configuration
    cellTowerApi: 'https://api.cellinfo.io',
    cellTowerKey: process.env.CELL_TOWER_API_KEY || 'your_cell_tower_key',

    // Google Maps API Configuration
    googleMapsApi: 'https://maps.googleapis.com/maps/api',
    googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || 'your_google_maps_key',

    // OpenCage Data Configuration (Recommended for Africa)
    openCageApi: 'https://api.opencagedata.com',
    openCageKey: process.env.OPENCAGE_API_KEY || 'your_opencage_key',

    // Cache settings
    cacheLocationTTL: 3600000, // 1 hour in milliseconds
    cacheMaxSize: 1000, // Maximum cached locations

    // Network operator location mappings
    operatorLocations: {
      // Kenya operators
      '63902': { carrier: 'Safaricom', region: 'Kenya', country: 'KE' },
      '63907': { carrier: 'Airtel', region: 'Kenya', country: 'KE' },
      '63904': { carrier: 'Idea', region: 'Kenya', country: 'KE' },
      '63903': { carrier: 'Orange', region: 'Kenya', country: 'KE' },

      // Uganda operators
      '25641': { carrier: 'MTN Uganda', region: 'Uganda', country: 'UG' },
      '25640': { carrier: 'Airtel Uganda', region: 'Uganda', country: 'UG' },

      // Other countries - add as needed
    },

    // Location accuracy thresholds (in meters)
    accuracyThresholds: {
      gps: 10, // ±10 meters
      cellTower: 500, // ±500 meters
      networkOperator: 50000, // ±50 kilometers
    },

    // Reverse geocoding providers
    reverseGeocoding: {
      primary: 'opencage', // 'opencage' or 'google'
      fallback: 'google',
      timeout: 5000, // milliseconds
    },
  },

  // ============================================================================
  // SMS FALLBACK CONFIGURATION
  // ============================================================================
  smsConfig: {
    // SMS Gateway Configuration
    smsGatewayUrl: process.env.SMS_GATEWAY_URL || 'https://api.sms-provider.com',
    smsGatewayKey: process.env.SMS_GATEWAY_KEY || 'your_sms_gateway_key',
    smsProvider: 'africas-talking', // 'africas-talking', 'twilio', 'custom'

    // Fallback SMS settings
    fallbackNumbers: [
      process.env.DISPATCH_CENTER_PHONE_1 || '+254701234567',
      process.env.DISPATCH_CENTER_PHONE_2 || '+254702234567',
    ],

    // SMS timeout triggers
    ussdTimeoutThreshold: 30000, // milliseconds
    maxUSSDRetries: 2,
    autoFallbackAfterRetries: true,

    // Intent detection keywords
    keywords: {
      medical: [
        'medical',
        'sick',
        'pain',
        'health',
        'hospital',
        'doctor',
        'chest',
        'breath',
        'unconscious',
        'bleeding',
        'help',
        'urgent',
      ],
      accident: [
        'accident',
        'crash',
        'collision',
        'hit',
        'emergency',
        'injured',
        'fire',
        'burn',
      ],
      ambulance: ['ambulance', 'help', 'emergency', 'urgent'],
    },

    // Confidence thresholds
    confidenceThresholds: {
      autoDispatch: 0.8, // Auto-dispatch if ≥ 80%
      requireConfirmation: 0.5, // Request confirmation if 50-80%
      requireClarification: 0.3, // Ask for clarification if < 30%
    },

    // Session management
    sessionTimeout: 1800000, // 30 minutes in milliseconds
    maxSMSInSession: 5,

    // SMS message templates
    messageTemplates: {
      fallbackInitial:
        'Emergency Services: USSD unavailable. Reply with emergency type (MEDICAL/ACCIDENT) or call 911.',
      confirmationRequest:
        'We detected a %type% emergency. Reply YES to dispatch an ambulance or NO to cancel.',
      dispatchConfirmation:
        'Ambulance Dispatched! Incident ID: %incidentId%. Help is on the way.',
      clarificationRequest:
        'Do you need emergency assistance? Reply MEDICAL, ACCIDENT, or call 911 directly.',
    },
  },

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================
  logging: {
    level: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
    format: 'json', // 'json' or 'text'
    output: 'console', // 'console', 'file', or 'both'
    logFile: '/var/log/ussd-service.log',
    requestLogging: true,
    performanceLogging: true,
    logSensitiveData: false, // Never log phone numbers, locations in production
  },

  // ============================================================================
  // DISPATCH SERVICE INTEGRATION
  // ============================================================================
  dispatchService: {
    apiUrl: process.env.DISPATCH_SERVICE_URL || 'http://localhost:3000/api',
    apiKey: process.env.DISPATCH_SERVICE_KEY || 'your_api_key',
    timeout: 5000, // milliseconds
    retries: 3,
    endpoints: {
      createIncident: '/incidents',
      updateIncident: '/incidents/:id',
      getTracking: '/incidents/:id/tracking',
    },
  },

  // ============================================================================
  // SECURITY CONFIGURATION
  // ============================================================================
  security: {
    // Rate limiting
    rateLimiting: {
      enabled: true,
      windowMs: 60000, // 1 minute
      maxRequestsPerWindow: 100,
      maxSessionsPerPhone: 5, // Max concurrent sessions per phone
    },

    // Input validation
    validation: {
      maxPhoneNumberLength: 15,
      maxUserInputLength: 160,
      sanitizeInput: true,
    },

    // Session security
    sessionSecurity: {
      requireTLS: true,
      sessionSecret: process.env.SESSION_SECRET || 'your_session_secret',
      encryptSessionData: true,
      keyRotation: 'weekly',
    },

    // API security
    cors: {
      enabled: true,
      origins: [process.env.ALLOWED_ORIGIN || 'http://localhost:3000'],
      credentials: true,
    },

    // Audit logging
    auditLog: {
      enabled: true,
      logAllRequests: false, // Set to true for compliance
      logIncidents: true,
      logDispatch: true,
    },
  },

  // ============================================================================
  // PERFORMANCE CONFIGURATION
  // ============================================================================
  performance: {
    // Connection pooling
    redis: {
      maxConnections: 50,
      connectionTimeout: 10000,
      idleTimeout: 30000,
    },

    // Caching strategies
    cache: {
      enableLocationCache: true,
      enableMenuCache: true,
      cacheTTL: 3600000, // 1 hour
    },

    // Batch processing
    batch: {
      enabled: true,
      batchSize: 100,
      batchInterval: 5000, // milliseconds
    },

    // Request timeouts
    timeouts: {
      locationApi: 5000,
      geocodeApi: 5000,
      dispatchApi: 5000,
      smsGateway: 10000,
    },
  },

  // ============================================================================
  // DATABASE CONFIGURATION
  // ============================================================================
  database: {
    // Redis configuration
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      tls: process.env.REDIS_TLS === 'true',
    },

    // Optional: PostgreSQL for persistent storage
    postgres: {
      enabled: false,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ambulance_dispatch',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true',
    },
  },

  // ============================================================================
  // ANALYTICS & MONITORING
  // ============================================================================
  analytics: {
    enabled: true,
    provider: 'application-insights', // 'application-insights', 'datadog', 'newrelic'
    apiKey: process.env.ANALYTICS_KEY,

    // Metrics to track
    metrics: {
      trackSessionCreation: true,
      trackMenuNavigation: true,
      trackLocationResolution: true,
      trackDispatch: true,
      trackSMSFallback: true,
      trackErrorRate: true,
      trackResponseTime: true,
    },

    // Alert thresholds
    alerts: {
      errorRateThreshold: 0.05, // 5%
      responseTimeThreshold: 5000, // 5 seconds
      failedDispatchThreshold: 0.1, // 10%
    },
  },

  // ============================================================================
  // TESTING CONFIGURATION
  // ============================================================================
  testing: {
    enabled: process.env.NODE_ENV === 'test',
    mockProviders: true,
    mockLocationApi: true,
    mockSmsGateway: true,
    seedData: {
      testPhoneNumbers: [
        '+254712345678',
        '+254722456789',
        '+254733567890',
      ],
      testNetworkCodes: [
        '63902', // Safaricom Kenya
        '63907', // Airtel Kenya
        '63904', // Idea Kenya
      ],
    },
  },

  // ============================================================================
  // ENVIRONMENT-SPECIFIC SETTINGS
  // ============================================================================
  environments: {
    development: {
      logLevel: 'debug',
      ussdProviders: ['africas-talking'],
      mockProviders: true,
      enableDetailedLogging: true,
    },

    staging: {
      logLevel: 'info',
      ussdProviders: ['africas-talking', 'twilio'],
      enableDetailedLogging: true,
      rateLimitingMaxRequests: 500,
    },

    production: {
      logLevel: 'warn',
      ussdProviders: ['africas-talking', 'twilio'],
      enableDetailedLogging: false,
      rateLimitingMaxRequests: 1000,
      requireTLS: true,
      auditLogAllRequests: true,
    },
  },
};
