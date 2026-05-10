/**
 * Sync Manager
 * Handles synchronization of cached data when connectivity is restored
 * Manages conflict resolution, data integrity, and smart update strategies
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const axios = require('axios');

class SyncManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.syncDir = options.syncDir || path.join(process.cwd(), '.offline-cache', 'sync');
    this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:3000/api';
    this.syncInterval = options.syncInterval || 5 * 60 * 1000; // 5 minutes
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // ms
    this.logger = options.logger || console;
    this.isOnline = options.isOnline || false;
    this.syncQueue = [];
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncStats = {
      totalSynced: 0,
      totalFailed: 0,
      totalConflicts: 0,
      lastAttempt: null
    };
    this.networkMonitor = null;
    this.pendingChanges = new Map(); // Track local changes for sync
  }

  /**
   * Initialize sync manager
   */
  async initialize() {
    try {
      await fs.mkdir(this.syncDir, { recursive: true });
      await this._loadPendingChanges();
      
      // Monitor connectivity
      this._initNetworkMonitor();
      
      // Start periodic sync if online
      if (this.isOnline) {
        this._startPeriodicSync();
      }

      this.logger.log('[SyncManager] Initialized successfully');
      this.emit('initialized', { pendingChanges: this.pendingChanges.size });
    } catch (error) {
      this.logger.error('[SyncManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Record a local change for later sync
   * @param {string} changeId - Unique change identifier
   * @param {string} type - Change type (create, update, delete, decision)
   * @param {string} entity - Entity type (location, route, decision, status)
   * @param {object} data - Change data
   * @param {number} priority - Sync priority (higher = sync first)
   */
  async recordChange(changeId, type, entity, data, priority = 1) {
    const change = {
      id: changeId,
      type,
      entity,
      data,
      priority,
      timestamp: Date.now(),
      status: 'pending', // pending, synced, failed, conflicted
      retryCount: 0,
      lastError: null
    };

    this.pendingChanges.set(changeId, change);
    
    // Persist to disk
    await this._persistChange(change);
    
    this.logger.log(`[SyncManager] Recorded change: ${changeId} (${type}/${entity})`);
    this.emit('changeRecorded', { changeId, type, entity });

    // If online, sync immediately
    if (this.isOnline) {
      await this._syncChange(changeId);
    }
  }

  /**
   * Trigger full sync
   */
  async sync() {
    if (this.isSyncing) {
      this.logger.warn('[SyncManager] Sync already in progress');
      return { status: 'already-syncing', changes: this.pendingChanges.size };
    }

    if (!this.isOnline) {
      this.logger.warn('[SyncManager] Not online, cannot sync');
      return { status: 'offline', changes: this.pendingChanges.size };
    }

    this.isSyncing = true;
    this.emit('syncStarted', { changeCount: this.pendingChanges.size });

    try {
      // Sort changes by priority
      const changesToSync = Array.from(this.pendingChanges.values())
        .filter(c => c.status === 'pending')
        .sort((a, b) => b.priority - a.priority);

      this.logger.log(`[SyncManager] Starting sync for ${changesToSync.length} changes`);

      const results = {
        synced: 0,
        failed: 0,
        conflicted: 0,
        details: []
      };

      for (const change of changesToSync) {
        const result = await this._syncChange(change.id);
        
        if (result.status === 'synced') {
          results.synced++;
        } else if (result.status === 'conflicted') {
          results.conflicted++;
        } else {
          results.failed++;
        }

        results.details.push(result);

        // Respect rate limiting
        await this._delay(100);
      }

      this.lastSyncTime = Date.now();
      this.syncStats.lastAttempt = new Date().toISOString();
      this.syncStats.totalSynced += results.synced;
      this.syncStats.totalFailed += results.failed;
      this.syncStats.totalConflicts += results.conflicted;

      this.logger.log(`[SyncManager] Sync completed: ${results.synced} synced, ${results.conflicted} conflicted, ${results.failed} failed`);
      this.emit('syncCompleted', results);

      return results;
    } catch (error) {
      this.logger.error('[SyncManager] Sync failed:', error);
      this.emit('syncFailed', { error: error.message });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync individual change
   * @private
   */
  async _syncChange(changeId) {
    const change = this.pendingChanges.get(changeId);
    if (!change) {
      return { status: 'not-found', changeId };
    }

    try {
      // Build API endpoint and payload
      const endpoint = this._buildEndpoint(change.entity, change.type);
      const payload = {
        id: change.id,
        timestamp: change.timestamp,
        type: change.type,
        entity: change.entity,
        data: change.data
      };

      // Attempt sync with retries
      let lastError = null;
      for (let retry = 0; retry <= this.maxRetries; retry++) {
        try {
          const response = await axios.post(`${this.apiBaseUrl}${endpoint}`, payload, {
            timeout: 10000,
            headers: { 'X-Sync-Token': this._getSyncToken() }
          });

          if (response.status === 200 || response.status === 201) {
            // Check for conflict
            if (response.data.conflict) {
              return await this._handleConflict(change, response.data);
            }

            // Success
            change.status = 'synced';
            change.retryCount = 0;
            await this._persistChange(change);

            this.logger.log(`[SyncManager] Synced: ${changeId}`);
            this.emit('changeSynced', { changeId, endpoint });

            return { status: 'synced', changeId, data: response.data };
          }
        } catch (error) {
          lastError = error;
          if (retry < this.maxRetries) {
            const delayMs = this.retryDelay * Math.pow(2, retry);
            await this._delay(delayMs);
          }
        }
      }

      // All retries failed
      change.status = 'failed';
      change.retryCount++;
      change.lastError = lastError?.message;
      await this._persistChange(change);

      this.logger.error(`[SyncManager] Failed to sync ${changeId}:`, lastError);
      this.emit('changeFailed', { changeId, error: lastError?.message });

      return { status: 'failed', changeId, error: lastError?.message };
    } catch (error) {
      this.logger.error(`[SyncManager] Unexpected error syncing ${changeId}:`, error);
      return { status: 'error', changeId, error: error.message };
    }
  }

  /**
   * Handle sync conflict
   * @private
   */
  async _handleConflict(change, serverData) {
    this.logger.warn(`[SyncManager] Conflict detected for ${change.id}`);

    const conflictInfo = {
      changeId: change.id,
      localVersion: {
        timestamp: change.timestamp,
        data: change.data
      },
      serverVersion: {
        timestamp: serverData.serverTimestamp,
        data: serverData.serverData
      },
      resolvedAt: Date.now(),
      strategy: 'manual' // manual, local, server, merge
    };

    // Emit conflict for application to handle
    this.emit('conflictDetected', conflictInfo);

    // Save conflict details
    const conflictPath = path.join(this.syncDir, `conflict-${change.id}.json`);
    await fs.writeFile(conflictPath, JSON.stringify(conflictInfo, null, 2));

    change.status = 'conflicted';
    await this._persistChange(change);

    return { status: 'conflicted', changeId: change.id, conflict: conflictInfo };
  }

  /**
   * Resolve conflict
   * @param {string} changeId - Change with conflict
   * @param {string} strategy - Resolution strategy (local, server, merged)
   * @param {object} mergedData - Merged data if strategy is 'merge'
   */
  async resolveConflict(changeId, strategy, mergedData = null) {
    const change = this.pendingChanges.get(changeId);
    if (!change) {
      throw new Error(`Change not found: ${changeId}`);
    }

    if (strategy === 'local') {
      // Keep local data, retry sync
      await this._syncChange(changeId);
    } else if (strategy === 'server') {
      // Accept server data
      change.status = 'synced';
      await this._persistChange(change);
    } else if (strategy === 'merge' && mergedData) {
      // Apply merged data
      change.data = mergedData;
      await this._syncChange(changeId);
    }

    this.logger.log(`[SyncManager] Resolved conflict for ${changeId} using ${strategy} strategy`);
    this.emit('conflictResolved', { changeId, strategy });
  }

  /**
   * Build API endpoint based on entity type
   * @private
   */
  _buildEndpoint(entity, type) {
    const endpoints = {
      location: '/locations/sync',
      route: '/routes/sync',
      decision: '/decisions/sync',
      status: '/status/sync',
      ambulance: '/ambulances/sync',
      incident: '/incidents/sync'
    };

    return endpoints[entity] || '/sync/generic';
  }

  /**
   * Get sync token for authentication
   * @private
   */
  _getSyncToken() {
    // In production, this would be obtained from secure storage
    return process.env.SYNC_TOKEN || 'offline-sync-token';
  }

  /**
   * Handle online status change
   */
  setOnlineStatus(isOnline) {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (!wasOnline && isOnline) {
      this.logger.log('[SyncManager] Connection restored, starting sync');
      this.emit('online');
      this._startPeriodicSync();
      this.sync().catch(error => {
        this.logger.error('[SyncManager] Auto-sync failed:', error);
      });
    } else if (wasOnline && !isOnline) {
      this.logger.log('[SyncManager] Connection lost, pausing sync');
      this.emit('offline');
      this._stopPeriodicSync();
    }
  }

  /**
   * Get pending changes
   */
  getPendingChanges() {
    return Array.from(this.pendingChanges.values()).map(change => ({
      id: change.id,
      type: change.type,
      entity: change.entity,
      status: change.status,
      timestamp: change.timestamp,
      retryCount: change.retryCount
    }));
  }

  /**
   * Get sync statistics
   */
  getStats() {
    return {
      ...this.syncStats,
      pendingChanges: this.pendingChanges.size,
      isSyncing: this.isSyncing,
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime
    };
  }

  /**
   * Clear synced changes
   */
  async clearSyncedChanges() {
    let clearedCount = 0;
    
    for (const [changeId, change] of this.pendingChanges) {
      if (change.status === 'synced') {
        this.pendingChanges.delete(changeId);
        const changePath = path.join(this.syncDir, `${changeId}.json`);
        try {
          await fs.unlink(changePath);
          clearedCount++;
        } catch (e) {
          // File already deleted or doesn't exist
        }
      }
    }

    this.logger.log(`[SyncManager] Cleared ${clearedCount} synced changes`);
    return clearedCount;
  }

  /**
   * Initialize network monitoring
   * @private
   */
  _initNetworkMonitor() {
    if (typeof window !== 'undefined') {
      // Browser environment
      window.addEventListener('online', () => this.setOnlineStatus(true));
      window.addEventListener('offline', () => this.setOnlineStatus(false));
    } else {
      // Node.js environment - periodically check connectivity
      this.networkMonitor = setInterval(async () => {
        try {
          await axios.head(`${this.apiBaseUrl}/health`, { timeout: 3000 });
          if (!this.isOnline) {
            this.setOnlineStatus(true);
          }
        } catch (error) {
          if (this.isOnline) {
            this.setOnlineStatus(false);
          }
        }
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Start periodic sync
   * @private
   */
  _startPeriodicSync() {
    if (this.syncInterval > 0) {
      this.syncTimer = setInterval(() => {
        if (!this.isSyncing && this.isOnline) {
          this.sync().catch(error => {
            this.logger.error('[SyncManager] Periodic sync failed:', error);
          });
        }
      }, this.syncInterval);
    }
  }

  /**
   * Stop periodic sync
   * @private
   */
  _stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Persist change to disk
   * @private
   */
  async _persistChange(change) {
    const changePath = path.join(this.syncDir, `${change.id}.json`);
    await fs.writeFile(changePath, JSON.stringify(change, null, 2));
  }

  /**
   * Load pending changes from disk
   * @private
   */
  async _loadPendingChanges() {
    try {
      const files = await fs.readdir(this.syncDir);
      
      for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('conflict-')) {
          const content = await fs.readFile(path.join(this.syncDir, file), 'utf-8');
          const change = JSON.parse(content);
          this.pendingChanges.set(change.id, change);
        }
      }

      this.logger.log(`[SyncManager] Loaded ${this.pendingChanges.size} pending changes`);
    } catch (error) {
      this.logger.warn('[SyncManager] Failed to load pending changes:', error);
    }
  }

  /**
   * Utility: Delay function
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this._stopPeriodicSync();
    
    if (this.networkMonitor) {
      clearInterval(this.networkMonitor);
    }

    this.logger.log('[SyncManager] Destroyed');
  }
}

module.exports = SyncManager;
