# Hospital Management System - Services Documentation

## Overview

This directory contains comprehensive hospital management services for the ambulance dispatch system. The system handles pre-alerts, confirmations, handover reports, and feedback collection with full PDF report generation.

## File Structure

```
hospital/
├── hospital-notifier.js      - Pre-alert notifications to hospitals
├── confirmation-handler.js   - Hospital acceptance/rejection handling
├── handover-report.js        - Digital handover reports with PDF generation
├── feedback-collector.js     - Patient and hospital feedback collection
└── README.md                 - This file
```

## Services Overview

### 1. Hospital Notifier Service (`hospital-notifier.js`)

**Purpose:** Sends pre-alert notifications to hospitals with patient information and ETA.

**Key Features:**
- Multi-channel notification (Email, SMS, API webhooks)
- Hospital capability matching based on patient condition
- Automatic speciality determination (Trauma, Cardiology, Neurology, Pediatrics, ICU)
- Customized handover instructions
- Pre-alert logging and tracking

**Main Methods:**

```javascript
// Send pre-alert to suitable hospitals
await hospitalNotifier.sendPreAlert({
  incidentId: 'INC-12345',
  patientInfo: {
    age: 45,
    gender: 'M',
    condition: 'cardiac',
    severity: 'critical',
    mainComplaint: 'Chest pain',
    allergies: 'Penicillin',
    medicalHistory: 'Diabetes, Hypertension'
  },
  ambulanceInfo: {
    number: 'AMB-001',
    type: 'Advanced Life Support',
    crewSize: 2,
    estimatedArrivalTime: new Date(Date.now() + 15 * 60000)
  },
  estimatedHospitals: [] // Optional pre-calculated hospitals
});

// Update hospital status
await hospitalNotifier.updateHospitalStatus(incidentId, hospitalId, 'accepted');
```

**Email Notification Features:**
- Professional HTML formatting
- Color-coded severity levels
- Patient allergies highlighted in alerts
- Handover instructions and crew details
- Direct dispatch center contact information

**SMS Notification:**
- Concise format for quick reading
- Patient condition, severity, ETA
- Incident ID for reference

**API Webhook:**
- Bearer token authentication
- JSON payload format
- 10-second timeout protection

---

### 2. Confirmation Handler (`confirmation-handler.js`)

**Purpose:** Manages hospital acceptance/rejection of incoming patients.

**Key Features:**
- Hospital confirmation/rejection tracking
- Automatic timeout handling (5 minutes default)
- Alternative hospital selection on rejection
- Cancellation notifications to other hospitals
- Event-based architecture for real-time updates
- Rejection metrics tracking

**Main Methods:**

```javascript
// Handle hospital confirmation
const result = await confirmationHandler.handleConfirmation({
  incidentId: 'INC-12345',
  hospitalId: 'HOSP-789',
  status: 'accepted', // or 'rejected'
  reason: 'No bed capacity', // For rejections
  additionalInfo: { preAlertTime: new Date() }
});

// Get confirmation status
const status = await confirmationHandler.getConfirmationStatus(incidentId);
// Returns: { accepted: [], rejected: [], noResponse: [], pending: [] }

// Set confirmation timeout (auto-rejects if no response)
confirmationHandler.setConfirmationTimeout(incidentId, hospitalId);

// Clear timeout if confirmed
confirmationHandler.clearConfirmationTimeout(incidentId, hospitalId);
```

**Event Emitters:**

```javascript
confirmationHandler.on('hospital-accepted', (data) => {
  // { incidentId, hospitalId, ambulanceId, timestamp }
});

confirmationHandler.on('hospital-rejected', (data) => {
  // { incidentId, hospitalId, reason, timestamp }
});

confirmationHandler.on('resend-pre-alert', (data) => {
  // { incidentId, hospitalId, timestamp }
});

confirmationHandler.on('no-hospital-available', (data) => {
  // { incidentId, timestamp }
});

confirmationHandler.on('start-hospital-tracking', (data) => {
  // { incidentId, hospitalId, ambulanceId, interval }
});
```

**Workflow:**
1. Hospital receives pre-alert
2. Hospital confirms (accepts/rejects) or timeout triggers
3. If accepted: Dispatch updated, other hospitals notified, tracking starts
4. If rejected: Alternative hospital search begins
5. Rejection metrics recorded for performance tracking

---

### 3. Handover Report Service (`handover-report.js`)

**Purpose:** Generates comprehensive digital and PDF handover reports.

**Key Features:**
- Automatic data collection from incident, dispatch, vitals, timeline
- Vitals trend analysis (improving/deteriorating/stable)
- PDF generation with professional formatting
- Digital JSON report format
- Multi-page PDF support
- Signature section for crew, hospital, and patient
- Patient privacy compliance

**Main Methods:**

```javascript
// Generate comprehensive handover report
const report = await handoverReportService.generateHandoverReport(incidentId);
// Returns: {
//   success: true,
//   reportId: 'uuid',
//   incidentId: 'INC-12345',
//   pdfPath: '/path/to/handover_INC-12345_timestamp.pdf',
//   digitalReport: { ... },
//   generatedAt: new Date()
// }

// Retrieve existing handover report
const report = await handoverReportService.getHandoverReport(incidentId);
```

**PDF Report Contents:**

1. **Header**
   - Report title and type
   - Report generation date and time
   - Incident ID

2. **Incident Summary**
   - Incident ID, type, severity
   - Reported time and location
   - Hospital details

3. **Patient Information**
   - Name, age, gender, blood type
   - Allergies (highlighted)
   - Medical history
   - Main complaint

4. **Ambulance Details**
   - Ambulance number and type
   - Crew size and composition
   - Response metrics

5. **Patient Vitals**
   - Initial vs Final comparison table
   - Vitals trend analysis
   - Full timeline of vital signs
   - Heart rate, BP, O2 sat, respiratory rate, temperature

6. **Incident Timeline**
   - Chronological event log
   - Time, event type, description
   - Up to 15 most recent events

7. **Treatments Provided**
   - Interventions list with timestamps
   - Medications administered with dosage

8. **Signature Section**
   - Ambulance crew signature lines
   - Hospital receiving staff signature lines
   - Patient/Guardian signature lines
   - Date fields

9. **Footer**
   - Page numbers
   - Incident ID
   - Confidentiality notice

**Vitals Trend Analysis:**

```javascript
{
  heartRate: {
    initial: 85,
    final: 78,
    change: -7,
    status: 'improving'
  },
  bloodPressure: {
    initial: '140/90',
    final: '130/85',
    status: 'stable'
  },
  oxygenSaturation: {
    initial: 92,
    final: 96,
    change: 4,
    status: 'improving'
  },
  respiratoryRate: {
    initial: 20,
    final: 18,
    change: -2,
    status: 'improving'
  }
}
```

---

### 4. Feedback Collector Service (`feedback-collector.js`)

**Purpose:** Collects feedback and ratings from patients and hospitals.

**Key Features:**
- Customized feedback forms for patients and hospitals
- Feedback token generation for secure links
- Email and SMS feedback request delivery
- Sentiment analysis from open-ended responses
- Hospital performance metrics tracking
- Feedback analytics and reporting

**Main Methods:**

```javascript
// Request patient feedback
const patientFeedback = await feedbackCollector.requestPatientFeedback(incidentId);
// Returns: { success: true, feedbackId, feedbackToken, message }

// Request hospital feedback
const hospitalFeedback = await feedbackCollector.requestHospitalFeedback(
  incidentId,
  hospitalId
);
// Returns: { success: true, feedbackId, feedbackToken, message }

// Submit patient feedback
const submitted = await feedbackCollector.submitPatientFeedback(feedbackToken, [
  { questionId: 'response_time', type: 'rating', value: 5 },
  { questionId: 'crew_professionalism', type: 'rating', value: 4 },
  { questionId: 'additional_comments', type: 'text', text: 'Great service!' }
]);

// Submit hospital feedback
const submitted = await feedbackCollector.submitHospitalFeedback(feedbackToken, [
  { questionId: 'pre_alert_timing', type: 'rating', value: 5 },
  { questionId: 'handover_process', type: 'rating', value: 4 }
]);

// Get feedback summary
const summary = await feedbackCollector.getFeedbackSummary(incidentId);

// Get analytics
const analytics = await feedbackCollector.getFeedbackAnalytics({
  hospitalId: 'HOSP-789',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});
```

**Patient Feedback Questions:**

1. Ambulance response time (1-5 rating)
2. Crew professionalism (1-5 rating)
3. Crew communication clarity (1-5 rating)
4. Ambulance ride comfort (1-5 rating)
5. Pain management adequacy (1-5 rating)
6. Overall experience (1-5 rating)
7. Additional comments (text)

**Hospital Feedback Questions:**

1. Pre-alert notification timeliness (1-5 rating)
2. Pre-alert information completeness (1-5 rating)
3. Handover process smoothness (1-5 rating)
4. Ambulance crew professionalism (1-5 rating)
5. Documentation completeness (1-5 rating)
6. Response effectiveness (1-5 rating)
7. Improvement areas (text)

**Email Request Features:**
- Professional HTML formatting
- Direct feedback survey link
- Confidentiality assurance
- Incident ID reference
- Patient/Hospital customized greeting

**Sentiment Analysis:**
- Positive keywords: excellent, great, good, amazing, wonderful, helpful, professional, quick, efficient, satisfied
- Negative keywords: poor, bad, terrible, awful, slow, unprofessional, rude, unhelpful, dissatisfied
- Returns: positive, neutral, or negative sentiment

**Feedback Token Format:**
- `fb_[timestamp]_[random]`
- Example: `fb_1699564800000_abc123def456`

---

## Environment Variables

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_ADDRESS=noreply@ambulance-dispatch.com

# SMS Configuration
SMS_PROVIDER=twilio  # or 'aws'
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# AWS SNS (Alternative SMS)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Feedback URLs
PATIENT_FEEDBACK_URL=https://app.ambulance-dispatch.com/feedback/patient
HOSPITAL_FEEDBACK_URL=https://app.ambulance-dispatch.com/feedback/hospital

# Dispatch Center
DISPATCH_CENTER_PHONE=+1-555-0100

# Report Storage
REPORTS_DIR=/path/to/reports/handovers
```

---

## Database Schema Requirements

### PreAlert Table
```sql
CREATE TABLE pre_alerts (
  id UUID PRIMARY KEY,
  incident_id VARCHAR(255) NOT NULL,
  hospital_id VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP,
  success BOOLEAN,
  channels JSON,
  status VARCHAR(50), -- sent, failed, cancelled
  hospital_status VARCHAR(50), -- pending, accepted, rejected
  status_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### HospitalConfirmation Table
```sql
CREATE TABLE hospital_confirmations (
  id UUID PRIMARY KEY,
  incident_id VARCHAR(255) NOT NULL,
  hospital_id VARCHAR(255) NOT NULL,
  status VARCHAR(50), -- accepted, rejected, no_response
  reason VARCHAR(255),
  additional_info JSON,
  confirmed_at TIMESTAMP,
  confirmation_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### HandoverReport Table
```sql
CREATE TABLE handover_reports (
  id UUID PRIMARY KEY,
  incident_id VARCHAR(255) NOT NULL UNIQUE,
  report_type VARCHAR(50),
  report_data LONGTEXT, -- JSON
  pdf_path VARCHAR(500),
  generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### PatientFeedback Table
```sql
CREATE TABLE patient_feedbacks (
  id UUID PRIMARY KEY,
  incident_id VARCHAR(255) NOT NULL,
  patient_id VARCHAR(255) NOT NULL,
  feedback_token VARCHAR(255) UNIQUE,
  status VARCHAR(50), -- pending, completed
  overall_rating DECIMAL(3,2),
  requested_at TIMESTAMP,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### HospitalFeedback Table
```sql
CREATE TABLE hospital_feedbacks (
  id UUID PRIMARY KEY,
  incident_id VARCHAR(255) NOT NULL,
  hospital_id VARCHAR(255) NOT NULL,
  feedback_token VARCHAR(255) UNIQUE,
  status VARCHAR(50), -- pending, completed
  overall_rating DECIMAL(3,2),
  requested_at TIMESTAMP,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### FeedbackResponse Table
```sql
CREATE TABLE feedback_responses (
  id UUID PRIMARY KEY,
  feedback_id VARCHAR(255) NOT NULL,
  feedback_type VARCHAR(50), -- patient, hospital
  question_id VARCHAR(100),
  response VARCHAR(255) OR TEXT,
  response_type VARCHAR(50), -- rating, text
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### HospitalMetric Table
```sql
CREATE TABLE hospital_metrics (
  id UUID PRIMARY KEY,
  hospital_id VARCHAR(255) NOT NULL,
  metric_type VARCHAR(50), -- rejection, feedback_rating
  reason VARCHAR(100),
  value DECIMAL(5,2),
  incident_id VARCHAR(255),
  recorded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Integration Examples

### Complete Workflow Example

```javascript
const hospitalNotifier = require('./hospital-notifier');
const confirmationHandler = require('./confirmation-handler');
const handoverReportService = require('./handover-report');
const feedbackCollector = require('./feedback-collector');

// Step 1: Send pre-alerts to hospitals
const preAlertResult = await hospitalNotifier.sendPreAlert({
  incidentId: 'INC-12345',
  patientInfo: { /* ... */ },
  ambulanceInfo: { /* ... */ }
});

// Step 2: Set timeout for confirmations
for (const result of preAlertResult.results) {
  if (result.success) {
    confirmationHandler.setConfirmationTimeout(
      'INC-12345',
      result.hospitalId
    );
  }
}

// Step 3: Handle hospital confirmations
confirmationHandler.on('hospital-accepted', async (data) => {
  console.log(`Hospital accepted: ${data.hospitalId}`);
});

// Step 4: After patient handover, generate report
const reportResult = await handoverReportService.generateHandoverReport('INC-12345');
console.log(`Report generated: ${reportResult.pdfPath}`);

// Step 5: Request feedback from all parties
await feedbackCollector.requestPatientFeedback('INC-12345');
await feedbackCollector.requestHospitalFeedback('INC-12345', hospitalId);

// Step 6: Get feedback summary
const feedbackSummary = await feedbackCollector.getFeedbackSummary('INC-12345');
console.log('Feedback:', feedbackSummary);
```

---

## Dependencies

```json
{
  "nodemailer": "^6.9.0",
  "axios": "^1.4.0",
  "pdfkit": "^0.13.0",
  "twilio": "^3.80.0",
  "aws-sdk": "^2.1400.0",
  "sequelize": "^6.25.0"
}
```

---

## Error Handling

All services include comprehensive error handling:

```javascript
try {
  const result = await hospitalNotifier.sendPreAlert(dispatchData);
} catch (error) {
  logger.error(`[PreAlert] Error: ${error.message}`);
  // Handle error appropriately
}
```

---

## Logging

All services use a centralized logger:

```javascript
const logger = require('../../utils/logger');

logger.info('[Service] Operation completed');
logger.warn('[Service] Warning message');
logger.error('[Service] Error occurred');
```

---

## Performance Considerations

1. **Multi-channel Notifications**: Uses `Promise.allSettled()` to send all channels in parallel
2. **Timeout Management**: Efficient timeout tracking using Map data structure
3. **Database Indexing**: Ensure indexes on:
   - `incident_id`, `hospital_id` (pre_alerts, confirmations)
   - `feedback_token` (unique)
   - `status`, `created_at` (for queries)

4. **PDF Generation**: Streams to file to avoid memory overhead
5. **Event-based Architecture**: Loose coupling between services

---

## Security Considerations

1. **Feedback Tokens**: Cryptographically secure random tokens
2. **Authentication**: Bearer token for hospital API webhooks
3. **Data Encryption**: Email passwords and API keys in environment variables
4. **HTTPS Only**: Feedback URLs should be HTTPS
5. **Rate Limiting**: Implement on feedback submission endpoints
6. **GDPR Compliance**: Feedback data handling and retention policies

---

## Testing

### Unit Test Example

```javascript
describe('HospitalNotifier', () => {
  it('should determine required specialities based on patient condition', () => {
    const result = hospitalNotifier.determineRequiredSpecialities({
      condition: 'cardiac',
      severity: 'critical',
      age: 65
    });

    expect(result).toContain('emergency');
    expect(result).toContain('cardiology');
    expect(result).toContain('icu');
  });

  it('should generate SMS content correctly', () => {
    const content = hospitalNotifier.generateSmsContent({
      etaMinutes: 10,
      patient: { condition: 'trauma', severity: 'critical', age: 45, gender: 'M' },
      incidentId: 'INC-123'
    });

    expect(content).toContain('TRAUMA');
    expect(content).toContain('10min');
  });
});

describe('ConfirmationHandler', () => {
  it('should handle hospital acceptance', async () => {
    const result = await confirmationHandler.handleConfirmation({
      incidentId: 'INC-123',
      hospitalId: 'HOSP-456',
      status: 'accepted'
    });

    expect(result.success).toBe(true);
  });

  it('should timeout after 5 minutes', (done) => {
    confirmationHandler.setConfirmationTimeout('INC-123', 'HOSP-456');
    
    setTimeout(() => {
      expect(confirmationHandler.confirmationTimeouts.has('INC-123_HOSP-456')).toBe(false);
      done();
    }, 301000); // 5 minutes + 1 second
  });
});
```

---

## Troubleshooting

### Email Not Sending
- Verify SMTP credentials in .env
- Check firewall rules for port 587 (TLS) or 465 (SSL)
- Enable "Less secure app access" for Gmail

### SMS Not Sending
- Verify Twilio Account SID and Auth Token
- Ensure phone numbers are in E.164 format (+1234567890)
- Check Twilio account balance

### PDF Generation Issues
- Ensure reports directory is writable
- Check disk space availability
- Verify pdfkit version compatibility

### Database Connection
- Check database credentials
- Verify network connectivity
- Ensure required tables exist with correct schema

---

## Future Enhancements

1. **Advanced Sentiment Analysis**: Integrate with NLP APIs (Google Cloud NLP, AWS Comprehend)
2. **Automated Hospital Ranking**: Dynamic hospital selection based on real-time metrics
3. **Multi-language Support**: Translate feedback forms and notifications
4. **Real-time Tracking Dashboard**: WebSocket updates to hospitals
5. **Predictive Analytics**: ML-based hospital capacity prediction
6. **Mobile App Integration**: Native app notifications
7. **Blockchain Audit Trail**: Immutable handover records
8. **Machine Learning Feedback**: Pattern detection and recommendations

---

## License

Copyright © 2024 Emergency Services. All rights reserved.

---

## Support

For questions or issues, contact the Emergency Services Development Team.
