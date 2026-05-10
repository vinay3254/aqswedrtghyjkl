/**
 * Offline Routing Configuration Template
 * Customize these settings for your deployment
 */

module.exports = {
  // =========================================================================
  // Cache Configuration
  // =========================================================================
  cache: {
    // Directory where offline tiles and data are stored
    cacheDir: process.env.CACHE_DIR || './offline-cache',

    // Maximum cache size in bytes (500MB default)
    maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '524288000'),

    // OSM tile provider URL
    tileProvider: process.env.TILE_PROVIDER || 'https://tile.openstreetmap.org',

    // Zoom levels to cache (12-16 recommended for ambulance routing)
    zoomLevels: [12, 13, 14, 15, 16],

    // Maximum concurrent tile downloads (3 recommended to avoid rate limiting)
    maxConcurrentDownloads: 3,

    // Cache expiration time in milliseconds (30 days)
    cacheExpiration: 30 * 24 * 60 * 60 * 1000
  },

  // =========================================================================
  // Router Configuration
  // =========================================================================
  router: {
    // Search radius for finding nearby road network nodes (degrees)
    searchRadius: 0.01, // ~1km at equator

    // Maximum route length in meters
    maxPathLength: 50000, // 50km

    // Maximum number of routes to cache
    maxRouteCache: 1000,

    // Heuristic function for A* algorithm
    heuristics: 'haversine', // 'haversine' or 'euclidean'

    // Road type weights (1.0 = baseline)
    roadTypeWeights: {
      motorway: 0.5,      // Fastest, prefer for ambulances
      trunk: 0.6,
      primary: 0.8,
      secondary: 1.0,
      tertiary: 1.2,
      residential: 1.5,
      service: 2.0,
      footway: 5.0        // Slowest, avoid for ambulances
    },

    // Default avoidance penalty multiplier
    avoidancePenalty: 5.0
  },

  // =========================================================================
  // Sync Configuration
  // =========================================================================
  sync: {
    // API base URL for synchronization
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',

    // Periodic sync interval in milliseconds (5 minutes)
    syncInterval: parseInt(process.env.SYNC_INTERVAL || '300000'),

    // Maximum number of retry attempts
    maxRetries: 3,

    // Initial retry delay in milliseconds (with exponential backoff)
    retryDelay: 1000,

    // Sync token for authentication (from secure storage in production)
    syncToken: process.env.SYNC_TOKEN || 'offline-sync-token',

    // High-priority change types that sync first
    priorityChangeTypes: ['decision', 'ambulance-update', 'incident'],

    // Rate limiting: maximum changes to sync per minute
    rateLimitPerMinute: 60
  },

  // =========================================================================
  // Storage Optimization Configuration
  // =========================================================================
  storage: {
    // Compression algorithm to use
    compressionAlgorithm: 'gzip', // 'gzip' or 'deflate'

    // Compression level (1-9, higher = more compression but slower)
    compressionLevel: 6,

    // Enable deduplication of identical files
    deduplicationEnabled: true,

    // Periodic optimization interval in milliseconds (24 hours)
    optimizationInterval: 24 * 60 * 60 * 1000,

    // Minimum file size to compress (bytes)
    minCompressionSize: 1024 * 100, // 100KB

    // File cleanup age threshold (days)
    cleanupAgeDays: 30
  },

  // =========================================================================
  // Districts Configuration
  // =========================================================================
  districts: [
    {
      id: 'downtown',
      name: 'Downtown Business District',
      boundary: {
        north: 40.7580,
        south: 40.7489,
        east: -73.9855,
        west: -73.9971
      },
      priority: 10,
      cache: true,
      maxTiles: 500,
      description: 'High incident density, financial district'
    },
    {
      id: 'hospital-district',
      name: 'Hospital & Medical Center',
      boundary: {
        north: 40.7700,
        south: 40.7600,
        east: -73.9500,
        west: -73.9700
      },
      priority: 10,
      cache: true,
      maxTiles: 400,
      description: 'Critical for emergency response'
    },
    {
      id: 'airport',
      name: 'Airport Region',
      boundary: {
        north: 40.7800,
        south: 40.7600,
        east: -73.9000,
        west: -73.8800
      },
      priority: 8,
      cache: true,
      maxTiles: 300,
      description: 'High-speed access routes'
    },
    {
      id: 'residential',
      name: 'Residential Area',
      boundary: {
        north: 40.8500,
        south: 40.7500,
        east: -73.9000,
        west: -74.0000
      },
      priority: 6,
      cache: false, // Cache on demand
      maxTiles: 800,
      description: 'Residential neighborhoods'
    },
    {
      id: 'industrial',
      name: 'Industrial Zone',
      boundary: {
        north: 40.7400,
        south: 40.7200,
        east: -73.8600,
        west: -73.8400
      },
      priority: 4,
      cache: false,
      maxTiles: 200,
      description: 'Industrial area, lower incident frequency'
    }
  ],

  // =========================================================================
  // Avoidance Zones Configuration
  // =========================================================================
  avoidanceZones: [
    {
      id: 'construction-5th-ave',
      name: '5th Avenue Construction',
      boundary: {
        north: 40.7560,
        south: 40.7540,
        east: -73.9755,
        west: -73.9775
      },
      penalty: 10.0,
      temporary: true,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    },
    {
      id: 'flood-zone-riverside',
      name: 'Flood Zone - Riverside',
      boundary: {
        north: 40.7400,
        south: 40.7300,
        east: -73.9800,
        west: -73.9900
      },
      penalty: 8.0,
      temporary: true,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
    }
  ],

  // =========================================================================
  // Ambulance & Hospital Configuration
  // =========================================================================
  ambulances: {
    // Default ambulance speed for routing (km/h)
    averageSpeed: 40,

    // Average response time to start moving (seconds)
    responseTime: 60,

    // Location update interval when online (seconds)
    updateInterval: 30,

    // Location update interval when offline (minutes)
    offlineUpdateInterval: 5
  },

  hospitals: {
    // Primary hospital dispatch center
    primaryHospital: {
      id: 'hospital-1',
      name: 'Central Medical Center',
      location: { lat: 40.7700, lon: -73.9550 },
      maxCapacity: 100,
      specialties: ['trauma', 'cardiac', 'pediatric'],
      contactPhone: '+1-555-0100'
    },

    // Secondary hospitals
    secondaryHospitals: [
      {
        id: 'hospital-2',
        name: 'East Side Medical',
        location: { lat: 40.7650, lon: -73.9450 },
        maxCapacity: 75,
        specialties: ['general', 'orthopedic']
      },
      {
        id: 'hospital-3',
        name: 'West Park Hospital',
        location: { lat: 40.7750, lon: -73.9700 },
        maxCapacity: 60,
        specialties: ['general', 'psychiatric']
      }
    ]
  },

  // =========================================================================
  // Feature Flags
  // =========================================================================
  features: {
    // Enable offline routing
    offlineRouting: true,

    // Enable automatic district caching
    autoDistrictCaching: true,

    // Enable predictive caching based on history
    predictiveCaching: true,

    // Enable conflict detection on sync
    conflictDetection: true,

    // Enable automatic storage optimization
    autoOptimization: true,

    // Enable voice directions
    voiceDirections: false,

    // Enable traffic prediction
    trafficPrediction: false,

    // Enable multi-modal routing (vehicle + air)
    multiModalRouting: false
  },

  // =========================================================================
  // Logging Configuration
  // =========================================================================
  logging: {
    // Log level ('debug', 'info', 'warn', 'error')
    level: process.env.LOG_LEVEL || 'info',

    // Enable detailed performance metrics
    enableMetrics: true,

    // Log destination ('console', 'file', 'both')
    destination: 'console',

    // Log file path (if using file logging)
    logFile: process.env.LOG_FILE || './logs/offline-routing.log',

    // Maximum log file size before rotation (bytes)
    maxFileSize: 10 * 1024 * 1024,

    // Number of log files to keep
    maxFiles: 10
  },

  // =========================================================================
  // Performance Tuning
  // =========================================================================
  performance: {
    // Use memory-mapped files for large caches
    useMemoryMapping: true,

    // Worker thread pool size for processing
    workerThreads: 4,

    // Enable request batching for sync
    enableBatching: true,

    // Maximum batch size for sync
    maxBatchSize: 100,

    // Route calculation timeout (milliseconds)
    routeTimeout: 5000,

    // Tile download timeout (milliseconds)
    downloadTimeout: 10000
  },

  // =========================================================================
  // Development & Testing
  // =========================================================================
  development: {
    // Enable debug mode
    debug: process.env.NODE_ENV !== 'production',

    // Use mock data instead of real API
    useMockData: false,

    // Simulated network latency (milliseconds)
    simulatedLatency: 0,

    // Random failure rate for testing (0-1)
    randomFailureRate: 0
  }
};

/**
 * Environment-specific configurations
 */
const environmentConfigs = {
  development: {
    cache: { maxCacheSize: 100 * 1024 * 1024 }, // 100MB for dev
    sync: { syncInterval: 60000 }, // 1 minute
    logging: { level: 'debug' }
  },

  staging: {
    cache: { maxCacheSize: 300 * 1024 * 1024 }, // 300MB for staging
    sync: { syncInterval: 5 * 60 * 1000 }, // 5 minutes
    logging: { level: 'info' }
  },

  production: {
    cache: { maxCacheSize: 500 * 1024 * 1024 }, // 500MB for production
    sync: { syncInterval: 10 * 60 * 1000 }, // 10 minutes
    logging: { level: 'warn' },
    performance: { workerThreads: 8 }
  }
};

/**
 * Merge environment config with base config
 */
function getConfig(environment = process.env.NODE_ENV || 'development') {
  const baseConfig = module.exports;
  const envConfig = environmentConfigs[environment] || {};

  return deepMerge(baseConfig, envConfig);
}

/**
 * Deep merge objects
 */
function deepMerge(base, override) {
  const result = { ...base };

  for (const key in override) {
    if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = deepMerge(base[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }

  return result;
}

module.exports.getConfig = getConfig;
module.exports.deepMerge = deepMerge;
