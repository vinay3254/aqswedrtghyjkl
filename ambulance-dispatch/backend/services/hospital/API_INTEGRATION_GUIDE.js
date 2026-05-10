/**
 * Hospital Services API Integration Guide
 * 
 * This file demonstrates how to integrate the hospital management services
 * into your API routes and controllers.
 */

// ============================================================================
// 1. INTEGRATION IN API ROUTES
// ============================================================================

// /backend/api/routes/dispatch.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const hospitalNotifier = require('../services/hospital/hospital-notifier');
const confirmationHandler = require('../services/hospital/confirmation-handler');
const handoverReportService = require('../services/hospital/handover-report');
const feedbackCollector = require('../services/hospital/feedback-collector');
const logger = require('../utils/logger');

// ============================================================================
// DISPATCH ROUTES - Hospital Pre-Alerts
// ============================================================================

/**
 * POST /api/dispatch/:dispatchId/pre-alert
 * Trigger pre-alert to hospitals
 */
router.post('/:dispatchId/pre-alert', authenticate, authorize('dispatcher'), async (req, res) => {
  try {
    const { dispatchId } = req.params;
    
    // Fetch dispatch and incident data
    const dispatch = await AmbulanceDispatch.findByPk(dispatchId, {
      include: ['incident', 'ambulance', 'hospital'],
    });

    if (!dispatch) {
      return res.status(404).json({ error: 'Dispatch not found' });
    }

    // Prepare dispatch data
    const dispatchData = {
      incidentId: dispatch.incidentId,
      patientInfo: {
        age: dispatch.incident.patient.age,
        gender: dispatch.incident.patient.gender,
        condition: dispatch.incident.type,
        severity: dispatch.incident.severity,
        mainComplaint: dispatch.incident.mainComplaint,
        allergies: dispatch.incident.patient.allergies,
        medicalHistory: dispatch.incident.patient.medicalHistory,
      },
      ambulanceInfo: {
        number: dispatch.ambulance.number,
        type: dispatch.ambulance.type,
        crewSize: dispatch.ambulance.crewSize,
        estimatedArrivalTime: new Date(Date.now() + 15 * 60000),
      },
      estimatedHospitals: dispatch.hospital ? [dispatch.hospital] : undefined,
    };

    // Send pre-alerts
    const result = await hospitalNotifier.sendPreAlert(dispatchData);

    res.json({
      success: result.success,
      incidentId: result.incidentId,
      notificationCount: result.results.length,
      details: result.results,
    });
  } catch (error) {
    logger.error(`[PreAlert API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/dispatch/:dispatchId/resend-pre-alert
 * Resend pre-alert to additional hospitals
 */
router.post('/:dispatchId/resend-pre-alert', authenticate, authorize('dispatcher'), async (req, res) => {
  try {
    const { dispatchId } = req.params;
    const { hospitalId } = req.body;

    const dispatch = await AmbulanceDispatch.findByPk(dispatchId);
    if (!dispatch) {
      return res.status(404).json({ error: 'Dispatch not found' });
    }

    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    // Resend to specific hospital
    const dispatchData = await buildDispatchData(dispatch);
    dispatchData.estimatedHospitals = [hospital];

    const result = await hospitalNotifier.sendPreAlert(dispatchData);

    res.json({ success: result.success, result: result.results[0] });
  } catch (error) {
    logger.error(`[ResendAlert API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CONFIRMATION ROUTES - Hospital Response
// ============================================================================

/**
 * POST /api/hospitals/:hospitalId/confirm
 * Hospital confirms acceptance/rejection
 */
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { incidentId, hospitalId, status, reason } = req.body;

    // Validate request
    if (!incidentId || !hospitalId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Handle confirmation
    const result = await confirmationHandler.handleConfirmation({
      incidentId,
      hospitalId,
      status,
      reason,
      additionalInfo: { confirmedAt: new Date(), hospitalStaff: req.user.id },
    });

    res.json(result);
  } catch (error) {
    logger.error(`[Confirmation API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dispatch/:dispatchId/confirmation-status
 * Get confirmation status for an incident
 */
router.get('/:dispatchId/confirmation-status', authenticate, async (req, res) => {
  try {
    const { dispatchId } = req.params;

    const dispatch = await AmbulanceDispatch.findByPk(dispatchId);
    if (!dispatch) {
      return res.status(404).json({ error: 'Dispatch not found' });
    }

    const status = await confirmationHandler.getConfirmationStatus(dispatch.incidentId);

    res.json(status);
  } catch (error) {
    logger.error(`[ConfirmationStatus API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// HANDOVER REPORT ROUTES
// ============================================================================

/**
 * POST /api/incidents/:incidentId/handover-report
 * Generate handover report
 */
router.post('/:incidentId/handover-report', authenticate, async (req, res) => {
  try {
    const { incidentId } = req.params;

    const incident = await Incident.findByPk(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Generate report
    const report = await handoverReportService.generateHandoverReport(incidentId);

    res.json({
      success: report.success,
      reportId: report.reportId,
      pdfUrl: `/api/reports/${report.reportId}/pdf`,
      digitalReport: report.digitalReport,
    });
  } catch (error) {
    logger.error(`[HandoverReport API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/incidents/:incidentId/handover-report
 * Retrieve handover report
 */
router.get('/:incidentId/handover-report', authenticate, async (req, res) => {
  try {
    const { incidentId } = req.params;

    const report = await handoverReportService.getHandoverReport(incidentId);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    logger.error(`[GetHandoverReport API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/:reportId/pdf
 * Download PDF handover report
 */
router.get('/reports/:reportId/pdf', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await HandoverReport.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.download(report.pdfPath, `handover_${report.incidentId}.pdf`);
  } catch (error) {
    logger.error(`[DownloadPDF API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// FEEDBACK ROUTES - Collect feedback from patients and hospitals
// ============================================================================

/**
 * POST /api/incidents/:incidentId/request-feedback
 * Request feedback from patient and hospitals
 */
router.post('/:incidentId/request-feedback', authenticate, authorize('dispatcher'), async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { includePatient = true, includeHospitals = true } = req.body;

    const dispatch = await AmbulanceDispatch.findOne({
      where: { incidentId },
    });

    if (!dispatch) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const results = {};

    // Request patient feedback
    if (includePatient) {
      try {
        results.patient = await feedbackCollector.requestPatientFeedback(incidentId);
      } catch (error) {
        results.patientError = error.message;
      }
    }

    // Request hospital feedback
    if (includeHospitals && dispatch.assignedHospitalId) {
      try {
        results.hospital = await feedbackCollector.requestHospitalFeedback(
          incidentId,
          dispatch.assignedHospitalId
        );
      } catch (error) {
        results.hospitalError = error.message;
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    logger.error(`[RequestFeedback API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feedback/patient/:token/submit
 * Submit patient feedback (public endpoint)
 */
router.post('/patient/:token/submit', async (req, res) => {
  try {
    const { token } = req.params;
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Invalid responses format' });
    }

    const result = await feedbackCollector.submitPatientFeedback(token, responses);

    res.json(result);
  } catch (error) {
    logger.error(`[PatientFeedbackSubmit API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feedback/hospital/:token/submit
 * Submit hospital feedback (public endpoint)
 */
router.post('/hospital/:token/submit', async (req, res) => {
  try {
    const { token } = req.params;
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Invalid responses format' });
    }

    const result = await feedbackCollector.submitHospitalFeedback(token, responses);

    res.json(result);
  } catch (error) {
    logger.error(`[HospitalFeedbackSubmit API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feedback/questions/:type
 * Get feedback questions for given type
 */
router.get('/questions/:type', authenticate, (req, res) => {
  try {
    const { type } = req.params;

    if (!['patient', 'hospital'].includes(type)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }

    const questions = feedbackCollector.getFeedbackQuestions(type);

    res.json({ success: true, questions });
  } catch (error) {
    logger.error(`[FeedbackQuestions API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/incidents/:incidentId/feedback
 * Get feedback summary for incident
 */
router.get('/:incidentId/feedback', authenticate, async (req, res) => {
  try {
    const { incidentId } = req.params;

    const summary = await feedbackCollector.getFeedbackSummary(incidentId);

    res.json({ success: true, feedback: summary });
  } catch (error) {
    logger.error(`[FeedbackSummary API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feedback/analytics
 * Get feedback analytics
 */
router.get('/analytics', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { hospitalId, startDate, endDate } = req.query;

    const filters = {};
    if (hospitalId) filters.hospitalId = hospitalId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const analytics = await feedbackCollector.getFeedbackAnalytics(filters);

    res.json({ success: true, analytics });
  } catch (error) {
    logger.error(`[FeedbackAnalytics API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// EVENT LISTENERS - Real-time updates
// ============================================================================

// Listen to confirmation events
confirmationHandler.on('hospital-accepted', (data) => {
  // Broadcast to dispatch center via WebSocket
  io.to(`dispatch-${data.incidentId}`).emit('hospital-accepted', data);

  // Update ambulance crew
  io.to(`ambulance-${data.ambulanceId}`).emit('hospital-confirmed', {
    incidentId: data.incidentId,
    hospitalId: data.hospitalId,
  });

  logger.info(`[Event] Hospital accepted incident ${data.incidentId}`);
});

confirmationHandler.on('hospital-rejected', (data) => {
  io.to(`dispatch-${data.incidentId}`).emit('hospital-rejected', data);
  logger.warn(`[Event] Hospital rejected incident ${data.incidentId}: ${data.reason}`);
});

confirmationHandler.on('resend-pre-alert', (data) => {
  logger.info(`[Event] Resending pre-alert for incident ${data.incidentId}`);
});

confirmationHandler.on('no-hospital-available', (data) => {
  io.to(`dispatch-${data.incidentId}`).emit('alert', {
    severity: 'critical',
    message: 'No hospitals available for this incident!',
  });
  logger.error(`[Event] No hospitals available for incident ${data.incidentId}`);
});

confirmationHandler.on('start-hospital-tracking', (data) => {
  logger.info(`[Event] Starting hospital tracking for incident ${data.incidentId}`);
  // Start location tracking updates every 30 seconds
});

module.exports = router;

// ============================================================================
// 2. HELPER FUNCTIONS
// ============================================================================

/**
 * Build dispatch data for pre-alert
 */
async function buildDispatchData(dispatch) {
  const incident = await dispatch.getIncident({ include: ['patient'] });
  const ambulance = await dispatch.getAmbulance();

  return {
    incidentId: dispatch.incidentId,
    patientInfo: {
      age: incident.patient.age,
      gender: incident.patient.gender,
      condition: incident.type,
      severity: incident.severity,
      mainComplaint: incident.mainComplaint,
      allergies: incident.patient.allergies,
      medicalHistory: incident.patient.medicalHistory,
    },
    ambulanceInfo: {
      number: ambulance.number,
      type: ambulance.type,
      crewSize: ambulance.crewSize,
      estimatedArrivalTime: new Date(Date.now() + 15 * 60000),
    },
  };
}

// ============================================================================
// 3. MIDDLEWARE FOR HOSPITAL ENDPOINTS
// ============================================================================

/**
 * Verify hospital API key for webhooks
 */
function verifyHospitalApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  // Verify against hospital record
  Hospital.findOne({ where: { apiKey } })
    .then(hospital => {
      if (!hospital) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      req.hospital = hospital;
      next();
    })
    .catch(error => {
      logger.error(`[VerifyAPIKey] Error: ${error.message}`);
      res.status(500).json({ error: 'Verification failed' });
    });
}

/**
 * Verify feedback token
 */
async function verifyFeedbackToken(req, res, next) {
  const { token } = req.params;

  try {
    // Check if token exists and is valid
    const feedback = await PatientFeedback.findOne({
      where: { feedbackToken: token },
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback token not found' });
    }

    if (feedback.status === 'completed') {
      return res.status(400).json({ error: 'Feedback already submitted' });
    }

    req.feedback = feedback;
    next();
  } catch (error) {
    logger.error(`[VerifyFeedbackToken] Error: ${error.message}`);
    res.status(500).json({ error: 'Token verification failed' });
  }
}

// ============================================================================
// 4. USAGE EXAMPLES
// ============================================================================

/**
 * Example: Complete dispatch flow
 */
async function handleCompleteDispatchFlow(dispatch) {
  try {
    // 1. Send pre-alerts to hospitals
    const preAlertResult = await hospitalNotifier.sendPreAlert({
      incidentId: dispatch.incidentId,
      patientInfo: { /* ... */ },
      ambulanceInfo: { /* ... */ },
    });

    // 2. Set confirmation timeouts
    for (const result of preAlertResult.results) {
      if (result.success) {
        confirmationHandler.setConfirmationTimeout(
          dispatch.incidentId,
          result.hospitalId
        );
      }
    }

    // 3. Wait for hospital confirmation (or timeout)
    await new Promise(resolve => {
      confirmationHandler.once('hospital-accepted', resolve);
    });

    // 4. Generate handover report
    const report = await handoverReportService.generateHandoverReport(dispatch.incidentId);

    // 5. Request feedback
    await feedbackCollector.requestPatientFeedback(dispatch.incidentId);
    await feedbackCollector.requestHospitalFeedback(
      dispatch.incidentId,
      dispatch.assignedHospitalId
    );

    logger.info(`[Flow] Complete dispatch flow for ${dispatch.incidentId} finished`);
  } catch (error) {
    logger.error(`[Flow] Error in dispatch flow: ${error.message}`);
  }
}

module.exports = {
  handleCompleteDispatchFlow,
  buildDispatchData,
  verifyHospitalApiKey,
  verifyFeedbackToken,
};
