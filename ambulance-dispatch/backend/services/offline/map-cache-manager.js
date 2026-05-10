/**
 * Map Cache Manager
 * Downloads and manages offline OSM (OpenStreetMap) tiles for ambulance dispatch
 * Supports district-level caching strategy with LRU eviction
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const EventEmitter = require('events');
const { createHash } = require('crypto');

class MapCacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.offline-cache', 'tiles');
    this.metadataDir = path.join(this.cacheDir, 'metadata');
    this.maxCacheSize = options.maxCacheSize || 500 * 1024 * 1024; // 500MB default
    this.tileSize = options.tileSize || 256; // pixels
    this.zoomLevels = options.zoomLevels || [12, 13, 14, 15, 16]; // Default zoom levels
    this.tileProvider = options.tileProvider || 'https://tile.openstreetmap.org';
    this.districts = new Map(); // Store district boundaries and metadata
    this.currentSize = 0;
    this.logger = options.logger || console;
    this.tileIndex = new Map(); // In-memory LRU index
    this.downloadQueue = [];
    this.isDownloading = false;
    this.maxConcurrentDownloads = options.maxConcurrentDownloads || 3;
  }

  /**
   * Initialize cache manager and create necessary directories
   */
  async initialize() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.mkdir(this.metadataDir, { recursive: true });
      await this._loadMetadata();
      this._calculateCurrentSize();
      this.logger.log('[MapCacheManager] Initialized successfully');
      this.emit('initialized', { size: this.currentSize, tiles: this.tileIndex.size });
    } catch (error) {
      this.logger.error('[MapCacheManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register a district for caching with boundary coordinates
   * @param {string} districtId - Unique district identifier
   * @param {object} boundary - { north, south, east, west } coordinates
   * @param {string} districtName - Human-readable district name
   * @param {number} priority - Cache priority (higher = cache first)
   */
  async registerDistrict(districtId, boundary, districtName = '', priority = 1) {
    if (!this._validateBoundary(boundary)) {
      throw new Error('Invalid boundary coordinates');
    }

    const districtInfo = {
      id: districtId,
      name: districtName,
      boundary,
      priority,
      tileCount: 0,
      estimatedSize: 0,
      lastUpdated: new Date().toISOString(),
      status: 'pending', // pending, caching, cached, expired
      cacheExpiry: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
    };

    this.districts.set(districtId, districtInfo);
    
    const metadataPath = path.join(this.metadataDir, `${districtId}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(districtInfo, null, 2));
    
    this.logger.log(`[MapCacheManager] Registered district: ${districtId} (${districtName})`);
    this.emit('districtRegistered', districtInfo);
  }

  /**
   * Calculate tile coordinates for a given boundary and zoom level
   * @private
   */
  _getBoundaryTiles(boundary, zoom) {
    const tiles = [];
    const { north, south, east, west } = boundary;

    for (let lat = south; lat <= north; lat += this._getTileLatDelta(zoom)) {
      for (let lon = west; lon <= east; lon += this._getTileLonDelta(zoom, lat)) {
        const tile = this._latLonToTile(lat, lon, zoom);
        tiles.push({ ...tile, zoom });
      }
    }
    return tiles;
  }

  /**
   * Cache map tiles for a district across all registered zoom levels
   * @param {string} districtId - District to cache
   * @param {object} options - { forceRefresh, maxTiles }
   */
  async cacheDistrict(districtId, options = {}) {
    const district = this.districts.get(districtId);
    if (!district) {
      throw new Error(`District not found: ${districtId}`);
    }

    const { forceRefresh = false, maxTiles = Infinity } = options;

    try {
      district.status = 'caching';
      this.emit('cachingStarted', { districtId, timestamp: Date.now() });

      let totalTiles = 0;
      const tilesToCache = [];

      // Collect all tiles to cache
      for (const zoom of this.zoomLevels) {
        const tiles = this._getBoundaryTiles(district.boundary, zoom);
        tilesToCache.push(...tiles.slice(0, maxTiles - totalTiles));
        totalTiles += tiles.length;

        if (totalTiles >= maxTiles) break;
      }

      this.logger.log(`[MapCacheManager] Caching ${tilesToCache.length} tiles for district ${districtId}`);

      // Queue tiles for download
      const tilesToDownload = forceRefresh
        ? tilesToCache
        : tilesToCache.filter(tile => !this._tileExists(tile));

      this.downloadQueue.push(...tilesToDownload);
      await this._processDownloadQueue();

      district.tileCount = tilesToCache.length;
      district.estimatedSize = tilesToCache.length * 20 * 1024; // ~20KB per tile average
      district.status = 'cached';
      district.lastUpdated = new Date().toISOString();

      await this._saveDistrictMetadata(districtId);
      this.emit('cachingCompleted', { districtId, tileCount: tilesToCache.length });

      return { success: true, tileCount: tilesToCache.length };
    } catch (error) {
      district.status = 'failed';
      this.logger.error(`[MapCacheManager] Failed to cache district ${districtId}:`, error);
      this.emit('cachingFailed', { districtId, error: error.message });
      throw error;
    }
  }

  /**
   * Process download queue with concurrency control
   * @private
   */
  async _processDownloadQueue() {
    if (this.isDownloading || this.downloadQueue.length === 0) {
      return;
    }

    this.isDownloading = true;
    const batchSize = this.maxConcurrentDownloads;

    try {
      while (this.downloadQueue.length > 0) {
        const batch = this.downloadQueue.splice(0, batchSize);
        const promises = batch.map(tile => this._downloadAndCacheTile(tile));

        const results = await Promise.allSettled(promises);
        
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            this.logger.warn(`[MapCacheManager] Failed to download tile:`, results[idx].reason);
          }
        });

        const progress = ((this.downloadQueue.length + batchSize) / (this.downloadQueue.length + batchSize + this.downloadQueue.length)) * 100;
        this.emit('downloadProgress', { progress: Math.round(progress) });
      }
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Download and cache a single tile
   * @private
   */
  async _downloadAndCacheTile(tile) {
    const { x, y, zoom } = tile;
    const tileKey = `${zoom}/${x}/${y}`;
    const tilePath = path.join(this.cacheDir, tileKey + '.png');

    // Check if already cached
    if (this._tileExists(tile) && !tile.forceRefresh) {
      this._updateTileAccessTime(tileKey);
      return { success: true, cached: true };
    }

    try {
      const url = `${this.tileProvider}/${zoom}/${x}/${y}.png`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000,
        headers: { 'User-Agent': 'AmbulanceDispatchOfflineCache/1.0' }
      });

      // Check cache size before adding
      const dataSize = response.data.length;
      if (this.currentSize + dataSize > this.maxCacheSize) {
        await this._evictOldestTiles(dataSize);
      }

      // Create tile directory
      const tileDir = path.dirname(tilePath);
      await fs.mkdir(tileDir, { recursive: true });

      // Write tile
      await fs.writeFile(tilePath, response.data);

      this.currentSize += dataSize;
      this.tileIndex.set(tileKey, { timestamp: Date.now(), size: dataSize });

      return { success: true, downloaded: true, size: dataSize };
    } catch (error) {
      throw new Error(`Failed to download tile ${tileKey}: ${error.message}`);
    }
  }

  /**
   * Evict oldest tiles to make space (LRU strategy)
   * @private
   */
  async _evictOldestTiles(requiredSpace) {
    const entries = Array.from(this.tileIndex.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    let freedSpace = 0;
    for (const [tileKey, metadata] of entries) {
      if (freedSpace >= requiredSpace) break;

      const tilePath = path.join(this.cacheDir, tileKey + '.png');
      try {
        await fs.unlink(tilePath);
        freedSpace += metadata.size;
        this.currentSize -= metadata.size;
        this.tileIndex.delete(tileKey);
      } catch (error) {
        this.logger.warn(`[MapCacheManager] Failed to evict tile ${tileKey}:`, error);
      }
    }

    this.logger.log(`[MapCacheManager] Evicted ${entries.length} tiles, freed ${freedSpace} bytes`);
  }

  /**
   * Retrieve cached tile as buffer
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {number} zoom - Zoom level
   */
  async getTile(x, y, zoom) {
    const tileKey = `${zoom}/${x}/${y}`;
    const tilePath = path.join(this.cacheDir, tileKey + '.png');

    try {
      const tile = await fs.readFile(tilePath);
      this._updateTileAccessTime(tileKey);
      return tile;
    } catch (error) {
      throw new Error(`Tile not found in cache: ${tileKey}`);
    }
  }

  /**
   * Check if tile exists in cache
   * @private
   */
  _tileExists(tile) {
    const tileKey = `${tile.zoom}/${tile.x}/${tile.y}`;
    return this.tileIndex.has(tileKey);
  }

  /**
   * Update tile access timestamp for LRU
   * @private
   */
  _updateTileAccessTime(tileKey) {
    if (this.tileIndex.has(tileKey)) {
      const metadata = this.tileIndex.get(tileKey);
      metadata.timestamp = Date.now();
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const stats = {
      totalSize: this.currentSize,
      totalTiles: this.tileIndex.size,
      maxSize: this.maxCacheSize,
      utilizationPercent: ((this.currentSize / this.maxCacheSize) * 100).toFixed(2),
      districts: Array.from(this.districts.values()).map(d => ({
        id: d.id,
        name: d.name,
        status: d.status,
        tileCount: d.tileCount,
        lastUpdated: d.lastUpdated,
        cacheExpiry: d.cacheExpiry
      }))
    };
    return stats;
  }

  /**
   * Clean expired district caches
   */
  async cleanExpiredCaches() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [districtId, district] of this.districts) {
      if (district.cacheExpiry < now) {
        try {
          // Delete all tiles for this district
          const tiles = this._getBoundaryTiles(district.boundary, 15);
          for (const tile of tiles) {
            const tileKey = `${tile.zoom}/${tile.x}/${tile.y}`;
            const tilePath = path.join(this.cacheDir, tileKey + '.png');
            try {
              await fs.unlink(tilePath);
              this.currentSize -= this.tileIndex.get(tileKey)?.size || 0;
              this.tileIndex.delete(tileKey);
            } catch (e) {
              // Tile already deleted or doesn't exist
            }
          }
          district.status = 'expired';
          cleanedCount++;
        } catch (error) {
          this.logger.error(`[MapCacheManager] Failed to clean expired cache for ${districtId}:`, error);
        }
      }
    }

    this.logger.log(`[MapCacheManager] Cleaned ${cleanedCount} expired district caches`);
    return cleanedCount;
  }

  /**
   * Export cache metadata for transfer
   */
  async exportCacheMetadata() {
    return {
      exportDate: new Date().toISOString(),
      version: '1.0',
      cacheSize: this.currentSize,
      tileCount: this.tileIndex.size,
      districts: Array.from(this.districts.values()),
      tileIndex: Array.from(this.tileIndex.entries())
    };
  }

  /**
   * Validate boundary coordinates
   * @private
   */
  _validateBoundary(boundary) {
    const { north, south, east, west } = boundary;
    return (
      typeof north === 'number' && typeof south === 'number' &&
      typeof east === 'number' && typeof west === 'number' &&
      south >= -90 && north <= 90 &&
      west >= -180 && east <= 180 &&
      south < north && west < east
    );
  }

  /**
   * Convert lat/lon to tile coordinates
   * @private
   */
  _latLonToTile(lat, lon, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor(n * ((lon + 180) / 360));
    const y = Math.floor(n * (1 - (Math.log(Math.tan(Math.PI / 4 + Math.PI * lat / 360)) / Math.PI) / 2));
    return { x, y };
  }

  /**
   * Get latitude delta for tile
   * @private
   */
  _getTileLatDelta(zoom) {
    return 360 / Math.pow(2, zoom);
  }

  /**
   * Get longitude delta for tile
   * @private
   */
  _getTileLonDelta(zoom, lat) {
    return 360 / Math.pow(2, zoom) * Math.cos(Math.PI * lat / 180);
  }

  /**
   * Load metadata from disk
   * @private
   */
  async _loadMetadata() {
    try {
      const files = await fs.readdir(this.metadataDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.metadataDir, file), 'utf-8');
          const metadata = JSON.parse(content);
          this.districts.set(metadata.id, metadata);
        }
      }
    } catch (error) {
      this.logger.warn('[MapCacheManager] Failed to load metadata:', error);
    }
  }

  /**
   * Save district metadata
   * @private
   */
  async _saveDistrictMetadata(districtId) {
    const district = this.districts.get(districtId);
    if (district) {
      const metadataPath = path.join(this.metadataDir, `${districtId}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(district, null, 2));
    }
  }

  /**
   * Calculate current cache size
   * @private
   */
  _calculateCurrentSize() {
    let size = 0;
    for (const metadata of this.tileIndex.values()) {
      size += metadata.size || 0;
    }
    this.currentSize = size;
  }
}

module.exports = MapCacheManager;
