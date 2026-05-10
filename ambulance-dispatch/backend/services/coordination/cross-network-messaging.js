/**
 * Cross-Network Messaging
 * Enables asynchronous message passing between different EMS networks
 * Handles message routing, queuing, delivery confirmation, and protocol translation
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class CrossNetworkMessaging extends EventEmitter {
  constructor(config = {}) {
    super();

    this.messageQueue = new Map(); // networkId -> queue[]
    this.messageHistory = [];
    this.networkConnections = new Map();
    this.messageProtocols = new Map();
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      messageTimeoutMs: config.messageTimeoutMs || 60000,
      enablePersistence: config.enablePersistence || true,
      maxHistorySize: config.maxHistorySize || 10000,
      deadLetterQueueSize: config.deadLetterQueueSize || 100,
      ...config
    };

    this.deadLetterQueue = [];
    this.initializeProtocols();
  }

  /**
   * Initialize message protocols for different networks
   */
  initializeProtocols() {
    // Government 108 Protocol
    this.registerProtocol('government-108', {
      name: 'Government-108',
      format: 'JSON',
      compression: true,
      encryption: true,
      priority: 'critical',
      timeout: 5000,
      retryAttempts: 3,
      translate: (message) => this.translateToGov108(message)
    });

    // Government 102 Protocol
    this.registerProtocol('government-102', {
      name: 'Government-102',
      format: 'JSON',
      compression: false,
      encryption: true,
      priority: 'high',
      timeout: 8000,
      retryAttempts: 2,
      translate: (message) => this.translateToGov102(message)
    });

    // Private Network Protocol
    this.registerProtocol('private-network', {
      name: 'Private-Network',
      format: 'JSON',
      compression: true,
      encryption: false,
      priority: 'normal',
      timeout: 10000,
      retryAttempts: 2,
      translate: (message) => this.translateToPrivate(message)
    });

    logger.info('Cross-network messaging protocols initialized', {
      protocolCount: this.messageProtocols.size
    });
  }

  /**
   * Register custom message protocol
   */
  registerProtocol(protocolId, config) {
    this.messageProtocols.set(protocolId, {
      id: protocolId,
      ...config,
      registeredAt: Date.now()
    });
  }

  /**
   * Register network connection
   */
  registerNetworkConnection(networkId, connectionConfig) {
    this.networkConnections.set(networkId, {
      networkId,
      ...connectionConfig,
      status: 'connected',
      connectedAt: Date.now(),
      messagesSent: 0,
      messagesReceived: 0,
      failureCount: 0,
      lastActivity: Date.now()
    });

    // Initialize message queue for network
    if (!this.messageQueue.has(networkId)) {
      this.messageQueue.set(networkId, []);
    }

    logger.info(`Network connection registered: ${networkId}`);
  }

  /**
   * Send message across networks
   */
  async sendMessage(messageContent, sourceNetwork, targetNetworks, options = {}) {
    const messageId = this.generateMessageId();
    const startTime = Date.now();

    try {
      // Validate message
      this.validateMessage(messageContent);

      const message = {
        id: messageId,
        sourceNetwork,
        targetNetworks: Array.isArray(targetNetworks) ? targetNetworks : [targetNetworks],
        content: messageContent,
        type: options.type || 'dispatch-update',
        priority: options.priority || 'normal',
        createdAt: Date.now(),
        status: 'pending',
        attempts: 0,
        results: [],
        requiresAck: options.requiresAck !== false
      };

      logger.info(`Sending cross-network message: ${messageId}`, {
        source: sourceNetwork,
        targets: message.targetNetworks,
        type: message.type,
        priority: message.priority
      });

      // Process message for each target network
      for (const targetNetwork of message.targetNetworks) {
        const result = await this.deliverMessage(message, targetNetwork);
        message.results.push(result);
      }

      // Record message
      this.recordMessage(message);

      const deliveryTime = Date.now() - startTime;
      message.status = 'delivered';
      message.deliveryTime = deliveryTime;

      logger.info(`Message delivered: ${messageId}`, {
        deliveryTime,
        targetCount: message.targetNetworks.length,
        successCount: message.results.filter(r => r.success).length
      });

      this.emit('message-delivered', message);

      return {
        success: true,
        messageId,
        deliveryTime,
        results: message.results
      };

    } catch (error) {
      logger.error(`Failed to send message: ${messageId}`, error);
      this.emit('message-send-failed', {
        messageId,
        sourceNetwork,
        targetNetworks,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deliver message to target network
   */
  async deliverMessage(message, targetNetwork) {
    const connection = this.networkConnections.get(targetNetwork);
    
    if (!connection) {
      logger.warn(`No connection found for network: ${targetNetwork}`);
      return {
        targetNetwork,
        success: false,
        reason: 'no-connection',
        timestamp: Date.now()
      };
    }

    if (connection.status !== 'connected') {
      logger.warn(`Network not connected: ${targetNetwork}`, {
        status: connection.status
      });

      // Queue message for later delivery
      this.queueMessage(message, targetNetwork);

      return {
        targetNetwork,
        success: false,
        reason: 'network-disconnected',
        queued: true,
        timestamp: Date.now()
      };
    }

    try {
      // Get protocol for target network
      const protocol = this.messageProtocols.get(targetNetwork);
      if (!protocol) {
        throw new Error(`No protocol found for network: ${targetNetwork}`);
      }

      // Translate message to network-specific format
      const translatedMessage = protocol.translate(message.content);

      // Simulate delivery with retry logic
      const result = await this.attemptMessageDelivery(
        translatedMessage,
        targetNetwork,
        protocol
      );

      // Update connection metrics
      connection.messagesSent++;
      connection.lastActivity = Date.now();

      if (result.success) {
        connection.failureCount = 0;
      } else {
        connection.failureCount++;
      }

      logger.debug(`Message delivery result for ${targetNetwork}`, result);

      return {
        targetNetwork,
        ...result,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error(`Error delivering to ${targetNetwork}`, error);
      connection.failureCount++;

      return {
        targetNetwork,
        success: false,
        reason: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Attempt message delivery with retry
   */
  async attemptMessageDelivery(message, targetNetwork, protocol, attempt = 0) {
    const maxAttempts = protocol.retryAttempts || 3;

    try {
      // Simulate message transmission
      logger.debug(`Attempting delivery to ${targetNetwork} (attempt ${attempt + 1})`);

      // In production, this would make actual network calls
      const success = Math.random() > 0.05; // 95% success rate simulation

      if (!success && attempt < maxAttempts) {
        logger.warn(`Delivery attempt ${attempt + 1} failed, retrying...`);
        
        // Exponential backoff
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));

        return this.attemptMessageDelivery(message, targetNetwork, protocol, attempt + 1);
      }

      if (!success) {
        return {
          success: false,
          reason: 'delivery-failed-max-retries',
          attempts: attempt + 1
        };
      }

      return {
        success: true,
        attempts: attempt + 1,
        ackId: this.generateAckId()
      };

    } catch (error) {
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.attemptMessageDelivery(message, targetNetwork, protocol, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Queue message for later delivery
   */
  queueMessage(message, targetNetwork) {
    const queue = this.messageQueue.get(targetNetwork);
    
    if (!queue) {
      logger.warn(`No queue found for network: ${targetNetwork}`);
      return false;
    }

    if (queue.length >= this.config.maxQueueSize) {
      logger.error(`Queue full for network: ${targetNetwork}`, {
        queueSize: queue.length
      });

      // Move to dead letter queue
      this.moveToDeadLetterQueue(message, targetNetwork, 'queue-full');
      return false;
    }

    queue.push({
      ...message,
      queuedAt: Date.now(),
      targetNetwork
    });

    logger.info(`Message queued for ${targetNetwork}`, {
      messageId: message.id,
      queueLength: queue.length
    });

    this.emit('message-queued', {
      messageId: message.id,
      targetNetwork,
      queueLength: queue.length
    });

    return true;
  }

  /**
   * Process queued messages for network
   */
  async processQueuedMessages(networkId) {
    const queue = this.messageQueue.get(networkId);
    
    if (!queue || queue.length === 0) {
      return { processed: 0, successful: 0 };
    }

    let successful = 0;
    const stillPending = [];

    logger.info(`Processing queued messages for ${networkId}`, {
      queueLength: queue.length
    });

    for (const message of queue) {
      try {
        const result = await this.deliverMessage(message, networkId);

        if (result.success) {
          successful++;
          logger.debug(`Queued message delivered: ${message.id}`);
        } else {
          stillPending.push(message);
        }
      } catch (error) {
        logger.error(`Error processing queued message: ${message.id}`, error);
        stillPending.push(message);
      }
    }

    // Update queue with remaining messages
    this.messageQueue.set(networkId, stillPending);

    logger.info(`Queue processing completed for ${networkId}`, {
      processed: queue.length,
      successful,
      remaining: stillPending.length
    });

    this.emit('queue-processed', {
      networkId,
      processed: queue.length,
      successful,
      remaining: stillPending.length
    });

    return { processed: queue.length, successful };
  }

  /**
   * Broadcast message to multiple networks
   */
  async broadcastMessage(messageContent, sourceNetwork, options = {}) {
    const targetNetworks = options.targetNetworks || Array.from(this.networkConnections.keys());

    logger.info('Broadcasting message to multiple networks', {
      source: sourceNetwork,
      targetCount: targetNetworks.length
    });

    return this.sendMessage(messageContent, sourceNetwork, targetNetworks, {
      ...options,
      type: options.type || 'broadcast'
    });
  }

  /**
   * Validate message structure
   */
  validateMessage(message) {
    if (!message) {
      throw new Error('Message content is required');
    }

    if (!message.dispatchId) {
      throw new Error('Message must contain dispatchId');
    }

    if (!message.messageType) {
      throw new Error('Message must contain messageType');
    }
  }

  /**
   * Translate message to Government 108 format
   */
  translateToGov108(message) {
    return {
      ...message,
      networkProtocol: 'GOV-108',
      format: 'EMERGENCY_STANDARD_108',
      timestamp: Date.now(),
      encryptionLevel: 'HIGH'
    };
  }

  /**
   * Translate message to Government 102 format
   */
  translateToGov102(message) {
    return {
      ...message,
      networkProtocol: 'GOV-102',
      format: 'EMERGENCY_STANDARD_102',
      timestamp: Date.now(),
      encryptionLevel: 'HIGH'
    };
  }

  /**
   * Translate message to Private Network format
   */
  translateToPrivate(message) {
    return {
      ...message,
      networkProtocol: 'PRIVATE',
      format: 'PRIVATE_STANDARD',
      timestamp: Date.now(),
      encryptionLevel: 'STANDARD'
    };
  }

  /**
   * Record message in history
   */
  recordMessage(message) {
    this.messageHistory.push({
      ...message,
      recordedAt: Date.now()
    });

    // Maintain history size
    if (this.messageHistory.length > this.config.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Move message to dead letter queue
   */
  moveToDeadLetterQueue(message, targetNetwork, reason) {
    if (this.deadLetterQueue.length >= this.config.deadLetterQueueSize) {
      // Remove oldest message
      this.deadLetterQueue.shift();
    }

    this.deadLetterQueue.push({
      ...message,
      targetNetwork,
      failureReason: reason,
      movedAt: Date.now()
    });

    logger.warn(`Message moved to dead letter queue: ${message.id}`, {
      reason,
      targetNetwork
    });

    this.emit('dead-letter-message', {
      messageId: message.id,
      targetNetwork,
      reason
    });
  }

  /**
   * Get message status
   */
  getMessageStatus(messageId) {
    // Check current messages
    for (const messages of this.messageQueue.values()) {
      const msg = messages.find(m => m.id === messageId);
      if (msg) return { status: 'queued', message: msg };
    }

    // Check history
    const historyMsg = this.messageHistory.find(m => m.id === messageId);
    if (historyMsg) return { status: historyMsg.status, message: historyMsg };

    return null;
  }

  /**
   * Get network connection status
   */
  getNetworkConnectionStatus(networkId) {
    return this.networkConnections.get(networkId) || null;
  }

  /**
   * Get all network connection statuses
   */
  getAllConnectionStatus() {
    const statuses = {};
    
    for (const [networkId, connection] of this.networkConnections) {
      statuses[networkId] = {
        status: connection.status,
        messagesSent: connection.messagesSent,
        messagesReceived: connection.messagesReceived,
        failureCount: connection.failureCount,
        lastActivity: connection.lastActivity,
        connectedDuration: Date.now() - connection.connectedAt
      };
    }

    return statuses;
  }

  /**
   * Get message statistics
   */
  getMessageStatistics() {
    let totalQueued = 0;
    const queueByNetwork = {};

    for (const [networkId, queue] of this.messageQueue) {
      queueByNetwork[networkId] = queue.length;
      totalQueued += queue.length;
    }

    return {
      totalMessages: this.messageHistory.length,
      totalQueued,
      queueByNetwork,
      deadLetterCount: this.deadLetterQueue.length,
      timestamp: Date.now()
    };
  }

  /**
   * Get message history
   */
  getMessageHistory(options = {}) {
    let history = [...this.messageHistory];

    // Filter by source network
    if (options.sourceNetwork) {
      history = history.filter(m => m.sourceNetwork === options.sourceNetwork);
    }

    // Filter by type
    if (options.type) {
      history = history.filter(m => m.type === options.type);
    }

    // Filter by status
    if (options.status) {
      history = history.filter(m => m.status === options.status);
    }

    // Limit results
    const limit = options.limit || 100;
    return history.slice(-limit);
  }

  /**
   * Acknowledge message
   */
  acknowledgeMessage(messageId, ackId) {
    const message = this.messageHistory.find(m => m.id === messageId);
    
    if (!message) {
      return false;
    }

    message.acknowledged = true;
    message.acknowledgedAt = Date.now();
    message.ackId = ackId;

    logger.info(`Message acknowledged: ${messageId}`);
    this.emit('message-acknowledged', { messageId, ackId });

    return true;
  }

  /**
   * Generate message ID
   */
  generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate acknowledgment ID
   */
  generateAckId() {
    return `ack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check all connections
   */
  async healthCheckConnections() {
    const results = {};

    for (const [networkId, connection] of this.networkConnections) {
      try {
        // Simulate health check
        const isHealthy = connection.failureCount < 5;
        
        results[networkId] = {
          networkId,
          isHealthy,
          status: connection.status,
          lastActivity: connection.lastActivity,
          failureCount: connection.failureCount
        };

        if (!isHealthy) {
          logger.warn(`Network health check failed: ${networkId}`, {
            failureCount: connection.failureCount
          });
        }
      } catch (error) {
        logger.error(`Health check error for ${networkId}`, error);
        results[networkId] = { networkId, isHealthy: false, error: error.message };
      }
    }

    this.emit('health-check-completed', results);
    return results;
  }
}

module.exports = CrossNetworkMessaging;
