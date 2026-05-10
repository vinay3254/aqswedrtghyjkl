/**
 * Storage Optimizer
 * Compresses and optimizes cached map data for efficient storage
 * Implements delta compression, deduplication, and smart deletion
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { EventEmitter } = require('events');
const crypto = require('crypto');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

class StorageOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.offline-cache');
    this.compressionLevel = options.compressionLevel || 6; // 1-9
    this.compressionAlgorithm = options.compressionAlgorithm || 'gzip'; // gzip, deflate
    this.deduplicationEnabled = options.deduplicationEnabled !== false;
    this.optimizationInterval = options.optimizationInterval || 24 * 60 * 60 * 1000; // 24 hours
    this.logger = options.logger || console;
    this.fileIndex = new Map(); // filename -> { size, hash, compressed, compressionRatio }
    this.hashIndex = new Map(); // hash -> [filenames] (for deduplication)
    this.optimizationStats = {
      originalSize: 0,
      compressedSize: 0,
      savedSpace: 0,
      duplicatesFound: 0,
      compressionRatio: 0,
      lastOptimization: null
    };
  }

  /**
   * Initialize storage optimizer
   */
  async initialize() {
    try {
      await this._buildFileIndex();
      this._startPeriodicOptimization();
      
      this.logger.log('[StorageOptimizer] Initialized successfully');
      this.emit('initialized', this.optimizationStats);
    } catch (error) {
      this.logger.error('[StorageOptimizer] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Optimize all cached data
   * @param {object} options - { includeCompression, includeDedupe, includeCleanup }
   */
  async optimizeAll(options = {}) {
    const {
      includeCompression = true,
      includeDedupe = true,
      includeCleanup = true,
      dryRun = false
    } = options;

    const startTime = Date.now();
    this.logger.log('[StorageOptimizer] Starting optimization...');
    this.emit('optimizationStarted', { timestamp: startTime });

    try {
      let results = {
        compression: { filesCompressed: 0, spaceSaved: 0 },
        deduplication: { duplicatesFound: 0, spaceSaved: 0 },
        cleanup: { filesDeleted: 0, spaceSaved: 0 },
        totalSaved: 0,
        dryRun
      };

      if (includeCompression) {
        results.compression = await this._optimizeCompression(dryRun);
      }

      if (includeDedupe) {
        results.deduplication = await this._optimizeDeduplication(dryRun);
      }

      if (includeCleanup) {
        results.cleanup = await this._optimizeCleanup(dryRun);
      }

      results.totalSaved = 
        results.compression.spaceSaved + 
        results.deduplication.spaceSaved + 
        results.cleanup.spaceSaved;

      const duration = Date.now() - startTime;
      
      this.optimizationStats.lastOptimization = new Date().toISOString();
      this.optimizationStats.savedSpace = results.totalSaved;

      this.logger.log(`[StorageOptimizer] Optimization completed in ${duration}ms, saved ${this._formatBytes(results.totalSaved)}`);
      this.emit('optimizationCompleted', results);

      return results;
    } catch (error) {
      this.logger.error('[StorageOptimizer] Optimization failed:', error);
      this.emit('optimizationFailed', { error: error.message });
      throw error;
    }
  }

  /**
   * Compress file
   * @param {string} filePath - Path to file to compress
   */
  async compressFile(filePath) {
    try {
      const fileContent = await fs.readFile(filePath);
      
      let compressed;
      const options = { level: this.compressionLevel };

      if (this.compressionAlgorithm === 'gzip') {
        compressed = await gzip(fileContent, options);
      } else if (this.compressionAlgorithm === 'deflate') {
        compressed = await deflate(fileContent, options);
      }

      const ratio = (compressed.length / fileContent.length) * 100;
      const spaceSaved = fileContent.length - compressed.length;

      // Only use compression if it saves space
      if (ratio < 95) {
        const compressedPath = `${filePath}.${this.compressionAlgorithm}`;
        await fs.writeFile(compressedPath, compressed);
        await fs.unlink(filePath); // Delete original

        return {
          originalSize: fileContent.length,
          compressedSize: compressed.length,
          ratio,
          spaceSaved,
          success: true
        };
      }

      return { success: false, reason: 'Compression not beneficial' };
    } catch (error) {
      this.logger.error(`[StorageOptimizer] Failed to compress ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Decompress file
   * @param {string} filePath - Path to compressed file
   */
  async decompressFile(filePath) {
    try {
      if (!filePath.includes('.gzip') && !filePath.includes('.deflate')) {
        return { success: false, reason: 'Not a compressed file' };
      }

      const fileContent = await fs.readFile(filePath);
      
      let decompressed;
      if (filePath.includes('.gzip')) {
        decompressed = await gunzip(fileContent);
      } else if (filePath.includes('.deflate')) {
        decompressed = await inflate(fileContent);
      }

      const originalPath = filePath.replace(/\.(gzip|deflate)$/, '');
      await fs.writeFile(originalPath, decompressed);
      await fs.unlink(filePath); // Delete compressed version

      return {
        decompressedSize: decompressed.length,
        success: true
      };
    } catch (error) {
      this.logger.error(`[StorageOptimizer] Failed to decompress ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Optimize via compression
   * @private
   */
  async _optimizeCompression(dryRun = false) {
    this.logger.log('[StorageOptimizer] Compressing large files...');

    let filesCompressed = 0;
    let totalSaved = 0;

    // Find large files (> 100KB)
    const largeFiles = Array.from(this.fileIndex.entries())
      .filter(([_, info]) => info.size > 100 * 1024 && !info.compressed)
      .map(([filename]) => filename);

    for (const filename of largeFiles) {
      try {
        const filePath = path.join(this.cacheDir, filename);
        const result = await this.compressFile(filePath);

        if (result.success && !dryRun) {
          filesCompressed++;
          totalSaved += result.spaceSaved;
          
          const info = this.fileIndex.get(filename);
          info.compressed = true;
          info.compressionRatio = result.ratio;
        }
      } catch (error) {
        this.logger.warn(`[StorageOptimizer] Failed to compress ${filename}:`, error);
      }
    }

    return { filesCompressed, spaceSaved: totalSaved };
  }

  /**
   * Optimize via deduplication
   * @private
   */
  async _optimizeDeduplication(dryRun = false) {
    if (!this.deduplicationEnabled) {
      return { duplicatesFound: 0, spaceSaved: 0 };
    }

    this.logger.log('[StorageOptimizer] Finding duplicate files...');

    const duplicates = this._findDuplicates();
    let spaceSaved = 0;

    for (const [hash, filenames] of duplicates) {
      if (filenames.length > 1) {
        // Keep first file, hardlink others or delete
        const keeper = filenames[0];

        for (let i = 1; i < filenames.length; i++) {
          const duplicate = filenames[i];
          const duplicatePath = path.join(this.cacheDir, duplicate);
          const keeperPath = path.join(this.cacheDir, keeper);

          try {
            if (!dryRun) {
              // Try hardlink first (atomic, space-efficient)
              try {
                await fs.link(keeperPath, duplicatePath);
              } catch {
                // Fallback to symlink if hardlink fails
                await fs.symlink(keeperPath, duplicatePath);
              }
            }

            const size = this.fileIndex.get(duplicate)?.size || 0;
            spaceSaved += size;
          } catch (error) {
            this.logger.warn(`[StorageOptimizer] Failed to deduplicate ${duplicate}:`, error);
          }
        }
      }
    }

    return { duplicatesFound: duplicates.size, spaceSaved };
  }

  /**
   * Optimize via cleanup
   * @private
   */
  async _optimizeCleanup(dryRun = false) {
    this.logger.log('[StorageOptimizer] Cleaning up unnecessary files...');

    let filesDeleted = 0;
    let spaceSaved = 0;

    // Find candidates for deletion
    const candidates = this._findCleanupCandidates();

    for (const filename of candidates) {
      try {
        const filePath = path.join(this.cacheDir, filename);
        const stats = await fs.stat(filePath);

        if (!dryRun) {
          await fs.unlink(filePath);
        }

        filesDeleted++;
        spaceSaved += stats.size;
        this.fileIndex.delete(filename);
      } catch (error) {
        this.logger.warn(`[StorageOptimizer] Failed to delete ${filename}:`, error);
      }
    }

    return { filesDeleted, spaceSaved };
  }

  /**
   * Find duplicate files by content hash
   * @private
   */
  _findDuplicates() {
    const duplicates = new Map();

    for (const [filename, hash] of this.hashIndex) {
      if (!duplicates.has(hash)) {
        duplicates.set(hash, []);
      }
      duplicates.get(hash).push(filename);
    }

    // Return only actual duplicates
    return new Map(
      Array.from(duplicates.entries()).filter(([_, files]) => files.length > 1)
    );
  }

  /**
   * Find files eligible for cleanup
   * @private
   */
  _findCleanupCandidates() {
    const candidates = [];
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    for (const [filename, info] of this.fileIndex) {
      // Delete temporary or very old files
      if (filename.includes('.tmp') || filename.includes('.bak')) {
        candidates.push(filename);
      } else if (info.lastAccessed && info.lastAccessed < thirtyDaysAgo) {
        candidates.push(filename);
      }
    }

    return candidates;
  }

  /**
   * Build file index
   * @private
   */
  async _buildFileIndex() {
    try {
      const files = await this._walkDir(this.cacheDir);

      for (const filePath of files) {
        try {
          const stats = await fs.stat(filePath);
          const relativePath = path.relative(this.cacheDir, filePath);
          const hash = await this._hashFile(filePath);

          this.fileIndex.set(relativePath, {
            size: stats.size,
            hash,
            compressed: filePath.includes('.gzip') || filePath.includes('.deflate'),
            lastAccessed: stats.atime.getTime(),
            created: stats.birthtime.getTime()
          });

          if (!this.hashIndex.has(hash)) {
            this.hashIndex.set(hash, []);
          }
          this.hashIndex.get(hash).push(relativePath);

          this.optimizationStats.originalSize += stats.size;
        } catch (error) {
          this.logger.warn(`[StorageOptimizer] Failed to index ${filePath}:`, error);
        }
      }

      this.logger.log(`[StorageOptimizer] Indexed ${this.fileIndex.size} files`);
    } catch (error) {
      this.logger.error('[StorageOptimizer] Failed to build file index:', error);
    }
  }

  /**
   * Recursively walk directory
   * @private
   */
  async _walkDir(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...await this._walkDir(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Hash file content (SHA256)
   * @private
   */
  async _hashFile(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = await fs.readFile(filePath);
    hash.update(stream);
    return hash.digest('hex');
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      ...this.optimizationStats,
      fileCount: this.fileIndex.size,
      compressionAlgorithm: this.compressionAlgorithm,
      compressionLevel: this.compressionLevel
    };
  }

  /**
   * Format bytes for display
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Start periodic optimization
   * @private
   */
  _startPeriodicOptimization() {
    if (this.optimizationInterval > 0) {
      this.optimizationTimer = setInterval(() => {
        this.optimizeAll().catch(error => {
          this.logger.error('[StorageOptimizer] Periodic optimization failed:', error);
        });
      }, this.optimizationInterval);
    }
  }

  /**
   * Stop periodic optimization
   * @private
   */
  _stopPeriodicOptimization() {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this._stopPeriodicOptimization();
    this.logger.log('[StorageOptimizer] Destroyed');
  }
}

module.exports = StorageOptimizer;
