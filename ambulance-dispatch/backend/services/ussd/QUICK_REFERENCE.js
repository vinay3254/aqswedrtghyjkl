/**
 * USSD Menu System - Quick Reference Guide
 * Fast lookup for common tasks and APIs
 */

// ============================================================================
// QUICK START
// ============================================================================

const USSDServer = require('./ussd-server');

// Start with default config
const server = new USSDServer();
await server.start();

// Or with custom config
const server = new USSDServer({
  port: 3001,
  redisUrl: 'redis://localhost:6379',
  sessionTimeout: 600,
});
await server.start();

// ============================================================================
// ENDPOINTS
// ============================================================================

/*
WEBHOOK ENDPOINTS (Incoming from USSD Provider)
-----------------------------------------------

POST /webhook/africas-talking
  - Africa's Talking USSD webhook
  - Body: { sessionId, phoneNumber, text, networkCode }

POST /webhook/twilio
  - Twilio USSD webhook
  - Body: { From, Body, ConversationSid }

POST /webhook/generic
  - Generic USSD endpoint
  - Body: { sessionId, phoneNumber, userInput }


ADMIN ENDPOINTS
---------------

GET /health
  - Health check endpoint
  - Returns: { status: 'ok', service: 'ussd-server' }

GET /sessions/:sessionId
  - Retrieve session data
  - Returns: Session object with context

DELETE /sessions/:sessionId
  - Clear session manually
  - Returns: { success: true, sessionId }

GET /stats
  - Get server statistics
  - Returns: { activeSessions, timestamp }
*/

// ============================================================================
// MENU NAVIGATION REFERENCE
// ============================================================================

const menuStructure = {
  main: {
    '1': 'Medical Emergency',
    '2': 'Accident Report',
    '3': 'Track Ambulance',
    '4': 'Cancel',
  },
  'emergency-type': {
    '1': 'Chest Pain',
    '2': 'Difficulty Breathing',
    '3': 'Unconscious/Collapsed',
    '4': 'Severe Bleeding',
    '5': 'Back to Main',
  },
  confirm: {
    '1': 'Yes, Dispatch Ambulance',
    '2': 'Back',
  },
  track: {
    '1': 'Get ETA',
    '2': 'Back to Main',
  },
};

// ============================================================================
// SESSION STRUCTURE
// ============================================================================

const sessionExample = {
  sessionId: 'uuid-1234-5678',
  phoneNumber: '+254712345678',
  networkCode: '63902',
  currentMenu: 'main', // Current menu state
  context: {
    // Custom context data
    emergencyType: 'medical',
    medicalCondition: 'chest-pain',
    location: {
      latitude: -1.2845,
      longitude: 36.8172,
      accuracy: 500,
      area: 'Nairobi, Kenya',
      method: 'cell-tower', // 'cell-tower', 'gps', 'network-operator'
    },
    locationSource: 'cell-tower',
    incidentId: 'INC-2024-001234',
  },
  attempts: 2,
  createdAt: '2024-01-15T10:30:00Z',
  lastActivity: '2024-01-15T10:31:00Z',
  isComplete: false,
};

// ============================================================================
// API EXAMPLES
// ============================================================================

// === CURL EXAMPLES ===

/*
1. Test Main Menu
-----------------
curl -X POST http://localhost:3001/webhook/africas-talking \
  -d "sessionId=test-123" \
  -d "phoneNumber=%2B254712345678" \
  -d "text=" \
  -d "networkCode=63902"


2. Test Medical Emergency Selection
-----------------------------------
curl -X POST http://localhost:3001/webhook/africas-talking \
  -d "sessionId=test-123" \
  -d "phoneNumber=%2B254712345678" \
  -d "text=1" \
  -d "networkCode=63902"


3. Test Dispatch
----------------
curl -X POST http://localhost:3001/webhook/africas-talking \
  -d "sessionId=test-123" \
  -d "phoneNumber=%2B254712345678" \
  -d "text=1" \
  -d "networkCode=63902"


4. Get Session Info
-------------------
curl http://localhost:3001/sessions/test-123


5. Clear Session
----------------
curl -X DELETE http://localhost:3001/sessions/test-123


6. Get Server Stats
-------------------
curl http://localhost:3001/stats
*/

// ============================================================================
// JAVASCRIPT/NODE.JS EXAMPLES
// ============================================================================

// === Import and Initialize Services ===

const MenuFlow = require('./menu-flow');
const LocationResolver = require('./location-resolver');
const SMSFallback = require('./sms-fallback');

const menu = new MenuFlow();
const location = new LocationResolver();
const sms = new SMSFallback();

// === Menu Flow Examples ===

// Get menu with options
const menuResponse = menu.getMenuResponse('main');
console.log(menuResponse.message);
console.log(menuResponse.options);

// Validate user input
const validation = menu.validateInput('main', '1');
console.log(validation); // { valid: true }

// Get next menu based on current state
const nextMenu = menu.getNextMenu('main', '1', {});
console.log(nextMenu); // 'emergency-type'

// === Location Resolver Examples ===

// Resolve location from cell tower
const location = await locationResolver.resolveCellTowerLocation('63902', '12345');
console.log(location);
// {
//   latitude: -1.2845,
//   longitude: 36.8172,
//   accuracy: 500,
//   method: 'cell-tower',
//   area: 'Nairobi, Kenya',
//   timestamp: '2024-01-15T10:30:00Z'
// }

// Resolve from GPS
const gpsLocation = await locationResolver.resolveGPSLocation(-1.2845, 36.8172);

// Get location quality
const quality = locationResolver.getLocationQuality(location);
console.log(quality);
// {
//   quality: 85,
//   method: 'cell-tower',
//   accuracy: 500,
//   recommendation: 'Use for dispatch'
// }

// === SMS Fallback Examples ===

// Analyze message intent
const intent = sms.analyzeMessageIntent('I have chest pain and difficulty breathing');
console.log(intent);
// {
//   type: 'medical',
//   confidence: 0.95,
//   conditions: ['chest', 'breathing'],
//   matchedKeywords: ['chest', 'pain', 'breathing']
// }

// Handle incoming SMS
const smsResult = await sms.handleIncomingSMS('+254712345678', 'Accident on main road');
console.log(smsResult);
// {
//   smsId: 'sms-uuid',
//   sessionKey: 'sms:+254712345678',
//   intent: { type: 'accident', confidence: 0.92 },
//   dispatch: { shouldDispatch: true, incidentId: 'INC-...' }
// }

// ============================================================================
// COMMON WORKFLOWS
// ============================================================================

/*
WORKFLOW 1: Medical Emergency (Start to Dispatch)
-------------------------------------------------
User dials USSD code
  ↓
Server creates session with cell tower location
  ↓
Display main menu
  ↓
User selects "1" (Medical Emergency)
  ↓
Display medical type menu
  ↓
User selects "1" (Chest Pain)
  ↓
Display confirmation with location
  ↓
User selects "1" (Confirm)
  ↓
Dispatch incident created
  ↓
Ambulance routed
  ↓
SMS confirmation sent to user


WORKFLOW 2: USSD Timeout → SMS Fallback
-----------------------------------------
User dials USSD code
  ↓
USSD timeout (30s, no response)
  ↓
Retry attempt 1 → timeout
  ↓
Retry attempt 2 → timeout
  ↓
Trigger SMS fallback
  ↓
Send SMS: "Reply with emergency type (MEDICAL/ACCIDENT)"
  ↓
User replies: "Car accident on main road"
  ↓
Server analyzes intent (confidence: 0.92)
  ↓
Auto-dispatch (confidence ≥ 0.8)
  ↓
Send confirmation SMS with incident ID


WORKFLOW 3: Track Ambulance
--------------------------
User dials USSD code
  ↓
Server retrieves active dispatch
  ↓
Display main menu
  ↓
User selects "3" (Track Ambulance)
  ↓
User selects "1" (Get ETA)
  ↓
Query dispatch service for ambulance location
  ↓
Display ETA and ambulance details
  ↓
Session completes
*/

// ============================================================================
// TROUBLESHOOTING QUICK LINKS
// ============================================================================

const troubleshooting = {
  'USSD Timeout': {
    problem: 'User sees timeout after 30s',
    solution: [
      '1. Check network connectivity',
      '2. Verify USSD provider status',
      '3. Check server logs for errors',
      '4. System auto-triggers SMS fallback',
    ],
  },

  'Location Failed': {
    problem: 'Location shows unknown/null',
    solution: [
      '1. Verify cell tower API credentials',
      '2. Check network code (MCC/MNC) validity',
      '3. Ensure location cache is cleared',
      '4. Check reverse geocoding provider keys',
      '5. Request manual location from user',
    ],
  },

  'SMS Not Sent': {
    problem: 'User does not receive SMS',
    solution: [
      '1. Verify SMS gateway credentials',
      '2. Check phone number format (with country code)',
      '3. Review SMS provider logs',
      '4. Ensure SMS fallback is enabled',
      '5. Check rate limiting per phone number',
    ],
  },

  'Session Expired': {
    problem: 'Session not found error',
    solution: [
      '1. Session TTL is 10 minutes by default',
      '2. User must start new USSD session',
      '3. Data preserved in incident records',
      '4. Check Redis for active sessions',
    ],
  },

  'High Error Rate': {
    problem: 'Many requests failing',
    solution: [
      '1. Check Redis connection',
      '2. Verify all API keys are set',
      '3. Review rate limiting configuration',
      '4. Check server logs for details',
      '5. Monitor network provider status',
    ],
  },
};

// ============================================================================
// ENVIRONMENT VARIABLES CHECKLIST
// ============================================================================

const requiredEnvVars = [
  'REDIS_URL',
  'AFRICAS_TALKING_API_KEY',
  'AFRICAS_TALKING_USERNAME',
  'GOOGLE_MAPS_API_KEY',
  'OPENCAGE_API_KEY',
  'CELL_TOWER_API_KEY',
  'SMS_GATEWAY_KEY',
  'DISPATCH_SERVICE_URL',
];

// ============================================================================
// MONITORING COMMANDS
// ============================================================================

/*
1. Check active USSD sessions
curl http://localhost:3001/stats

2. Get specific session
curl http://localhost:3001/sessions/{sessionId}

3. Monitor server health
curl http://localhost:3001/health

4. Check server logs
docker logs ussd-server

5. Monitor Redis
redis-cli
  > KEYS ussd:*
  > GET ussd:session-uuid
  > DBSIZE

6. Check SMS fallback sessions
redis-cli
  > KEYS sms:*
  > DBSIZE
*/

// ============================================================================
// RESPONSE FORMATS
// ============================================================================

const responseFormats = {
  africasTalking: {
    ongoing: 'CON Menu text here\n\n1. Option 1\n2. Option 2',
    final: 'END Session completed text here',
  },

  twilio: {
    format: {
      statusCode: 200,
      body: {
        message: 'Menu text here\n\n1. Option 1\n2. Option 2',
      },
    },
  },

  apiResponse: {
    success: {
      message: 'Menu text',
      sessionId: 'uuid',
      provider: 'africas-talking',
      timestamp: '2024-01-15T10:30:00Z',
    },

    error: {
      error: 'Error message',
      code: 'ERROR_CODE',
      sessionId: 'uuid',
      timestamp: '2024-01-15T10:30:00Z',
    },
  },
};

// ============================================================================
// PERFORMANCE TIPS
// ============================================================================

const performanceTips = {
  reduceLocationAPIcalls: 'Cache location results (TTL: 1 hour)',
  minimizeUSSDexchanges: 'Pre-select menu options based on context',
  optimizeSMSfallback: 'Use simple keywords for intent detection',
  parallelizeAPIs: 'Call location & dispatch APIs simultaneously',
  useConnectionPooling: 'Redis: 50 max connections',
  batchProcessing: 'Batch 100 incidents every 5 seconds',
};

// ============================================================================
// DEPLOYMENT CHECKLIST
// ============================================================================

const deploymentChecklist = [
  '☐ All environment variables set',
  '☐ Redis running and accessible',
  '☐ API keys validated',
  '☐ TLS enabled for production',
  '☐ Rate limiting configured',
  '☐ Audit logging enabled',
  '☐ Monitoring & alerts set up',
  '☐ Backup USSD provider configured',
  '☐ SMS fallback tested',
  '☐ Location APIs tested',
  '☐ Load testing completed (100+ sessions)',
  '☐ Disaster recovery plan',
  '☐ Documentation updated',
];

module.exports = {
  menuStructure,
  sessionExample,
  troubleshooting,
  requiredEnvVars,
  responseFormats,
  performanceTips,
  deploymentChecklist,
};
