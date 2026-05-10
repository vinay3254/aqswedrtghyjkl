# SMS/USSD Emergency Dispatch System

Complete SMS and USSD-based emergency ambulance dispatch system for rural areas and feature phones.

## Features

### 1. SMS Emergency Requests
- Send `AMBULANCE <location>` to request emergency ambulance
- Automatic location geocoding
- Instant ambulance dispatch
- SMS confirmation with ambulance details and ETA

### 2. SMS Status Updates
Users receive automatic updates:
- Ambulance assigned
- Ambulance en route
- Ambulance arrived
- Patient picked up
- Arrived at hospital

### 3. USSD Menu System
Dial `*108#` for interactive menu:
1. Request Ambulance
2. Check Ambulance Status
3. List Nearby Hospitals
4. Emergency Contacts
5. Help

### 4. Driver SMS Interface
Drivers receive and respond to assignments via SMS:
- Assignment notifications
- Accept/reject with YES/NO replies
- Route and hospital information

### 5. Location Handling
- Landmark-based location recognition
- Google Maps Geocoding API integration
- Cell tower triangulation fallback
- Manual dispatcher intervention for unclear locations

### 6. Mock SMS Gateway
Built-in mock gateway for testing without real SMS provider

## Installation

```bash
cd backend/services/sms
npm install axios express
```

## Configuration

```javascript
const SMSService = require('./services/sms/service');

const smsService = new SMSService({
  gatewayType: 'mock', // or 'twilio', 'nexmo'
  googleMapsApiKey: 'YOUR_API_KEY', // optional, uses mock if not provided
  gateway: {
    // For Twilio
    accountSid: 'YOUR_ACCOUNT_SID',
    authToken: 'YOUR_AUTH_TOKEN',
    fromNumber: '+1234567890'
  }
});
```

## API Endpoints

### SMS Endpoints

#### Receive SMS (Webhook)
```http
POST /api/sms/receive
Content-Type: application/json

{
  "from": "+91-9876543210",
  "message": "AMBULANCE Gandhi Chowk, Patna",
  "messageId": "MSG-123"
}
```

#### Send SMS
```http
POST /api/sms/send
Content-Type: application/json

{
  "to": "+91-9876543210",
  "message": "Your ambulance is arriving in 5 min."
}
```

#### Get SMS Status
```http
GET /api/sms/status/MSG-123
```

#### Send Status Update
```http
POST /api/sms/status-update
Content-Type: application/json

{
  "phoneNumber": "+91-9876543210",
  "status": "en_route",
  "details": {
    "eta": 10
  }
}
```

### USSD Endpoints

#### Handle USSD Session
```http
POST /api/ussd/session
Content-Type: application/json

{
  "sessionId": "USSD-12345",
  "phoneNumber": "+91-9876543210",
  "input": "1",
  "serviceCode": "108"
}
```

### Testing Endpoints

#### Simulate Incoming SMS
```http
POST /api/sms/simulate
Content-Type: application/json

{
  "from": "+91-9876543210",
  "message": "AMBULANCE Gandhi Chowk, Patna"
}
```

#### Simulate USSD Flow
```http
POST /api/ussd/simulate
Content-Type: application/json

{
  "phoneNumber": "+91-9876543210"
}
```

#### Health Check
```http
GET /api/sms/health
```

## Usage Examples

### Emergency Request Flow

```
User SMS: AMBULANCE Gandhi Chowk, Patna

System Response:
"Emergency received. Ambulance AMB-12 assigned. ETA 15 min. 
Driver: +91-9876543210. Track: http://track.ems/1234"

[10 minutes later]
System: "Ambulance on the way. Arriving in 5 min."

[5 minutes later]
System: "Ambulance has arrived. Look for AMB-12."
```

### USSD Flow

```
User: *108#

System:
"CON Welcome to Emergency Medical Services

1. Request Ambulance
2. Check Ambulance Status
3. List Nearby Hospitals
4. Emergency Contacts
5. Help

Enter your choice:"

User: 1

System:
"CON Request Ambulance

Enter your location:
(e.g., Gandhi Chowk, Patna)"

User: Gandhi Chowk, Patna

System:
"CON Confirm Emergency Request

Location: Gandhi Chowk, Patna

1. Confirm & Request
2. Re-enter Location
3. Cancel

Enter your choice:"

User: 1

System:
"END Emergency Request Confirmed

Incident ID: INC-1234567890
Location: Gandhi Chowk, Patna

Ambulance dispatched!
You will receive SMS updates.

For urgent help, call 108."
```

### Driver Assignment

```
Driver receives:
"NEW ASSIGNMENT: Incident INC-1234. Location: Gandhi Chowk. 
Type: Medical. Severity: High. Reply YES to accept, NO to reject."

Driver replies: YES

System responds:
"Assignment accepted. Route: Take NH-31 to location. Distance: 8 km. 
Hospital: City General. Contact patient: Get from dispatch."
```

## SMS Commands

| Command | Format | Description |
|---------|--------|-------------|
| Emergency Request | `AMBULANCE <location>` | Request emergency ambulance |
| Status Check | `STATUS` | Check latest ambulance status |
| Status with ID | `STATUS <id>` | Check specific incident |
| Driver Accept | `YES` | Accept assignment (drivers) |
| Driver Reject | `NO` | Reject assignment (drivers) |
| Help | `HELP` | Get command instructions |

## Integration with Existing System

### Add Routes to Express App

```javascript
const express = require('express');
const createSMSRoutes = require('./services/sms/routes');

const app = express();
app.use(express.json());

// Add SMS/USSD routes
const smsRoutes = createSMSRoutes({
  gatewayType: 'mock',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
});
app.use('/api', smsRoutes);

app.listen(3000);
```

### Integrate with Incident Service

```javascript
const SMSService = require('./services/sms/service');

class IncidentService {
  constructor() {
    this.smsService = new SMSService();
  }

  async updateIncidentStatus(incidentId, status, details) {
    // Update incident in database
    // ...

    // Send SMS update to user
    if (incident.phoneNumber) {
      await this.smsService.sendStatusUpdate(
        incident.phoneNumber,
        status,
        details
      );
    }
  }
}
```

## Location Geocoding

### Text to Coordinates

```javascript
const GeocodingService = require('./services/sms/geocoding');

const geocoding = new GeocodingService('YOUR_GOOGLE_API_KEY');

// Geocode location
const result = await geocoding.geocodeLocation('Gandhi Chowk, Patna');

console.log(result);
// {
//   success: true,
//   location: {
//     latitude: 25.5941,
//     longitude: 85.1376,
//     formattedAddress: 'Gandhi Chowk, Patna, Bihar, India'
//   },
//   confidence: 85
// }
```

### With Fallback

```javascript
// Tries geocoding, then cell tower if available
const result = await geocoding.getLocationWithFallback(
  'Gandhi Chowk',
  '+91-9876543210'
);

if (result.needsManualVerification) {
  console.log('⚠️ Location uncertain, manual verification needed');
}
```

## SMS Gateway Integration

### Mock Gateway (Development)

```javascript
const { createGateway } = require('./services/sms/gateway');

const gateway = createGateway('mock');
await gateway.sendSMS('+91-9876543210', 'Test message');
```

### Twilio Integration

```javascript
const gateway = createGateway('twilio', {
  accountSid: 'YOUR_ACCOUNT_SID',
  authToken: 'YOUR_AUTH_TOKEN',
  fromNumber: '+1234567890'
});

await gateway.sendSMS('+91-9876543210', 'Emergency alert');
```

### Nexmo/Vonage Integration

```javascript
const gateway = createGateway('nexmo', {
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
  fromNumber: '108'
});

await gateway.sendSMS('+91-9876543210', 'Ambulance dispatched');
```

## Testing

### Test Emergency Request

```bash
curl -X POST http://localhost:3000/api/sms/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+91-9876543210",
    "message": "AMBULANCE Gandhi Chowk, Patna"
  }'
```

### Test USSD Flow

```bash
curl -X POST http://localhost:3000/api/ussd/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+91-9876543210"
  }'
```

### Test Status Update

```bash
curl -X POST http://localhost:3000/api/sms/status-update \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+91-9876543210",
    "status": "en_route",
    "details": {
      "eta": 10
    }
  }'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SMS/USSD Service                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Gateway    │  │    Parser    │  │   Geocoding  │     │
│  │  (Mock/Real) │  │  (Commands)  │  │   (Google)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Service   │  │  Controller  │  │ USSD Handler │     │
│  │  (Business)  │  │   (HTTP)     │  │  (Sessions)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │   SMS    │        │  USSD    │        │ Incident │
    │ Provider │        │ Provider │        │  System  │
    └──────────┘        └──────────┘        └──────────┘
```

## Deployment Considerations

### Environment Variables

```bash
# .env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
SMS_GATEWAY_TYPE=twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=+1234567890
```

### Production Gateway Setup

1. **Sign up for SMS provider** (Twilio, Nexmo, etc.)
2. **Configure webhook URL** for incoming SMS
3. **Update gateway type** in configuration
4. **Add credentials** to environment variables
5. **Test with real phone numbers**

### Webhook Configuration

Set webhook URL in SMS provider dashboard:
```
https://your-domain.com/api/sms/receive
```

### Security

- Validate webhook signatures
- Rate limit SMS sending
- Sanitize user input
- Encrypt sensitive data
- Monitor for abuse

## Offline Mode

The system includes offline capabilities:
- SMS queue when internet down
- Send when connectivity restored
- Local SMS gateway fallback
- Priority queuing for emergencies

## Rural Coverage Optimization

- Minimal data usage
- Works on 2G networks
- Feature phone compatible
- No app installation required
- Multi-language support ready
- Voice call fallback

## Monitoring

Track key metrics:
- SMS delivery rates
- Response times
- Failed geocoding attempts
- USSD session completion rates
- Driver acceptance rates

## Support

For issues or questions:
- Check logs for detailed error messages
- Test with mock gateway first
- Verify API credentials
- Check network connectivity
- Review webhook configuration

## License

MIT
