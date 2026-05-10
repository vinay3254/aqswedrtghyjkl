# Offline Route Caching System

A comprehensive offline-first caching and routing system for ambulance dispatch applications. Enables emergency responders to navigate and dispatch ambulances even when connectivity is unavailable.

## Overview

This system consists of four integrated modules that work together to provide complete offline routing capabilities:

```
┌─────────────────────────────────────────────────────────┐
│         Offline Route Caching System                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  MapCacheManager          OfflineRouter                 │
│  • Download OSM tiles     • A* pathfinding              │
│  • District-level cache   • Real-time routing           │
│  • LRU eviction          • Obstacle avoidance           │
│                                                          │
│  SyncManager              StorageOptimizer              │
│  • Auto sync on online    • Compression                 │
│  • Conflict resolution    • Deduplication               │
│  • Change tracking        • Smart cleanup               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Features

### MapCacheManager
- **OSM Tile Downloading**: Downloads OpenStreetMap tiles at multiple zoom levels
- **District-Level Caching**: Register and cache entire districts with custom boundaries
- **LRU Eviction**: Automatically removes least-recently-used tiles when cache is full
- **Priority Caching**: Cache districts based on priority (hospitals, fire stations, etc.)
- **Metadata Tracking**: Maintains cache metadata with expiration and statistics
- **Concurrent Downloads**: Multi-threaded tile downloads with configurable concurrency

### OfflineRouter
- **A* Pathfinding**: Optimal route calculation using cached road network
- **Real-Time Routing**: Fast route computation without network dependency
- **Obstacle Avoidance**: Support for dynamic avoidance zones
- **Turn-by-Turn Directions**: Detailed waypoints with directions and road types
- **Route Caching**: Frequently used routes cached for instant lookup
- **Road Type Weighting**: Different weights for various road types (motorway, residential, etc.)
- **Ambulance Priority**: Prefers main roads for emergency response

### SyncManager
- **Automatic Sync**: Background sync when connectivity is restored
- **Offline Change Tracking**: Records all local changes while offline
- **Conflict Resolution**: Handles sync conflicts with multiple strategies
- **Retry Logic**: Exponential backoff with configurable retry counts
- **Change Prioritization**: Syncs high-priority changes first
- **Connectivity Monitoring**: Detects online/offline status changes

### StorageOptimizer
- **File Compression**: Gzip and deflate compression with configurable levels
- **Deduplication**: Identifies and links duplicate tiles using content hashing
- **Smart Cleanup**: Removes temporary and expired files
- **Periodic Optimization**: Background optimization on configurable schedule
- **Space Reporting**: Detailed statistics on cache utilization and compression ratios

## Installation

```bash
npm install
```

Required dependencies:
```json
{
  "axios": "^1.4.0",
  "priorityqueue": "^1.0.0"
}
```

## Quick Start

### Initialize the System

```javascript
const MapCacheManager = require('./map-cache-manager');
const OfflineRouter = require('./offline-router');
const SyncManager = require('./sync-manager');
const StorageOptimizer = require('./storage-optimizer');

// Initialize cache manager
const cacheManager = new MapCacheManager({
  cacheDir: '/path/to/cache',
  maxCacheSize: 500 * 1024 * 1024, // 500MB
  tileProvider: 'https://tile.openstreetmap.org'
});

await cacheManager.initialize();

// Initialize router
const router = new OfflineRouter({
  searchRadius: 0.01,
  maxPathLength: 50000
});

// Initialize sync manager
const syncManager = new SyncManager({
  apiBaseUrl: 'http://api.example.com',
  syncInterval: 5 * 60 * 1000 // 5 minutes
});

await syncManager.initialize();

// Initialize storage optimizer
const optimizer = new StorageOptimizer({
  compressionLevel: 6,
  optimizationInterval: 24 * 60 * 60 * 1000 // 24 hours
});

await optimizer.initialize();
```

### Register Districts

```javascript
// Register a district for caching
await cacheManager.registerDistrict(
  'downtown',
  {
    north: 40.7580,
    south: 40.7489,
    east: -73.9855,
    west: -73.9971
  },
  'Downtown Manhattan',
  priority = 1
);

// Cache the district at all zoom levels
await cacheManager.cacheDistrict('downtown', {
  forceRefresh: false,
  maxTiles: 500
});
```

### Find Routes

```javascript
// Load road network data (from offline database or cached data)
const nodes = await loadRoadNetworkNodes();
const edges = await loadRoadNetworkEdges();

await router.initialize(nodes, edges);

// Find route
const route = await router.findRoute(
  { lat: 40.7505, lon: -73.9972 }, // Start (Times Square)
  { lat: 40.7829, lon: -73.9654 },  // End (Central Park)
  {
    ambulancePriority: true,
    avoidZones: []
  }
);

console.log(`Route: ${route.distance}m, ~${route.duration} minutes`);
route.waypoints.forEach(wp => {
  console.log(`- ${wp.instructions} at ${wp.lat},${wp.lon}`);
});
```

### Record and Sync Changes

```javascript
// Record a local change (while offline)
await syncManager.recordChange(
  'incident-123',
  'create',
  'incident',
  {
    location: { lat: 40.7505, lon: -73.9972 },
    severity: 'critical',
    type: 'medical'
  },
  priority = 10 // High priority
);

// When connectivity is restored, sync automatically
// Or manually trigger sync
const result = await syncManager.sync();
console.log(`Synced ${result.synced} changes`);
```

### Optimize Storage

```javascript
// Run full optimization
const optimizationResult = await optimizer.optimizeAll({
  includeCompression: true,
  includeDedupe: true,
  includeCleanup: true,
  dryRun: false
});

console.log(`Saved ${optimizationResult.totalSaved} bytes`);
```

## District-Level Caching Strategy

The system implements a district-based caching strategy optimized for ambulance dispatch:

### District Definition
```javascript
{
  id: 'unique-id',
  name: 'District Name',
  boundary: {
    north: 40.7580,
    south: 40.7489,
    east: -73.9855,
    west: -73.9971
  },
  priority: 1,        // Higher = cache first
  status: 'cached',   // pending, caching, cached, expired, failed
  cacheExpiry: timestamp,
  tileCount: 245,
  estimatedSize: 5242880
}
```

### Caching Strategy
1. **Priority-Based**: Districts registered with higher priority are cached first
2. **Multi-Zoom**: Tiles cached at zoom levels 12-16 for different detail levels
3. **Incremental**: Only cache tiles not already in cache (unless forced refresh)
4. **Size-Aware**: Automatically evicts old tiles when cache is full using LRU
5. **Expiration**: Districts automatically expire after 30 days (configurable)

### Use Cases
- **Hospital Districts**: Cache with highest priority around hospitals
- **Fire Station Coverage**: Cache areas served by fire stations
- **Highway Corridors**: Cache along major emergency routes
- **Urban Centers**: Cache downtown areas with high incident density
- **Residential Areas**: Cache neighborhood streets for comprehensive coverage

## API Reference

### MapCacheManager

#### `initialize()`
Initialize cache directories and load existing metadata.

#### `registerDistrict(districtId, boundary, districtName, priority)`
Register a new district for caching.

**Parameters:**
- `districtId` (string): Unique identifier
- `boundary` (object): { north, south, east, west }
- `districtName` (string): Human-readable name
- `priority` (number): Cache priority (higher first)

#### `cacheDistrict(districtId, options)`
Download and cache all tiles for a district.

**Options:**
- `forceRefresh` (boolean): Force re-download all tiles
- `maxTiles` (number): Maximum tiles to cache

#### `getTile(x, y, zoom)`
Retrieve a cached tile as buffer.

#### `getCacheStats()`
Get cache statistics including size and utilization.

#### `cleanExpiredCaches()`
Remove caches that have passed expiration date.

### OfflineRouter

#### `initialize(nodes, edges)`
Initialize router with road network data.

**Parameters:**
- `nodes`: Array of { id, lat, lon, type }
- `edges`: Array of { from, to, distance, type, restrictions }

#### `findRoute(start, end, options)`
Find optimal route using A* algorithm.

**Parameters:**
- `start` (object): { lat, lon }
- `end` (object): { lat, lon }
- `options` (object):
  - `ambulancePriority` (boolean): Prefer main roads
  - `avoidZones` (array): Zones to avoid
  - `preferredRoads` (array): Roads to prefer

**Returns:**
```javascript
{
  distance: number,          // meters
  duration: number,          // minutes
  waypoints: [
    {
      type: 'start|waypoint|end',
      lat: number,
      lon: number,
      distance: number,      // cumulative from start
      instructions: string,
      roadType: string
    }
  ],
  summary: string
}
```

#### `registerAvoidanceZone(zoneId, boundary, penalty)`
Register an area to avoid during routing.

#### `getStats()`
Get router statistics.

### SyncManager

#### `initialize()`
Initialize sync manager and load pending changes.

#### `recordChange(changeId, type, entity, data, priority)`
Record a change for later synchronization.

**Parameters:**
- `changeId` (string): Unique change identifier
- `type` (string): 'create', 'update', 'delete'
- `entity` (string): 'location', 'route', 'decision', 'status'
- `data` (object): Change data
- `priority` (number): Sync priority (higher first)

#### `sync()`
Trigger manual synchronization of all pending changes.

**Returns:**
```javascript
{
  synced: number,      // Successfully synced
  conflicted: number,  // Conflicts found
  failed: number,      // Failed to sync
  details: array       // Detailed results per change
}
```

#### `resolveConflict(changeId, strategy, mergedData)`
Resolve a sync conflict.

**Strategies:**
- `local`: Keep local data
- `server`: Accept server data
- `merge`: Use merged data

#### `setOnlineStatus(isOnline)`
Update connectivity status (triggers auto-sync if coming online).

#### `getPendingChanges()`
Get list of pending changes awaiting sync.

#### `getStats()`
Get sync statistics.

### StorageOptimizer

#### `initialize()`
Initialize optimizer and build file index.

#### `optimizeAll(options)`
Run complete optimization.

**Options:**
- `includeCompression` (boolean): Enable compression
- `includeDedupe` (boolean): Enable deduplication
- `includeCleanup` (boolean): Enable cleanup
- `dryRun` (boolean): Preview changes without applying

**Returns:**
```javascript
{
  compression: { filesCompressed, spaceSaved },
  deduplication: { duplicatesFound, spaceSaved },
  cleanup: { filesDeleted, spaceSaved },
  totalSaved: number,
  dryRun: boolean
}
```

#### `compressFile(filePath)`
Compress a single file.

#### `decompressFile(filePath)`
Decompress a single file.

#### `getStats()`
Get optimization statistics.

## Event Handling

All modules emit events for status tracking:

### MapCacheManager Events
```javascript
cacheManager.on('initialized', ({ size, tiles }) => {});
cacheManager.on('districtRegistered', (districtInfo) => {});
cacheManager.on('cachingStarted', ({ districtId, timestamp }) => {});
cacheManager.on('cachingCompleted', ({ districtId, tileCount }) => {});
cacheManager.on('cachingFailed', ({ districtId, error }) => {});
cacheManager.on('downloadProgress', ({ progress }) => {});
```

### OfflineRouter Events
```javascript
router.on('initialized', ({ nodeCount, edgeCount }) => {});
router.on('routeFound', ({ distance, duration, waypoints }) => {});
router.on('routeFailed', ({ error }) => {});
```

### SyncManager Events
```javascript
syncManager.on('initialized', ({ pendingChanges }) => {});
syncManager.on('changeRecorded', ({ changeId, type, entity }) => {});
syncManager.on('changeSynced', ({ changeId, endpoint }) => {});
syncManager.on('changeFailed', ({ changeId, error }) => {});
syncManager.on('conflictDetected', (conflictInfo) => {});
syncManager.on('conflictResolved', ({ changeId, strategy }) => {});
syncManager.on('syncStarted', ({ changeCount }) => {});
syncManager.on('syncCompleted', (results) => {});
syncManager.on('syncFailed', ({ error }) => {});
syncManager.on('online', () => {});
syncManager.on('offline', () => {});
```

### StorageOptimizer Events
```javascript
optimizer.on('initialized', (stats) => {});
optimizer.on('optimizationStarted', ({ timestamp }) => {});
optimizer.on('optimizationCompleted', (results) => {});
optimizer.on('optimizationFailed', ({ error }) => {});
```

## Configuration Examples

### Hospital Dispatch Configuration
```javascript
// Cache hospital and surrounding area with highest priority
await cacheManager.registerDistrict(
  'mercy-hospital',
  {
    north: 40.7800,
    south: 40.7600,
    east: -73.9500,
    west: -73.9700
  },
  'Mercy Hospital Coverage',
  priority = 10
);

// Register nearby avoidance zones
router.registerAvoidanceZone('construction-zone', {
  north: 40.7700,
  south: 40.7650,
  east: -73.9600,
  west: -73.9650
}, penalty = 10.0);
```

### Multi-District Setup
```javascript
// Cache multiple districts in priority order
const districts = [
  { id: 'downtown', priority: 10 },
  { id: 'uptown', priority: 8 },
  { id: 'airport', priority: 6 },
  { id: 'suburbs', priority: 4 }
];

for (const district of districts) {
  await cacheManager.cacheDistrict(district.id, {
    maxTiles: 200 // Limit tiles per district
  });
}
```

### Aggressive Caching
```javascript
// For ambulances that work wide areas
const router = new OfflineRouter({
  searchRadius: 0.05, // 5km search radius
  maxPathLength: 100000, // 100km max route
  maxCacheSize: 2000 // Cache 2000 routes
});
```

### Storage-Constrained Devices
```javascript
const optimizer = new StorageOptimizer({
  compressionLevel: 9, // Maximum compression
  compressionAlgorithm: 'deflate', // Faster decompression
  deduplicationEnabled: true,
  optimizationInterval: 6 * 60 * 60 * 1000 // Every 6 hours
});

const cacheManager = new MapCacheManager({
  maxCacheSize: 100 * 1024 * 1024 // Only 100MB
});
```

## Performance Characteristics

### MapCacheManager
- **Tile Download**: ~1-5 tiles/second (depending on bandwidth)
- **Tile Retrieval**: <10ms from cache
- **Memory Footprint**: ~10MB for 100k tiles metadata

### OfflineRouter
- **Route Calculation**: 50-500ms depending on distance and complexity
- **Route Caching**: <1ms for cached routes
- **Cache Size**: ~50KB per 100 routes

### SyncManager
- **Change Recording**: <5ms per change
- **Sync Processing**: 10-50ms per change
- **Conflict Detection**: <1ms per conflict

### StorageOptimizer
- **Compression**: 10-100MB/minute depending on data type
- **Deduplication**: 50-200MB/minute scan rate
- **Optimization Overhead**: ~10% of cache size

## Troubleshooting

### Cache Not Growing
1. Check `maxCacheSize` setting
2. Verify districts are registered: `cacheManager.districts.size`
3. Check download progress: Listen to `downloadProgress` events
4. Check logs for network errors

### Routes Not Found
1. Verify road network loaded: `router.getStats()`
2. Check start/end points are within search radius
3. Ensure nodes/edges are properly formatted
4. Register avoidance zones sparingly

### Sync Conflicts
1. Check conflict details in events
2. Resolve with appropriate strategy (local/server/merge)
3. Monitor conflict frequency
4. Review business logic for conflict prevention

### High Storage Usage
1. Run `optimizer.optimizeAll()` manually
2. Increase compression level
3. Reduce `maxCacheSize`
4. Increase cleanup aggressiveness

## Development

### Testing
```bash
npm test
```

### Logging
Enable debug logging with environment variable:
```bash
DEBUG=offline-routing npm start
```

### Metrics Collection
```javascript
// Periodic metrics reporting
setInterval(() => {
  const cacheStats = cacheManager.getCacheStats();
  const routerStats = router.getStats();
  const syncStats = syncManager.getStats();
  const optimizationStats = optimizer.getStats();
  
  console.log('System Metrics:', { cacheStats, routerStats, syncStats, optimizationStats });
}, 60000);
```

## Future Enhancements

- [ ] Distributed caching across multiple devices
- [ ] Machine learning for predictive caching
- [ ] Real-time traffic data integration
- [ ] Turn-by-turn voice directions
- [ ] Multi-modal routing (ambulance + helicopter)
- [ ] WebAssembly A* implementation
- [ ] Database sync instead of REST API

## License

MIT

## Support

For issues and feature requests, contact the development team.
