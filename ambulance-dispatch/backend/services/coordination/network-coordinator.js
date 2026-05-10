/**
 * Network Coordinator
 * Orchestrates dispatch coordination across government (108/102) and private ambulance fleets
 * Manages multi-network request routing, priority assignment, and fleet synchronization
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class NetworkCoordinator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.networks = new Map();
    this.activeDispatches = new Map();
    this.networkMetrics = new Map();
    this.config = {
      maxCoordinationDelay: config.maxCoordinationDelay || 500, // ms
      preferredNetworkPriority: config.preferredNetworkPriority || [
        'government-108',
        'government-102',
        'private-network'
      ],
      enableDualDispatch: config.enableDualDispatch || false,
      ...config
    };
    
    this.initializeNetworks();
  }

  /**
   * Initialize supported EMS networks
   */
  initializeNetworks() {
    // Government networks (108 and 102)
    this.registerNetwork('government-108', {
      type: 'government',
      protocol: 'emergency',
      code: '108',
      maxCapacity: 500,
      responseTime: '8-10 minutes',
      coverage: 'city-wide'
    });

    this.registerNetwork('government-102', {
      type: 'government',
      protocol: 'emergency',
      code: '102',
      maxCapacity: 300,
      responseTime: '10-12 minutes',
      coverage: 'city-wide'
    });

    // Private networks
    this.registerNetwork('private-network', {
      type: 'private',
      protocol: 'standard',
      maxCapacity: 200,
      responseTime: '12-15 minutes',
      coverage: 'network-dependent'
    });

    logger.info('Network coordinator initialized with government and private networks');
  }

  /**
   * Register a new EMS network
   */
  registerNetwork(networkId, config) {
    this.networks.set(networkId, {
      id: networkId,
      ...config,
      status: 'active',
      registeredAt: Date.now(),
      activeDispatchCount: 0,
      totalDispatches: 0,
      successRate: 0
    });

    this.networkMetrics.set(networkId, {
      responseTimeAvg: 0,
      successCount: 0,
      failureCount: 0,
      overloadCount: 0,
      lastHealthCheck: Date.now()
    });

    logger.info(`Network registered: ${networkId}`, config);
    this.emit('network-registered', { networkId, config });
  }

  /**
   * Coordinate dispatch across networks
   * Selects optimal network based on availability, priority, and load
   */
  async coordinateDispatch(dispatchRequest) {
    const dispatchId = dispatchRequest.id || this.generateDispatchId();
    const startTime = Date.now();

    try {
      logger.info(`Coordinating dispatch ${dispatchId}`, {
        location: dispatchRequest.location,
        priority: dispatchRequest.priority,
        patientCount: dispatchRequest.patientCount
      });

      // Step 1: Validate request
      this.validateDispatchRequest(dispatchRequest);

      // Step 2: Evaluate all networks
      const networkEvaluations = await this.evaluateNetworks(dispatchRequest);

      // Step 3: Select optimal network(s)
      const selectedNetworks = this.selectNetworks(networkEvaluations, dispatchRequest);

      if (selectedNetworks.length === 0) {
        logger.warn(`No available networks for dispatch ${dispatchId}`);
        this.emit('dispatch-coordination-failed', {
          dispatchId,
          reason: 'no-available-networks'
        });
        return { success: false, reason: 'no-available-networks' };
      }

      // Step 4: Create dispatch record
      const dispatchRecord = {
        id: dispatchId,
        originalRequest: dispatchRequest,
        selectedNetworks,
        status: 'coordinated',
        coordinatedAt: Date.now(),
        coordinationTime: Date.now() - startTime,
        primaryNetwork: selectedNetworks[0],
        backupNetworks: selectedNetworks.slice(1)
      };

      this.activeDispatches.set(dispatchId, dispatchRecord);

      // Step 5: Update network metrics
      selectedNetworks.forEach(networkId => {
        const network = this.networks.get(networkId);
        if (network) {
          network.activeDispatchCount++;
          network.totalDispatches++;
        }
      });

      logger.info(`Dispatch coordinated successfully: ${dispatchId}`, {
        primaryNetwork: dispatchRecord.primaryNetwork,
        backupCount: dispatchRecord.backupNetworks.length,
        totalTime: dispatchRecord.coordinationTime
      });

      this.emit('dispatch-coordinated', dispatchRecord);

      return {
        success: true,
        dispatch: dispatchRecord
      };

    } catch (error) {
      logger.error(`Dispatch coordination failed: ${dispatchId}`, error);
      this.emit('dispatch-coordination-error', { dispatchId, error });
      return { success: false, reason: error.message };
    }
  }

  /**
   * Evaluate all networks for suitability
   */
  async evaluateNetworks(dispatchRequest) {
    const evaluations = [];

    for (const [networkId, network] of this.networks) {
      if (network.status !== 'active') {
        continue;
      }

      const evaluation = {
        networkId,
        network,
        score: 0,
        suitability: []
      };

      // Evaluate capacity
      const capacityScore = this.evaluateCapacity(network);
      evaluation.capacityScore = capacityScore;
      evaluation.score += capacityScore * 0.3;

      // Evaluate coverage
      const coverageScore = this.evaluateCoverage(network, dispatchRequest);
      evaluation.coverageScore = coverageScore;
      evaluation.score += coverageScore * 0.25;

      // Evaluate priority alignment
      const priorityScore = this.evaluatePriorityAlignment(networkId, dispatchRequest);
      evaluation.priorityScore = priorityScore;
      evaluation.score += priorityScore * 0.25;

      // Evaluate health metrics
      const healthScore = this.evaluateNetworkHealth(networkId);
      evaluation.healthScore = healthScore;
      evaluation.score += healthScore * 0.2;

      evaluations.push(evaluation);
    }

    return evaluations.sort((a, b) => b.score - a.score);
  }

  /**
   * Evaluate network capacity
   */
  evaluateCapacity(network) {
    const utilization = network.activeDispatchCount / network.maxCapacity;
    
    if (utilization > 0.9) return 0.1; // Critical
    if (utilization > 0.75) return 0.4; // High load
    if (utilization > 0.5) return 0.7; // Medium load
    return 1.0; // Available
  }

  /**
   * Evaluate network coverage for location
   */
  evaluateCoverage(network, dispatchRequest) {
    // In production, this would check actual coverage maps
    if (network.type === 'government') {
      return 1.0; // Government networks have full coverage
    }

    // Private networks may have limited coverage
    if (dispatchRequest.location && network.coverage === 'network-dependent') {
      // Check if location is in private network's service area
      return 0.8; // Placeholder
    }

    return 0.9;
  }

  /**
   * Evaluate priority alignment
   */
  evaluatePriorityAlignment(networkId, dispatchRequest) {
    const priority = this.config.preferredNetworkPriority.indexOf(networkId);
    
    if (priority === -1) return 0.5;
    
    // Higher priority networks get higher scores
    return 1.0 - (priority * 0.3);
  }

  /**
   * Evaluate network health
   */
  evaluateNetworkHealth(networkId) {
    const metrics = this.networkMetrics.get(networkId);
    if (!metrics) return 0.5;

    const successRate = metrics.successCount / (metrics.successCount + metrics.failureCount) || 0.5;
    const recentHealth = (Date.now() - metrics.lastHealthCheck) < 300000 ? 1.0 : 0.7;

    return (successRate * 0.7) + (recentHealth * 0.3);
  }

  /**
   * Select optimal network(s) for dispatch
   */
  selectNetworks(evaluations, dispatchRequest) {
    const selected = [];
    const highPriorityDispatch = dispatchRequest.priority === 'critical';

    // Always select top network
    if (evaluations.length > 0) {
      selected.push(evaluations[0].networkId);
    }

    // Select backup networks for critical dispatches
    if (highPriorityDispatch && this.config.enableDualDispatch) {
      if (evaluations.length > 1) {
        selected.push(evaluations[1].networkId);
      }
    }

    return selected;
  }

  /**
   * Validate dispatch request structure
   */
  validateDispatchRequest(request) {
    if (!request.id && !request.location) {
      throw new Error('Invalid dispatch request: missing location');
    }

    if (!request.priority || !['low', 'medium', 'high', 'critical'].includes(request.priority)) {
      throw new Error('Invalid dispatch request: invalid priority level');
    }

    if (!request.patientCount || request.patientCount < 1) {
      throw new Error('Invalid dispatch request: invalid patient count');
    }
  }

  /**
   * Get coordination status for active dispatch
   */
  getDispatchStatus(dispatchId) {
    return this.activeDispatches.get(dispatchId) || null;
  }

  /**
   * Complete dispatch coordination
   */
  completeDispatch(dispatchId, result) {
    const dispatch = this.activeDispatches.get(dispatchId);
    
    if (!dispatch) {
      logger.warn(`Attempt to complete unknown dispatch: ${dispatchId}`);
      return false;
    }

    dispatch.status = 'completed';
    dispatch.completedAt = Date.now();
    dispatch.completionTime = dispatch.completedAt - dispatch.coordinatedAt;
    dispatch.result = result;

    // Update network metrics
    dispatch.selectedNetworks.forEach(networkId => {
      const network = this.networks.get(networkId);
      if (network) {
        network.activeDispatchCount = Math.max(0, network.activeDispatchCount - 1);
      }

      const metrics = this.networkMetrics.get(networkId);
      if (metrics && result.success) {
        metrics.successCount++;
      } else if (metrics) {
        metrics.failureCount++;
      }
    });

    this.emit('dispatch-completed', dispatch);
    return true;
  }

  /**
   * Get network status summary
   */
  getNetworkStatus() {
    const status = {};

    for (const [networkId, network] of this.networks) {
      const metrics = this.networkMetrics.get(networkId);
      status[networkId] = {
        name: network.id,
        type: network.type,
        status: network.status,
        activeDispatches: network.activeDispatchCount,
        capacity: network.maxCapacity,
        utilization: (network.activeDispatchCount / network.maxCapacity * 100).toFixed(2) + '%',
        totalDispatches: network.totalDispatches,
        successRate: metrics ? 
          ((metrics.successCount / (metrics.successCount + metrics.failureCount) * 100) || 0).toFixed(2) + '%'
          : 'N/A'
      };
    }

    return status;
  }

  /**
   * Generate unique dispatch ID
   */
  generateDispatchId() {
    return `disp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check for all networks
   */
  async performHealthCheck() {
    const results = {};

    for (const [networkId, network] of this.networks) {
      try {
        // In production, this would make actual health check requests
        const isHealthy = Math.random() > 0.1; // Simulate 90% uptime
        results[networkId] = isHealthy;
        
        network.status = isHealthy ? 'active' : 'degraded';
        
        const metrics = this.networkMetrics.get(networkId);
        if (metrics) {
          metrics.lastHealthCheck = Date.now();
        }

        logger.debug(`Health check for ${networkId}: ${isHealthy ? 'healthy' : 'degraded'}`);
      } catch (error) {
        logger.error(`Health check failed for ${networkId}`, error);
        network.status = 'unhealthy';
        results[networkId] = false;
      }
    }

    this.emit('health-check-completed', results);
    return results;
  }

  /**
   * Get detailed coordination statistics
   */
  getCoordinationStats() {
    let totalActive = 0;
    let totalCompleted = 0;

    for (const dispatch of this.activeDispatches.values()) {
      if (dispatch.status === 'completed') {
        totalCompleted++;
      } else {
        totalActive++;
      }
    }

    return {
      activeDispatches: totalActive,
      completedDispatches: totalCompleted,
      totalNetworks: this.networks.size,
      networkStatus: this.getNetworkStatus(),
      registeredAt: this.startTime
    };
  }
}

module.exports = NetworkCoordinator;
