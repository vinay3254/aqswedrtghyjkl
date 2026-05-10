/**
 * Offline Route Caching System - Main Index
 * Complete offline-first caching and routing solution for ambulance dispatch
 */

const MapCacheManager = require('./map-cache-manager');
const OfflineRouter = require('./offline-router');
const SyncManager = require('./sync-manager');
const StorageOptimizer = require('./storage-optimizer');
const OfflineRoutingService = require('./offline-routing-service');
const config = require('./config');

/**
 * Export all modules
 */
module.exports = {
  // Core components
  MapCacheManager,
  OfflineRouter,
  SyncManager,
  StorageOptimizer,
  OfflineRoutingService,

  // Configuration
  config,

  // Convenience function to create fully integrated service
  createOfflineRoutingService: (options = {}) => {
    return new OfflineRoutingService({
      ...config.getConfig(process.env.NODE_ENV),
      ...options
    });
  },

  // Version info
  version: '1.0.0',

  // API Documentation
  documentation: {
    overview: 'Offline-first caching and routing system for ambulance dispatch',
    components: {
      MapCacheManager: 'Download and manage OSM tiles for offline use',
      OfflineRouter: 'A* pathfinding using cached road network data',
      SyncManager: 'Sync cached data when connectivity restored',
      StorageOptimizer: 'Compress and optimize cached map data',
      OfflineRoutingService: 'Integrated service combining all components'
    },
    readmeFile: './README.md',
    configFile: './config.js',
    testFile: './offline-routing.test.js'
  }
};

/**
 * Example usage:
 *
 * const { OfflineRoutingService, config } = require('./index');
 *
 * // Create service with custom config
 * const service = new OfflineRoutingService({
 *   cacheDir: './offline-cache',
 *   apiBaseUrl: 'http://api.example.com',
 *   maxCacheSize: 500 * 1024 * 1024
 * });
 *
 * // Initialize
 * await service.initialize();
 *
 * // Setup districts
 * await service.setupDistrict({
 *   id: 'downtown',
 *   name: 'Downtown',
 *   boundary: { north: 40.8, south: 40.7, east: -73.9, west: -74.0 },
 *   priority: 10,
 *   cache: true
 * });
 *
 * // Load road network and find routes
 * await service.loadRoadNetwork(nodes, edges);
 * const route = await service.findRoute(start, end);
 */
