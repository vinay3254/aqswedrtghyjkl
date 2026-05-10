/**
 * Webhook Handler
 * Handles incoming webhooks from government EMS systems
 * Validates, processes, and routes webhook events
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const { ValidationError, WebhookError, UnauthorizedError } = require('../../errors');
const EMSAdapter = require('./ems-adapter');

class WebhookHandler {
  constructor(config = {}) {
    this.config = {
      secret: config.secret || 'webhook-secret-key',
      enableSignatureVerification: config.enableSignatureVerification !== false,
      maxPayloadSize: config.maxPayloadSize || 1024 * 100, // 100KB
      retentionDays: config.retentionDays || 30,
    };

    this.adapter = new EMSAdapter();
    this.webhookHistory = new Map();
    this.eventHandlers = new Map();

    // Register default event handlers
    this._registerDefaultHandlers();

    logger.info('[WebhookHandler] Initialized');
  }

  /**
   * Process incoming webhook
   * @param {Object} request - Express request object
   * @param {Object} body - Request body
   * @param {string} signature - X-Signature header
   * @returns {Promise<Object>} Processing result
   */
  async processWebhook(request, body, signature) {
    try {
      logger.info('[WebhookHandler] Received webhook', {
        path: request.path,
        method: request.method,
      });

      // Validate signature
      if (this.config.enableSignatureVerification) {
        this._verifySignature(body, signature);
      }

      // Validate payload
      const validatedPayload = this._validatePayload(body);

      // Store webhook history
      const webhookId = this._storeWebhook(validatedPayload);

      // Route to appropriate handler
      const result = await this._routeEvent(validatedPayload);

      logger.info('[WebhookHandler] Webhook processed successfully', {
        webhookId,
        eventType: validatedPayload.eventType,
      });

      return {
        success: true,
        webhookId,
        processed: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[WebhookHandler] Webhook processing failed', { error });
      throw error;
    }
  }

  /**
   * Register event handler
   * @param {string} eventType - Event type to handle
   * @param {Function} handler - Handler function
   */
  registerEventHandler(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new ValidationError('Handler must be a function');
    }
    this.eventHandlers.set(eventType, handler);
    logger.info('[WebhookHandler] Registered event handler', { eventType });
  }

  /**
   * Get webhook history
   * @param {Object} options - Query options
   * @returns {Array} Webhook history
   */
  getWebhookHistory(options = {}) {
    const { limit = 100, status = null } = options;

    let webhooks = Array.from(this.webhookHistory.values());

    if (status) {
      webhooks = webhooks.filter((w) => w.status === status);
    }

    return webhooks.slice(-limit);
  }

  /**
   * Retry failed webhook
   * @param {string} webhookId - Webhook ID to retry
   * @returns {Promise<Object>} Retry result
   */
  async retryWebhook(webhookId) {
    const webhook = this.webhookHistory.get(webhookId);

    if (!webhook) {
      throw new WebhookError(`Webhook not found: ${webhookId}`);
    }

    if (webhook.status !== 'failed') {
      throw new WebhookError(`Cannot retry webhook with status: ${webhook.status}`);
    }

    logger.info('[WebhookHandler] Retrying webhook', { webhookId });

    try {
      const result = await this._routeEvent(webhook.payload);
      webhook.status = 'succeeded';
      webhook.retries = (webhook.retries || 0) + 1;
      webhook.lastRetryAt = new Date().toISOString();

      return {
        success: true,
        webhookId,
        result,
      };
    } catch (error) {
      webhook.status = 'failed';
      webhook.error = error.message;
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * @private
   */
  _verifySignature(body, signature) {
    if (!signature) {
      throw new UnauthorizedError('Missing signature header');
    }

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', this.config.secret)
      .update(bodyString)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedError('Invalid signature');
    }

    logger.debug('[WebhookHandler] Signature verified');
  }

  /**
   * Validate webhook payload
   * @private
   */
  _validatePayload(body) {
    if (!body) {
      throw new ValidationError('Empty payload');
    }

    // Check payload size
    const payloadSize =
      typeof body === 'string' ? body.length : JSON.stringify(body).length;
    if (payloadSize > this.config.maxPayloadSize) {
      throw new ValidationError('Payload size exceeds limit');
    }

    // Validate required fields
    const required = ['eventType', 'serviceCode', 'timestamp', 'data'];
    const missing = required.filter((field) => !body[field]);

    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate timestamp (not older than 5 minutes)
    const webhookTimestamp = new Date(body.timestamp);
    const now = new Date();
    const diffMinutes = (now - webhookTimestamp) / 1000 / 60;

    if (diffMinutes > 5) {
      throw new ValidationError('Webhook timestamp too old');
    }

    return {
      webhookId: body.webhookId || `WH-${Date.now()}`,
      eventType: body.eventType,
      serviceCode: body.serviceCode,
      timestamp: body.timestamp,
      data: body.data,
      metadata: body.metadata || {},
    };
  }

  /**
   * Store webhook in history
   * @private
   */
  _storeWebhook(payload) {
    const webhook = {
      id: payload.webhookId,
      eventType: payload.eventType,
      serviceCode: payload.serviceCode,
      timestamp: payload.timestamp,
      receivedAt: new Date().toISOString(),
      payload,
      status: 'processing',
      retries: 0,
    };

    this.webhookHistory.set(webhook.id, webhook);

    // Cleanup old entries
    this._cleanupOldWebhooks();

    return webhook.id;
  }

  /**
   * Route event to appropriate handler
   * @private
   */
  async _routeEvent(payload) {
    const handler = this.eventHandlers.get(payload.eventType);

    if (!handler) {
      logger.warn('[WebhookHandler] No handler for event type', {
        eventType: payload.eventType,
      });
      return null;
    }

    try {
      const result = await handler(payload);
      this._updateWebhookStatus(payload.webhookId, 'succeeded');
      return result;
    } catch (error) {
      logger.error('[WebhookHandler] Handler error', {
        eventType: payload.eventType,
        error: error.message,
      });
      this._updateWebhookStatus(payload.webhookId, 'failed', error);
      throw error;
    }
  }

  /**
   * Update webhook processing status
   * @private
   */
  _updateWebhookStatus(webhookId, status, error = null) {
    const webhook = this.webhookHistory.get(webhookId);
    if (webhook) {
      webhook.status = status;
      webhook.processedAt = new Date().toISOString();
      if (error) {
        webhook.error = error.message;
      }
    }
  }

  /**
   * Register default event handlers
   * @private
   */
  _registerDefaultHandlers() {
    // Incident received event
    this.registerEventHandler('incident.received', async (payload) => {
      logger.info('[WebhookHandler] Handling incident received event', {
        serviceCode: payload.serviceCode,
      });

      const normalized = this.adapter.normalizeIncident(
        payload.serviceCode,
        payload.data
      );

      return {
        eventType: 'incident.received',
        normalized,
        handledAt: new Date().toISOString(),
      };
    });

    // Ambulance status updated event
    this.registerEventHandler('ambulance.status_updated', async (payload) => {
      logger.info('[WebhookHandler] Handling ambulance status updated event', {
        serviceCode: payload.serviceCode,
      });

      const normalized = this.adapter.normalizeStatus(
        payload.serviceCode,
        payload.data
      );

      return {
        eventType: 'ambulance.status_updated',
        normalized,
        handledAt: new Date().toISOString(),
      };
    });

    // Incident completion event
    this.registerEventHandler('incident.completed', async (payload) => {
      logger.info('[WebhookHandler] Handling incident completed event', {
        incidentId: payload.data.incidentId,
      });

      return {
        eventType: 'incident.completed',
        incidentId: payload.data.incidentId,
        patientDeliveredAt: payload.data.deliveryTime,
        hospital: payload.data.hospital,
        handledAt: new Date().toISOString(),
      };
    });

    // Ambulance registration event
    this.registerEventHandler('ambulance.registered', async (payload) => {
      logger.info('[WebhookHandler] Handling ambulance registered event', {
        serviceCode: payload.serviceCode,
      });

      const normalized = this.adapter.normalizeAmbulanceRegistration(
        payload.serviceCode,
        payload.data
      );

      return {
        eventType: 'ambulance.registered',
        normalized,
        handledAt: new Date().toISOString(),
      };
    });

    // Health check event
    this.registerEventHandler('system.health_check', async (payload) => {
      logger.debug('[WebhookHandler] Handling health check event');

      return {
        eventType: 'system.health_check',
        status: 'healthy',
        handledAt: new Date().toISOString(),
      };
    });

    logger.info('[WebhookHandler] Default event handlers registered');
  }

  /**
   * Cleanup old webhook entries
   * @private
   */
  _cleanupOldWebhooks() {
    const cutoffTime = new Date(
      Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000
    );

    let cleaned = 0;
    for (const [id, webhook] of this.webhookHistory.entries()) {
      if (new Date(webhook.timestamp) < cutoffTime) {
        this.webhookHistory.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('[WebhookHandler] Cleaned old webhooks', { count: cleaned });
    }
  }

  /**
   * Export webhook history as JSON
   * @returns {Object} Webhook history export
   */
  exportHistory() {
    const webhooks = Array.from(this.webhookHistory.values()).map((w) => ({
      id: w.id,
      eventType: w.eventType,
      serviceCode: w.serviceCode,
      timestamp: w.timestamp,
      receivedAt: w.receivedAt,
      processedAt: w.processedAt,
      status: w.status,
      error: w.error || null,
      retries: w.retries,
    }));

    return {
      exportedAt: new Date().toISOString(),
      count: webhooks.length,
      webhooks,
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.webhookHistory.clear();
    this.eventHandlers.clear();
    logger.info('[WebhookHandler] Handler destroyed');
  }
}

module.exports = WebhookHandler;
