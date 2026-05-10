/**
 * Escalation Manager
 * Handles dispatch escalation when primary network is overloaded or unavailable
 * Manages escalation chains, retry logic, and fallback procedures
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class EscalationManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.escalationChains = new Map();
    this.activeEscalations = new Map();
    this.escalationRules = new Map();
    this.config = {
      maxEscalationLevels: config.maxEscalationLevels || 3,
      escalationDelayMs: config.escalationDelayMs || 5000,
      retryAttempts: config.retryAttempts || 3,
      enableAutoEscalation: config.enableAutoEscalation !== false,
      escalationTimeoutMs: config.escalationTimeoutMs || 30000,
      notificationChannels: config.notificationChannels || ['sms', 'call', 'push'],
      ...config
    };

    this.initializeEscalationRules();
  }

  /**
   * Initialize escalation rules
   */
  initializeEscalationRules() {
    // Rule: Network overload
    this.registerRule('network-overload', {
      condition: (context) => context.networkUtilization > 0.85,
      priority: 'high',
      action: 'escalate-to-backup-network'
    });

    // Rule: Network unavailable
    this.registerRule('network-unavailable', {
      condition: (context) => context.networkStatus === 'unavailable' || context.networkStatus === 'offline',
      priority: 'critical',
      action: 'immediate-escalation'
    });

    // Rule: Response time exceeded
    this.registerRule('response-timeout', {
      condition: (context) => context.responseTimeMs > context.maxResponseTimeMs,
      priority: 'high',
      action: 'escalate-with-secondary'
    });

    // Rule: Critical priority with no response
    this.registerRule('critical-no-response', {
      condition: (context) => 
        context.priority === 'critical' && 
        context.responseTimeMs > 3000 && 
        !context.hasAcknowledged,
      priority: 'critical',
      action: 'multi-network-dispatch'
    });

    // Rule: Resource unavailable
    this.registerRule('resources-unavailable', {
      condition: (context) => context.availableResources === 0,
      priority: 'high',
      action: 'escalate-geographic'
    });

    logger.info('Escalation rules initialized', {
      ruleCount: this.escalationRules.size
    });
  }

  /**
   * Register escalation rule
   */
  registerRule(ruleName, rule) {
    this.escalationRules.set(ruleName, {
      name: ruleName,
      ...rule,
      createdAt: Date.now()
    });
  }

  /**
   * Register escalation chain for network
   */
  registerEscalationChain(networkId, chain) {
    /**
     * chain: {
     *   primary: networkId,
     *   backups: [networkId1, networkId2, ...],
     *   conditions: { ... },
     *   notify: { ... }
     * }
     */
    this.escalationChains.set(networkId, {
      networkId,
      ...chain,
      registeredAt: Date.now(),
      lastEscalation: null,
      escalationCount: 0
    });

    logger.info(`Escalation chain registered for ${networkId}`, {
      backupCount: chain.backups.length
    });
  }

  /**
   * Evaluate dispatch for escalation
   */
  evaluateForEscalation(dispatchContext) {
    const escalationTriggers = [];

    for (const [ruleName, rule] of this.escalationRules) {
      try {
        if (rule.condition(dispatchContext)) {
          escalationTriggers.push({
            ruleName,
            rule,
            triggeredAt: Date.now()
          });
        }
      } catch (error) {
        logger.error(`Error evaluating rule ${ruleName}`, error);
      }
    }

    if (escalationTriggers.length > 0) {
      logger.warn('Escalation condition(s) triggered', {
        dispatchId: dispatchContext.dispatchId,
        triggers: escalationTriggers.map(t => t.ruleName)
      });

      return {
        needsEscalation: true,
        triggers: escalationTriggers,
        recommendedAction: this.determineEscalationAction(escalationTriggers)
      };
    }

    return { needsEscalation: false };
  }

  /**
   * Determine escalation action based on triggers
   */
  determineEscalationAction(triggers) {
    // Sort by priority
    triggers.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.rule.priority] - priorityOrder[b.rule.priority];
    });

    if (triggers.length === 0) return null;

    // Return most critical action
    return triggers[0].rule.action;
  }

  /**
   * Execute escalation for dispatch
   */
  async executeEscalation(dispatchId, currentNetwork, escalationAction, availableNetworks) {
    const escalationId = this.generateEscalationId();
    const startTime = Date.now();

    try {
      logger.info(`Executing escalation: ${escalationAction}`, {
        dispatchId,
        escalationId,
        currentNetwork,
        action: escalationAction
      });

      const escalationRecord = {
        id: escalationId,
        dispatchId,
        currentNetwork,
        escalationAction,
        status: 'in-progress',
        initiatedAt: Date.now(),
        attempts: 0,
        results: []
      };

      this.activeEscalations.set(escalationId, escalationRecord);

      let result;

      switch (escalationAction) {
        case 'escalate-to-backup-network':
          result = await this.escalateToBackupNetwork(
            dispatchId,
            currentNetwork,
            availableNetworks,
            escalationRecord
          );
          break;

        case 'immediate-escalation':
          result = await this.immediateEscalation(
            dispatchId,
            availableNetworks,
            escalationRecord
          );
          break;

        case 'escalate-with-secondary':
          result = await this.escalateWithSecondary(
            dispatchId,
            currentNetwork,
            availableNetworks,
            escalationRecord
          );
          break;

        case 'multi-network-dispatch':
          result = await this.multiNetworkDispatch(
            dispatchId,
            availableNetworks,
            escalationRecord
          );
          break;

        case 'escalate-geographic':
          result = await this.escalateGeographic(
            dispatchId,
            currentNetwork,
            availableNetworks,
            escalationRecord
          );
          break;

        default:
          result = await this.defaultEscalation(
            dispatchId,
            availableNetworks,
            escalationRecord
          );
      }

      escalationRecord.status = 'completed';
      escalationRecord.completedAt = Date.now();
      escalationRecord.executionTime = escalationRecord.completedAt - startTime;
      escalationRecord.result = result;

      // Update escalation chain metrics
      this.updateChainMetrics(currentNetwork);

      logger.info(`Escalation completed: ${escalationAction}`, {
        escalationId,
        dispatchId,
        executionTime: escalationRecord.executionTime,
        success: result.success
      });

      this.emit('escalation-completed', escalationRecord);

      return {
        success: result.success,
        escalationId,
        newNetwork: result.selectedNetwork,
        reason: result.reason
      };

    } catch (error) {
      logger.error(`Escalation execution failed: ${escalationAction}`, error);

      const escalation = this.activeEscalations.get(escalationId);
      if (escalation) {
        escalation.status = 'failed';
        escalation.error = error.message;
      }

      this.emit('escalation-failed', {
        escalationId,
        dispatchId,
        action: escalationAction,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Escalate to backup network
   */
  async escalateToBackupNetwork(dispatchId, currentNetwork, availableNetworks, escalationRecord) {
    const chain = this.escalationChains.get(currentNetwork);
    
    if (!chain || !chain.backups || chain.backups.length === 0) {
      return {
        success: false,
        reason: 'no-backup-network-configured'
      };
    }

    // Try backup networks in order
    for (const backupNetworkId of chain.backups) {
      const backupNetwork = availableNetworks.find(n => n.networkId === backupNetworkId);

      if (backupNetwork && backupNetwork.status === 'active') {
        logger.info(`Escalating to backup network: ${backupNetworkId}`);

        escalationRecord.attempts++;
        escalationRecord.results.push({
          attemptNumber: escalationRecord.attempts,
          targetNetwork: backupNetworkId,
          status: 'success',
          timestamp: Date.now()
        });

        this.emit('escalation-to-backup', {
          dispatchId,
          backupNetwork: backupNetworkId,
          timestamp: Date.now()
        });

        return {
          success: true,
          selectedNetwork: backupNetworkId,
          reason: 'escalated-to-backup'
        };
      }
    }

    return {
      success: false,
      reason: 'all-backup-networks-unavailable'
    };
  }

  /**
   * Immediate escalation (network unavailable)
   */
  async immediateEscalation(dispatchId, availableNetworks, escalationRecord) {
    logger.warn(`Immediate escalation initiated for ${dispatchId}`);

    // Get best available network
    const activeNetworks = availableNetworks.filter(n => n.status === 'active');

    if (activeNetworks.length === 0) {
      return {
        success: false,
        reason: 'no-available-networks'
      };
    }

    // Select network with lowest utilization
    const selectedNetwork = activeNetworks.reduce((best, current) => {
      const currentUtil = current.activeDispatchCount / current.maxCapacity;
      const bestUtil = best.activeDispatchCount / best.maxCapacity;
      return currentUtil < bestUtil ? current : best;
    });

    escalationRecord.attempts++;
    escalationRecord.results.push({
      attemptNumber: escalationRecord.attempts,
      targetNetwork: selectedNetwork.networkId,
      status: 'success',
      timestamp: Date.now()
    });

    this.notifyStakeholders(dispatchId, 'immediate-escalation', selectedNetwork);

    return {
      success: true,
      selectedNetwork: selectedNetwork.networkId,
      reason: 'immediate-escalation-executed'
    };
  }

  /**
   * Escalate with secondary dispatch
   */
  async escalateWithSecondary(dispatchId, currentNetwork, availableNetworks, escalationRecord) {
    logger.info(`Escalating with secondary dispatch for ${dispatchId}`);

    // Keep current network but also dispatch to secondary
    const backupNetworks = availableNetworks.filter(n => 
      n.status === 'active' && n.networkId !== currentNetwork
    );

    if (backupNetworks.length === 0) {
      return {
        success: false,
        reason: 'no-secondary-network-available'
      };
    }

    const secondaryNetwork = backupNetworks[0];

    escalationRecord.attempts++;
    escalationRecord.results.push({
      attemptNumber: escalationRecord.attempts,
      primaryNetwork: currentNetwork,
      secondaryNetwork: secondaryNetwork.networkId,
      status: 'dual-dispatch',
      timestamp: Date.now()
    });

    this.emit('dual-dispatch-initiated', {
      dispatchId,
      primaryNetwork: currentNetwork,
      secondaryNetwork: secondaryNetwork.networkId,
      timestamp: Date.now()
    });

    return {
      success: true,
      selectedNetwork: secondaryNetwork.networkId,
      dualDispatch: true,
      reason: 'escalated-with-secondary'
    };
  }

  /**
   * Multi-network dispatch (critical cases)
   */
  async multiNetworkDispatch(dispatchId, availableNetworks, escalationRecord) {
    logger.warn(`Multi-network dispatch initiated for critical dispatch: ${dispatchId}`);

    const activeNetworks = availableNetworks
      .filter(n => n.status === 'active')
      .slice(0, 3); // Dispatch to top 3 networks

    if (activeNetworks.length === 0) {
      return {
        success: false,
        reason: 'no-available-networks'
      };
    }

    escalationRecord.attempts++;
    escalationRecord.results.push({
      attemptNumber: escalationRecord.attempts,
      dispatchedNetworks: activeNetworks.map(n => n.networkId),
      status: 'multi-dispatch',
      timestamp: Date.now()
    });

    // Notify all networks
    this.notifyMultipleNetworks(dispatchId, activeNetworks);

    this.emit('multi-network-dispatch', {
      dispatchId,
      networks: activeNetworks.map(n => n.networkId),
      timestamp: Date.now()
    });

    return {
      success: true,
      selectedNetworks: activeNetworks.map(n => n.networkId),
      multiNetworkDispatch: true,
      reason: 'critical-multi-dispatch'
    };
  }

  /**
   * Geographic escalation (expand search radius)
   */
  async escalateGeographic(dispatchId, currentNetwork, availableNetworks, escalationRecord) {
    logger.info(`Geographic escalation for ${dispatchId}`);

    // In production, expand geographic search radius
    const geographicNetworks = availableNetworks.filter(n => n.status === 'active');

    if (geographicNetworks.length === 0) {
      return {
        success: false,
        reason: 'no-geographic-networks-available'
      };
    }

    // Select network with best coverage
    const selectedNetwork = geographicNetworks[0];

    escalationRecord.attempts++;
    escalationRecord.results.push({
      attemptNumber: escalationRecord.attempts,
      targetNetwork: selectedNetwork.networkId,
      escalationType: 'geographic',
      timestamp: Date.now()
    });

    return {
      success: true,
      selectedNetwork: selectedNetwork.networkId,
      reason: 'geographic-escalation'
    };
  }

  /**
   * Default escalation
   */
  async defaultEscalation(dispatchId, availableNetworks, escalationRecord) {
    const activeNetworks = availableNetworks.filter(n => n.status === 'active');

    if (activeNetworks.length === 0) {
      return {
        success: false,
        reason: 'no-available-networks'
      };
    }

    const selectedNetwork = activeNetworks[0];

    escalationRecord.attempts++;
    escalationRecord.results.push({
      attemptNumber: escalationRecord.attempts,
      targetNetwork: selectedNetwork.networkId,
      status: 'success',
      timestamp: Date.now()
    });

    return {
      success: true,
      selectedNetwork: selectedNetwork.networkId,
      reason: 'default-escalation'
    };
  }

  /**
   * Retry dispatch with exponential backoff
   */
  async retryDispatch(dispatchId, targetNetwork, previousAttempts = 0) {
    if (previousAttempts >= this.config.retryAttempts) {
      logger.warn(`Max retry attempts reached for dispatch ${dispatchId}`);
      return { success: false, reason: 'max-retries-exceeded' };
    }

    // Exponential backoff
    const delayMs = this.config.escalationDelayMs * Math.pow(2, previousAttempts);
    
    logger.info(`Scheduling retry for dispatch ${dispatchId}`, {
      attempt: previousAttempts + 1,
      delayMs,
      targetNetwork
    });

    await new Promise(resolve => setTimeout(resolve, delayMs));

    this.emit('dispatch-retry', {
      dispatchId,
      targetNetwork,
      attempt: previousAttempts + 1,
      timestamp: Date.now()
    });

    return {
      success: true,
      reason: 'retry-scheduled',
      attempt: previousAttempts + 1
    };
  }

  /**
   * Notify stakeholders of escalation
   */
  notifyStakeholders(dispatchId, escalationType, network) {
    const notification = {
      dispatchId,
      escalationType,
      network: network.networkId,
      timestamp: Date.now(),
      channels: this.config.notificationChannels
    };

    logger.info('Notifying stakeholders of escalation', notification);

    this.emit('escalation-notification', notification);
  }

  /**
   * Notify multiple networks
   */
  notifyMultipleNetworks(dispatchId, networks) {
    const notification = {
      dispatchId,
      networks: networks.map(n => n.networkId),
      type: 'multi-dispatch',
      timestamp: Date.now()
    };

    logger.info('Notifying multiple networks', notification);

    this.emit('multi-network-notification', notification);
  }

  /**
   * Update escalation chain metrics
   */
  updateChainMetrics(networkId) {
    const chain = this.escalationChains.get(networkId);
    if (chain) {
      chain.lastEscalation = Date.now();
      chain.escalationCount++;
    }
  }

  /**
   * Get escalation status
   */
  getEscalationStatus(escalationId) {
    return this.activeEscalations.get(escalationId) || null;
  }

  /**
   * Get all active escalations
   */
  getActiveEscalations() {
    const active = [];
    for (const escalation of this.activeEscalations.values()) {
      if (escalation.status === 'in-progress') {
        active.push(escalation);
      }
    }
    return active;
  }

  /**
   * Cancel escalation
   */
  cancelEscalation(escalationId) {
    const escalation = this.activeEscalations.get(escalationId);
    if (escalation) {
      escalation.status = 'cancelled';
      escalation.cancelledAt = Date.now();
      logger.info(`Escalation cancelled: ${escalationId}`);
      return true;
    }
    return false;
  }

  /**
   * Generate escalation report
   */
  getEscalationReport() {
    let totalEscalations = 0;
    let successfulEscalations = 0;
    const chainMetrics = {};

    for (const [networkId, chain] of this.escalationChains) {
      chainMetrics[networkId] = {
        networkId,
        escalationCount: chain.escalationCount,
        lastEscalation: chain.lastEscalation,
        backupNetworks: chain.backups.length
      };
    }

    for (const escalation of this.activeEscalations.values()) {
      if (escalation.status === 'completed') {
        totalEscalations++;
        if (escalation.result && escalation.result.success) {
          successfulEscalations++;
        }
      }
    }

    return {
      totalEscalations,
      successfulEscalations,
      successRate: totalEscalations > 0 ? 
        ((successfulEscalations / totalEscalations) * 100).toFixed(2) + '%' :
        'N/A',
      chainMetrics,
      timestamp: Date.now()
    };
  }

  /**
   * Generate unique escalation ID
   */
  generateEscalationId() {
    return `esc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = EscalationManager;
