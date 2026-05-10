/**
 * SMS Controller
 * HTTP endpoints for SMS and USSD functionality
 */

const SMSService = require('./service');

class SMSController {
  constructor(config = {}) {
    this.smsService = new SMSService(config);
  }

  /**
   * Receive incoming SMS (webhook)
   * POST /api/sms/receive
   */
  async receiveSMS(req, res) {
    try {
      const { from, message, messageId } = req.body;

      if (!from || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: from, message'
        });
      }

      console.log(`\n📨 Incoming SMS webhook`);
      console.log(`From: ${from}`);
      console.log(`Message: ${message}`);

      // Process the SMS
      const result = await this.smsService.processIncomingSMS(from, message);

      res.json({
        success: true,
        messageId,
        processed: result
      });

    } catch (error) {
      console.error('SMS receive error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Send SMS
   * POST /api/sms/send
   */
  async sendSMS(req, res) {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, message'
        });
      }

      const result = await this.smsService.sendSMS(to, message);

      res.json(result);

    } catch (error) {
      console.error('SMS send error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get SMS delivery status
   * GET /api/sms/status/:messageId
   */
  async getSMSStatus(req, res) {
    try {
      const { messageId } = req.params;

      const status = this.smsService.getDeliveryStatus(messageId);

      res.json({
        success: true,
        messageId,
        status
      });

    } catch (error) {
      console.error('SMS status error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get sent messages
   * GET /api/sms/messages
   */
  async getSentMessages(req, res) {
    try {
      const messages = this.smsService.getSentMessages();

      res.json({
        success: true,
        count: messages.length,
        messages
      });

    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle USSD session
   * POST /api/ussd/session
   */
  async handleUSSD(req, res) {
    try {
      const { sessionId, phoneNumber, input, serviceCode } = req.body;

      if (!sessionId || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sessionId, phoneNumber'
        });
      }

      console.log(`\n📞 USSD Session`);
      console.log(`Session ID: ${sessionId}`);
      console.log(`Phone: ${phoneNumber}`);
      console.log(`Input: ${input || '(initial)'}`);

      const response = this.smsService.handleUSSD(
        sessionId,
        phoneNumber,
        input || '',
        serviceCode
      );

      res.json({
        success: true,
        response: response.message,
        type: response.type,
        action: response.action,
        sessionId: response.session ? response.session.id : null
      });

    } catch (error) {
      console.error('USSD error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Send status update
   * POST /api/sms/status-update
   */
  async sendStatusUpdate(req, res) {
    try {
      const { phoneNumber, status, details } = req.body;

      if (!phoneNumber || !status) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: phoneNumber, status'
        });
        }

      await this.smsService.sendStatusUpdate(phoneNumber, status, details);

      res.json({
        success: true,
        message: 'Status update sent'
      });

    } catch (error) {
      console.error('Status update error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Simulate incoming SMS (for testing)
   * POST /api/sms/simulate
   */
  async simulateIncomingSMS(req, res) {
    try {
      const { from, message } = req.body;

      if (!from || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: from, message'
        });
      }

      console.log(`\n🧪 Simulating incoming SMS`);

      // Simulate receiving via gateway
      await this.smsService.gateway.receiveSMS(from, message);

      // Process the SMS
      const result = await this.smsService.processIncomingSMS(from, message);

      res.json({
        success: true,
        simulation: true,
        result
      });

    } catch (error) {
      console.error('Simulation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Simulate USSD flow (for testing)
   * POST /api/ussd/simulate
   */
  async simulateUSSD(req, res) {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: phoneNumber'
        });
      }

      const sessionId = `USSD-${Date.now()}`;
      const flow = [];

      // Step 1: Initial dial
      let response = this.smsService.handleUSSD(sessionId, phoneNumber, '');
      flow.push({
        step: 'Initial',
        input: '(dial *108#)',
        response: response.message
      });

      // Step 2: Select "Request Ambulance"
      response = this.smsService.handleUSSD(sessionId, phoneNumber, '1');
      flow.push({
        step: 'Menu Selection',
        input: '1',
        response: response.message
      });

      // Step 3: Enter location
      response = this.smsService.handleUSSD(sessionId, phoneNumber, 'Gandhi Chowk, Patna');
      flow.push({
        step: 'Enter Location',
        input: 'Gandhi Chowk, Patna',
        response: response.message
      });

      // Step 4: Confirm
      response = this.smsService.handleUSSD(sessionId, phoneNumber, '1');
      flow.push({
        step: 'Confirm',
        input: '1',
        response: response.message
      });

      res.json({
        success: true,
        simulation: true,
        sessionId,
        phoneNumber,
        flow
      });

    } catch (error) {
      console.error('USSD simulation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get service health
   * GET /api/sms/health
   */
  async getHealth(req, res) {
    try {
      res.json({
        success: true,
        service: 'SMS/USSD Service',
        status: 'operational',
        gateway: 'mock',
        activeSessions: this.smsService.ussdHandler.getActiveSessionCount(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = SMSController;
