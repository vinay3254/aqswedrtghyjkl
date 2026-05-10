/**
 * Hospital Confirmation Handler
 * Manages hospital acceptance/rejection of incoming patients
 */

const logger = require('../../utils/logger');
const {
  AmbulanceDispatch,
  PreAlert,
  HospitalConfirmation,
  Incident,
} = require('../../models');
const { EventEmitter } = require('events');

class ConfirmationHandler extends EventEmitter {
  constructor() {
    super();
    this.confirmationTimeouts = new Map();
    this.CONFIRMATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Handle hospital confirmation/rejection
   * @param {Object} confirmationData - Confirmation request data
   * @returns {Promise<Object>} Confirmation result
   */
  async handleConfirmation(confirmationData) {
    try {
      const { incidentId, hospitalId, status, reason, additionalInfo } = confirmationData;

      // Validate input
      if (!incidentId || !hospitalId || !status) {
        throw new Error('Missing required confirmation data');
      }

      if (!['accepted', 'rejected'].includes(status)) {
        throw new Error('Invalid confirmation status');
      }

      logger.info(
        `[Confirmation] Handling ${status} from hospital ${hospitalId} for incident ${incidentId}`
      );

      // Check if confirmation already exists
      const existingConfirmation = await HospitalConfirmation.findOne({
        where: { incidentId, hospitalId },
      });

      if (existingConfirmation) {
        throw new Error('Confirmation already recorded for this hospital and incident');
      }

      // Record confirmation
      const confirmation = await this.recordConfirmation(
        incidentId,
        hospitalId,
        status,
        reason,
        additionalInfo
      );

      // Clear confirmation timeout
      this.clearConfirmationTimeout(incidentId, hospitalId);

      // Handle based on status
      if (status === 'accepted') {
        await this.handleAcceptance(incidentId, hospitalId, confirmation);
      } else {
        await this.handleRejection(incidentId, hospitalId, confirmation);
      }

      return {
        success: true,
        confirmationId: confirmation.id,
        message: `Hospital confirmation recorded: ${status}`,
      };
    } catch (error) {
      logger.error(`[Confirmation] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Record confirmation in database
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @param {String} status - Confirmation status
   * @param {String} reason - Reason for rejection (if applicable)
   * @param {Object} additionalInfo - Additional information
   * @returns {Promise<Object>}
   */
  async recordConfirmation(incidentId, hospitalId, status, reason, additionalInfo) {
    try {
      const confirmation = await HospitalConfirmation.create({
        incidentId,
        hospitalId,
        status,
        reason,
        additionalInfo: JSON.stringify(additionalInfo || {}),
        confirmedAt: new Date(),
        confirmationTimeMs: Date.now() - (new Date(additionalInfo?.preAlertTime).getTime() || 0),
      });

      // Update PreAlert record
      await PreAlert.update(
        { hospitalStatus: status, statusUpdatedAt: new Date() },
        {
          where: { incidentId, hospitalId },
        }
      );

      logger.info(
        `[Confirmation] Recorded ${status} for hospital ${hospitalId}: ${confirmation.id}`
      );

      return confirmation;
    } catch (error) {
      logger.error(`[RecordConfirmation] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle hospital acceptance
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @param {Object} confirmation - Confirmation record
   * @returns {Promise<void>}
   */
  async handleAcceptance(incidentId, hospitalId, confirmation) {
    try {
      logger.info(
        `[Acceptance] Processing acceptance from hospital ${hospitalId} for incident ${incidentId}`
      );

      // Update dispatch record
      await AmbulanceDispatch.update(
        {
          assignedHospitalId: hospitalId,
          hospitalConfirmed: true,
          hospitalConfirmationTime: new Date(),
          status: 'en_route_to_hospital',
        },
        {
          where: { incidentId },
        }
      );

      // Get dispatch details for notification
      const dispatch = await AmbulanceDispatch.findOne({
        where: { incidentId },
        include: ['ambulance', 'patient'],
      });

      // Notify other hospitals of acceptance
      await this.notifyOtherHospitals(
        incidentId,
        hospitalId,
        'Hospital already accepted patient'
      );

      // Notify dispatch center
      this.emit('hospital-accepted', {
        incidentId,
        hospitalId,
        ambulanceId: dispatch?.ambulanceId,
        timestamp: new Date(),
      });

      // Start real-time tracking updates to hospital
      await this.startHospitalTracking(incidentId, hospitalId);

      logger.info(`[Acceptance] Hospital acceptance processed: ${incidentId}`);
    } catch (error) {
      logger.error(`[Acceptance] Error processing acceptance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle hospital rejection
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @param {Object} confirmation - Confirmation record
   * @returns {Promise<void>}
   */
  async handleRejection(incidentId, hospitalId, confirmation) {
    try {
      logger.warn(
        `[Rejection] Hospital ${hospitalId} rejected incident ${incidentId}: ${confirmation.reason}`
      );

      // Check if patient still needs a hospital
      const otherAcceptances = await HospitalConfirmation.findOne({
        where: {
          incidentId,
          status: 'accepted',
          hospitalId: { [require('sequelize').Op.ne]: hospitalId },
        },
      });

      if (!otherAcceptances) {
        // Try other hospitals
        await this.findAlternativeHospital(incidentId);
      }

      // Update rejection metrics
      await this.recordRejectionMetrics(hospitalId, incidentId, confirmation.reason);

      // Notify dispatch center
      this.emit('hospital-rejected', {
        incidentId,
        hospitalId,
        reason: confirmation.reason,
        timestamp: new Date(),
      });

      logger.info(`[Rejection] Rejection processed for hospital ${hospitalId}`);
    } catch (error) {
      logger.error(`[Rejection] Error processing rejection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find alternative hospital if initial one rejects
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object|null>}
   */
  async findAlternativeHospital(incidentId) {
    try {
      logger.info(`[AlternativeHospital] Searching for alternative hospital for incident ${incidentId}`);

      const incident = await Incident.findByPk(incidentId, {
        include: ['patient'],
      });

      if (!incident) {
        throw new Error('Incident not found');
      }

      // Get hospitals that haven't responded yet
      const respondedHospitals = await PreAlert.findAll({
        where: { incidentId },
        attributes: ['hospitalId'],
        raw: true,
      });

      const respondedIds = respondedHospitals.map(h => h.hospitalId);

      // Find next suitable hospital
      const { Hospital } = require('../../models');
      const alternativeHospital = await Hospital.findOne({
        where: {
          id: { [require('sequelize').Op.notIn]: respondedIds },
          isActive: true,
          acceptingPatients: true,
        },
        order: [['responseTime', 'ASC']],
      });

      if (alternativeHospital) {
        logger.info(
          `[AlternativeHospital] Found alternative: ${alternativeHospital.id}`
        );

        // Resend pre-alert to alternative hospital
        const dispatch = await AmbulanceDispatch.findOne({
          where: { incidentId },
        });

        this.emit('resend-pre-alert', {
          incidentId,
          hospitalId: alternativeHospital.id,
          timestamp: new Date(),
        });

        return alternativeHospital;
      } else {
        logger.warn(`[AlternativeHospital] No alternative hospitals available`);
        this.emit('no-hospital-available', {
          incidentId,
          timestamp: new Date(),
        });

        return null;
      }
    } catch (error) {
      logger.error(`[AlternativeHospital] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notify other hospitals that patient has been accepted elsewhere
   * @param {String} incidentId - Incident ID
   * @param {String} acceptedHospitalId - ID of accepting hospital
   * @param {String} message - Notification message
   * @returns {Promise<void>}
   */
  async notifyOtherHospitals(incidentId, acceptedHospitalId, message) {
    try {
      const preAlerts = await PreAlert.findAll({
        where: {
          incidentId,
          hospitalId: { [require('sequelize').Op.ne]: acceptedHospitalId },
          hospitalStatus: { [require('sequelize').Op.ne]: 'responded' },
        },
        include: ['hospital'],
      });

      for (const preAlert of preAlerts) {
        try {
          // Send cancellation notification
          const cancelMessage = `Incident ${incidentId}: ${message}. Pre-alert cancelled.`;
          
          // Send via email
          if (preAlert.hospital.emailAddress) {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: process.env.SMTP_PORT,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              },
            });

            await transporter.sendMail({
              to: preAlert.hospital.emailAddress,
              subject: `[AMBULANCE PRE-ALERT CANCELLED] Incident ${incidentId}`,
              html: `
                <div style="background: #f5f5f5; padding: 20px;">
                  <div style="background: white; padding: 20px; border-radius: 8px;">
                    <h3>Pre-Alert Cancelled</h3>
                    <p>${cancelMessage}</p>
                    <p style="color: #666; font-size: 12px;">Incident ID: ${incidentId}</p>
                  </div>
                </div>
              `,
            });
          }

          // Update pre-alert status
          await preAlert.update({ status: 'cancelled' });

          logger.info(
            `[NotifyOtherHospitals] Notified hospital ${preAlert.hospitalId} of cancellation`
          );
        } catch (error) {
          logger.error(
            `[NotifyOtherHospitals] Error notifying ${preAlert.hospitalId}: ${error.message}`
          );
        }
      }
    } catch (error) {
      logger.error(`[NotifyOtherHospitals] Error: ${error.message}`);
    }
  }

  /**
   * Record rejection metrics for hospital performance tracking
   * @param {String} hospitalId - Hospital ID
   * @param {String} incidentId - Incident ID
   * @param {String} reason - Rejection reason
   * @returns {Promise<void>}
   */
  async recordRejectionMetrics(hospitalId, incidentId, reason) {
    try {
      const { HospitalMetric } = require('../../models');

      const rejectionReasons = {
        'capacity': 'no_bed_capacity',
        'specialty': 'no_specialty',
        'equipment': 'equipment_unavailable',
        'staff': 'staff_unavailable',
        'other': 'other',
      };

      await HospitalMetric.create({
        hospitalId,
        metricType: 'rejection',
        reason: rejectionReasons[reason] || 'unknown',
        incidentId,
        recordedAt: new Date(),
      });

      logger.info(`[RejectionMetrics] Recorded rejection metric for ${hospitalId}`);
    } catch (error) {
      logger.error(`[RejectionMetrics] Error: ${error.message}`);
    }
  }

  /**
   * Start real-time tracking updates to hospital
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @returns {Promise<void>}
   */
  async startHospitalTracking(incidentId, hospitalId) {
    try {
      const dispatch = await AmbulanceDispatch.findOne({
        where: { incidentId },
        include: ['ambulance'],
      });

      if (dispatch && dispatch.ambulance) {
        // Emit event to start real-time tracking
        this.emit('start-hospital-tracking', {
          incidentId,
          hospitalId,
          ambulanceId: dispatch.ambulanceId,
          interval: 30000, // Send updates every 30 seconds
        });

        logger.info(
          `[Tracking] Started hospital tracking for incident ${incidentId}`
        );
      }
    } catch (error) {
      logger.error(`[Tracking] Error starting hospital tracking: ${error.message}`);
    }
  }

  /**
   * Set confirmation timeout for automatic rejection if no response
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @returns {void}
   */
  setConfirmationTimeout(incidentId, hospitalId) {
    const timeoutKey = `${incidentId}_${hospitalId}`;

    const timeoutId = setTimeout(async () => {
      try {
        logger.warn(
          `[Timeout] No confirmation from hospital ${hospitalId} for incident ${incidentId} within ${this.CONFIRMATION_TIMEOUT / 1000}s`
        );

        // Mark as no response
        const existingConfirmation = await HospitalConfirmation.findOne({
          where: { incidentId, hospitalId },
        });

        if (!existingConfirmation) {
          await this.recordConfirmation(
            incidentId,
            hospitalId,
            'no_response',
            'Confirmation timeout',
            { timeout: true }
          );

          // Try to find alternative hospital
          await this.findAlternativeHospital(incidentId);
        }
      } catch (error) {
        logger.error(`[TimeoutHandler] Error: ${error.message}`);
      } finally {
        this.confirmationTimeouts.delete(timeoutKey);
      }
    }, this.CONFIRMATION_TIMEOUT);

    this.confirmationTimeouts.set(timeoutKey, timeoutId);
  }

  /**
   * Clear confirmation timeout
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @returns {void}
   */
  clearConfirmationTimeout(incidentId, hospitalId) {
    const timeoutKey = `${incidentId}_${hospitalId}`;
    const timeoutId = this.confirmationTimeouts.get(timeoutKey);

    if (timeoutId) {
      clearTimeout(timeoutId);
      this.confirmationTimeouts.delete(timeoutKey);
    }
  }

  /**
   * Get confirmation status for incident
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>}
   */
  async getConfirmationStatus(incidentId) {
    try {
      const confirmations = await HospitalConfirmation.findAll({
        where: { incidentId },
        include: ['hospital'],
      });

      const preAlerts = await PreAlert.findAll({
        where: { incidentId },
        include: ['hospital'],
      });

      const status = {
        incidentId,
        accepted: confirmations.filter(c => c.status === 'accepted'),
        rejected: confirmations.filter(c => c.status === 'rejected'),
        noResponse: confirmations.filter(c => c.status === 'no_response'),
        pending: preAlerts.filter(pa => !confirmations.find(c => c.hospitalId === pa.hospitalId)),
      };

      return status;
    } catch (error) {
      logger.error(`[GetStatus] Error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ConfirmationHandler();
