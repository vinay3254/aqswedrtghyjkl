/**
 * SMS Service
 * Main service orchestrating SMS/USSD emergency dispatch
 */

const { createGateway } = require('./gateway');
const SMSParser = require('./parser');
const GeocodingService = require('./geocoding');
const USSDHandler = require('./ussd-handler');

class SMSService {
  constructor(config = {}) {
    this.gateway = createGateway(config.gatewayType || 'mock', config.gateway);
    this.geocoding = new GeocodingService(config.googleMapsApiKey);
    this.ussdHandler = new USSDHandler();
    this.pendingDriverResponses = new Map();
    this.userIncidents = new Map(); // Track user's latest incident
  }

  /**
   * Process incoming SMS
   * @param {string} fromNumber - Sender's phone number
   * @param {string} message - SMS content
   * @returns {Promise<object>} Processing result
   */
  async processIncomingSMS(fromNumber, message) {
    console.log(`\n🔄 Processing SMS from ${fromNumber}`);

    // Parse the message
    const parsed = SMSParser.parse(message);

    if (!parsed.valid) {
      await this.sendSMS(fromNumber, parsed.error || 'Invalid command. Send HELP for instructions.');
      return {
        success: false,
        error: parsed.error
      };
    }

    // Route based on message type
    switch (parsed.type) {
      case 'emergency_request':
        return await this.handleEmergencyRequest(fromNumber, parsed);
      
      case 'status_request':
        return await this.handleStatusRequest(fromNumber, parsed);
      
      case 'driver_accept':
      case 'driver_reject':
        return await this.handleDriverResponse(fromNumber, parsed);
      
      case 'help_request':
        return await this.handleHelpRequest(fromNumber);
      
      default:
        await this.sendSMS(fromNumber, 'Unknown command. Send HELP for instructions.');
        return {
          success: false,
          error: 'Unknown command'
        };
    }
  }

  /**
   * Handle emergency ambulance request
   */
  async handleEmergencyRequest(fromNumber, parsed) {
    try {
      console.log(`🚨 Emergency request from ${fromNumber}: ${parsed.location}`);

      // Geocode the location
      const geocoded = await this.geocoding.getLocationWithFallback(
        parsed.location,
        fromNumber
      );

      if (!geocoded.success) {
        await this.sendSMS(
          fromNumber,
          'Unable to locate address. Please provide more details or call 108 for immediate assistance.'
        );
        return {
          success: false,
          error: 'Geocoding failed'
        };
      }

      // Create incident
      const incident = {
        id: `INC-${Date.now()}`,
        phoneNumber: fromNumber,
        location: geocoded.location,
        locationText: parsed.location,
        locationConfidence: geocoded.confidence,
        timestamp: new Date().toISOString(),
        status: 'pending',
        type: 'medical',
        severity: 'high'
      };

      // Store incident for status tracking
      this.userIncidents.set(fromNumber, incident);

      // Simulate ambulance dispatch
      const ambulance = await this.dispatchNearestAmbulance(incident);

      if (!ambulance) {
        await this.sendSMS(
          fromNumber,
          `Emergency received (${incident.id}). No ambulances available. Dispatcher will call you shortly.`
        );
        return {
          success: false,
          error: 'No ambulances available'
        };
      }

      // Update incident
      incident.ambulanceId = ambulance.id;
      incident.driverId = ambulance.driverId;
      incident.driverPhone = ambulance.driverPhone;
      incident.status = 'assigned';
      incident.eta = ambulance.eta;

      // Send confirmation to user
      await this.sendEmergencyConfirmation(fromNumber, incident, ambulance);

      // Send assignment to driver
      await this.sendDriverAssignment(ambulance.driverPhone, incident);

      console.log(`✅ Ambulance ${ambulance.id} dispatched for incident ${incident.id}`);

      return {
        success: true,
        incident,
        ambulance
      };

    } catch (error) {
      console.error('Emergency request error:', error);
      await this.sendSMS(
        fromNumber,
        'Error processing request. Please call 108 immediately.'
      );
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send emergency confirmation to user
   */
  async sendEmergencyConfirmation(phoneNumber, incident, ambulance) {
    const message = `Emergency received. Ambulance ${ambulance.id} assigned. ETA ${ambulance.eta} min. Driver: ${ambulance.driverPhone}. Track: http://track.ems/${incident.id}`;
    
    await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send ambulance assignment to driver
   */
  async sendDriverAssignment(driverPhone, incident) {
    const message = `NEW ASSIGNMENT: Incident ${incident.id}. Location: ${incident.locationText}. Type: ${incident.type}. Severity: ${incident.severity}. Reply YES to accept, NO to reject.`;
    
    // Track pending response
    this.pendingDriverResponses.set(driverPhone, {
      incidentId: incident.id,
      timestamp: Date.now()
    });

    await this.sendSMS(driverPhone, message);
  }

  /**
   * Handle driver response (YES/NO)
   */
  async handleDriverResponse(fromNumber, parsed) {
    const pending = this.pendingDriverResponses.get(fromNumber);

    if (!pending) {
      await this.sendSMS(fromNumber, 'No pending assignment found.');
      return {
        success: false,
        error: 'No pending assignment'
      };
    }

    this.pendingDriverResponses.delete(fromNumber);

    if (parsed.accepted) {
      // Driver accepted
      const message = `Assignment accepted. Route: Take NH-31 to location. Distance: 8 km. Hospital: City General. Contact patient: Get from dispatch.`;
      await this.sendSMS(fromNumber, message);

      console.log(`✅ Driver ${fromNumber} accepted incident ${pending.incidentId}`);

      return {
        success: true,
        action: 'accepted',
        incidentId: pending.incidentId
      };
    } else {
      // Driver rejected
      await this.sendSMS(fromNumber, 'Assignment rejected. Finding alternative ambulance...');

      console.log(`❌ Driver ${fromNumber} rejected incident ${pending.incidentId}`);

      return {
        success: true,
        action: 'rejected',
        incidentId: pending.incidentId
      };
    }
  }

  /**
   * Handle status request
   */
  async handleStatusRequest(fromNumber, parsed) {
    const incident = this.userIncidents.get(fromNumber);

    if (!incident) {
      await this.sendSMS(fromNumber, 'No active emergency found. Send AMBULANCE <location> to request.');
      return {
        success: false,
        error: 'No active incident'
      };
    }

    const statusMessage = this.getStatusMessage(incident);
    await this.sendSMS(fromNumber, statusMessage);

    return {
      success: true,
      incident
    };
  }

  /**
   * Get status message based on incident state
   */
  getStatusMessage(incident) {
    switch (incident.status) {
      case 'assigned':
        return `Status: Ambulance ${incident.ambulanceId} assigned. ETA ${incident.eta} min. Driver: ${incident.driverPhone}`;
      
      case 'en_route':
        return `Status: Ambulance on the way. Arriving in ${incident.eta} min. Driver: ${incident.driverPhone}`;
      
      case 'arrived':
        return `Status: Ambulance has arrived at your location. Look for ${incident.ambulanceId}.`;
      
      case 'patient_loaded':
        return `Status: Patient loaded. Going to ${incident.hospital || 'nearest hospital'}.`;
      
      case 'at_hospital':
        return `Status: Arrived at hospital. Patient handed over. Stay safe!`;
      
      default:
        return `Status: ${incident.status}. Incident ID: ${incident.id}`;
    }
  }

  /**
   * Handle help request
   */
  async handleHelpRequest(fromNumber) {
    const helpMessage = SMSParser.getHelpMessage();
    await this.sendSMS(fromNumber, helpMessage);

    return {
      success: true,
      action: 'help_sent'
    };
  }

  /**
   * Send ambulance status update
   * @param {string} phoneNumber - User's phone number
   * @param {string} status - New status
   * @param {object} details - Additional details
   */
  async sendStatusUpdate(phoneNumber, status, details = {}) {
    const incident = this.userIncidents.get(phoneNumber);
    
    if (!incident) {
      console.log(`⚠️ No incident found for ${phoneNumber}`);
      return;
    }

    incident.status = status;
    
    let message;
    switch (status) {
      case 'en_route':
        incident.eta = details.eta || 10;
        message = `Ambulance on the way. Arriving in ${incident.eta} min.`;
        break;
      
      case 'arrived':
        message = `Ambulance has arrived. Look for ${incident.ambulanceId}.`;
        break;
      
      case 'patient_loaded':
        incident.hospital = details.hospital || 'City Hospital';
        message = `Patient loaded. Going to ${incident.hospital}.`;
        break;
      
      case 'at_hospital':
        message = `Arrived at hospital. Patient handed over.`;
        break;
      
      default:
        message = `Status update: ${status}`;
    }

    await this.sendSMS(phoneNumber, message);
    console.log(`📊 Status update sent to ${phoneNumber}: ${status}`);
  }

  /**
   * Dispatch nearest ambulance (mock implementation)
   */
  async dispatchNearestAmbulance(incident) {
    // Mock ambulance data
    const ambulances = [
      {
        id: 'AMB-12',
        driverId: 'DRV-101',
        driverName: 'Rajesh Kumar',
        driverPhone: '+91-9876543210',
        latitude: incident.location.latitude + 0.05,
        longitude: incident.location.longitude + 0.05,
        available: true
      },
      {
        id: 'AMB-45',
        driverId: 'DRV-102',
        driverName: 'Suresh Singh',
        driverPhone: '+91-9876543211',
        latitude: incident.location.latitude + 0.08,
        longitude: incident.location.longitude + 0.08,
        available: true
      }
    ];

    // Find nearest available ambulance
    const available = ambulances.filter(a => a.available);
    if (available.length === 0) return null;

    const nearest = available[0];
    
    // Calculate ETA (mock)
    const distance = this.geocoding.calculateDistance(
      nearest.latitude,
      nearest.longitude,
      incident.location.latitude,
      incident.location.longitude
    );
    
    const eta = Math.ceil(distance * 2); // Rough estimate: 2 min per km

    return {
      ...nearest,
      distance,
      eta
    };
  }

  /**
   * Send SMS via gateway
   */
  async sendSMS(phoneNumber, message) {
    return await this.gateway.sendSMS(phoneNumber, message);
  }

  /**
   * Handle USSD session
   */
  handleUSSD(sessionId, phoneNumber, input, serviceCode = '108') {
    const response = this.ussdHandler.handleSession(sessionId, phoneNumber, input, serviceCode);

    // If action is dispatch_ambulance, process it
    if (response.action === 'dispatch_ambulance') {
      // Process as emergency request
      this.processIncomingSMS(phoneNumber, `AMBULANCE ${response.data.location}`);
    }

    return response;
  }

  /**
   * Get SMS delivery status
   */
  getDeliveryStatus(messageId) {
    return this.gateway.getDeliveryStatus(messageId);
  }

  /**
   * Get sent messages
   */
  getSentMessages() {
    return this.gateway.getSentMessages();
  }
}

module.exports = SMSService;
