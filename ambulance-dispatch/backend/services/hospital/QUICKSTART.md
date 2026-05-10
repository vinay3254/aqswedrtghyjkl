# Hospital Services - Quick Start Guide

## Overview

This guide helps you get started with the Hospital Management Services in 5 minutes.

## Installation

### 1. Install Dependencies

```bash
npm install nodemailer axios pdfkit twilio aws-sdk
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_ADDRESS=noreply@ambulance-dispatch.com

# SMS Configuration (Twilio)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Feedback URLs
PATIENT_FEEDBACK_URL=http://localhost:3000/feedback/patient
HOSPITAL_FEEDBACK_URL=http://localhost:3000/feedback/hospital

# Dispatch Center
DISPATCH_CENTER_PHONE=+1-555-0100
```

### 3. Database Setup

Run migrations to create required tables:

```bash
npm run migrate -- --path services/hospital/migrations
```

## Basic Usage

### 1. Send Hospital Pre-Alerts

```javascript
const hospitalNotifier = require('./services/hospital/hospital-notifier');

// Send pre-alert when ambulance is dispatched
const result = await hospitalNotifier.sendPreAlert({
  incidentId: 'INC-12345',
  patientInfo: {
    age: 45,
    gender: 'M',
    condition: 'cardiac',
    severity: 'critical',
    mainComplaint: 'Severe chest pain',
    allergies: 'Penicillin',
    medicalHistory: 'Diabetes, Hypertension'
  },
  ambulanceInfo: {
    number: 'AMB-001',
    type: 'ALS',
    crewSize: 2,
    estimatedArrivalTime: new Date(Date.now() + 15 * 60000)
  }
});

console.log(result);
// Output: {
//   success: true,
//   incidentId: 'INC-12345',
//   results: [...]
// }
```

### 2. Handle Hospital Confirmations

```javascript
const confirmationHandler = require('./services/hospital/confirmation-handler');

// Listen for hospital acceptance
confirmationHandler.on('hospital-accepted', (data) => {
  console.log(`Hospital ${data.hospitalId} accepted incident ${data.incidentId}`);
  // Update dispatch, notify crew, start tracking
});

// Handle rejection with alternative hospital
confirmationHandler.on('hospital-rejected', async (data) => {
  console.log(`Hospital ${data.hospitalId} rejected: ${data.reason}`);
  // Automatically finds alternative hospital
});

// Hospital confirms acceptance
const confirmation = await confirmationHandler.handleConfirmation({
  incidentId: 'INC-12345',
  hospitalId: 'HOSP-789',
  status: 'accepted'
});
```

### 3. Generate Handover Reports

```javascript
const handoverReportService = require('./services/hospital/handover-report');

// Generate PDF report after patient handover
const report = await handoverReportService.generateHandoverReport('INC-12345');

console.log(report);
// Output: {
//   success: true,
//   reportId: 'uuid',
//   pdfPath: '/reports/handovers/handover_INC-12345_1234567890.pdf',
//   digitalReport: { ... },
//   generatedAt: new Date()
// }

// Download PDF
res.download(report.pdfPath, `handover_${report.incidentId}.pdf`);
```

### 4. Collect Feedback

```javascript
const feedbackCollector = require('./services/hospital/feedback-collector');

// Request feedback from patient
const feedback = await feedbackCollector.requestPatientFeedback('INC-12345');

// Request feedback from hospital
await feedbackCollector.requestHospitalFeedback('INC-12345', 'HOSP-789');

// Patient submits feedback via link
const submitted = await feedbackCollector.submitPatientFeedback(
  'fb_1699564800000_abc123def456', // feedback token from email link
  [
    { questionId: 'response_time', type: 'rating', value: 5 },
    { questionId: 'crew_professionalism', type: 'rating', value: 4 },
    { questionId: 'additional_comments', type: 'text', text: 'Great service!' }
  ]
);

console.log(submitted);
// Output: {
//   success: true,
//   feedbackId: 'uuid',
//   overallRating: 4.5,
//   message: 'Thank you for your feedback!'
// }

// Get feedback summary
const summary = await feedbackCollector.getFeedbackSummary('INC-12345');
```

## API Integration

### Add Routes to Express App

```javascript
// /backend/api/routes/dispatch.js
const express = require('express');
const router = express.Router();
const hospitalNotifier = require('../services/hospital/hospital-notifier');

// POST /api/dispatch/pre-alert
router.post('/pre-alert', async (req, res) => {
  try {
    const result = await hospitalNotifier.sendPreAlert(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/hospitals/confirm
router.post('/confirm', async (req, res) => {
  try {
    const confirmationHandler = require('../services/hospital/confirmation-handler');
    const result = await confirmationHandler.handleConfirmation(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/incidents/:id/handover-report
router.post('/incidents/:id/handover-report', async (req, res) => {
  try {
    const handoverReportService = require('../services/hospital/handover-report');
    const report = await handoverReportService.generateHandoverReport(req.params.id);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/incidents/:id/request-feedback
router.post('/incidents/:id/request-feedback', async (req, res) => {
  try {
    const feedbackCollector = require('../services/hospital/feedback-collector');
    const results = {};
    
    results.patient = await feedbackCollector.requestPatientFeedback(req.params.id);
    results.hospital = await feedbackCollector.requestHospitalFeedback(
      req.params.id,
      req.body.hospitalId
    );
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Register Routes in App

```javascript
// /backend/app.js
const express = require('express');
const dispatchRoutes = require('./api/routes/dispatch');

const app = express();

// ... other middleware ...

app.use('/api/dispatch', dispatchRoutes);

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Complete Workflow Example

```javascript
const hospitalNotifier = require('./services/hospital/hospital-notifier');
const confirmationHandler = require('./services/hospital/confirmation-handler');
const handoverReportService = require('./services/hospital/handover-report');
const feedbackCollector = require('./services/hospital/feedback-collector');

async function handleIncident(dispatch) {
  try {
    // 1. Send pre-alerts to nearby hospitals
    console.log('1️⃣ Sending pre-alerts...');
    const preAlert = await hospitalNotifier.sendPreAlert({
      incidentId: dispatch.incidentId,
      patientInfo: { /* patient details */ },
      ambulanceInfo: { /* ambulance details */ }
    });

    // 2. Set 5-minute timeout for confirmations
    console.log('2️⃣ Setting confirmation timeouts...');
    for (const result of preAlert.results) {
      if (result.success) {
        confirmationHandler.setConfirmationTimeout(
          dispatch.incidentId,
          result.hospitalId
        );
      }
    }

    // 3. Wait for hospital acceptance
    console.log('3️⃣ Waiting for hospital response...');
    const acceptance = await new Promise(resolve => {
      confirmationHandler.once('hospital-accepted', resolve);
    });

    console.log(`✅ Hospital ${acceptance.hospitalId} accepted!`);

    // 4. After handover, generate report
    console.log('4️⃣ Generating handover report...');
    const report = await handoverReportService.generateHandoverReport(
      dispatch.incidentId
    );
    console.log(`📄 Report saved: ${report.pdfPath}`);

    // 5. Request feedback
    console.log('5️⃣ Requesting feedback...');
    await feedbackCollector.requestPatientFeedback(dispatch.incidentId);
    await feedbackCollector.requestHospitalFeedback(
      dispatch.incidentId,
      acceptance.hospitalId
    );

    console.log('✅ All tasks completed!');

    return {
      success: true,
      incidentId: dispatch.incidentId,
      hospitalId: acceptance.hospitalId,
      reportPath: report.pdfPath
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Usage
await handleIncident(dispatch);
```

## Testing

### Test Pre-Alert Notification

```javascript
// Test with curl
curl -X POST http://localhost:3000/api/dispatch/pre-alert \
  -H "Content-Type: application/json" \
  -d '{
    "incidentId": "TEST-001",
    "patientInfo": {
      "age": 45,
      "gender": "M",
      "condition": "cardiac",
      "severity": "critical",
      "mainComplaint": "Chest pain"
    },
    "ambulanceInfo": {
      "number": "AMB-001",
      "type": "ALS",
      "crewSize": 2
    }
  }'
```

### Test Hospital Confirmation

```bash
curl -X POST http://localhost:3000/api/hospitals/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "incidentId": "TEST-001",
    "hospitalId": "HOSP-001",
    "status": "accepted"
  }'
```

## Troubleshooting

### Email Not Sending

1. Check Gmail App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Generate a new App Password
   - Use it in `SMTP_PASSWORD`

2. Check SMTP Settings:
   ```bash
   telnet smtp.gmail.com 587
   ```

### SMS Not Sending

1. Verify Twilio credentials:
   - Log in to https://twilio.com/console
   - Check Account SID and Auth Token
   - Verify phone numbers

2. Check account balance

### Database Errors

1. Ensure tables are created:
   ```bash
   npm run migrate
   ```

2. Check database connection:
   ```bash
   npm test -- --testPathPattern=database
   ```

## Next Steps

1. **Customize Email Templates**: Edit HTML templates for branding
2. **Configure SMS Gateway**: Switch to AWS SNS if preferred
3. **Set Up Dashboards**: Create real-time monitoring dashboards
4. **Integrate with CRM**: Sync feedback to patient management system
5. **Add Analytics**: Set up metrics tracking and reporting

## Support

- 📖 Full documentation: See `README.md`
- 🔧 API reference: See `API_INTEGRATION_GUIDE.js`
- ⚙️ Configuration: See `config.js`
- 💬 Questions: Contact support@ambulance-dispatch.com

## Key Files Location

```
backend/services/hospital/
├── hospital-notifier.js          # Pre-alert notifications
├── confirmation-handler.js       # Hospital confirmations
├── handover-report.js            # PDF & digital reports
├── feedback-collector.js         # Feedback collection
├── config.js                     # Configuration
├── API_INTEGRATION_GUIDE.js      # API integration examples
├── README.md                     # Full documentation
└── QUICKSTART.md                # This file
```

---

**Happy dispatching!** 🚑
