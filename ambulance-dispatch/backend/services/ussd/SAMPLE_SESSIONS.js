/**
 * USSD Menu System - Sample Session Flows & Documentation
 * This file demonstrates real-world USSD session flows for the ambulance dispatch system
 */

/**
 * ============================================================================
 * SCENARIO 1: Medical Emergency - Chest Pain (Successful Dispatch)
 * ============================================================================
 * 
 * A patient in a rural area with unstable network calls USSD short code
 * with GPS unavailable, relying on cell tower location detection
 */
const scenario1_medicalEmergency = {
  title: 'Medical Emergency - Chest Pain (Auto-location)',
  timestamp: '2024-01-15T10:30:00Z',
  phoneNumber: '+254712345678',
  networkCode: '63902', // Safaricom Kenya
  sessionId: 'ussd-session-uuid-001',

  // Message flow exchange
  exchanges: [
    {
      step: 1,
      direction: 'incoming',
      userInput: '', // User dials USSD code
      serverResponse: {
        type: 'menu',
        message: 'Welcome to Emergency Services\n\nSelect service:',
        options: {
          '1': 'Medical Emergency',
          '2': 'Accident Report',
          '3': 'Track Ambulance',
          '4': 'Cancel',
        },
        sessionData: {
          currentMenu: 'main',
          context: {
            location: {
              latitude: -1.2845,
              longitude: 36.8172,
              accuracy: 500,
              area: 'Nairobi, Kenya',
              method: 'cell-tower',
              locationSource: 'cell-tower',
            },
            locationSource: 'cell-tower',
          },
        },
      },
    },
    {
      step: 2,
      direction: 'incoming',
      userInput: '1', // User selects Medical Emergency
      serverResponse: {
        type: 'menu',
        message: 'Select medical emergency type:',
        options: {
          '1': 'Chest Pain',
          '2': 'Difficulty Breathing',
          '3': 'Unconscious/Collapsed',
          '4': 'Severe Bleeding',
          '5': 'Back to Main Menu',
        },
        sessionData: {
          currentMenu: 'emergency-type',
          context: {
            emergencyType: 'medical',
            locationSource: 'cell-tower',
          },
        },
      },
    },
    {
      step: 3,
      direction: 'incoming',
      userInput: '1', // User selects Chest Pain
      serverResponse: {
        type: 'confirmation',
        message:
          'Confirm dispatch:\nEmergency Type: Medical\nCondition: Chest Pain\nLocation: Nairobi, Kenya\n\nProceed?',
        options: {
          '1': 'Yes, Dispatch Ambulance',
          '2': 'Back',
        },
        sessionData: {
          currentMenu: 'confirm',
          context: {
            emergencyType: 'medical',
            medicalCondition: 'chest-pain',
            location: {
              latitude: -1.2845,
              longitude: 36.8172,
              accuracy: 500,
              area: 'Nairobi, Kenya',
              method: 'cell-tower',
            },
            locationSource: 'cell-tower',
          },
        },
      },
    },
    {
      step: 4,
      direction: 'incoming',
      userInput: '1', // User confirms dispatch
      serverResponse: {
        type: 'info',
        message:
          'Ambulance Dispatched!\n\nIncident ID: INC-2024-001234\nAmbulance en route to your location.\n\nPress 1 to track ambulance\nPress 2 to return home',
        options: {
          '1': 'Track Ambulance',
          '2': 'Return Home',
        },
        sessionData: {
          currentMenu: 'dispatched',
          isComplete: true,
          context: {
            incidentId: 'INC-2024-001234',
            emergencyType: 'medical',
            medicalCondition: 'chest-pain',
            location: {
              latitude: -1.2845,
              longitude: 36.8172,
              accuracy: 500,
              area: 'Nairobi, Kenya',
              method: 'cell-tower',
            },
            locationSource: 'cell-tower',
          },
        },
      },
    },
  ],

  // Dispatch incident created
  dispatchIncident: {
    incidentId: 'INC-2024-001234',
    phoneNumber: '+254712345678',
    emergencyType: 'medical',
    medicalCondition: 'chest-pain',
    location: {
      latitude: -1.2845,
      longitude: 36.8172,
      accuracy: 500,
      area: 'Nairobi, Kenya',
      method: 'cell-tower',
      locationSource: 'cell-tower',
    },
    channel: 'ussd',
    timestamp: '2024-01-15T10:31:45Z',
    status: 'dispatched',
  },

  // Notes
  notes: `
    - Cell tower location was successfully resolved (±500m accuracy)
    - Session completed in 4 USSD exchanges
    - Ambulance dispatched within ~90 seconds
    - SMS confirmation sent to patient
  `,
};

/**
 * ============================================================================
 * SCENARIO 2: Accident Report (Low Confidence - Requires Confirmation)
 * ============================================================================
 * 
 * SMS fallback when USSD is experiencing high latency or packet loss
 * Patient sends natural language SMS, system extracts intent
 */
const scenario2_accidentFallback = {
  title: 'Accident Report via SMS Fallback',
  timestamp: '2024-01-15T11:15:00Z',
  phoneNumber: '+254722456789',
  channel: 'sms-fallback',
  reason: 'USSD timeout after 2 retries',

  // Initial SMS from patient
  incomingSMS: {
    messageId: 'sms-msg-001',
    phoneNumber: '+254722456789',
    text: 'Car accident on ngong road near the market there are injuries',
    timestamp: '2024-01-15T11:15:30Z',
  },

  // Intent analysis
  intentAnalysis: {
    type: 'accident',
    confidence: 0.92,
    matchedKeywords: ['accident', 'car', 'injuries'],
    conditions: ['accident'],
    reasoning: {
      keywordMatches: 2,
      contextClues: ['injuries'],
      confidenceBoost: 0.22,
    },
  },

  // SMS response (high confidence - auto-dispatch)
  autoDispatchResponse: {
    decision: 'dispatch',
    reason: 'Confidence >= 0.8',
    incidentId: 'INC-2024-001235',
    message:
      'Ambulance dispatched! Incident ID: INC-2024-001235. Help is on the way.',
  },

  // Dispatch incident created
  dispatchIncident: {
    incidentId: 'INC-2024-001235',
    phoneNumber: '+254722456789',
    emergencyType: 'accident',
    location: {
      area: 'Ngong Road, Nairobi',
      source: 'manual-extraction',
      extracted: true,
    },
    channel: 'sms-fallback',
    messageText: 'Car accident on ngong road near the market there are injuries',
    confidence: 0.92,
    timestamp: '2024-01-15T11:15:45Z',
    status: 'dispatched',
  },

  notes: `
    - SMS fallback triggered due to USSD timeout
    - Natural language processing extracted incident location from message
    - High confidence (92%) triggered automatic dispatch
    - No user confirmation needed
    - Follow-up SMS sent to patient
  `,
};

/**
 * ============================================================================
 * SCENARIO 3: Track Ambulance (Active Dispatch)
 * ============================================================================
 * 
 * Patient tracking an ambulance that was previously dispatched
 */
const scenario3_trackAmbulance = {
  title: 'Ambulance Tracking Service',
  timestamp: '2024-01-15T10:45:00Z',
  phoneNumber: '+254712345678', // Same patient as Scenario 1
  sessionId: 'ussd-session-uuid-003',
  previousIncidentId: 'INC-2024-001234',

  exchanges: [
    {
      step: 1,
      direction: 'incoming',
      userInput: '',
      serverResponse: {
        type: 'menu',
        message: 'Welcome to Emergency Services\n\nSelect service:',
        options: {
          '1': 'Medical Emergency',
          '2': 'Accident Report',
          '3': 'Track Ambulance',
          '4': 'Cancel',
        },
      },
    },
    {
      step: 2,
      direction: 'incoming',
      userInput: '3',
      serverResponse: {
        type: 'menu',
        message: 'Track Ambulance Status\n\nPress 1 to get ambulance ETA\nPress 2 to go back',
        options: {
          '1': 'Get ETA',
          '2': 'Back to Main Menu',
        },
      },
    },
    {
      step: 3,
      direction: 'incoming',
      userInput: '1',
      serverResponse: {
        type: 'end',
        message: 'Ambulance En Route\n\nPlate: KBA 123Z\nETA: 8 minutes\n\nPress any key to continue',
        options: {},
        trackingData: {
          ambulancePlate: 'KBA 123Z',
          eta: 8,
          driver: 'John Kamau',
          latitude: -1.2820,
          longitude: 36.8145,
          status: 'en-route',
          lastUpdate: '2024-01-15T10:44:30Z',
        },
      },
    },
  ],

  notes: `
    - Patient successfully tracked ambulance
    - ETA accurate within 2 minutes based on GPS tracking
    - Real-time ambulance position sent via USSD
    - Session completed in 3 exchanges
  `,
};

/**
 * ============================================================================
 * SCENARIO 4: USSD Timeout with SMS Fallback
 * ============================================================================
 * 
 * USSD gateway experiences packet loss and times out multiple times
 * System automatically switches to SMS fallback
 */
const scenario4_ussdTimeout = {
  title: 'USSD Timeout -> SMS Fallback',
  timestamp: '2024-01-15T12:00:00Z',
  phoneNumber: '+254733567890',
  networkCode: '63907', // Airtel Kenya
  initialSessionId: 'ussd-session-uuid-004',
  reason: 'High latency rural area with poor connectivity',

  // Timeout sequence
  timeoutSequence: [
    {
      attempt: 1,
      action: 'User initiates USSD',
      status: 'timeout',
      waitTime: 30000,
    },
    {
      attempt: 2,
      action: 'System retries',
      status: 'timeout',
      waitTime: 30000,
    },
    {
      attempt: 3,
      action: 'System triggers SMS fallback',
      status: 'fallback_activated',
      action_taken: 'Send fallback SMS to user',
    },
  ],

  // SMS fallback initiated
  fallbackSMS: {
    messageId: 'sms-fb-001',
    phoneNumber: '+254733567890',
    text:
      'Emergency Services: USSD unavailable. Reply YES to request ambulance or call 911.',
    timestamp: '2024-01-15T12:01:15Z',
  },

  // User responds via SMS
  userResponse: {
    messageId: 'sms-resp-001',
    phoneNumber: '+254733567890',
    text: 'YES medical emergency',
    timestamp: '2024-01-15T12:01:45Z',
  },

  // Intent processing
  intentProcessing: {
    text: 'YES medical emergency',
    intent: {
      type: 'medical',
      confidence: 0.85,
      matchedKeywords: ['medical', 'emergency'],
    },
    decision: 'dispatch',
    requiresConfirmation: false,
  },

  // Final dispatch
  dispatchIncident: {
    incidentId: 'INC-2024-001236',
    phoneNumber: '+254733567890',
    emergencyType: 'medical',
    channel: 'sms-fallback',
    fallbackReason: 'ussd-timeout',
    timestamp: '2024-01-15T12:02:00Z',
    status: 'dispatched',
  },

  notes: `
    - USSD failed after 2 timeout attempts (system default: 3)
    - SMS fallback automatically triggered
    - Patient able to request ambulance via SMS
    - Total time from first attempt to dispatch: 2.5 minutes
    - Patient location resolved from cell tower data
  `,
};

/**
 * ============================================================================
 * SCENARIO 5: User Navigation - Back Button (Medical -> Main)
 * ============================================================================
 * 
 * User navigates back through menu structure
 */
const scenario5_backNavigation = {
  title: 'Menu Navigation - Back Button',
  timestamp: '2024-01-15T13:00:00Z',
  phoneNumber: '+254745678901',
  sessionId: 'ussd-session-uuid-005',

  exchanges: [
    {
      step: 1,
      userInput: '',
      currentMenu: 'main',
    },
    {
      step: 2,
      userInput: '1', // Medical Emergency
      currentMenu: 'emergency-type',
    },
    {
      step: 3,
      userInput: '5', // Back to Main Menu
      currentMenu: 'main',
    },
    {
      step: 4,
      userInput: '4', // Cancel
      currentMenu: 'cancelled',
      isComplete: true,
    },
  ],

  notes: `
    - User changed mind about medical emergency
    - Successfully navigated back to main menu
    - Then cancelled session
    - No incident created
  `,
};

/**
 * ============================================================================
 * SESSION DATA STRUCTURES
 * ============================================================================
 */

const redisSessionExample = {
  sessionId: 'ussd-session-uuid-001',
  phoneNumber: '+254712345678',
  networkCode: '63902',
  currentMenu: 'dispatched',
  context: {
    emergencyType: 'medical',
    medicalCondition: 'chest-pain',
    incidentId: 'INC-2024-001234',
    location: {
      latitude: -1.2845,
      longitude: 36.8172,
      accuracy: 500,
      area: 'Nairobi, Kenya',
      method: 'cell-tower',
      locationSource: 'cell-tower',
    },
    locationSource: 'cell-tower',
  },
  attempts: 4,
  createdAt: '2024-01-15T10:30:00Z',
  lastActivity: '2024-01-15T10:31:45Z',
  isComplete: true,
  status: 'dispatched',
};

/**
 * ============================================================================
 * API INTEGRATION EXAMPLES
 * ============================================================================
 */

const apiIntegrationExamples = {
  // Africa's Talking USSD Webhook Request
  africasTalkingRequest: {
    httpMethod: 'POST',
    endpoint: '/webhook/africas-talking',
    body: {
      sessionId: 'ATUId_1234567890abcdef',
      phoneNumber: '+254712345678',
      text: '1',
      networkCode: '63902',
    },
  },

  // Africa's Talking USSD Webhook Response
  africasTalkingResponse: 'CON Welcome to Emergency Services\n\nSelect service:\n\n1. Medical Emergency\n2. Accident Report\n3. Track Ambulance\n4. Cancel',

  // Twilio USSD Webhook Request
  twilioRequest: {
    httpMethod: 'POST',
    endpoint: '/webhook/twilio',
    body: {
      From: '+254712345678',
      Body: '1',
      ConversationSid: 'conv-uuid-123',
    },
  },

  // Twilio Response
  twilioResponse: {
    statusCode: 200,
    body: {
      message: 'Welcome to Emergency Services\n\nSelect service:\n\n1. Medical Emergency\n2. Accident Report\n3. Track Ambulance\n4. Cancel',
    },
  },
};

/**
 * ============================================================================
 * TESTING CHECKLIST
 * ============================================================================
 */

const testingChecklist = {
  ussdFlowTests: [
    '✓ Medical Emergency -> Chest Pain -> Confirm -> Dispatch',
    '✓ Accident Report -> Confirm -> Dispatch',
    '✓ Track Ambulance -> Get ETA',
    '✓ Cancel Request',
    '✓ Back Navigation',
    '✓ Invalid Input Handling',
    '✓ Session Timeout',
    '✓ Max Retries Exceeded',
  ],

  locationResolutionTests: [
    '✓ Cell Tower Location (MCC/MNC)',
    '✓ GPS Coordinates',
    '✓ Network Operator Fallback',
    '✓ Reverse Geocoding',
    '✓ Location Caching',
  ],

  smsFallbackTests: [
    '✓ SMS Intent Detection - Medical',
    '✓ SMS Intent Detection - Accident',
    '✓ High Confidence Auto-Dispatch',
    '✓ Low Confidence Confirmation',
    '✓ SMS Session Management',
    '✓ Confirmation Response Handling',
  ],

  resilliencyTests: [
    '✓ USSD Timeout -> SMS Fallback',
    '✓ Redis Unavailability',
    '✓ Location API Failure',
    '✓ GPS API Timeout',
    '✓ Max Retries Exceeded',
  ],

  performanceTests: [
    '✓ Session Response Time (<3s)',
    '✓ Location Resolution (<2s)',
    '✓ Dispatch Time (<5s)',
    '✓ Concurrent Session Handling (100+)',
  ],
};

/**
 * ============================================================================
 * DEPLOYMENT CONFIGURATION
 * ============================================================================
 */

const deploymentConfig = {
  environment: 'production',
  ussdServerConfig: {
    port: 3001,
    redisUrl: 'redis://localhost:6379',
    sessionTimeout: 600, // 10 minutes
    maxRetries: 3,
  },
  providers: {
    africasTalking: {
      enabled: true,
      apiKey: process.env.AFRICAS_TALKING_API_KEY,
      username: process.env.AFRICAS_TALKING_USERNAME,
      endpoint: 'https://api.sandbox.africastalking.com',
    },
    locationResolver: {
      cellTowerApi: 'https://api.cellinfo.io',
      googleMapsApi: 'https://maps.googleapis.com/maps/api',
      openCageApi: 'https://api.opencagedata.com',
    },
  },
};

module.exports = {
  scenario1_medicalEmergency,
  scenario2_accidentFallback,
  scenario3_trackAmbulance,
  scenario4_ussdTimeout,
  scenario5_backNavigation,
  redisSessionExample,
  apiIntegrationExamples,
  testingChecklist,
  deploymentConfig,
};
