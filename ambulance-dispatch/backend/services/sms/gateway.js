/**
 * Mock SMS Gateway for Testing
 * Simulates SMS sending/receiving with console logging
 * Integration points for Twilio, Nexmo, or Indian SMS providers
 */

class SMSGateway {
  constructor() {
    this.sentMessages = [];
    this.deliveryStatus = new Map();
    this.webhookUrl = null;
  }

  /**
   * Send SMS message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - SMS content
   * @returns {Promise<object>} Message ID and status
   */
  async sendSMS(phoneNumber, message) {
    const messageId = `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const smsData = {
      id: messageId,
      to: phoneNumber,
      message,
      timestamp: new Date().toISOString(),
      status: 'sent',
      deliveredAt: null
    };

    this.sentMessages.push(smsData);
    this.deliveryStatus.set(messageId, 'sent');

    // Mock delivery after 2 seconds
    setTimeout(() => {
      this.deliveryStatus.set(messageId, 'delivered');
      smsData.status = 'delivered';
      smsData.deliveredAt = new Date().toISOString();
      console.log(`📬 SMS DELIVERED to ${phoneNumber}`);
    }, 2000);

    console.log(`\n📤 SMS SENT`);
    console.log(`To: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    console.log(`Message ID: ${messageId}`);
    console.log(`Status: sent`);
    console.log(`─────────────────────────────────────\n`);

    return {
      success: true,
      messageId,
      status: 'sent',
      timestamp: smsData.timestamp
    };
  }

  /**
   * Simulate receiving SMS (for testing)
   * @param {string} fromNumber - Sender phone number
   * @param {string} message - SMS content
   * @returns {Promise<object>} Received message data
   */
  async receiveSMS(fromNumber, message) {
    const receivedData = {
      from: fromNumber,
      message,
      timestamp: new Date().toISOString(),
      id: `RCV-${Date.now()}`
    };

    console.log(`\n📥 SMS RECEIVED`);
    console.log(`From: ${fromNumber}`);
    console.log(`Message: ${message}`);
    console.log(`Timestamp: ${receivedData.timestamp}`);
    console.log(`─────────────────────────────────────\n`);

    // Trigger webhook if configured
    if (this.webhookUrl) {
      await this.triggerWebhook(receivedData);
    }

    return receivedData;
  }

  /**
   * Get delivery status of a message
   * @param {string} messageId - Message ID
   * @returns {string} Delivery status
   */
  getDeliveryStatus(messageId) {
    return this.deliveryStatus.get(messageId) || 'unknown';
  }

  /**
   * Get all sent messages
   * @returns {Array} Sent messages
   */
  getSentMessages() {
    return this.sentMessages;
  }

  /**
   * Set webhook URL for incoming SMS
   * @param {string} url - Webhook URL
   */
  setWebhookUrl(url) {
    this.webhookUrl = url;
  }

  /**
   * Trigger webhook for incoming SMS
   * @param {object} data - SMS data
   */
  async triggerWebhook(data) {
    try {
      // In a real implementation, this would make an HTTP POST to the webhook URL
      console.log(`🔔 Webhook triggered: ${this.webhookUrl}`);
      console.log(`Data:`, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Webhook trigger failed:', error.message);
    }
  }

  /**
   * Clear all messages (for testing)
   */
  clearMessages() {
    this.sentMessages = [];
    this.deliveryStatus.clear();
  }
}

// Twilio Integration (commented out - activate when credentials available)
class TwilioGateway {
  constructor(accountSid, authToken, fromNumber) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
    // this.client = require('twilio')(accountSid, authToken);
  }

  async sendSMS(phoneNumber, message) {
    // Uncomment when using Twilio
    /*
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      });
      
      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        timestamp: result.dateCreated
      };
    } catch (error) {
      console.error('Twilio SMS Error:', error);
      throw error;
    }
    */
    throw new Error('Twilio integration not configured');
  }
}

// Nexmo/Vonage Integration (commented out - activate when credentials available)
class NexmoGateway {
  constructor(apiKey, apiSecret, fromNumber) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.fromNumber = fromNumber;
    // this.nexmo = new Nexmo({ apiKey, apiSecret });
  }

  async sendSMS(phoneNumber, message) {
    // Uncomment when using Nexmo
    /*
    return new Promise((resolve, reject) => {
      this.nexmo.message.sendSms(
        this.fromNumber,
        phoneNumber,
        message,
        (err, responseData) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              success: responseData.messages[0].status === '0',
              messageId: responseData.messages[0]['message-id'],
              status: responseData.messages[0].status
            });
          }
        }
      );
    });
    */
    throw new Error('Nexmo integration not configured');
  }
}

// Factory to create appropriate gateway
function createGateway(type = 'mock', config = {}) {
  switch (type) {
    case 'twilio':
      return new TwilioGateway(
        config.accountSid,
        config.authToken,
        config.fromNumber
      );
    case 'nexmo':
      return new NexmoGateway(
        config.apiKey,
        config.apiSecret,
        config.fromNumber
      );
    case 'mock':
    default:
      return new SMSGateway();
  }
}

module.exports = {
  SMSGateway,
  TwilioGateway,
  NexmoGateway,
  createGateway
};
