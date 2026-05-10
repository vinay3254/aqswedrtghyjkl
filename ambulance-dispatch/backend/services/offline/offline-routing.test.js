/**
 * Offline Routing System - Test Suite
 * Unit tests for all offline routing components
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;

const MapCacheManager = require('./map-cache-manager');
const OfflineRouter = require('./offline-router');
const SyncManager = require('./sync-manager');
const StorageOptimizer = require('./storage-optimizer');
const OfflineRoutingService = require('./offline-routing-service');

// Test utilities
const TEST_CACHE_DIR = path.join(__dirname, '.test-cache');
const logger = {
  log: (msg) => console.log(`[TEST] ${msg}`),
  warn: (msg) => console.warn(`[TEST] ${msg}`),
  error: (msg, err) => console.error(`[TEST] ${msg}`, err)
};

async function cleanup() {
  try {
    await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
  } catch (e) {
    // Already cleaned
  }
}

// ============================================================================
// MapCacheManager Tests
// ============================================================================

async function testMapCacheManager() {
  console.log('\n📍 Testing MapCacheManager...');

  const manager = new MapCacheManager({
    cacheDir: TEST_CACHE_DIR,
    maxCacheSize: 50 * 1024 * 1024,
    logger
  });

  try {
    // Test 1: Initialization
    console.log('  ✓ Testing initialization...');
    await manager.initialize();
    assert(manager.cacheDir, 'Cache dir should be set');

    // Test 2: Register district
    console.log('  ✓ Testing district registration...');
    await manager.registerDistrict(
      'test-district',
      { north: 40.8, south: 40.7, east: -73.9, west: -74.0 },
      'Test District',
      priority = 1
    );
    assert(manager.districts.has('test-district'), 'District should be registered');

    // Test 3: Get stats
    console.log('  ✓ Testing statistics...');
    const stats = await manager.getCacheStats();
    assert(stats.totalSize >= 0, 'Stats should have size');
    assert(stats.districts.length > 0, 'Stats should have districts');

    // Test 4: Validate boundary
    console.log('  ✓ Testing boundary validation...');
    assert(manager._validateBoundary({ north: 40.8, south: 40.7, east: -73.9, west: -74.0 }), 'Valid boundary');
    assert(!manager._validateBoundary({ north: 40.7, south: 40.8, east: -73.9, west: -74.0 }), 'Invalid boundary');

    console.log('✅ MapCacheManager tests passed');
  } catch (error) {
    console.error('❌ MapCacheManager tests failed:', error);
    throw error;
  }
}

// ============================================================================
// OfflineRouter Tests
// ============================================================================

async function testOfflineRouter() {
  console.log('\n🗺️  Testing OfflineRouter...');

  const router = new OfflineRouter({ logger });

  try {
    // Test 1: Initialize with mock network
    console.log('  ✓ Testing router initialization...');
    const nodes = [
      { id: 1, lat: 40.75, lon: -73.99, type: 'intersection' },
      { id: 2, lat: 40.76, lon: -73.98, type: 'intersection' },
      { id: 3, lat: 40.74, lon: -74.00, type: 'intersection' }
    ];

    const edges = [
      { from: 1, to: 2, distance: 1500, type: 'primary' },
      { from: 2, to: 3, distance: 2000, type: 'secondary' },
      { from: 1, to: 3, distance: 2500, type: 'residential' }
    ];

    await router.initialize(nodes, edges);
    assert(router.roadNetwork.size === 3, 'Should have 3 nodes');

    // Test 2: Test heuristics
    console.log('  ✓ Testing heuristics...');
    const dist = router._haversineDistance(nodes[0], nodes[1]);
    assert(dist > 0, 'Distance should be positive');

    // Test 3: Nearest node finding
    console.log('  ✓ Testing nearest node finding...');
    const nearest = router._findNearestNode({ lat: 40.75, lon: -73.99 });
    assert(nearest !== null, 'Should find nearest node');

    // Test 4: Route finding
    console.log('  ✓ Testing route finding...');
    const route = await router.findRoute(
      { lat: 40.75, lon: -73.99 },
      { lat: 40.74, lon: -74.00 },
      { ambulancePriority: true }
    );
    assert(route.distance > 0, 'Route should have distance');
    assert(route.waypoints.length > 0, 'Route should have waypoints');

    // Test 5: Avoidance zones
    console.log('  ✓ Testing avoidance zones...');
    router.registerAvoidanceZone('zone-1', { north: 40.76, south: 40.75, east: -73.98, west: -73.99 });
    assert(router.avoidanceZones.has('zone-1'), 'Zone should be registered');

    // Test 6: Cache operations
    console.log('  ✓ Testing route caching...');
    const cacheKey = router._getCacheKey({ lat: 40.75, lon: -73.99 }, { lat: 40.74, lon: -74.00 }, {});
    router._cacheRoute(cacheKey, route);
    assert(router.cache.has(cacheKey), 'Route should be cached');

    // Test 7: Get stats
    console.log('  ✓ Testing statistics...');
    const stats = router.getStats();
    assert(stats.nodeCount === 3, 'Should report 3 nodes');
    assert(stats.cachedRoutes >= 1, 'Should have cached routes');

    console.log('✅ OfflineRouter tests passed');
  } catch (error) {
    console.error('❌ OfflineRouter tests failed:', error);
    throw error;
  }
}

// ============================================================================
// SyncManager Tests
// ============================================================================

async function testSyncManager() {
  console.log('\n🔄 Testing SyncManager...');

  const manager = new SyncManager({
    syncDir: path.join(TEST_CACHE_DIR, 'sync'),
    isOnline: false,
    logger
  });

  try {
    // Test 1: Initialization
    console.log('  ✓ Testing initialization...');
    await manager.initialize();
    assert(!manager.isOnline, 'Should be offline');

    // Test 2: Record change
    console.log('  ✓ Testing change recording...');
    await manager.recordChange('change-1', 'create', 'incident', {
      location: { lat: 40.75, lon: -73.99 },
      severity: 'critical'
    }, priority = 10);
    assert(manager.pendingChanges.has('change-1'), 'Change should be recorded');

    // Test 3: Get pending changes
    console.log('  ✓ Testing pending changes...');
    const pending = manager.getPendingChanges();
    assert(pending.length > 0, 'Should have pending changes');
    assert(pending[0].id === 'change-1', 'Should find recorded change');

    // Test 4: Change status
    console.log('  ✓ Testing change status...');
    const change = manager.pendingChanges.get('change-1');
    assert(change.status === 'pending', 'Change should be pending');

    // Test 5: Get stats
    console.log('  ✓ Testing statistics...');
    const stats = manager.getStats();
    assert(stats.pendingChanges >= 1, 'Should have pending changes in stats');
    assert(stats.isOnline === false, 'Should show offline status');

    // Test 6: Online status change
    console.log('  ✓ Testing online status change...');
    manager.setOnlineStatus(true);
    assert(manager.isOnline === true, 'Should be online');

    console.log('✅ SyncManager tests passed');
  } catch (error) {
    console.error('❌ SyncManager tests failed:', error);
    throw error;
  }
}

// ============================================================================
// StorageOptimizer Tests
// ============================================================================

async function testStorageOptimizer() {
  console.log('\n💾 Testing StorageOptimizer...');

  const optimizer = new StorageOptimizer({
    cacheDir: TEST_CACHE_DIR,
    compressionLevel: 6,
    logger
  });

  try {
    // Test 1: Initialization
    console.log('  ✓ Testing initialization...');
    await optimizer.initialize();
    assert(optimizer.fileIndex !== null, 'File index should be initialized');

    // Test 2: Get stats
    console.log('  ✓ Testing statistics...');
    const stats = optimizer.getStats();
    assert(stats.fileCount >= 0, 'Stats should have file count');
    assert(stats.compressionLevel === 6, 'Should report compression level');

    // Test 3: Bytes formatting
    console.log('  ✓ Testing bytes formatting...');
    const formatted = optimizer._formatBytes(1024 * 1024);
    assert(formatted.includes('MB'), 'Should format as MB');

    console.log('✅ StorageOptimizer tests passed');
  } catch (error) {
    console.error('❌ StorageOptimizer tests failed:', error);
    throw error;
  }
}

// ============================================================================
// OfflineRoutingService Tests
// ============================================================================

async function testOfflineRoutingService() {
  console.log('\n🚑 Testing OfflineRoutingService...');

  const service = new OfflineRoutingService({
    cacheDir: TEST_CACHE_DIR,
    logger
  });

  try {
    // Test 1: Initialization
    console.log('  ✓ Testing initialization...');
    await service.initialize();
    assert(service.isInitialized, 'Service should be initialized');

    // Test 2: Setup district
    console.log('  ✓ Testing district setup...');
    const result = await service.setupDistrict({
      id: 'test-dist',
      name: 'Test District',
      boundary: { north: 40.8, south: 40.7, east: -73.9, west: -74.0 },
      priority: 1,
      cache: false
    });
    assert(result.success, 'District setup should succeed');

    // Test 3: Load road network
    console.log('  ✓ Testing road network loading...');
    const nodes = [
      { id: 1, lat: 40.75, lon: -73.99, type: 'intersection' },
      { id: 2, lat: 40.76, lon: -73.98, type: 'intersection' }
    ];
    const edges = [
      { from: 1, to: 2, distance: 1500, type: 'primary' }
    ];
    await service.loadRoadNetwork(nodes, edges);
    assert(service.router.roadNetwork.size > 0, 'Road network should be loaded');

    // Test 4: Find route
    console.log('  ✓ Testing route finding...');
    const route = await service.findRoute(
      { lat: 40.75, lon: -73.99 },
      { lat: 40.76, lon: -73.98 }
    );
    assert(route.distance > 0, 'Route should be found');

    // Test 5: Record incident
    console.log('  ✓ Testing incident recording...');
    await service.recordIncident('inc-001', {
      type: 'medical',
      severity: 'critical'
    });
    const pending = service.syncManager.getPendingChanges();
    assert(pending.length > 0, 'Should have pending incident');

    // Test 6: Get status
    console.log('  ✓ Testing service status...');
    const status = service.getStatus();
    assert(status.initialized, 'Service should show as initialized');

    // Test 7: Register avoidance zone
    console.log('  ✓ Testing avoidance zone registration...');
    service.registerAvoidanceZone('zone-1', { north: 40.76, south: 40.75, east: -73.98, west: -73.99 });
    assert(service.router.avoidanceZones.has('zone-1'), 'Zone should be registered');

    // Test 8: Cleanup
    console.log('  ✓ Testing cleanup...');
    await service.destroy();
    assert(true, 'Service cleanup should succeed');

    console.log('✅ OfflineRoutingService tests passed');
  } catch (error) {
    console.error('❌ OfflineRoutingService tests failed:', error);
    throw error;
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log('================================');
  console.log('  Offline Routing System Tests');
  console.log('================================');

  try {
    // Cleanup before tests
    await cleanup();

    // Run all tests
    await testMapCacheManager();
    await testOfflineRouter();
    await testSyncManager();
    await testStorageOptimizer();
    await testOfflineRoutingService();

    // Cleanup after tests
    await cleanup();

    console.log('\n================================');
    console.log('  ✅ All tests passed!');
    console.log('================================');
    process.exit(0);
  } catch (error) {
    console.error('\n================================');
    console.error('  ❌ Tests failed!');
    console.error('================================');
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testMapCacheManager,
  testOfflineRouter,
  testSyncManager,
  testStorageOptimizer,
  testOfflineRoutingService,
  runAllTests,
  cleanup
};
