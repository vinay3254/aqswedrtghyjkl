/**
 * Hospital Services Configuration
 * 
 * Default configuration for hospital management services.
 * Override with environment variables.
 */

module.exports = {
  // ========================================================================
  // NOTIFICATION SETTINGS
  // ========================================================================
  
  notification: {
    // Email configuration
    email: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASSWORD || 'your-app-password',
      },
      from: process.env.SMTP_FROM_ADDRESS || 'noreply@ambulance-dispatch.com',
      retryAttempts: 3,
      retryDelay: 5000, // ms
      timeout: 30000, // ms
    },

    // SMS configuration
    sms: {
      provider: process.env.SMS_PROVIDER || 'twilio',
      
      // Twilio
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
        timeout: 10000, // ms
      },

      // AWS SNS
      aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        timeout: 10000, // ms
      },

      // SMS message length limits
      maxLength: 160,
      multiPartLength: 153,
    },

    // API webhook configuration
    api: {
      timeout: 10000, // ms
      retryAttempts: 2,
      retryDelay: 5000, // ms
      useBearer: true,
    },

    // Notification channels
    channels: {
      email: {
        enabled: true,
        priority: 1,
      },
      sms: {
        enabled: true,
        priority: 2,
      },
      api: {
        enabled: true,
        priority: 3,
      },
    },
  },

  // ========================================================================
  // HOSPITAL CONFIRMATION SETTINGS
  // ========================================================================

  confirmation: {
    // Confirmation timeout (milliseconds)
    timeout: 5 * 60 * 1000, // 5 minutes

    // Enable automatic resend pre-alerts on rejection
    autoResendOnRejection: true,

    // Enable alternative hospital search
    findAlternatives: true,

    // Maximum retry attempts for alternative hospitals
    maxAlternativeAttempts: 3,

    // Confirmation tracking
    tracking: {
      enabled: true,
      interval: 30000, // ms - update interval to hospital
      updateDistance: 100, // meters - minimum distance change to send update
    },
  },

  // ========================================================================
  // HANDOVER REPORT SETTINGS
  // ========================================================================

  handoverReport: {
    // Report storage directory
    storageDir: process.env.REPORTS_DIR || './reports/handovers',

    // PDF configuration
    pdf: {
      pageSize: 'A4',
      margins: {
        top: 40,
        right: 40,
        bottom: 40,
        left: 40,
      },
      font: 'Helvetica',
      fontSize: {
        title: 20,
        heading: 12,
        subheading: 11,
        body: 10,
        table: 9,
        footer: 8,
      },
      compression: true,
      compression_level: 9,
    },

    // Report sections
    sections: {
      header: true,
      incidentSummary: true,
      patientInfo: true,
      ambulanceDetails: true,
      hospitalDetails: true,
      vitals: true,
      timeline: true,
      treatments: true,
      signatures: true,
      footer: true,
    },

    // Vitals configuration
    vitals: {
      // Minimum readings for trend analysis
      minReadings: 2,

      // Vital sign ranges for alerts
      ranges: {
        heartRate: {
          normal: [60, 100],
          low: [0, 60],
          high: [100, 200],
          critical: [0, 40, 140, 200],
        },
        bloodPressure: {
          normal: ['90/60', '120/80'],
          low: [0, 90, 0, 60],
          high: [140, 90],
          critical: [0, 60, 180, 120],
        },
        oxygenSaturation: {
          normal: [95, 100],
          low: [85, 95],
          critical: [0, 85],
        },
        respiratoryRate: {
          normal: [12, 20],
          low: [0, 12],
          high: [20, 60],
          critical: [0, 8, 30, 60],
        },
        temperature: {
          normal: [36.5, 37.5],
          low: [0, 36.5],
          high: [37.5, 41],
          critical: [0, 35, 40, 50],
        },
      },
    },

    // Retention policies
    retention: {
      enabled: true,
      keepForDays: 365 * 7, // 7 years
      archiveAfterDays: 365 * 2, // 2 years
    },
  },

  // ========================================================================
  // FEEDBACK COLLECTION SETTINGS
  // ========================================================================

  feedback: {
    // Feedback request delay after incident
    requestDelayMinutes: 1,

    // Feedback survey configuration
    survey: {
      patient: {
        enabled: true,
        maxQuestions: 7,
        timeoutDays: 7,
      },
      hospital: {
        enabled: true,
        maxQuestions: 7,
        timeoutDays: 7,
      },
    },

    // Token configuration
    token: {
      length: 32,
      expiryDays: 30,
      hashAlgorithm: 'sha256',
    },

    // Rating scale configuration
    rating: {
      scale: 5,
      minRating: 1,
      maxRating: 5,
      weights: {
        1: 'Very Poor',
        2: 'Poor',
        3: 'Average',
        4: 'Good',
        5: 'Excellent',
      },
    },

    // Sentiment analysis
    sentiment: {
      enabled: true,
      keywords: {
        positive: [
          'excellent', 'great', 'good', 'amazing', 'wonderful',
          'helpful', 'professional', 'quick', 'efficient', 'satisfied',
          'impressed', 'outstanding', 'exemplary', 'fantastic'
        ],
        negative: [
          'poor', 'bad', 'terrible', 'awful', 'slow',
          'unprofessional', 'rude', 'unhelpful', 'dissatisfied',
          'disappointed', 'inadequate', 'unacceptable'
        ],
      },
    },

    // Hospital metrics tracking
    metrics: {
      trackRejections: true,
      trackRatings: true,
      calculateAverages: true,
      updateFrequency: 'daily', // 'realtime', 'hourly', 'daily'
    },

    // Email feedback requests
    emailRequest: {
      enabled: true,
      template: 'feedback-request-patient',
      sender: 'feedback@ambulance-dispatch.com',
      retryAttempts: 2,
      retryDelay: 86400000, // 24 hours
    },

    // SMS feedback requests
    smsRequest: {
      enabled: true,
      template: 'feedback-sms-short',
      maxLength: 160,
    },

    // Feedback URLs
    urls: {
      patient: process.env.PATIENT_FEEDBACK_URL || 'https://app.ambulance-dispatch.com/feedback/patient',
      hospital: process.env.HOSPITAL_FEEDBACK_URL || 'https://app.ambulance-dispatch.com/feedback/hospital',
    },
  },

  // ========================================================================
  // DISPATCH CENTER SETTINGS
  // ========================================================================

  dispatchCenter: {
    phone: process.env.DISPATCH_CENTER_PHONE || '+1-555-0100',
    email: process.env.DISPATCH_CENTER_EMAIL || 'dispatch@ambulance-dispatch.com',
    operatingHours: {
      start: '00:00',
      end: '23:59',
      timezone: 'UTC',
    },
  },

  // ========================================================================
  // LOGGING SETTINGS
  // ========================================================================

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    outputs: ['console', 'file'],
    file: {
      directory: process.env.LOGS_DIR || './logs/hospital-services',
      maxSize: '10m',
      maxFiles: '14d',
      filename: 'hospital-services-%DATE%.log',
    },
  },

  // ========================================================================
  // PERFORMANCE SETTINGS
  // ========================================================================

  performance: {
    // Parallel notification sending
    parallelNotifications: true,
    maxConcurrent: 10,

    // Database connection pooling
    database: {
      pool: {
        min: 2,
        max: 10,
        idle: 30000,
        acquire: 30000,
      },
    },

    // Cache configuration
    cache: {
      enabled: true,
      ttl: 3600, // seconds
      provider: 'memory', // 'memory', 'redis'
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || null,
      },
    },

    // Rate limiting
    rateLimit: {
      enabled: true,
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      perEndpoint: {
        confirmation: 50,
        feedback: 20,
        report: 10,
      },
    },
  },

  // ========================================================================
  // SECURITY SETTINGS
  // ========================================================================

  security: {
    // HTTPS enforcement
    https: {
      enabled: true,
      requireCert: true,
    },

    // API key validation
    apiKey: {
      enabled: true,
      headerName: 'x-api-key',
      validateOnEveryRequest: true,
    },

    // CORS configuration
    cors: {
      enabled: true,
      origins: [
        process.env.ADMIN_DASHBOARD_URL || 'https://admin.ambulance-dispatch.com',
        process.env.HOSPITAL_PORTAL_URL || 'https://hospitals.ambulance-dispatch.com',
      ],
      credentials: true,
    },

    // Data encryption
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      keyRotation: 'monthly',
    },

    // Audit logging
    audit: {
      enabled: true,
      logAllRequests: false,
      logFailuresOnly: true,
    },
  },

  // ========================================================================
  // FEATURE FLAGS
  // ========================================================================

  features: {
    // Pre-alert features
    multiChannelNotification: true,
    hospitalCapabilityMatching: true,
    customHandoverInstructions: true,

    // Confirmation features
    automaticAlternativeHospital: true,
    confirmationTimeout: true,
    hospitalTracking: true,

    // Report features
    pdfGeneration: true,
    digitalReport: true,
    autoReportGeneration: true,
    signatureSection: true,

    // Feedback features
    patientFeedback: true,
    hospitalFeedback: true,
    sentimentAnalysis: true,
    performanceMetrics: true,

    // Advanced features
    mlRecommendations: false,
    blockchainAudit: false,
    multiLanguageSupport: false,
    mobileAppIntegration: false,
  },

  // ========================================================================
  // NOTIFICATION TEMPLATES
  // ========================================================================

  templates: {
    // Email templates directory
    emailTemplatesDir: './templates/email',
    
    // SMS templates directory
    smsTemplatesDir: './templates/sms',

    // Available templates
    available: {
      email: [
        'pre-alert-notification',
        'feedback-request-patient',
        'feedback-request-hospital',
        'confirmation-cancelled',
      ],
      sms: [
        'pre-alert-sms',
        'feedback-sms-short',
        'confirmation-timeout',
      ],
    },
  },

  // ========================================================================
  // COMPLIANCE & REGULATIONS
  // ========================================================================

  compliance: {
    // GDPR compliance
    gdpr: {
      enabled: true,
      consentRequired: true,
      dataRetentionDays: 365 * 7, // 7 years
      anonymizeAfterDays: 365 * 3, // 3 years
    },

    // HIPAA compliance
    hipaa: {
      enabled: true,
      encryptedStorage: true,
      accessLogging: true,
      auditTrails: true,
    },

    // Document retention
    docRetention: {
      reports: 365 * 7, // 7 years
      feedback: 365 * 3, // 3 years
      communications: 365 * 2, // 2 years
    },

    // Audit trail
    auditTrail: {
      enabled: true,
      captureAll: true,
      storageBackend: 'database', // 'database', 'elasticsearch'
    },
  },

  // ========================================================================
  // ALERTS & ESCALATION
  // ========================================================================

  alerts: {
    // Critical alerts
    critical: {
      enabled: true,
      channels: ['email', 'sms', 'slack'],
      recipients: [process.env.ADMIN_EMAIL || 'admin@ambulance-dispatch.com'],
    },

    // Escalation rules
    escalation: {
      noHospitalAvailable: {
        delay: 60000, // 1 minute
        escalateTo: 'supervisor',
      },
      confirmationTimeout: {
        delay: 0,
        escalateTo: 'dispatcher',
      },
      highRejectionRate: {
        threshold: 0.5, // 50% rejection rate
        escalateTo: 'coordinator',
      },
    },

    // Metrics thresholds
    thresholds: {
      preAlertFailure: 0.1, // 10%
      confirmationTimeout: 0.2, // 20%
      hospitalRejection: 0.5, // 50%
      lowFeedbackRating: 3.0, // Below 3 stars
    },
  },

  // ========================================================================
  // INTEGRATION ENDPOINTS
  // ========================================================================

  integrations: {
    // Hospital information systems
    his: {
      enabled: true,
      baseUrl: process.env.HIS_BASE_URL || 'http://localhost:3001',
      apiKey: process.env.HIS_API_KEY || '',
      timeout: 10000,
    },

    // Ambulance fleet management
    fleet: {
      enabled: true,
      baseUrl: process.env.FLEET_BASE_URL || 'http://localhost:3002',
      apiKey: process.env.FLEET_API_KEY || '',
      timeout: 5000,
    },

    // Analytics platform
    analytics: {
      enabled: true,
      baseUrl: process.env.ANALYTICS_BASE_URL || 'http://localhost:3003',
      apiKey: process.env.ANALYTICS_API_KEY || '',
      timeout: 10000,
    },

    // Notification service
    notifications: {
      enabled: true,
      baseUrl: process.env.NOTIFICATIONS_BASE_URL || 'http://localhost:3004',
      apiKey: process.env.NOTIFICATIONS_API_KEY || '',
      timeout: 5000,
    },
  },
};

// Export configuration validator
function validateConfig(config) {
  const errors = [];

  // Validate required settings
  if (!config.notification.email.auth.user) {
    errors.push('SMTP_USER environment variable is required');
  }

  if (!config.notification.email.auth.pass) {
    errors.push('SMTP_PASSWORD environment variable is required');
  }

  if (config.notification.sms.provider === 'twilio') {
    if (!config.notification.sms.twilio.accountSid) {
      errors.push('TWILIO_ACCOUNT_SID environment variable is required');
    }
    if (!config.notification.sms.twilio.authToken) {
      errors.push('TWILIO_AUTH_TOKEN environment variable is required');
    }
  }

  if (errors.length > 0) {
    console.error('Configuration validation errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  return true;
}

module.exports.validateConfig = validateConfig;
