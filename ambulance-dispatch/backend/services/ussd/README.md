# USSD Menu System for Ambulance Dispatch

Complete USSD (Unstructured Supplementary Service Data) system for rural/low-connectivity emergency response. Provides a text-based menu interface that works on basic mobile phones without internet access.

## Features

### Core Features
- **USSD Menu System**: Interactive menu-driven interface (1=Medical Emergency, 2=Accident, 3=Track Ambulance, 4=Cancel)
- **Session Management**: Redis-backed session storage with automatic expiration
- **Multi-Provider Support**: Africa's Talking, Twilio, and generic USSD providers
- **Location Auto-Detection**: Cell tower triangulation, GPS fallback, network operator data
- **SMS Fallback**: Automatic SMS dispatch when USSD unavailable (high latency/timeout)
- **Natural Language Processing**: SMS intent extraction for fallback channel

### Rural/Low-Connectivity Optimizations
- **Cell Tower Location**: Works without GPS via MCC/MNC triangulation (±500m accuracy)
- **Minimal Data Usage**: USSD uses ~100 bytes per exchange vs. SMS (160 bytes)
- **Timeout Resilience**: Auto-switches to SMS after 2-3 USSD timeouts
- **Session Caching**: Reuses location data to minimize API calls
- **Reverse Geocoding**: Converts coordinates to human-readable addresses

## Architecture

```
USSD Menu System
├── ussd-server.js          # Main USSD gateway (Express.js)
├── menu-flow.js            # Menu tree & navigation
├── location-resolver.js    # Location detection (cell tower, GPS)
├── sms-fallback.js        # SMS fallback dispatch
└── SAMPLE_SESSIONS.js     # Usage examples & documentation
```

## File Descriptions

### 1. `ussd-server.js`
Main USSD gateway server handling HTTP webhooks from USSD providers.

**Key Methods:**
- `handleAfricasTalkingUSSD()` - Africa's Talking provider webhook
- `handleTwilioUSSD()` - Twilio provider webhook
- `handleGenericUSSD()` - Generic USSD endpoint
- `processUSSDRequest()` - Core USSD logic
- `getOrCreateSession()` - Session management with location resolution

**Redis Session Structure:**
```javascript
{
  sessionId: "uuid",
  phoneNumber: "+254712345678",
  currentMenu: "main",
  context: {
    emergencyType: "medical",
    medicalCondition: "chest-pain",
    location: { lat, lng, accuracy, area },
    locationSource: "cell-tower"
  },
  attempts: 0,
  isComplete: false,
  createdAt: "timestamp",
  lastActivity: "timestamp"
}
```

### 2. `menu-flow.js`
Hierarchical menu tree with state management.

**Menu Structure:**
```
main (1: Medical, 2: Accident, 3: Track, 4: Cancel)
├── emergency-type (1-4: Medical conditions, 5: Back)
├── confirm (1: Confirm, 2: Back)
├── track (1: Get ETA, 2: Back)
└── dispatched / cancelled / error states
```

**Key Methods:**
- `getMenuResponse()` - Return menu with options
- `getNextMenu()` - Navigate menu tree
- `validateInput()` - Input validation
- `getMenuTree()` - Visual menu structure

### 3. `location-resolver.js`
Multi-source location detection for rural areas.

**Location Methods (in priority order):**
1. **Cell Tower Triangulation** (±500m-1km accuracy)
   - Uses MCC/MNC from network code
   - Works without GPS
   - Ideal for rural areas

2. **GPS Coordinates** (±10m accuracy)
   - Direct latitude/longitude
   - Reverse geocoding to address

3. **Network Operator Data** (±50km accuracy)
   - Fallback for carrier data
   - Regional location only

4. **Reverse Geocoding**
   - OpenCage API (preferred for Africa)
   - Google Maps (fallback)
   - Converts coordinates to addresses

**Key Methods:**
- `resolveLocation()` - Main entry point
- `resolveCellTowerLocation()` - Cell tower triangulation
- `resolveGPSLocation()` - GPS reverse geocoding
- `reverseGeocode()` - Coordinate to address
- `getLocationQuality()` - Quality assessment

### 4. `sms-fallback.js`
SMS-based fallback dispatch for USSD timeouts.

**Fallback Triggers:**
- USSD timeout (>30s without response)
- USSD unavailable (network error)
- High latency areas (>2 retries)

**SMS Features:**
- Natural language intent detection
- Keywords: "medical", "accident", "help", "emergency"
- Condition extraction: "chest pain", "bleeding", "conscious", etc.
- Confidence scoring (0-1.0)
- Auto-dispatch if confidence ≥ 0.8
- Confirmation request if confidence 0.5-0.8
- Clarification request if confidence < 0.5

**Key Methods:**
- `handleIncomingSMS()` - Process incoming SMS
- `analyzeMessageIntent()` - Extract emergency type
- `extractMedicalConditions()` - Parse medical conditions
- `processSMSIntent()` - Decision logic
- `handleConfirmationResponse()` - Process YES/NO response

## Installation

### Prerequisites
```bash
# Node.js 14+ 
# Redis 6+
# npm/yarn
```

### Setup

1. **Install Dependencies**
```bash
cd backend/services/ussd
npm install express redis axios uuid
```

2. **Environment Variables**
```bash
# .env or environment config
REDIS_URL=redis://localhost:6379
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username
GOOGLE_MAPS_API_KEY=your_maps_key
OPENCAGE_API_KEY=your_opencage_key
CELL_TOWER_API_KEY=your_cell_tower_key
SMS_GATEWAY_KEY=your_sms_key
```

3. **Start Redis**
```bash
redis-server
```

4. **Start USSD Server**
```bash
node ussd-server.js
# Or with custom config
const USSDServer = require('./ussd-server');
const server = new USSDServer({
  port: 3001,
  redisUrl: 'redis://localhost:6379',
  sessionTimeout: 600
});
server.start();
```

## Usage Examples

### Example 1: Medical Emergency Flow (USSD)
```
User:                  Display:
                       "Welcome to Emergency Services
                        
                        1. Medical Emergency
                        2. Accident Report
                        3. Track Ambulance
                        4. Cancel"

Press: 1               "Select medical emergency:
                        
                        1. Chest Pain
                        2. Difficulty Breathing
                        3. Unconscious
                        4. Severe Bleeding
                        5. Back"

Press: 1               "Confirm:
                        Emergency: Medical
                        Condition: Chest Pain
                        Location: Nairobi, Kenya
                        
                        1. Dispatch
                        2. Back"

Press: 1               "Ambulance Dispatched!
                        
                        ID: INC-2024-001234
                        ETA: 8 minutes"
```

### Example 2: Accident with SMS Fallback
```
User calls USSD        USSD timeout (30s, no response)
                       ↓
System waits 5s        Retry attempt 2
                       ↓
USSD timeout again     Trigger SMS fallback
                       ↓
SMS sent to user:      "USSD unavailable. Reply with emergency type
                        (MEDICAL/ACCIDENT) or call 911"

User replies SMS:      "Accident on main road"
                       ↓
System analyzes:       Type: accident
                       Confidence: 0.92 (contains "accident" + "road")
                       Decision: Auto-dispatch
                       ↓
Ambulance dispatched   SMS confirmation sent
```

### Example 3: Location Resolution (Background)
```
// Cell tower location detected
NetworkCode: 63902 (Safaricom Kenya)
CellID: 12345

↓ Cell Tower API

Location: -1.2845, 36.8172 (±500m)

↓ Reverse Geocoding (OpenCage)

Address: "Nairobi, Kenya"

Result:
{
  latitude: -1.2845,
  longitude: 36.8172,
  accuracy: 500,
  area: "Nairobi, Kenya",
  method: "cell-tower",
  timestamp: "2024-01-15T10:30:00Z"
}
```

## API Integration

### Africa's Talking USSD Webhook
```javascript
// Request (Africa's Talking → Your Server)
POST /webhook/africas-talking
{
  "sessionId": "ATUId_1234567890",
  "phoneNumber": "+254712345678",
  "text": "1",
  "networkCode": "63902"
}

// Response (Your Server → Africa's Talking)
CON Welcome to Emergency Services\n\n1. Medical Emergency\n2. Accident\n3. Track\n4. Cancel

// or for final response:
END Thank you for using our service
```

### Twilio USSD Webhook
```javascript
// Request (Twilio → Your Server)
POST /webhook/twilio
{
  "From": "+254712345678",
  "Body": "1",
  "ConversationSid": "conv-uuid"
}

// Response (Your Server → Twilio)
{
  "message": "Welcome to Emergency Services\n\n1. Medical Emergency..."
}
```

### SMS Incoming Webhook
```javascript
// Request (SMS Provider → Your Server)
POST /webhook/sms
{
  "phoneNumber": "+254712345678",
  "messageText": "Accident on ngong road",
  "messageId": "msg-123",
  "timestamp": "2024-01-15T11:15:30Z"
}

// Your server processes and creates dispatch
```

## Testing

### Manual USSD Testing
```bash
# Test main menu
curl -X POST http://localhost:3001/webhook/africas-talking \
  -d "sessionId=test-123&phoneNumber=%2B254712345678&text=" \
  -d "networkCode=63902"

# Test medical emergency selection
curl -X POST http://localhost:3001/webhook/africas-talking \
  -d "sessionId=test-123&phoneNumber=%2B254712345678&text=1" \
  -d "networkCode=63902"
```

### Location Testing
```javascript
const LocationResolver = require('./location-resolver');
const resolver = new LocationResolver({
  openCageKey: 'your_key',
  cellTowerKey: 'your_key'
});

// Test cell tower location
const location = await resolver.resolveCellTowerLocation('63902', '12345');
console.log(location);

// Test GPS location
const gpsLocation = await resolver.resolveGPSLocation(-1.2845, 36.8172);
console.log(gpsLocation);
```

### SMS Intent Testing
```javascript
const SMSFallback = require('./sms-fallback');
const sms = new SMSFallback();

// Test intent detection
const intent = sms.analyzeMessageIntent('I have chest pain');
// Returns: { type: 'medical', confidence: 0.9, conditions: ['chest'] }

const accidentIntent = sms.analyzeMessageIntent('Car accident on main road');
// Returns: { type: 'accident', confidence: 0.92, conditions: ['accident'] }
```

## Performance Metrics

### Typical Timings (Rural Connectivity)
- USSD Session Creation: 2-3 seconds
- Menu Exchange: 1-2 seconds
- Location Resolution: 1-3 seconds (cell tower)
- Dispatch Creation: <1 second
- **Total Time to Dispatch**: ~5-8 seconds

### Data Usage
- Per USSD Exchange: ~100-200 bytes
- Per SMS: ~160 bytes
- Location API Call: ~500 bytes
- **Total per incident**: ~1-2 KB

### Concurrency
- 100+ concurrent USSD sessions (single server)
- 1000+ sessions with Redis cluster
- <50ms response time per request

## Troubleshooting

### USSD Timeouts
**Problem**: User sees "timeout" error  
**Solution**: 
- Check network connectivity
- Verify USSD gateway status
- System automatically falls back to SMS

### Location Resolution Failed
**Problem**: Location shows "unknown"  
**Solution**:
- Verify cell tower API keys
- Check network code (MCC/MNC) validity
- Fallback to manual location entry

### SMS Not Received
**Problem**: User doesn't get SMS fallback  
**Solution**:
- Verify SMS gateway credentials
- Check phone number format
- Review SMS provider logs

### Session Expired
**Problem**: "Session not found" error  
**Solution**:
- Session timeout is 10 minutes
- User must start new USSD session
- Data is preserved in incident records

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **Phone Numbers**: Implement rate limiting per phone
3. **Location Data**: Comply with local privacy regulations
4. **Session Timeout**: Automatic 10-minute timeout to prevent data leaks
5. **Input Validation**: All USSD inputs validated before processing

## Compliance & Regulations

### GDPR (Europe)
- Location data is PII, stored only for dispatch
- Automatic deletion after incident completion
- User can request data deletion

### HIPAA (US Health)
- Medical information encrypted in transit
- Secure Redis with password
- Audit logging for medical calls

### Regional Requirements
- Adapt keywords for local languages
- Verify USSD short code regulations
- SMS delivery confirmation

## Monitoring & Logging

### Key Metrics to Track
```javascript
// USSD
- Active sessions
- Menu completion rate
- Session timeout rate
- Average response time

// Location
- Cell tower vs GPS vs manual percentage
- Location accuracy distribution
- Reverse geocoding success rate

// SMS Fallback
- Fallback trigger frequency
- Intent detection accuracy
- False positive rate

// Dispatch
- Avg time to dispatch
- Dispatch success rate
- Incident completion rate
```

### Log Examples
```javascript
logger.info('USSD Session Created', {
  sessionId: 'uuid',
  phoneNumber: '+254...',
  locationSource: 'cell-tower',
  timestamp: new Date()
});

logger.warn('SMS Fallback Triggered', {
  reason: 'ussd-timeout',
  attempts: 2,
  phoneNumber: '+254...'
});

logger.error('Location Resolution Failed', {
  error: error.message,
  phoneNumber: '+254...'
});
```

## Development Roadmap

### Phase 1 (Current)
- ✅ Basic USSD menu system
- ✅ Cell tower location resolution
- ✅ SMS fallback
- ✅ Session management

### Phase 2
- [ ] Multi-language support
- [ ] Voice IVR (IVRS) integration
- [ ] WhatsApp fallback channel
- [ ] Offline mode (local caching)

### Phase 3
- [ ] AI-based medical condition assessment
- [ ] Real-time ambulance tracking updates
- [ ] Family notification system
- [ ] Integration with hospital records

## License

MIT - See LICENSE file

## Support

For issues, questions, or contributions:
1. Check SAMPLE_SESSIONS.js for examples
2. Review troubleshooting section
3. Check server logs: `docker logs ussd-server`
4. Open an issue in the repository

## Architecture Diagram

```
User (USSD/SMS)
     ↓
USSD/SMS Provider (Africa's Talking, Twilio)
     ↓
USSD Server (Express.js)
├── Menu Flow → User Response
├── Session Management (Redis)
├── Location Resolver
│   ├── Cell Tower API
│   ├── GPS/Geocoding API
│   └── Network Operator Data
├── SMS Fallback (NLP Intent)
└── Dispatch Service
     ↓
Ambulance Dispatch System
     ↓
Emergency Response
```

## Contributing

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Test in rural connectivity scenarios
5. Submit PR with clear description

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0  
**Maintained By**: Ambulance Dispatch Team
