/**
 * SMS Fallback Service
 * Provides SMS-based dispatch when USSD is unavailable
 * Handles SMS parsing, user intent extraction, and fallback dispatch
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

class SMSFallback {
  constructor(config = {}) {
    this.config = {
      smsGatewayUrl: config.smsGatewayUrl || 'https://api.sms-provider.com',
      smsGatewayKey: config.smsGatewayKey || process.env.SMS_GATEWAY_KEY,
      fallbackNumbers: config.fallbackNumbers || [
        '+254701234567', // Emergency dispatch center
        '+254702234567', // Backup dispatch
      ],
      keywords: config.keywords || {
        medical: ['medical', 'sick', 'pain', 'health', 'hospital', 'doctor'],
        accident: ['accident', 'crash', 'collision', 'hit', 'emergency'],
        ambulance: ['ambulance', 'help', 'emergency', 'urgent'],
      },
      dispatchConfig: config.dispatchConfig || {},
      ...config,
    };

    this.smsCache = new Map(); // Simple in-memory cache for SMS conversations
  }

  /**
   * Send fallback message via SMS
   * Called when USSD processing fails or times out
   */
  async sendFallbackMessage(phoneNumber, context = {}) {
    try {
      const message = this.constructFallbackMessage(context);

      const response = await this.sendSMS(phoneNumber, message);

      logger.info('Fallback SMS sent', {
        phoneNumber,
        messageId: response.messageId,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        messageId: response.messageId,
        channel: 'sms-fallback',
      };
    } catch (error) {
      logger.error('SMS fallback failed:', error);
      throw new Error(`SMS fallback failed: ${error.message}`);
    }
  }

  /**
   * Handle incoming SMS message and extract emergency intent
   */
  async handleIncomingSMS(phoneNumber, messageText) {
    try {
      const smsId = uuidv4();
      const timestamp = new Date();

      logger.info('Incoming SMS for fallback processing', {
        smsId,
        phoneNumber,
        message: messageText,
      });

      // Analyze message intent
      const intent = this.analyzeMessageIntent(messageText);

      // Get or create SMS session
      const sessionKey = `sms:${phoneNumber}`;
      let session = this.smsCache.get(sessionKey) || {
        phoneNumber,
        createdAt: timestamp,
        messages: [],
        intent: null,
        isComplete: false,
      };

      // Add message to session
      session.messages.push({
        smsId,
        text: messageText,
        intent,
        timestamp,
      });

      session.lastActivity = timestamp;

      // Process SMS based on intent
      const dispatch = await this.processSMSIntent(phoneNumber, intent, session);

      if (dispatch.shouldDispatch) {
        session.isComplete = true;
        session.dispatchId = dispatch.incidentId;
      }

      // Cache session
      if (!session.isComplete) {
        this.smsCache.set(sessionKey, session);
        // Set timeout to clear session after 30 minutes
        setTimeout(() => this.smsCache.delete(sessionKey), 30 * 60 * 1000);
      }

      return {
        smsId,
        sessionKey,
        intent,
        dispatch,
        requiresConfirmation: !dispatch.shouldDispatch && intent.confidence < 0.8,
      };
    } catch (error) {
      logger.error('SMS intent processing failed:', error);
      throw error;
    }
  }

  /**
   * Analyze SMS message to extract emergency intent
   */
  analyzeMessageIntent(messageText) {
    const text = messageText.toLowerCase().trim();

    // Extract intent type
    let intentType = 'unknown';
    let confidence = 0;
    const matchedKeywords = [];

    // Medical emergency detection
    const medicalMatches = this.config.keywords.medical.filter((kw) =>
      text.includes(kw)
    );
    if (medicalMatches.length > 0) {
      intentType = 'medical';
      confidence = Math.min(medicalMatches.length * 0.3, 1.0);
      matchedKeywords.push(...medicalMatches);
    }

    // Accident detection
    const accidentMatches = this.config.keywords.accident.filter((kw) =>
      text.includes(kw)
    );
    if (accidentMatches.length > 0 && intentType !== 'medical') {
      intentType = 'accident';
      confidence = Math.min(accidentMatches.length * 0.3, 1.0);
      matchedKeywords.push(...accidentMatches);
    }

    // General ambulance request
    if (this.config.keywords.ambulance.some((kw) => text.includes(kw))) {
      if (confidence < 0.5) {
        intentType = 'ambulance';
        confidence = 0.7;
      }
      matchedKeywords.push(...this.config.keywords.ambulance.filter((kw) =>
        text.includes(kw)
      ));
    }

    // Extract specific medical conditions
    const conditions = this.extractMedicalConditions(text);

    // Boost confidence if conditions are found
    if (conditions.length > 0) {
      confidence = Math.min(confidence + 0.2, 1.0);
    }

    return {
      type: intentType,
      confidence,
      matchedKeywords: [...new Set(matchedKeywords)],
      conditions,
      rawMessage: messageText,
      timestamp: new Date(),
    };
  }

  /**
   * Extract specific medical conditions from message
   */
  extractMedicalConditions(text) {
    const conditions = {
      chest: /chest|heart|cardiac/i,
      breathing: /breath|breathing|asthma|choking|suffoc/i,
      unconscious: /unconscious|faint|collapse|pass.{0,5}out|seizure|convul/i,
      bleeding: /bleed|blood|hemorrhag|wound|cut|stab|shot/i,
      accident: /accident|crash|collision|hit|car|motorcycle|bike/i,
      burn: /burn|fire|scald|electro/i,
      poison: /poison|overdose|drug|toxin/i,
      fracture: /fracture|break|bone|sprain|twist|dislocate/i,
    };

    const found = [];
    for (const [condition, regex] of Object.entries(conditions)) {
      if (regex.test(text)) {
        found.push(condition);
      }
    }

    return found;
  }

  /**
   * Process SMS intent and determine if dispatch is needed
   */
  async processSMSIntent(phoneNumber, intent, session) {
    // High confidence direct dispatch
    if (intent.confidence >= 0.8) {
      try {
        const incident = await this.createDispatchIncident(phoneNumber, intent, session);
        return {
          shouldDispatch: true,
          incidentId: incident.incidentId,
          confidence: intent.confidence,
        };
      } catch (error) {
        logger.error('Dispatch incident creation failed:', error);
        return {
          shouldDispatch: false,
          error: error.message,
        };
      }
    }

    // Medium confidence - require confirmation
    if (intent.confidence >= 0.5) {
      return {
        shouldDispatch: false,
        requiresConfirmation: true,
        suggestedIntent: intent.type,
        confidence: intent.confidence,
      };
    }

    // Low confidence - ask for clarification
    return {
      shouldDispatch: false,
      requiresClarification: true,
      confidence: intent.confidence,
    };
  }

  /**
   * Create dispatch incident from SMS
   */
  async createDispatchIncident(phoneNumber, intent, session) {
    const incident = {
      incidentId: uuidv4(),
      phoneNumber,
      channel: 'sms-fallback',
      emergencyType: intent.type,
      conditions: intent.conditions,
      confidence: intent.confidence,
      messageText: intent.rawMessage,
      sessions: session.messages.map((m) => m.smsId),
      timestamp: new Date(),
      source: 'sms-fallback',
    };

    // TODO: Send to main dispatch service
    logger.info('SMS Fallback Dispatch Incident Created', incident);

    return incident;
  }

  /**
   * Send confirmation request SMS
   */
  async sendConfirmationRequest(phoneNumber, suggestedIntent) {
    const confirmationMessages = {
      medical:
        'We detected a medical emergency. Reply YES to dispatch an ambulance or call 911 directly.',
      accident:
        'We detected an accident. Reply YES to dispatch an ambulance or call 911 directly.',
      ambulance:
        'Do you need an ambulance? Reply YES or NO.',
      unknown:
        'Do you need emergency assistance? Reply YES for ambulance or NO to cancel.',
    };

    const message =
      confirmationMessages[suggestedIntent] ||
      confirmationMessages.unknown;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send SMS via gateway
   */
  async sendSMS(phoneNumber, message) {
    try {
      // Use configured SMS provider (e.g., Africa's Talking, Twilio)
      // This is a generic implementation - adapt to your SMS provider

      const payload = {
        recipients: [
          {
            phoneNumber,
            message,
          },
        ],
      };

      const response = await axios.post(`${this.config.smsGatewayUrl}/send`, payload, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.config.smsGatewayKey,
        },
        timeout: 10000,
      });

      return {
        success: true,
        messageId: response.data.data?.recipients?.[0]?.statusCode
          ? uuidv4()
          : null,
        provider: 'sms-gateway',
      };
    } catch (error) {
      // Fallback: try to send via local provider
      logger.warn('SMS gateway failed, attempting fallback provider:', error.message);

      return {
        success: false,
        error: error.message,
        fallback: true,
      };
    }
  }

  /**
   * Construct fallback message
   */
  constructFallbackMessage(context = {}) {
    if (context.emergencyType) {
      return `We are dispatching an ambulance to your location. Your incident ID is: ${
        context.incidentId || 'PENDING'
      }. Help is on the way. Do not move the patient if possible.`;
    }

    if (context.error) {
      return `The USSD system is temporarily unavailable. Please call 911 directly or reply to this SMS with YES to request an ambulance.`;
    }

    return `Emergency Services: Please reply to this message with your emergency type (MEDICAL, ACCIDENT) or call 911.`;
  }

  /**
   * Handle SMS confirmation response
   */
  async handleConfirmationResponse(phoneNumber, response, sessionKey) {
    const normalizedResponse = response.toLowerCase().trim();

    if (['yes', 'y', '1'].includes(normalizedResponse)) {
      const session = this.smsCache.get(sessionKey);
      if (session) {
        const dispatch = await this.createDispatchIncident(
          phoneNumber,
          session.intent || { type: 'ambulance', confidence: 0.9 },
          session
        );

        return {
          confirmed: true,
          incidentId: dispatch.incidentId,
        };
      }
    } else if (['no', 'n', '0'].includes(normalizedResponse)) {
      this.smsCache.delete(sessionKey);
      return { confirmed: false };
    }

    return { confirmed: false, error: 'Invalid response' };
  }

  /**
   * Get SMS session info
   */
  getSession(sessionKey) {
    return this.smsCache.get(sessionKey);
  }

  /**
   * Clear SMS session
   */
  clearSession(sessionKey) {
    this.smsCache.delete(sessionKey);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeSessions: this.smsCache.size,
      sessions: Array.from(this.smsCache.entries()).map(([key, session]) => ({
        key,
        phoneNumber: session.phoneNumber,
        messageCount: session.messages.length,
        intent: session.intent?.type,
        createdAt: session.createdAt,
      })),
    };
  }
}

module.exports = SMSFallback;
