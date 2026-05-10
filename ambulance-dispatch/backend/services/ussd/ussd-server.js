/**
 * USSD Server - USSD Gateway Server with Session Management
 * Handles USSD requests in rural/low-connectivity environments
 * Supports multiple USSD providers (Africa's Talking, Twilio, etc.)
 */

const express = require('express');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const MenuFlow = require('./menu-flow');
const LocationResolver = require('./location-resolver');
const SMSFallback = require('./sms-fallback');
const logger = require('../../utils/logger');

class USSDServer {
  constructor(config = {}) {
    this.app = express();
    this.config = {
      port: config.port || 3001,
      redisUrl: config.redisUrl || 'redis://localhost:6379',
      sessionTimeout: config.sessionTimeout || 600, // 10 minutes
      maxRetries: config.maxRetries || 3,
      ussdProviders: config.ussdProviders || ['africas-talking'], // Support multiple providers
      ...config,
    };

    // Initialize Redis for session storage
    this.redisClient = redis.createClient({ url: this.config.redisUrl });
    this.redisClient.on('error', (err) => logger.error('Redis error:', err));

    // Initialize services
    this.menuFlow = new MenuFlow();
    this.locationResolver = new LocationResolver(config.locationConfig);
    this.smsFallback = new SMSFallback(config.smsConfig);

    this.setupRoutes();
  }

  /**
   * Setup Express routes for USSD handling
   */
  setupRoutes() {
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'ussd-server' });
    });

    // USSD webhook endpoints for different providers
    this.app.post('/webhook/africas-talking', this.handleAfricasTalkingUSSD.bind(this));
    this.app.post('/webhook/twilio', this.handleTwilioUSSD.bind(this));
    this.app.post('/webhook/generic', this.handleGenericUSSD.bind(this));

    // Admin endpoints
    this.app.get('/sessions/:sessionId', this.getSession.bind(this));
    this.app.delete('/sessions/:sessionId', this.clearSession.bind(this));
    this.app.get('/stats', this.getStats.bind(this));
  }

  /**
   * Handle Africa's Talking USSD requests
   * Expected format:
   * {
   *   sessionId: "unique-session-id",
   *   phoneNumber: "+254xxx",
   *   text: "1", // User input
   *   networkCode: "63902"
   * }
   */
  async handleAfricasTalkingUSSD(req, res) {
    try {
      const { sessionId, phoneNumber, text, networkCode } = req.body;

      logger.info('Africa\'s Talking USSD request', {
        sessionId,
        phoneNumber,
        text,
        networkCode,
      });

      const response = await this.processUSSDRequest({
        sessionId,
        phoneNumber,
        userInput: text,
        provider: 'africas-talking',
        networkCode,
        isNew: req.body.sessionId === undefined, // Indicate if this is a new session
      });

      // Africa's Talking response format
      res.status(200).send(response.message);
    } catch (error) {
      logger.error('Africa\'s Talking USSD error:', error);
      res.status(500).send('END Error processing request. Please try again.');
    }
  }

  /**
   * Handle Twilio USSD requests
   */
  async handleTwilioUSSD(req, res) {
    try {
      const phoneNumber = req.body.From;
      const userInput = req.body.Body;
      const sessionId = req.body.ConversationSid || uuidv4();

      logger.info('Twilio USSD request', { sessionId, phoneNumber, userInput });

      const response = await this.processUSSDRequest({
        sessionId,
        phoneNumber,
        userInput,
        provider: 'twilio',
        isNew: req.body.Body === undefined,
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Twilio USSD error:', error);
      res.status(500).json({ message: 'Error processing request' });
    }
  }

  /**
   * Handle generic USSD requests
   */
  async handleGenericUSSD(req, res) {
    try {
      const { sessionId, phoneNumber, userInput } = req.body;

      const response = await this.processUSSDRequest({
        sessionId,
        phoneNumber,
        userInput,
        provider: 'generic',
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Generic USSD error:', error);
      res.status(500).json({ message: 'Error processing request' });
    }
  }

  /**
   * Core USSD request processing logic
   */
  async processUSSDRequest(requestData) {
    const {
      sessionId,
      phoneNumber,
      userInput,
      provider,
      networkCode,
      isNew,
    } = requestData;

    try {
      // Retrieve or create session
      let session = await this.getOrCreateSession(sessionId, phoneNumber, networkCode);

      // Process user input
      if (userInput) {
        session = await this.handleUserInput(session, userInput);
      }

      // Get menu response
      const menuResponse = this.menuFlow.getMenuResponse(
        session.currentMenu,
        session.context
      );

      // Save session
      await this.saveSession(session);

      // Format response based on provider
      let message = this.formatMessage(menuResponse, session, provider);

      // Check if session should end
      const shouldEnd = menuResponse.type === 'end' || session.isComplete;

      if (shouldEnd) {
        await this.endSession(sessionId);
        if (provider === 'africas-talking') {
          message = `END ${message}`;
        }
      } else {
        if (provider === 'africas-talking') {
          message = `CON ${message}`;
        }
      }

      return {
        message,
        sessionId: session.sessionId,
        provider,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('USSD processing error:', error);

      // Attempt SMS fallback for critical errors
      try {
        await this.smsFallback.sendFallbackMessage(phoneNumber, userInput);
      } catch (smsError) {
        logger.error('SMS fallback failed:', smsError);
      }

      throw error;
    }
  }

  /**
   * Get or create USSD session
   */
  async getOrCreateSession(sessionId, phoneNumber, networkCode) {
    let session;

    // Try to retrieve existing session
    if (sessionId) {
      const sessionData = await this.redisClient.get(`ussd:${sessionId}`);
      if (sessionData) {
        session = JSON.parse(sessionData);
        session.lastActivity = new Date();
        return session;
      }
    }

    // Create new session
    const newSessionId = sessionId || uuidv4();
    session = {
      sessionId: newSessionId,
      phoneNumber,
      networkCode,
      currentMenu: 'main',
      context: {},
      attempts: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
      isComplete: false,
    };

    // Attempt to resolve location from cell tower data
    try {
      const location = await this.locationResolver.resolveLocation(phoneNumber, networkCode);
      if (location) {
        session.context.location = location;
        session.context.locationSource = 'cell-tower';
      }
    } catch (error) {
      logger.warn('Location resolution failed:', error);
      session.context.locationSource = 'manual';
    }

    return session;
  }

  /**
   * Handle user input and update session state
   */
  async handleUserInput(session, userInput) {
    session.attempts = (session.attempts || 0) + 1;

    if (session.attempts > this.config.maxRetries) {
      session.isComplete = true;
      session.status = 'exceeded-retries';
      return session;
    }

    // Process menu selection
    const input = userInput.trim();
    const menuResponse = this.menuFlow.getMenuResponse(session.currentMenu, session.context);

    // Validate input against menu options
    if (menuResponse.options && menuResponse.options[input]) {
      const selectedOption = menuResponse.options[input];

      // Handle menu navigation and actions
      switch (session.currentMenu) {
        case 'main':
          return this.handleMainMenuSelection(session, input);

        case 'emergency-type':
          return this.handleEmergencyTypeSelection(session, input);

        case 'confirm':
          return this.handleConfirmation(session, input);

        case 'track':
          return this.handleTracking(session, input);

        default:
          return session;
      }
    }

    // Invalid input
    session.context.lastError = 'Invalid selection';
    return session;
  }

  /**
   * Handle main menu selections
   */
  async handleMainMenuSelection(session, input) {
    switch (input) {
      case '1': // Medical Emergency
        session.currentMenu = 'emergency-type';
        session.context.emergencyType = 'medical';
        break;

      case '2': // Accident
        session.currentMenu = 'confirm';
        session.context.emergencyType = 'accident';
        break;

      case '3': // Track Ambulance
        session.currentMenu = 'track';
        break;

      case '4': // Cancel
        session.isComplete = true;
        session.currentMenu = 'cancelled';
        break;

      default:
        session.context.lastError = 'Invalid selection. Please choose 1-4.';
    }

    return session;
  }

  /**
   * Handle emergency type sub-selections
   */
  async handleEmergencyTypeSelection(session, input) {
    const medicalTypes = {
      '1': 'chest-pain',
      '2': 'difficulty-breathing',
      '3': 'unconscious',
      '4': 'severe-bleeding',
      '5': 'back-to-main',
    };

    if (medicalTypes[input]) {
      if (input === '5') {
        session.currentMenu = 'main';
      } else {
        session.context.medicalCondition = medicalTypes[input];
        session.currentMenu = 'confirm';
      }
    } else {
      session.context.lastError = 'Invalid selection. Please choose 1-5.';
    }

    return session;
  }

  /**
   * Handle confirmation and dispatch
   */
  async handleConfirmation(session, input) {
    switch (input) {
      case '1': // Confirm and Dispatch
        // Create dispatch incident
        const incident = {
          incidentId: uuidv4(),
          phoneNumber: session.phoneNumber,
          emergencyType: session.context.emergencyType,
          medicalCondition: session.context.medicalCondition,
          location: session.context.location,
          locationSource: session.context.locationSource,
          timestamp: new Date(),
          channel: 'ussd',
          provider: 'africas-talking',
        };

        try {
          // Send to dispatch service
          await this.dispatchIncident(incident);
          session.context.incidentId = incident.incidentId;
          session.currentMenu = 'dispatched';
          session.isComplete = true;
        } catch (error) {
          logger.error('Dispatch failed:', error);
          session.currentMenu = 'dispatch-error';
        }
        break;

      case '2': // Back
        session.currentMenu = 'main';
        break;

      default:
        session.context.lastError = 'Invalid selection. Please choose 1 or 2.';
    }

    return session;
  }

  /**
   * Handle ambulance tracking
   */
  async handleTracking(session, input) {
    if (input === '1') {
      // Get ambulance tracking info
      try {
        const trackingInfo = await this.getAmbulanceTracking(session.phoneNumber);
        if (trackingInfo) {
          session.context.ambulanceEta = trackingInfo.eta;
          session.context.ambulancePlate = trackingInfo.plate;
          session.currentMenu = 'tracking-info';
        } else {
          session.currentMenu = 'no-active-dispatch';
        }
      } catch (error) {
        logger.error('Tracking error:', error);
        session.currentMenu = 'tracking-error';
      }
    } else if (input === '2') {
      session.currentMenu = 'main';
    } else {
      session.context.lastError = 'Invalid selection.';
    }

    return session;
  }

  /**
   * Format message based on provider
   */
  formatMessage(menuResponse, session, provider) {
    let message = menuResponse.message;

    if (menuResponse.options) {
      const optionsList = Object.entries(menuResponse.options)
        .map(([key, value]) => `${key}. ${value}`)
        .join('\n');

      message = `${message}\n\n${optionsList}`;
    }

    // Add error messages if present
    if (session.context.lastError) {
      message = `${session.context.lastError}\n\n${message}`;
      delete session.context.lastError;
    }

    return message;
  }

  /**
   * Save session to Redis
   */
  async saveSession(session) {
    const key = `ussd:${session.sessionId}`;
    const ttl = this.config.sessionTimeout;

    await this.redisClient.setEx(
      key,
      ttl,
      JSON.stringify(session)
    );
  }

  /**
   * Get session from Redis
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      const sessionData = await this.redisClient.get(`ussd:${sessionId}`);

      if (!sessionData) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(JSON.parse(sessionData));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * End session
   */
  async endSession(sessionId) {
    await this.redisClient.del(`ussd:${sessionId}`);
  }

  /**
   * Clear session endpoint
   */
  async clearSession(req, res) {
    try {
      const { sessionId } = req.params;
      await this.endSession(sessionId);
      res.json({ success: true, sessionId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get statistics
   */
  async getStats(req, res) {
    try {
      const stats = {
        activeSessions: await this.getActiveSessions(),
        timestamp: new Date(),
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get count of active sessions
   */
  async getActiveSessions() {
    const keys = await this.redisClient.keys('ussd:*');
    return keys.length;
  }

  /**
   * Dispatch incident (integrate with dispatch service)
   */
  async dispatchIncident(incident) {
    // This should integrate with the main dispatch service
    logger.info('Dispatching incident from USSD:', incident);

    // TODO: Call dispatch service API
    return {
      success: true,
      incidentId: incident.incidentId,
    };
  }

  /**
   * Get ambulance tracking info
   */
  async getAmbulanceTracking(phoneNumber) {
    // TODO: Query dispatch service for active dispatch
    // Return { eta: minutes, plate: "ABC 123" } or null
    return null;
  }

  /**
   * Start server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.redisClient.connect().catch(reject);

        this.server = this.app.listen(this.config.port, () => {
          logger.info(`USSD Server listening on port ${this.config.port}`);
          resolve(this.server);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop server
   */
  async stop() {
    return new Promise((resolve, reject) => {
      try {
        if (this.server) {
          this.server.close(() => {
            this.redisClient.quit().then(resolve).catch(reject);
          });
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Export for standalone usage
if (require.main === module) {
  const ussdServer = new USSDServer();
  ussdServer.start().catch((error) => {
    logger.error('Failed to start USSD server:', error);
    process.exit(1);
  });
}

module.exports = USSDServer;
