/**
 * Hospital Services Module
 * 
 * Central export point for all hospital management services.
 * Provides pre-alerts, confirmations, handover reports, and feedback collection.
 */

// ============================================================================
// SERVICE EXPORTS
// ============================================================================

const hospitalNotifier = require('./hospital-notifier');
const confirmationHandler = require('./confirmation-handler');
const handoverReportService = require('./handover-report');
const feedbackCollector = require('./feedback-collector');

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = require('./config');

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // Services
  services: {
    hospitalNotifier,
    confirmationHandler,
    handoverReportService,
    feedbackCollector,
  },

  // Configuration
  config,

  // ========================================================================
  // CONVENIENCE METHODS
  // ========================================================================

  /**
   * Initialize all hospital services
   * Validates configuration and sets up event listeners
   */
  async initialize() {
    try {
      // Validate configuration
      if (!config.validateConfig(config)) {
        throw new Error('Configuration validation failed');
      }

      console.log('✅ Hospital Services initialized successfully');

      return {
        success: true,
        services: {
          notifier: hospitalNotifier,
          confirmation: confirmationHandler,
          reports: handoverReportService,
          feedback: feedbackCollector,
        },
      };
    } catch (error) {
      console.error('❌ Hospital Services initialization failed:', error.message);
      throw error;
    }
  },

  /**
   * Send pre-alert to hospitals
   * @param {Object} dispatchData - Dispatch information
   * @returns {Promise<Object>}
   */
  sendPreAlert(dispatchData) {
    return hospitalNotifier.sendPreAlert(dispatchData);
  },

  /**
   * Handle hospital confirmation
   * @param {Object} confirmationData - Confirmation information
   * @returns {Promise<Object>}
   */
  handleConfirmation(confirmationData) {
    return confirmationHandler.handleConfirmation(confirmationData);
  },

  /**
   * Generate handover report
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>}
   */
  generateHandoverReport(incidentId) {
    return handoverReportService.generateHandoverReport(incidentId);
  },

  /**
   * Get handover report
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>}
   */
  getHandoverReport(incidentId) {
    return handoverReportService.getHandoverReport(incidentId);
  },

  /**
   * Request patient feedback
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>}
   */
  requestPatientFeedback(incidentId) {
    return feedbackCollector.requestPatientFeedback(incidentId);
  },

  /**
   * Request hospital feedback
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @returns {Promise<Object>}
   */
  requestHospitalFeedback(incidentId, hospitalId) {
    return feedbackCollector.requestHospitalFeedback(incidentId, hospitalId);
  },

  /**
   * Get feedback summary
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>}
   */
  getFeedbackSummary(incidentId) {
    return feedbackCollector.getFeedbackSummary(incidentId);
  },

  /**
   * Get feedback analytics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>}
   */
  getFeedbackAnalytics(filters) {
    return feedbackCollector.getFeedbackAnalytics(filters);
  },

  // ========================================================================
  // EVENT EMITTER METHODS (ConfirmationHandler)
  // ========================================================================

  /**
   * Listen for hospital acceptance
   * @param {Function} callback - Callback function
   */
  onHospitalAccepted(callback) {
    return confirmationHandler.on('hospital-accepted', callback);
  },

  /**
   * Listen for hospital rejection
   * @param {Function} callback - Callback function
   */
  onHospitalRejected(callback) {
    return confirmationHandler.on('hospital-rejected', callback);
  },

  /**
   * Listen for pre-alert resend
   * @param {Function} callback - Callback function
   */
  onResendPreAlert(callback) {
    return confirmationHandler.on('resend-pre-alert', callback);
  },

  /**
   * Listen for no hospital available
   * @param {Function} callback - Callback function
   */
  onNoHospitalAvailable(callback) {
    return confirmationHandler.on('no-hospital-available', callback);
  },

  /**
   * Listen for hospital tracking start
   * @param {Function} callback - Callback function
   */
  onStartHospitalTracking(callback) {
    return confirmationHandler.on('start-hospital-tracking', callback);
  },

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get confirmation status for incident
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>}
   */
  getConfirmationStatus(incidentId) {
    return confirmationHandler.getConfirmationStatus(incidentId);
  },

  /**
   * Get feedback questions
   * @param {String} type - Type of feedback (patient/hospital)
   * @returns {Array}
   */
  getFeedbackQuestions(type) {
    return feedbackCollector.getFeedbackQuestions(type);
  },

  /**
   * Set confirmation timeout
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   */
  setConfirmationTimeout(incidentId, hospitalId) {
    return confirmationHandler.setConfirmationTimeout(incidentId, hospitalId);
  },

  /**
   * Clear confirmation timeout
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   */
  clearConfirmationTimeout(incidentId, hospitalId) {
    return confirmationHandler.clearConfirmationTimeout(incidentId, hospitalId);
  },

  // ========================================================================
  // VERSION INFO
  // ========================================================================

  version: '1.0.0',
  name: 'Hospital Management Services',
  description: 'Pre-alerts, confirmations, handover reports, and feedback collection',
};

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Initialize and use hospital services
 * 
 * const hospitalServices = require('./services/hospital');
 * 
 * // Initialize
 * await hospitalServices.initialize();
 * 
 * // Send pre-alerts
 * const preAlert = await hospitalServices.sendPreAlert({
 *   incidentId: 'INC-123',
 *   patientInfo: { ... },
 *   ambulanceInfo: { ... }
 * });
 * 
 * // Listen for confirmation
 * hospitalServices.onHospitalAccepted((data) => {
 *   console.log('Hospital accepted:', data.hospitalId);
 * });
 * 
 * // Generate report after handover
 * const report = await hospitalServices.generateHandoverReport('INC-123');
 * 
 * // Request feedback
 * await hospitalServices.requestPatientFeedback('INC-123');
 */
