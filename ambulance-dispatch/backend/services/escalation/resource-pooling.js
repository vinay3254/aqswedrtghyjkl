/**
 * Resource Pooling Manager
 * Pools and manages resources across multiple jurisdictions
 */

const EventEmitter = require('events');

class ResourcePoolingManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      poolingStrategy: config.poolingStrategy || 'DYNAMIC', // DYNAMIC or STATIC
      rebalanceInterval: config.rebalanceInterval || 30000, // 30 seconds
      minStandbyTime: config.minStandbyTime || 60000, // 1 minute before rebalance
      ...config,
    };

    this.jurisdictions = new Map();
    this.pooledResources = new Map();
    this.resourceAllocations = new Map();
    this.rebalanceHistory = [];
    this.poolingPolicies = new Map();
  }

  /**
   * Register jurisdiction in resource pool
   * @param {string} jurisdictionId - Jurisdiction identifier
   * @param {Object} jurisdictionData - Jurisdiction information
   */
  registerJurisdiction(jurisdictionId, jurisdictionData) {
    const {
      name,
      location,
      baseUnits = [],
      resourceCapacity = 100,
      region = null,
    } = jurisdictionData;

    this.jurisdictions.set(jurisdictionId, {
      jurisdictionId,
      name,
      location,
      baseUnits: new Set(baseUnits),
      resourceCapacity,
      region,
      currentLoad: 0,
      pooledUnits: [],
      receivedUnits: [],
      registeredAt: new Date(),
    });

    // Create pooling policy for jurisdiction
    this.createPoolingPolicy(jurisdictionId);

    this.emit('jurisdiction-registered', {
      jurisdictionId,
      name,
      baseUnits: baseUnits.length,
    });
  }

  /**
   * Create pooling policy for jurisdiction
   * @private
   */
  createPoolingPolicy(jurisdictionId) {
    const policy = {
      jurisdictionId,
      createdAt: new Date(),
      rules: {
        shareWhenUtilization: 0.7, // Share when 70% utilized
        recallWhenUtilization: 0.4, // Recall when requesting jurisdiction < 40% utilized
        priorityTier: 1, // Higher tier gets resources first
        maxSharedUnits: 5,
        minRetainedUnits: 2,
      },
      status: 'ACTIVE',
    };

    this.poolingPolicies.set(jurisdictionId, policy);
  }

  /**
   * Request resources from pool
   * @param {string} requestingJurisdiction - Requesting jurisdiction ID
   * @param {Object} requestData - Request details
   * @returns {Promise<Object>}
   */
  async requestPooledResources(requestingJurisdiction, requestData) {
    const {
      unitType = 'AMBULANCE',
      requiredCount = 1,
      reason = '',
      duration = 3600000, // 1 hour default
    } = requestData;

    const requesting = this.jurisdictions.get(requestingJurisdiction);
    if (!requesting) {
      throw new Error(`Jurisdiction not found: ${requestingJurisdiction}`);
    }

    const requestId = `PR-${requestingJurisdiction}-${Date.now()}`;

    try {
      // Find available resources in pool
      const availableResources = this.findPooledResources(
        unitType,
        requiredCount,
        requestingJurisdiction
      );

      if (availableResources.length === 0) {
        throw new Error(`No ${unitType}s available in resource pool`);
      }

      // Allocate resources
      const allocation = {
        allocationId: requestId,
        requestingJurisdiction,
        sourceJurisdictions: [],
        resources: availableResources,
        unitType,
        requiredCount,
        allocatedCount: availableResources.length,
        reason,
        allocatedAt: new Date(),
        duration,
        expiresAt: new Date(Date.now() + duration),
        status: 'ALLOCATED',
      };

      this.resourceAllocations.set(requestId, allocation);

      // Move resources to requesting jurisdiction
      for (const resource of availableResources) {
        const sourceJurisdiction = this.jurisdictions.get(resource.jurisdictionId);
        if (sourceJurisdiction) {
          sourceJurisdiction.pooledUnits.push(resource);
          requesting.receivedUnits.push(resource);

          if (!allocation.sourceJurisdictions.includes(resource.jurisdictionId)) {
            allocation.sourceJurisdictions.push(resource.jurisdictionId);
          }
        }
      }

      // Set automatic recall
      this.scheduleRecall(requestId, duration);

      this.emit('resource-allocated', {
        allocationId: requestId,
        requestingJurisdiction,
        allocatedUnits: availableResources.length,
        sources: allocation.sourceJurisdictions.length,
      });

      return {
        success: true,
        allocationId: requestId,
        allocatedUnits: availableResources.length,
        expiresAt: allocation.expiresAt,
      };
    } catch (error) {
      this.emit('resource-allocation-failed', {
        requestId,
        jurisdiction: requestingJurisdiction,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find pooled resources matching criteria
   * @private
   */
  findPooledResources(unitType, requiredCount, requestingJurisdiction) {
    const available = [];

    for (const [jurisdictionId, jurisdiction] of this.jurisdictions) {
      if (jurisdictionId === requestingJurisdiction) continue;

      // Check if can share resources
      const canShare = this.canShareResources(jurisdictionId);
      if (!canShare) continue;

      // Find matching units
      for (const unitId of jurisdiction.baseUnits) {
        if (available.length >= requiredCount) break;

        available.push({
          unitId,
          unitType,
          jurisdictionId,
          originalJurisdiction: jurisdictionId,
          pooledAt: new Date(),
        });
      }

      if (available.length >= requiredCount) break;
    }

    return available.slice(0, requiredCount);
  }

  /**
   * Check if jurisdiction can share resources
   * @private
   */
  canShareResources(jurisdictionId) {
    const jurisdiction = this.jurisdictions.get(jurisdictionId);
    const policy = this.poolingPolicies.get(jurisdictionId);

    if (!jurisdiction || !policy) return false;
    if (policy.status !== 'ACTIVE') return false;

    // Calculate utilization
    const utilization = jurisdiction.currentLoad / jurisdiction.resourceCapacity;
    return utilization < policy.rules.shareWhenUtilization;
  }

  /**
   * Return resources to original jurisdiction
   * @param {string} allocationId - Allocation identifier
   * @returns {Object}
   */
  returnResources(allocationId) {
    const allocation = this.resourceAllocations.get(allocationId);

    if (!allocation) {
      throw new Error(`Allocation not found: ${allocationId}`);
    }

    if (allocation.status === 'RETURNED') {
      return { success: true, message: 'Already returned' };
    }

    // Return resources to original jurisdictions
    allocation.resources.forEach((resource) => {
      const requesting = this.jurisdictions.get(allocation.requestingJurisdiction);
      const source = this.jurisdictions.get(resource.originalJurisdiction);

      if (requesting) {
        requesting.receivedUnits = requesting.receivedUnits.filter(
          (u) => u.unitId !== resource.unitId
        );
      }

      if (source) {
        source.pooledUnits = source.pooledUnits.filter(
          (u) => u.unitId !== resource.unitId
        );
      }
    });

    allocation.status = 'RETURNED';
    allocation.returnedAt = new Date();

    this.emit('resources-returned', {
      allocationId,
      jurisdiction: allocation.requestingJurisdiction,
      returnedUnits: allocation.resources.length,
    });

    return {
      success: true,
      allocationId,
      returnedUnits: allocation.resources.length,
    };
  }

  /**
   * Schedule automatic resource recall
   * @private
   */
  scheduleRecall(allocationId, duration) {
    setTimeout(() => {
      const allocation = this.resourceAllocations.get(allocationId);
      if (allocation && allocation.status === 'ALLOCATED') {
        this.returnResources(allocationId);

        this.emit('resource-recall-triggered', {
          allocationId,
          reason: 'Allocation duration expired',
        });
      }
    }, duration);
  }

  /**
   * Rebalance resources across jurisdictions
   * @returns {Array} Rebalancing actions
   */
  rebalanceResources() {
    const actions = [];
    const timestamp = new Date();

    // Sort jurisdictions by utilization
    const sorted = Array.from(this.jurisdictions.entries())
      .map(([id, j]) => ({
        jurisdictionId: id,
        utilization: j.currentLoad / j.resourceCapacity,
        jurisdiction: j,
      }))
      .sort((a, b) => b.utilization - a.utilization);

    // Move resources from low to high utilization jurisdictions
    for (let i = 0; i < sorted.length; i++) {
      const highUtil = sorted[i];

      if (highUtil.utilization > 0.7) {
        // Find low utilization jurisdiction to borrow from
        for (let j = sorted.length - 1; j > i; j--) {
          const lowUtil = sorted[j];

          if (lowUtil.utilization < 0.5) {
            // Perform rebalance
            const resources = Array.from(lowUtil.jurisdiction.baseUnits)
              .slice(0, 1)
              .map((unitId) => ({
                unitId,
                source: lowUtil.jurisdictionId,
                target: highUtil.jurisdictionId,
              }));

            resources.forEach((r) => {
              actions.push({
                type: 'REBALANCE',
                source: r.source,
                target: r.target,
                resource: r.unitId,
                timestamp,
              });
            });

            break;
          }
        }
      }
    }

    // Record rebalancing
    if (actions.length > 0) {
      this.rebalanceHistory.push({
        timestamp,
        actions,
      });

      if (this.rebalanceHistory.length > 500) {
        this.rebalanceHistory = this.rebalanceHistory.slice(-500);
      }

      this.emit('resources-rebalanced', {
        actions: actions.length,
        timestamp,
      });
    }

    return actions;
  }

  /**
   * Update jurisdiction load
   * @param {string} jurisdictionId - Jurisdiction identifier
   * @param {number} load - Current load value
   */
  updateJurisdictionLoad(jurisdictionId, load) {
    const jurisdiction = this.jurisdictions.get(jurisdictionId);
    if (jurisdiction) {
      jurisdiction.currentLoad = load;
    }
  }

  /**
   * Get pool status
   * @returns {Object}
   */
  getPoolStatus() {
    const jurisdictionStats = Array.from(this.jurisdictions.entries()).map(
      ([id, j]) => ({
        jurisdictionId: id,
        name: j.name,
        utilization: (j.currentLoad / j.resourceCapacity),
        baseUnits: j.baseUnits.size,
        pooledUnits: j.pooledUnits.length,
        receivedUnits: j.receivedUnits.length,
      })
    );

    return {
      totalJurisdictions: this.jurisdictions.size,
      totalAllocations: this.resourceAllocations.size,
      activeAllocations: Array.from(this.resourceAllocations.values()).filter(
        (a) => a.status === 'ALLOCATED'
      ).length,
      jurisdictions: jurisdictionStats,
      poolingStrategy: this.config.poolingStrategy,
    };
  }

  /**
   * Get allocation details
   * @param {string} allocationId - Allocation identifier
   * @returns {Object|null}
   */
  getAllocationDetails(allocationId) {
    return this.resourceAllocations.get(allocationId) || null;
  }

  /**
   * Get jurisdiction details
   * @param {string} jurisdictionId - Jurisdiction identifier
   * @returns {Object|null}
   */
  getJurisdictionDetails(jurisdictionId) {
    const jurisdiction = this.jurisdictions.get(jurisdictionId);
    if (!jurisdiction) return null;

    return {
      jurisdictionId,
      name: jurisdiction.name,
      location: jurisdiction.location,
      resourceCapacity: jurisdiction.resourceCapacity,
      currentLoad: jurisdiction.currentLoad,
      utilization: jurisdiction.currentLoad / jurisdiction.resourceCapacity,
      baseUnits: Array.from(jurisdiction.baseUnits),
      pooledUnits: jurisdiction.pooledUnits.length,
      receivedUnits: jurisdiction.receivedUnits.length,
      policy: this.poolingPolicies.get(jurisdictionId),
    };
  }
}

module.exports = ResourcePoolingManager;
