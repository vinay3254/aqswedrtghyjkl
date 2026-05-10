/**
 * SMS Command Parser
 * Parses incoming SMS messages and extracts commands and data
 */

class SMSParser {
  /**
   * Parse emergency ambulance request
   * Format: "AMBULANCE <location>"
   * Example: "AMBULANCE Gandhi Chowk, Patna"
   */
  static parseEmergencyRequest(message) {
    const trimmed = message.trim();
    const regex = /^AMBULANCE\s+(.+)$/i;
    const match = trimmed.match(regex);

    if (!match) {
      return {
        type: 'unknown',
        valid: false,
        error: 'Invalid format. Use: AMBULANCE <location>'
      };
    }

    return {
      type: 'emergency_request',
      valid: true,
      location: match[1].trim(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Parse status check request
   * Format: "STATUS" or "STATUS <incident_id>"
   */
  static parseStatusRequest(message) {
    const trimmed = message.trim();
    const regex = /^STATUS(?:\s+(\d+))?$/i;
    const match = trimmed.match(regex);

    if (!match) {
      return {
        type: 'unknown',
        valid: false,
        error: 'Invalid format. Use: STATUS or STATUS <incident_id>'
      };
    }

    return {
      type: 'status_request',
      valid: true,
      incidentId: match[1] || null
    };
  }

  /**
   * Parse driver assignment response
   * Format: "YES" or "NO"
   */
  static parseDriverResponse(message) {
    const trimmed = message.trim().toUpperCase();

    if (trimmed === 'YES') {
      return {
        type: 'driver_accept',
        valid: true,
        accepted: true
      };
    }

    if (trimmed === 'NO') {
      return {
        type: 'driver_reject',
        valid: true,
        accepted: false
      };
    }

    return {
      type: 'unknown',
      valid: false,
      error: 'Invalid response. Reply YES to accept or NO to reject.'
    };
  }

  /**
   * Parse help request
   * Format: "HELP"
   */
  static parseHelpRequest(message) {
    const trimmed = message.trim().toUpperCase();

    if (trimmed === 'HELP') {
      return {
        type: 'help_request',
        valid: true
      };
    }

    return {
      type: 'unknown',
      valid: false
    };
  }

  /**
   * Main parser - determines message type and parses accordingly
   */
  static parse(message) {
    if (!message || typeof message !== 'string') {
      return {
        type: 'invalid',
        valid: false,
        error: 'Empty or invalid message'
      };
    }

    const trimmed = message.trim().toUpperCase();

    // Check for HELP
    if (trimmed === 'HELP') {
      return this.parseHelpRequest(message);
    }

    // Check for STATUS
    if (trimmed.startsWith('STATUS')) {
      return this.parseStatusRequest(message);
    }

    // Check for AMBULANCE request
    if (trimmed.startsWith('AMBULANCE')) {
      return this.parseEmergencyRequest(message);
    }

    // Check for driver response (YES/NO)
    if (trimmed === 'YES' || trimmed === 'NO') {
      return this.parseDriverResponse(message);
    }

    // Unknown command
    return {
      type: 'unknown',
      valid: false,
      error: 'Unknown command. Send HELP for instructions.'
    };
  }

  /**
   * Generate help message
   */
  static getHelpMessage() {
    return `Emergency SMS Commands:

AMBULANCE <location> - Request emergency ambulance
Example: AMBULANCE Gandhi Chowk, Patna

STATUS - Check your latest ambulance status
STATUS <id> - Check specific incident status

YES - Accept ambulance assignment (drivers)
NO - Reject ambulance assignment (drivers)

HELP - Show this help message

For immediate assistance, call 108.`;
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phoneNumber) {
    // Indian phone number format: +91XXXXXXXXXX or 10 digits
    const regex = /^(\+91)?[6-9]\d{9}$/;
    return regex.test(phoneNumber.replace(/\s/g, ''));
  }

  /**
   * Format phone number to standard format
   */
  static formatPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\s/g, '');
    
    // Add +91 if not present
    if (cleaned.startsWith('+91')) {
      return cleaned;
    }
    
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    
    return cleaned;
  }

  /**
   * Extract location landmarks from text
   */
  static extractLandmarks(locationText) {
    const landmarks = [];
    const commonLandmarks = [
      'hospital', 'school', 'temple', 'mosque', 'church',
      'station', 'park', 'market', 'mall', 'circle',
      'chowk', 'road', 'street', 'lane', 'colony'
    ];

    const words = locationText.toLowerCase().split(/\s+/);
    
    words.forEach((word, index) => {
      if (commonLandmarks.some(landmark => word.includes(landmark))) {
        // Include the word before and after for context
        const start = Math.max(0, index - 1);
        const end = Math.min(words.length, index + 2);
        landmarks.push(words.slice(start, end).join(' '));
      }
    });

    return landmarks;
  }

  /**
   * Parse location confidence from text
   */
  static getLocationConfidence(locationText) {
    const text = locationText.toLowerCase();
    let confidence = 50; // Base confidence

    // Increase confidence for specific patterns
    if (text.includes(',')) confidence += 10; // Has comma separation
    if (/\d{6}/.test(text)) confidence += 20; // Has PIN code
    if (text.includes('near')) confidence += 10; // Has "near" reference
    if (text.split(/\s+/).length >= 3) confidence += 10; // Multiple words
    
    const landmarks = this.extractLandmarks(text);
    if (landmarks.length > 0) confidence += 15; // Has landmarks

    return Math.min(100, confidence);
  }
}

module.exports = SMSParser;
