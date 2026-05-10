/**
 * USSD Session Handler
 * Handles USSD menu navigation for *108# emergency service
 * State machine for multi-step interactions
 */

class USSDHandler {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = 180000; // 3 minutes
  }

  /**
   * Handle USSD session
   * @param {string} sessionId - Unique session ID
   * @param {string} phoneNumber - User's phone number
   * @param {string} input - User input
   * @param {number} serviceCode - USSD service code (e.g., 108)
   * @returns {object} Response with message and continue flag
   */
  handleSession(sessionId, phoneNumber, input, serviceCode = '108') {
    let session = this.sessions.get(sessionId);

    // New session
    if (!session) {
      session = {
        id: sessionId,
        phoneNumber,
        state: 'main_menu',
        data: {},
        startTime: Date.now()
      };
      this.sessions.set(sessionId, session);
      return this.showMainMenu(session);
    }

    // Clean expired sessions
    this.cleanExpiredSessions();

    // Route to appropriate handler based on state
    return this.routeInput(session, input);
  }

  /**
   * Show main menu
   */
  showMainMenu(session) {
    session.state = 'main_menu';
    
    const menu = `CON Welcome to Emergency Medical Services

1. Request Ambulance
2. Check Ambulance Status
3. List Nearby Hospitals
4. Emergency Contacts
5. Help

Enter your choice:`;

    return {
      type: 'CON',
      message: menu,
      session
    };
  }

  /**
   * Route user input to appropriate handler
   */
  routeInput(session, input) {
    switch (session.state) {
      case 'main_menu':
        return this.handleMainMenuInput(session, input);
      
      case 'request_ambulance_location':
        return this.handleLocationInput(session, input);
      
      case 'request_ambulance_confirm':
        return this.handleConfirmation(session, input);
      
      case 'check_status_input':
        return this.handleStatusInput(session, input);
      
      case 'list_hospitals':
        return this.handleHospitalList(session, input);
      
      default:
        return this.showMainMenu(session);
    }
  }

  /**
   * Handle main menu selection
   */
  handleMainMenuInput(session, input) {
    switch (input) {
      case '1':
        return this.requestAmbulanceFlow(session);
      
      case '2':
        return this.checkStatusFlow(session);
      
      case '3':
        return this.listHospitalsFlow(session);
      
      case '4':
        return this.showEmergencyContacts(session);
      
      case '5':
        return this.showHelp(session);
      
      default:
        return {
          type: 'CON',
          message: 'Invalid choice. Please enter 1-5:',
          session
        };
    }
  }

  /**
   * Request Ambulance Flow
   */
  requestAmbulanceFlow(session) {
    session.state = 'request_ambulance_location';
    
    return {
      type: 'CON',
      message: `CON Request Ambulance

Enter your location:
(e.g., Gandhi Chowk, Patna)`,
      session
    };
  }

  /**
   * Handle location input
   */
  handleLocationInput(session, input) {
    if (!input || input.trim().length < 3) {
      return {
        type: 'CON',
        message: 'CON Location too short. Please enter a detailed location:',
        session
      };
    }

    session.data.location = input.trim();
    session.state = 'request_ambulance_confirm';

    return {
      type: 'CON',
      message: `CON Confirm Emergency Request

Location: ${session.data.location}

1. Confirm & Request
2. Re-enter Location
3. Cancel

Enter your choice:`,
      session
    };
  }

  /**
   * Handle confirmation
   */
  handleConfirmation(session, input) {
    switch (input) {
      case '1':
        // Confirm and dispatch
        return this.dispatchAmbulance(session);
      
      case '2':
        // Re-enter location
        session.state = 'request_ambulance_location';
        return {
          type: 'CON',
          message: 'CON Enter your location:',
          session
        };
      
      case '3':
        // Cancel
        this.sessions.delete(session.id);
        return {
          type: 'END',
          message: 'END Request cancelled.',
          session: null
        };
      
      default:
        return {
          type: 'CON',
          message: 'CON Invalid choice. Enter 1-3:',
          session
        };
    }
  }

  /**
   * Dispatch ambulance (final step)
   */
  dispatchAmbulance(session) {
    const incidentId = `INC-${Date.now()}`;
    
    // Store incident data for processing
    session.data.incidentId = incidentId;
    session.data.timestamp = new Date().toISOString();

    // Clean up session
    this.sessions.delete(session.id);

    return {
      type: 'END',
      message: `END Emergency Request Confirmed

Incident ID: ${incidentId}
Location: ${session.data.location}

Ambulance dispatched!
You will receive SMS updates.

For urgent help, call 108.`,
      session,
      action: 'dispatch_ambulance',
      data: session.data
    };
  }

  /**
   * Check Status Flow
   */
  checkStatusFlow(session) {
    session.state = 'check_status_input';
    
    return {
      type: 'CON',
      message: `CON Check Ambulance Status

1. Check Latest Request
2. Enter Incident ID
3. Back to Main Menu

Enter your choice:`,
      session
    };
  }

  /**
   * Handle status input
   */
  handleStatusInput(session, input) {
    switch (input) {
      case '1':
        // Check latest request for this phone number
        this.sessions.delete(session.id);
        return {
          type: 'END',
          message: `END Status: Ambulance En Route

ETA: 12 minutes
Driver: Rajesh Kumar
Contact: +91-9876543210
Vehicle: AMB-142

Track: http://ems.track/abc123`,
          session: null,
          action: 'check_status',
          data: { phoneNumber: session.phoneNumber }
        };
      
      case '2':
        session.state = 'check_status_enter_id';
        return {
          type: 'CON',
          message: 'CON Enter Incident ID:',
          session
        };
      
      case '3':
        return this.showMainMenu(session);
      
      default:
        return {
          type: 'CON',
          message: 'CON Invalid choice. Enter 1-3:',
          session
        };
    }
  }

  /**
   * List Hospitals Flow
   */
  listHospitalsFlow(session) {
    this.sessions.delete(session.id);
    
    return {
      type: 'END',
      message: `END Nearby Hospitals:

1. City General Hospital
   Distance: 2.5 km
   Phone: +91-9876543211

2. AIIMS Patna
   Distance: 5.8 km
   Phone: +91-9876543212

3. Patna Medical College
   Distance: 3.2 km
   Phone: +91-9876543213

For emergency, dial 108.`,
      session: null,
      action: 'list_hospitals',
      data: { phoneNumber: session.phoneNumber }
    };
  }

  /**
   * Show emergency contacts
   */
  showEmergencyContacts(session) {
    this.sessions.delete(session.id);
    
    return {
      type: 'END',
      message: `END Emergency Contacts:

Ambulance: 108
Police: 100
Fire: 101
Women Helpline: 1091
Disaster Mgmt: 108

National Emergency: 112

Stay safe!`,
      session: null
    };
  }

  /**
   * Show help
   */
  showHelp(session) {
    this.sessions.delete(session.id);
    
    return {
      type: 'END',
      message: `END How to Use *108#:

1. Dial *108#
2. Select "Request Ambulance"
3. Enter your location
4. Confirm request

You'll receive SMS updates.

For immediate help: Call 108

You can also SMS:
AMBULANCE <location>`,
      session: null
    };
  }

  /**
   * Clean expired sessions
   */
  cleanExpiredSessions() {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.startTime > this.sessionTimeout) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get session
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearSessions() {
    this.sessions.clear();
  }

  /**
   * Get active session count
   */
  getActiveSessionCount() {
    return this.sessions.size;
  }
}

module.exports = USSDHandler;
