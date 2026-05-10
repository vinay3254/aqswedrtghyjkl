/**
 * Offline Routing Integration Example
 * Demonstrates how to integrate all offline routing components
 */

const MapCacheManager = require('./map-cache-manager');
const OfflineRouter = require('./offline-router');
const SyncManager = require('./sync-manager');
const StorageOptimizer = require('./storage-optimizer');
const EventEmitter = require('events');

class OfflineRoutingService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      cacheDir: config.cacheDir || './offline-cache',
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:3000/api',
      maxCacheSize: config.maxCacheSize || 500 * 1024 * 1024,
      zoomLevels: config.zoomLevels || [12, 13, 14, 15, 16],
      syncInterval: config.syncInterval || 5 * 60 * 1000,
      logger: config.logger || console,
      ...config
    };

    this.cacheManager = null;
    this.router = null;
    this.syncManager = null;
    this.optimizer = null;
    this.isInitialized = false;
    this.isOnline = config.isOnline !== false;
  }

  /**
   * Initialize all components
   */
  async initialize() {
    try {
      this.config.logger.log('[OfflineRoutingService] Initializing...');

      // Initialize cache manager
      this.cacheManager = new MapCacheManager({
        cacheDir: this.config.cacheDir,
        maxCacheSize: this.config.maxCacheSize,
        zoomLevels: this.config.zoomLevels,
        tileProvider: this.config.tileProvider,
        logger: this.config.logger
      });
      await this.cacheManager.initialize();

      // Initialize router
      this.router = new OfflineRouter({
        searchRadius: this.config.searchRadius,
        maxPathLength: this.config.maxPathLength,
        maxCacheSize: this.config.routerCacheSize || 1000,
        logger: this.config.logger
      });

      // Initialize sync manager
      this.syncManager = new SyncManager({
        syncDir: `${this.config.cacheDir}/sync`,
        apiBaseUrl: this.config.apiBaseUrl,
        syncInterval: this.config.syncInterval,
        isOnline: this.isOnline,
        logger: this.config.logger
      });
      await this.syncManager.initialize();

      // Initialize storage optimizer
      this.optimizer = new StorageOptimizer({
        cacheDir: this.config.cacheDir,
        compressionLevel: this.config.compressionLevel || 6,
        optimizationInterval: this.config.optimizationInterval || 24 * 60 * 60 * 1000,
        logger: this.config.logger
      });
      await this.optimizer.initialize();

      // Wire up event handlers
      this._setupEventHandlers();

      this.isInitialized = true;
      this.config.logger.log('[OfflineRoutingService] Initialized successfully');
      this.emit('initialized');

      return { success: true };
    } catch (error) {
      this.config.logger.error('[OfflineRoutingService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers between components
   * @private
   */
  _setupEventHandlers() {
    // Cache events
    this.cacheManager.on('districtRegistered', (district) => {
      this.emit('districtRegistered', district);
    });

    this.cacheManager.on('cachingCompleted', (result) => {
      this.config.logger.log(`District ${result.districtId} cached successfully`);
      this.emit('districtCached', result);
    });

    // Router events
    this.router.on('routeFound', (result) => {
      this.emit('routeFound', result);
    });

    // Sync events
    this.syncManager.on('conflictDetected', (conflict) => {
      this.emit('conflictDetected', conflict);
    });

    this.syncManager.on('syncCompleted', (result) => {
      this.emit('syncCompleted', result);
    });

    // Monitor connectivity changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.setOnlineStatus(true));
      window.addEventListener('offline', () => this.setOnlineStatus(false));
    }
  }

  /**
   * Setup a district for caching
   */
  async setupDistrict(districtConfig) {
    const {
      id,
      name,
      boundary,
      priority = 1,
      cache = true,
      maxTiles = 500
    } = districtConfig;

    try {
      await this.cacheManager.registerDistrict(id, boundary, name, priority);

      if (cache) {
        await this.cacheManager.cacheDistrict(id, { maxTiles });
      }

      return { success: true, districtId: id };
    } catch (error) {
      this.config.logger.error(`[OfflineRoutingService] Failed to setup district ${id}:`, error);
      throw error;
    }
  }

  /**
   * Setup multiple districts
   */
  async setupDistricts(districts) {
    const results = [];

    for (const district of districts) {
      try {
        const result = await this.setupDistrict(district);
        results.push(result);
      } catch (error) {
        results.push({ success: false, districtId: district.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Load road network and initialize router
   */
  async loadRoadNetwork(nodesSource, edgesSource) {
    try {
      this.config.logger.log('[OfflineRoutingService] Loading road network...');

      const nodes = typeof nodesSource === 'function' ? await nodesSource() : nodesSource;
      const edges = typeof edgesSource === 'function' ? await edgesSource() : edgesSource;

      await this.router.initialize(nodes, edges);

      this.config.logger.log('[OfflineRoutingService] Road network loaded');
      return { success: true, nodeCount: nodes.length, edgeCount: edges.length };
    } catch (error) {
      this.config.logger.error('[OfflineRoutingService] Failed to load road network:', error);
      throw error;
    }
  }

  /**
   * Find route
   */
  async findRoute(start, end, options = {}) {
    if (!this.router.roadNetwork.size) {
      throw new Error('Road network not loaded');
    }

    return this.router.findRoute(start, end, {
      ambulancePriority: true,
      ...options
    });
  }

  /**
   * Record incident location while offline
   */
  async recordIncident(incidentId, incidentData) {
    return this.syncManager.recordChange(
      incidentId,
      'create',
      'incident',
      incidentData,
      priority = 10 // High priority
    );
  }

  /**
   * Record dispatch decision
   */
  async recordDispatchDecision(decisionId, decision) {
    return this.syncManager.recordChange(
      decisionId,
      'create',
      'decision',
      decision,
      priority = 8
    );
  }

  /**
   * Update ambulance location (while offline)
   */
  async updateAmbulanceLocation(ambulanceId, location) {
    return this.syncManager.recordChange(
      `ambulance-${ambulanceId}-${Date.now()}`,
      'update',
      'location',
      {
        ambulanceId,
        ...location,
        timestamp: Date.now()
      },
      priority = 9
    );
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      online: this.isOnline,
      cache: this.cacheManager ? this.cacheManager.getCacheStats() : null,
      router: this.router ? this.router.getStats() : null,
      sync: this.syncManager ? this.syncManager.getStats() : null,
      storage: this.optimizer ? this.optimizer.getStats() : null
    };
  }

  /**
   * Trigger manual sync
   */
  async sync() {
    return this.syncManager.sync();
  }

  /**
   * Trigger storage optimization
   */
  async optimize(options = {}) {
    return this.optimizer.optimizeAll(options);
  }

  /**
   * Set online status
   */
  setOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    this.syncManager.setOnlineStatus(isOnline);

    if (isOnline) {
      this.config.logger.log('[OfflineRoutingService] Online, triggering sync');
      this.sync().catch(error => {
        this.config.logger.error('[OfflineRoutingService] Auto-sync failed:', error);
      });
    } else {
      this.config.logger.log('[OfflineRoutingService] Offline mode');
    }

    this.emit('onlineStatusChanged', { isOnline });
  }

  /**
   * Register avoidance zone (construction, accident, etc.)
   */
  registerAvoidanceZone(zoneId, boundary, penalty = 5.0) {
    this.router.registerAvoidanceZone(zoneId, boundary, penalty);
    this.config.logger.log(`[OfflineRoutingService] Avoidance zone registered: ${zoneId}`);
  }

  /**
   * Clear all caches
   */
  async clearAllCaches() {
    try {
      this.router.clearCache();
      this.syncManager.clearSyncedChanges();
      this.config.logger.log('[OfflineRoutingService] Caches cleared');
      return { success: true };
    } catch (error) {
      this.config.logger.error('[OfflineRoutingService] Failed to clear caches:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    if (this.optimizer) {
      await this.optimizer.destroy();
    }

    if (this.syncManager) {
      await this.syncManager.destroy();
    }

    this.config.logger.log('[OfflineRoutingService] Destroyed');
  }
}

module.exports = OfflineRoutingService;

/**
 * USAGE EXAMPLE
 */
if (require.main === module) {
  (async () => {
    const service = new OfflineRoutingService({
      cacheDir: './offline-cache',
      apiBaseUrl: 'http://localhost:3000/api',
      maxCacheSize: 500 * 1024 * 1024
    });

    try {
      // Initialize
      await service.initialize();

      // Setup districts
      await service.setupDistricts([
        {
          id: 'downtown',
          name: 'Downtown District',
          boundary: { north: 40.7580, south: 40.7489, east: -73.9855, west: -73.9971 },
          priority: 10,
          cache: true
        },
        {
          id: 'hospital-area',
          name: 'Hospital Vicinity',
          boundary: { north: 40.7700, south: 40.7600, east: -73.9500, west: -73.9700 },
          priority: 10,
          cache: true
        }
      ]);

      // Load road network
      const mockNodes = [
        { id: 1, lat: 40.7505, lon: -73.9972, type: 'intersection' },
        { id: 2, lat: 40.7580, lon: -73.9855, type: 'intersection' },
        { id: 3, lat: 40.7489, lon: -73.9971, type: 'intersection' }
      ];

      const mockEdges = [
        { from: 1, to: 2, distance: 8000, type: 'primary' },
        { from: 2, to: 3, distance: 12000, type: 'secondary' },
        { from: 1, to: 3, distance: 15000, type: 'residential' }
      ];

      await service.loadRoadNetwork(mockNodes, mockEdges);

      // Find route
      const route = await service.findRoute(
        { lat: 40.7505, lon: -73.9972 },
        { lat: 40.7580, lon: -73.9855 }
      );

      console.log('Route found:', route);

      // Record incident
      await service.recordIncident('inc-001', {
        type: 'medical',
        severity: 'critical',
        location: { lat: 40.7505, lon: -73.9972 }
      });

      // Get status
      console.log('System status:', service.getStatus());

      // Cleanup
      await service.destroy();
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}
