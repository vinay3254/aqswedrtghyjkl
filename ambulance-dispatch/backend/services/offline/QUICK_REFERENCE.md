# 🚑 Offline Route Caching System - Quick Reference

## Directory Structure
```
backend/services/offline/
├── map-cache-manager.js           (14.1 KB) - OSM tile caching
├── offline-router.js              (13.8 KB) - A* pathfinding
├── sync-manager.js                (14.3 KB) - Offline sync
├── storage-optimizer.js           (13.6 KB) - Compression & optimization
├── offline-routing-service.js     (11.1 KB) - Integrated service
├── index.js                       (2.3 KB)  - Module exports
├── config.js                      (11.6 KB) - Configuration template
├── offline-routing.test.js        (12.6 KB) - Unit tests (31 tests)
├── README.md                      (17.4 KB) - Full documentation
├── IMPLEMENTATION_SUMMARY.md      (15.7 KB) - This summary
└── QUICK_REFERENCE.md             (this file)
```

## Component Overview

### 🗺️ MapCacheManager
**Downloads and caches OpenStreetMap tiles**
```javascript
const manager = new MapCacheManager({ maxCacheSize: 500MB });
await manager.initialize();
await manager.registerDistrict('downtown', boundary, 'Downtown', priority=10);
await manager.cacheDistrict('downtown', { maxTiles: 500 });
const stats = await manager.getCacheStats();
```

### 🧭 OfflineRouter
**Finds optimal routes using A* algorithm**
```javascript
const router = new OfflineRouter();
await router.initialize(nodes, edges);
const route = await router.findRoute(start, end, { ambulancePriority: true });
// Returns: { distance, duration, waypoints, summary }
```

### 🔄 SyncManager
**Syncs offline changes when connectivity restored**
```javascript
const sync = new SyncManager({ apiBaseUrl: 'http://api.example.com' });
await sync.initialize();
await sync.recordChange('inc-001', 'create', 'incident', data, priority=10);
// Auto-syncs when online, manually trigger: await sync.sync();
```

### 💾 StorageOptimizer
**Compresses and deduplicates cached data**
```javascript
const optimizer = new StorageOptimizer({ compressionLevel: 6 });
await optimizer.initialize();
const result = await optimizer.optimizeAll();
// Result: { compression, deduplication, cleanup, totalSaved }
```

### 🚑 OfflineRoutingService
**Integrated service combining all components**
```javascript
const service = new OfflineRoutingService(config);
await service.initialize();
await service.setupDistricts(districtsList);
await service.loadRoadNetwork(nodes, edges);
const route = await service.findRoute(start, end);
await service.recordIncident(id, data);
await service.sync(); // When online
```

## Key Methods Summary

| Component | Method | Purpose |
|-----------|--------|---------|
| MapCacheManager | registerDistrict() | Add district for caching |
| MapCacheManager | cacheDistrict() | Download tiles for district |
| MapCacheManager | getTile() | Retrieve cached tile |
| OfflineRouter | initialize() | Load road network |
| OfflineRouter | findRoute() | Calculate optimal route |
| OfflineRouter | registerAvoidanceZone() | Mark area to avoid |
| SyncManager | recordChange() | Record offline change |
| SyncManager | sync() | Trigger manual sync |
| SyncManager | resolveConflict() | Resolve sync conflicts |
| SyncManager | setOnlineStatus() | Update connectivity |
| StorageOptimizer | optimizeAll() | Run full optimization |
| StorageOptimizer | compressFile() | Compress single file |
| OfflineRoutingService | setupDistrict() | Setup district for use |
| OfflineRoutingService | loadRoadNetwork() | Load OSM road data |
| OfflineRoutingService | findRoute() | Find route (convenience) |

## Event Emitters

### MapCacheManager Events
```javascript
manager.on('initialized', ({ size, tiles }) => {});
manager.on('districtRegistered', (districtInfo) => {});
manager.on('cachingStarted', ({ districtId, timestamp }) => {});
manager.on('cachingCompleted', ({ districtId, tileCount }) => {});
manager.on('downloadProgress', ({ progress }) => {});
```

### OfflineRouter Events
```javascript
router.on('initialized', ({ nodeCount, edgeCount }) => {});
router.on('routeFound', ({ distance, duration, waypoints }) => {});
router.on('routeFailed', ({ error }) => {});
```

### SyncManager Events
```javascript
sync.on('changeRecorded', ({ changeId, type, entity }) => {});
sync.on('changeSynced', ({ changeId, endpoint }) => {});
sync.on('conflictDetected', (conflictInfo) => {});
sync.on('syncCompleted', (results) => {});
sync.on('online', () => {});
sync.on('offline', () => {});
```

### StorageOptimizer Events
```javascript
optimizer.on('optimizationStarted', ({ timestamp }) => {});
optimizer.on('optimizationCompleted', (results) => {});
```

## Configuration Quick Reference

### Minimal Config
```javascript
const service = new OfflineRoutingService({
  cacheDir: './offline-cache',
  apiBaseUrl: 'http://api.example.com',
  maxCacheSize: 500 * 1024 * 1024
});
```

### Full Environment Setup
```javascript
const { getConfig } = require('./config');
const envConfig = getConfig(process.env.NODE_ENV || 'production');
const service = new OfflineRoutingService(envConfig);
```

## Usage Patterns

### Basic Workflow
```javascript
// 1. Initialize
const service = new OfflineRoutingService();
await service.initialize();

// 2. Setup districts
await service.setupDistricts([
  { id: 'downtown', boundary: {...}, priority: 10, cache: true }
]);

// 3. Load road network
await service.loadRoadNetwork(nodes, edges);

// 4. Find routes
const route = await service.findRoute(start, end);

// 5. Record changes (offline)
await service.recordIncident('inc-001', incidentData);

// 6. Sync (when online)
const result = await service.sync();
```

### Offline Incident Handling
```javascript
// Record incident while offline
await service.recordIncident('incident-123', {
  type: 'medical',
  severity: 'critical',
  location: { lat: 40.75, lon: -73.99 },
  timestamp: Date.now()
});

// Auto-syncs when connectivity restored
service.on('syncCompleted', (result) => {
  console.log(`Synced ${result.synced} incidents`);
});
```

### Real-Time Avoidance Zones
```javascript
// Register construction zone
service.registerAvoidanceZone('construction-5th', 
  { north: 40.756, south: 40.754, east: -73.9755, west: -73.9775 },
  penalty = 10.0
);

// Routes will avoid this area with 10x cost multiplier
const route = await service.findRoute(start, end);
```

### Storage Optimization
```javascript
// Run optimization (compression + dedup + cleanup)
const result = await service.optimize({
  includeCompression: true,
  includeDedupe: true,
  includeCleanup: true,
  dryRun: false
});

console.log(`Saved ${result.totalSaved} bytes`);
```

## District Configuration Example

```javascript
{
  id: 'downtown',
  name: 'Downtown Business District',
  boundary: {
    north: 40.7580,
    south: 40.7489,
    east: -73.9855,
    west: -73.9971
  },
  priority: 10,        // Higher = cache first
  cache: true,         // Automatically cache
  maxTiles: 500,       // Max tiles to cache
  description: 'High incident density'
}
```

## Ambulance Priority Routing

```javascript
// Find route with ambulance optimization (prefers main roads)
const route = await service.findRoute(start, end, {
  ambulancePriority: true,
  avoidZones: hazardZones  // Optional
});

// Route prefers:
// - Motorways (0.5x weight)
// - Trunks (0.6x weight)
// - Primaries (0.8x weight)
```

## Performance Tips

1. **Cache Districts at Startup**
   - Pre-cache high-priority districts
   - Use priority=10 for hospitals/fire stations

2. **Route Caching**
   - Frequently used routes cached automatically
   - ~50KB per 100 routes in memory

3. **Storage Optimization**
   - Run nightly optimization on tablets/ambulances
   - Compression: 10-100MB/min
   - Saves ~20-40% of storage

4. **Sync Optimization**
   - Batch changes together
   - Higher priority changes sync first
   - Exponential backoff prevents API overload

## Troubleshooting

### No Routes Found
```javascript
// Check if road network loaded
console.log(service.router.getStats());

// Verify start/end points in search radius
// Increase searchRadius if needed
```

### Cache Growing Too Fast
```javascript
// Reduce maxCacheSize or maxTiles per district
// Enable periodic optimization
// Clear old caches: await manager.cleanExpiredCaches()
```

### Sync Conflicts
```javascript
// Listen for conflicts
syncManager.on('conflictDetected', (conflict) => {
  // Resolve with strategy: 'local', 'server', or 'merge'
  syncManager.resolveConflict(conflict.changeId, 'local');
});
```

### High Memory Usage
```javascript
// Reduce router cache size
new OfflineRouter({ maxCacheSize: 500 })

// Clear caches periodically
service.clearAllCaches();
```

## Testing

Run all tests:
```bash
npm test offline-routing.test.js
```

Tests cover:
- MapCacheManager: 7 tests
- OfflineRouter: 7 tests
- SyncManager: 6 tests
- StorageOptimizer: 3 tests
- OfflineRoutingService: 8 tests

## Files at a Glance

| File | Size | Purpose |
|------|------|---------|
| map-cache-manager.js | 14.1 KB | Tile caching |
| offline-router.js | 13.8 KB | A* routing |
| sync-manager.js | 14.3 KB | Offline sync |
| storage-optimizer.js | 13.6 KB | Compression |
| offline-routing-service.js | 11.1 KB | Integration |
| config.js | 11.6 KB | Configuration |
| index.js | 2.3 KB | Exports |
| offline-routing.test.js | 12.6 KB | Tests (31) |
| README.md | 17.4 KB | Full docs |
| IMPLEMENTATION_SUMMARY.md | 15.7 KB | Architecture |

## Import Examples

```javascript
// Import all components
const {
  MapCacheManager,
  OfflineRouter,
  SyncManager,
  StorageOptimizer,
  OfflineRoutingService,
  config,
  createOfflineRoutingService
} = require('./offline');

// Use convenience factory
const service = createOfflineRoutingService({ cacheDir: './cache' });

// Or import specific component
const { OfflineRouter } = require('./offline');
const router = new OfflineRouter();
```

## API Endpoints (Sync)

SyncManager syncs to these endpoints:
- `POST /api/incidents/sync` - Incident data
- `POST /api/decisions/sync` - Dispatch decisions
- `POST /api/locations/sync` - Location updates
- `POST /api/status/sync` - Status updates
- `POST /api/ambulances/sync` - Ambulance info

## Further Reading

- **README.md** - Complete API documentation
- **IMPLEMENTATION_SUMMARY.md** - Architecture details
- **config.js** - All configuration options
- **offline-routing.test.js** - Usage examples in tests

---

Last Updated: 2024
Version: 1.0.0
