/**
 * Load Balancer
 * Intelligently distributes dispatch requests across networks based on:
 * - Current capacity and utilization
 * - Network health and performance metrics
 * - Geographic proximity and coverage
 * - Historical performance data
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class LoadBalancer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.networkQueues = new Map();
    this.loadMetrics = new Map();
    this.balancingStrategies = new Map();
    this.config = {
      strategyType: config.strategyType || 'weighted-round-robin',
      rebalanceInterval: config.rebalanceInterval || 30000, // ms
      thresholdHigh: config.thresholdHigh || 0.8,
      thresholdCritical: config.thresholdCritical || 0.95,
      enableAutoRebalancing: config.enableAutoRebalancing !== false,
      ...config
    };

    this.initializeStrategies();
    this.initializeMetrics();

    if (this.config.enableAutoRebalancing) {
      this.startAutoRebalancing();
    }
  }

  /**
   * Initialize load balancing strategies
   */
  initializeStrategies() {
    // Round Robin - Simple cyclic distribution
    this.registerStrategy('round-robin', (networks) => {
      const available = networks.filter(n => n.status === 'active');
      if (available.length === 0) return null;
      
      const index = (this.roundRobinIndex || 0) % available.length;
      this.roundRobinIndex = index + 1;
      return available[index];
    });

    // Weighted Round Robin - Based on capacity
    this.registerStrategy('weighted-round-robin', (networks) => {
      return this.selectWeightedRoundRobin(networks);
    });

    // Least Connections - Send to network with fewest active dispatches
    this.registerStrategy('least-connections', (networks) => {
      return this.selectLeastConnections(networks);
    });

    // Capacity Based - Send to network with most available capacity
    this.registerStrategy('capacity-based', (networks) => {
      return this.selectByCapacity(networks);
    });

    // Performance Based - Send to network with best recent performance
    this.registerStrategy('performance-based', (networks) => {
      return this.selectByPerformance(networks);
    });

    // Geographic - Send to network closest to incident location
    this.registerStrategy('geographic', (networks, context) => {
      return this.selectByGeographic(networks, context);
    });

    logger.info('Load balancing strategies initialized', {
      strategies: Array.from(this.balancingStrategies.keys())
    });
  }

  /**
   * Register custom balancing strategy
   */
  registerStrategy(name, strategyFn) {
    this.balancingStrategies.set(name, strategyFn);
  }

  /**
   * Initialize load metrics for networks
   */
  initializeMetrics() {
    this.globalMetrics = {
      totalDispatchesBalanced: 0,
      totalRebalances: 0,
      averageLoadFactor: 0,
      peakLoadTime: null,
      lastMetricsUpdate: Date.now()
    };
  }

  /**
   * Register network for load balancing
   */
  registerNetwork(networkId, config) {
    this.networkQueues.set(networkId, {
      networkId,
      queue: [],
      activeCount: 0,
      maxCapacity: config.maxCapacity || 100,
      priority: config.priority || 'normal',
      weight: config.weight || 1,
      status: 'active',
      lastUpdated: Date.now()
    });

    this.loadMetrics.set(networkId, {
      networkId,
      currentLoad: 0,
      peakLoad: 0,
      averageLoad: 0,
      requestsProcessed: 0,
      rejectedRequests: 0,
      lastRebalanceTime: Date.now(),
      responseTimeMs: 0,
      errorRate: 0
    });

    logger.debug(`Network registered for load balancing: ${networkId}`);
  }

  /**
   * Balance and dispatch request to optimal network
   */
  async balanceDispatch(dispatchRequest, availableNetworks) {
    const startTime = Date.now();

    try {
      logger.info(`Balancing dispatch request`, {
        priority: dispatchRequest.priority,
        networkCount: availableNetworks.length
      });

      // Validate input
      if (!availableNetworks || availableNetworks.length === 0) {
        throw new Error('No available networks for load balancing');
      }

      // Select strategy based on request type
      const strategy = this.selectStrategy(dispatchRequest);
      
      // Select target network using chosen strategy
      const selectedNetwork = this.selectNetwork(
        availableNetworks,
        strategy,
        { dispatchRequest }
      );

      if (!selectedNetwork) {
        logger.warn('Load balancer could not select network', {
          reason: 'no-available-network',
          attemptedCount: availableNetworks.length
        });
        this.emit('dispatch-rejection', {
          reason: 'no-available-network',
          timestamp: Date.now()
        });
        return null;
      }

      // Queue dispatch
      const queueRecord = {
        dispatchRequest,
        selectedNetwork: selectedNetwork.networkId,
        queueTime: Date.now(),
        strategy: strategy,
        priority: dispatchRequest.priority
      };

      const queue = this.networkQueues.get(selectedNetwork.networkId);
      queue.queue.push(queueRecord);
      queue.activeCount++;
      queue.lastUpdated = Date.now();

      // Update metrics
      this.updateMetrics(selectedNetwork.networkId, dispatchRequest);

      // Check for overload conditions
      this.checkOverloadConditions(selectedNetwork.networkId);

      const balanceTime = Date.now() - startTime;
      logger.info(`Dispatch balanced successfully`, {
        network: selectedNetwork.networkId,
        strategy,
        balanceTime,
        queueLength: queue.queue.length
      });

      this.emit('dispatch-balanced', {
        network: selectedNetwork.networkId,
        strategy,
        balanceTime,
        timestamp: Date.now()
      });

      return queueRecord;

    } catch (error) {
      logger.error('Dispatch balancing failed', error);
      this.emit('balance-error', { error, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Select appropriate balancing strategy
   */
  selectStrategy(dispatchRequest) {
    // Critical priority uses performance-based routing
    if (dispatchRequest.priority === 'critical') {
      return 'performance-based';
    }

    // High priority uses least connections
    if (dispatchRequest.priority === 'high') {
      return 'least-connections';
    }

    // Default: weighted round robin
    return this.config.strategyType || 'weighted-round-robin';
  }

  /**
   * Select network using specified strategy
   */
  selectNetwork(networks, strategy, context = {}) {
    const strategyFn = this.balancingStrategies.get(strategy);
    
    if (!strategyFn) {
      logger.warn(`Unknown balancing strategy: ${strategy}, using default`);
      return networks[0];
    }

    return strategyFn.call(this, networks, context);
  }

  /**
   * Weighted Round Robin selection
   */
  selectWeightedRoundRobin(networks) {
    const activeNetworks = networks.filter(n => n.status === 'active');
    if (activeNetworks.length === 0) return null;

    const totalWeight = activeNetworks.reduce((sum, n) => sum + (n.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const network of activeNetworks) {
      random -= (network.weight || 1);
      if (random <= 0) return network;
    }

    return activeNetworks[0];
  }

  /**
   * Least Connections selection
   */
  selectLeastConnections(networks) {
    const activeNetworks = networks.filter(n => n.status === 'active');
    if (activeNetworks.length === 0) return null;

    let minConnections = Infinity;
    let selectedNetwork = null;

    for (const network of activeNetworks) {
      const queue = this.networkQueues.get(network.networkId);
      const connections = queue ? queue.activeCount : 0;

      if (connections < minConnections) {
        minConnections = connections;
        selectedNetwork = network;
      }
    }

    return selectedNetwork;
  }

  /**
   * Capacity Based selection
   */
  selectByCapacity(networks) {
    const activeNetworks = networks.filter(n => n.status === 'active');
    if (activeNetworks.length === 0) return null;

    let maxAvailableCapacity = -1;
    let selectedNetwork = null;

    for (const network of activeNetworks) {
      const queue = this.networkQueues.get(network.networkId);
      const availableCapacity = queue ? 
        queue.maxCapacity - queue.activeCount : 
        network.maxCapacity;

      if (availableCapacity > maxAvailableCapacity) {
        maxAvailableCapacity = availableCapacity;
        selectedNetwork = network;
      }
    }

    return selectedNetwork;
  }

  /**
   * Performance Based selection
   */
  selectByPerformance(networks) {
    const activeNetworks = networks.filter(n => n.status === 'active');
    if (activeNetworks.length === 0) return null;

    let bestScore = -1;
    let selectedNetwork = null;

    for (const network of activeNetworks) {
      const metrics = this.loadMetrics.get(network.networkId);
      if (!metrics) continue;

      // Calculate performance score
      const errorRateFactor = (1 - metrics.errorRate);
      const responseTimeFactor = Math.max(0, 1 - (metrics.responseTimeMs / 30000));
      const loadFactor = Math.max(0, 1 - (metrics.currentLoad / 100));

      const score = (errorRateFactor * 0.4) + (responseTimeFactor * 0.35) + (loadFactor * 0.25);

      if (score > bestScore) {
        bestScore = score;
        selectedNetwork = network;
      }
    }

    return selectedNetwork || activeNetworks[0];
  }

  /**
   * Geographic selection (proximity based)
   */
  selectByGeographic(networks, context) {
    if (!context.dispatchRequest || !context.dispatchRequest.location) {
      return this.selectLeastConnections(networks);
    }

    const incidentLocation = context.dispatchRequest.location;
    const activeNetworks = networks.filter(n => n.status === 'active');
    
    if (activeNetworks.length === 0) return null;

    // In production, this would calculate actual geographic distance
    // For now, prioritize government networks for full coverage
    const govNetwork = activeNetworks.find(n => n.type === 'government');
    return govNetwork || activeNetworks[0];
  }

  /**
   * Update load metrics for network
   */
  updateMetrics(networkId, dispatchRequest) {
    const queue = this.networkQueues.get(networkId);
    const metrics = this.loadMetrics.get(networkId);

    if (!queue || !metrics) return;

    metrics.currentLoad = (queue.activeCount / queue.maxCapacity) * 100;
    metrics.requestsProcessed++;

    if (metrics.currentLoad > metrics.peakLoad) {
      metrics.peakLoad = metrics.currentLoad;
    }

    metrics.averageLoad = 
      (metrics.averageLoad * (metrics.requestsProcessed - 1) + metrics.currentLoad) / 
      metrics.requestsProcessed;

    this.globalMetrics.totalDispatchesBalanced++;

    logger.debug(`Load metrics updated for ${networkId}`, {
      currentLoad: metrics.currentLoad.toFixed(2) + '%',
      peakLoad: metrics.peakLoad.toFixed(2) + '%',
      queueLength: queue.queue.length
    });
  }

  /**
   * Check for overload conditions
   */
  checkOverloadConditions(networkId) {
    const queue = this.networkQueues.get(networkId);
    const metrics = this.loadMetrics.get(networkId);

    if (!queue || !metrics) return;

    const loadFactor = queue.activeCount / queue.maxCapacity;

    if (loadFactor > this.config.thresholdCritical) {
      logger.warn(`CRITICAL OVERLOAD: ${networkId}`, {
        utilization: (loadFactor * 100).toFixed(2) + '%',
        activeCount: queue.activeCount,
        maxCapacity: queue.maxCapacity
      });

      this.emit('network-critical-overload', {
        networkId,
        utilization: loadFactor,
        timestamp: Date.now()
      });

    } else if (loadFactor > this.config.thresholdHigh) {
      logger.warn(`High load on network: ${networkId}`, {
        utilization: (loadFactor * 100).toFixed(2) + '%'
      });

      this.emit('network-high-load', {
        networkId,
        utilization: loadFactor,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start automatic load rebalancing
   */
  startAutoRebalancing() {
    this.rebalanceInterval = setInterval(() => {
      this.rebalance();
    }, this.config.rebalanceInterval);

    logger.info('Auto-rebalancing started', {
      interval: this.config.rebalanceInterval
    });
  }

  /**
   * Perform load rebalancing across networks
   */
  rebalance() {
    logger.info('Starting load rebalancing cycle');

    const networkLoads = [];

    for (const [networkId, queue] of this.networkQueues) {
      const loadFactor = queue.activeCount / queue.maxCapacity;
      networkLoads.push({
        networkId,
        loadFactor,
        activeCount: queue.activeCount,
        maxCapacity: queue.maxCapacity
      });
    }

    // Sort by load
    networkLoads.sort((a, b) => b.loadFactor - a.loadFactor);

    // Identify overloaded and underloaded networks
    const overloaded = networkLoads.filter(n => n.loadFactor > 0.7);
    const underloaded = networkLoads.filter(n => n.loadFactor < 0.3);

    if (overloaded.length > 0 && underloaded.length > 0) {
      logger.info('Rebalancing opportunity detected', {
        overloadedCount: overloaded.length,
        underloadedCount: underloaded.length
      });

      this.emit('rebalancing-opportunity', {
        overloaded: overloaded.map(n => ({ ...n, percentage: (n.loadFactor * 100).toFixed(2) })),
        underloaded: underloaded.map(n => ({ ...n, percentage: (n.loadFactor * 100).toFixed(2) })),
        timestamp: Date.now()
      });

      this.globalMetrics.totalRebalances++;
    }

    this.globalMetrics.lastMetricsUpdate = Date.now();
    logger.debug('Rebalancing cycle completed', { networkLoads });
  }

  /**
   * Get load distribution report
   */
  getLoadReport() {
    const networks = [];

    for (const [networkId, queue] of this.networkQueues) {
      const metrics = this.loadMetrics.get(networkId);
      const loadFactor = queue.activeCount / queue.maxCapacity;

      networks.push({
        networkId,
        status: queue.status,
        activeDispatches: queue.activeCount,
        maxCapacity: queue.maxCapacity,
        utilization: (loadFactor * 100).toFixed(2) + '%',
        queueLength: queue.queue.length,
        peakLoad: metrics ? (metrics.peakLoad).toFixed(2) + '%' : 'N/A',
        averageLoad: metrics ? (metrics.averageLoad).toFixed(2) + '%' : 'N/A',
        errorRate: metrics ? (metrics.errorRate * 100).toFixed(2) + '%' : 'N/A'
      });
    }

    return {
      networks,
      globalMetrics: this.globalMetrics,
      timestamp: Date.now()
    };
  }

  /**
   * Dequeue dispatch from network
   */
  dequeueDispatch(networkId, dispatchId) {
    const queue = this.networkQueues.get(networkId);
    if (!queue) return false;

    const index = queue.queue.findIndex(d => d.dispatchRequest.id === dispatchId);
    if (index !== -1) {
      queue.queue.splice(index, 1);
      queue.activeCount = Math.max(0, queue.activeCount - 1);
      return true;
    }

    return false;
  }

  /**
   * Stop auto-rebalancing
   */
  stopAutoRebalancing() {
    if (this.rebalanceInterval) {
      clearInterval(this.rebalanceInterval);
      logger.info('Auto-rebalancing stopped');
    }
  }

  /**
   * Get queue status for network
   */
  getQueueStatus(networkId) {
    const queue = this.networkQueues.get(networkId);
    return queue ? {
      networkId,
      activeCount: queue.activeCount,
      queueLength: queue.queue.length,
      maxCapacity: queue.maxCapacity,
      utilization: (queue.activeCount / queue.maxCapacity * 100).toFixed(2) + '%'
    } : null;
  }
}

module.exports = LoadBalancer;
