/**
 * Hospital Notifier Service
 * Sends pre-alert notifications to hospitals with patient information and ETA
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../../utils/logger');
const { Hospital, PreAlert, AmbulanceDispatch } = require('../../models');

class HospitalNotifier {
  constructor() {
    this.emailTransporter = this.initializeEmailTransport();
    this.smsProvider = process.env.SMS_PROVIDER || 'twilio';
  }

  /**
   * Initialize email transport for hospital notifications
   */
  initializeEmailTransport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      from: process.env.SMTP_FROM_ADDRESS,
    });
  }

  /**
   * Send pre-alert to hospital with patient information and ETA
   * @param {Object} dispatchData - Dispatch and patient information
   * @returns {Promise<Object>} Notification status for each hospital
   */
  async sendPreAlert(dispatchData) {
    try {
      const { incidentId, patientInfo, ambulanceInfo, estimatedHospitals } = dispatchData;

      logger.info(`[PreAlert] Starting pre-alert for incident ${incidentId}`);

      // Validate input data
      if (!incidentId || !patientInfo || !ambulanceInfo) {
        throw new Error('Missing required dispatch data');
      }

      const notificationResults = [];

      // Identify target hospitals
      const targetHospitals = await this.identifyTargetHospitals(
        patientInfo,
        estimatedHospitals
      );

      if (targetHospitals.length === 0) {
        logger.warn(`[PreAlert] No suitable hospitals found for incident ${incidentId}`);
        return { success: false, message: 'No suitable hospitals available' };
      }

      // Send notifications to each hospital
      for (const hospital of targetHospitals) {
        try {
          const result = await this.notifyHospital(
            hospital,
            patientInfo,
            ambulanceInfo,
            incidentId
          );
          notificationResults.push(result);

          // Log pre-alert in database
          await this.logPreAlert(incidentId, hospital.id, result);
        } catch (error) {
          logger.error(
            `[PreAlert] Error notifying hospital ${hospital.id}: ${error.message}`
          );
          notificationResults.push({
            hospitalId: hospital.id,
            success: false,
            error: error.message,
          });
        }
      }

      logger.info(
        `[PreAlert] Completed for incident ${incidentId}. ${notificationResults.filter(r => r.success).length}/${notificationResults.length} successful`
      );

      return {
        success: notificationResults.filter(r => r.success).length > 0,
        incidentId,
        results: notificationResults,
      };
    } catch (error) {
      logger.error(`[PreAlert] Error in sendPreAlert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Identify suitable hospitals based on patient condition and location
   * @param {Object} patientInfo - Patient information
   * @param {Array} estimatedHospitals - Pre-calculated hospital options
   * @returns {Promise<Array>} List of suitable hospitals
   */
  async identifyTargetHospitals(patientInfo, estimatedHospitals) {
    try {
      // Use estimated hospitals if provided
      if (estimatedHospitals && estimatedHospitals.length > 0) {
        return estimatedHospitals;
      }

      // Otherwise, query hospitals by capability
      const requiredSpecialities = this.determineRequiredSpecialities(patientInfo);

      const hospitals = await Hospital.findAll({
        where: {
          isActive: true,
          acceptingPatients: true,
        },
        include: [{
          association: 'specialities',
          where: { name: requiredSpecialities },
          required: true,
        }],
      });

      return hospitals;
    } catch (error) {
      logger.error(`[HospitalSelection] Error: ${error.message}`);
      return [];
    }
  }

  /**
   * Determine required specialities based on patient condition
   * @param {Object} patientInfo - Patient information
   * @returns {Array} List of required specialities
   */
  determineRequiredSpecialities(patientInfo) {
    const specialities = ['emergency'];

    const { condition, severity, age } = patientInfo;

    // Add specialities based on condition
    if (condition === 'trauma' || condition === 'accident') {
      specialities.push('trauma');
    }

    if (condition === 'cardiac' || condition === 'chest_pain') {
      specialities.push('cardiology');
    }

    if (condition === 'stroke' || condition === 'neurological') {
      specialities.push('neurology');
    }

    if (age < 18) {
      specialities.push('pediatrics');
    }

    if (severity === 'critical') {
      specialities.push('icu');
    }

    return [...new Set(specialities)];
  }

  /**
   * Send notification to a specific hospital
   * @param {Object} hospital - Hospital object
   * @param {Object} patientInfo - Patient information
   * @param {Object} ambulanceInfo - Ambulance information
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>} Notification result
   */
  async notifyHospital(hospital, patientInfo, ambulanceInfo, incidentId) {
    try {
      const notificationData = this.prepareNotificationData(
        hospital,
        patientInfo,
        ambulanceInfo,
        incidentId
      );

      const notificationMethods = [];

      // Send via available channels
      if (hospital.emailAddress) {
        notificationMethods.push(
          this.sendEmailAlert(hospital, notificationData)
        );
      }

      if (hospital.smsNumber) {
        notificationMethods.push(
          this.sendSmsAlert(hospital, notificationData)
        );
      }

      if (hospital.apiEndpoint) {
        notificationMethods.push(
          this.sendApiAlert(hospital, notificationData)
        );
      }

      const results = await Promise.allSettled(notificationMethods);

      const hasSuccess = results.some(r => r.status === 'fulfilled' && r.value);

      return {
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        success: hasSuccess,
        channels: results.map((r, i) => ({
          channel: ['email', 'sms', 'api'][i],
          sent: r.status === 'fulfilled' && r.value,
          timestamp: new Date(),
        })),
      };
    } catch (error) {
      logger.error(
        `[NotifyHospital] Error notifying ${hospital.id}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Prepare notification data with patient info, ETA, and handover instructions
   * @param {Object} hospital - Hospital object
   * @param {Object} patientInfo - Patient information
   * @param {Object} ambulanceInfo - Ambulance information
   * @param {String} incidentId - Incident ID
   * @returns {Object} Notification data
   */
  prepareNotificationData(hospital, patientInfo, ambulanceInfo, incidentId) {
    const eta = ambulanceInfo.estimatedArrivalTime || new Date(Date.now() + 15 * 60000);
    const etaMinutes = Math.round((eta - new Date()) / 60000);

    return {
      incidentId,
      hospitalId: hospital.id,
      timestamp: new Date(),
      eta: eta.toISOString(),
      etaMinutes,
      patient: {
        age: patientInfo.age,
        gender: patientInfo.gender,
        condition: patientInfo.condition,
        severity: patientInfo.severity,
        mainComplaint: patientInfo.mainComplaint,
        allergies: patientInfo.allergies,
        medicalHistory: patientInfo.medicalHistory,
      },
      ambulance: {
        number: ambulanceInfo.number,
        crewSize: ambulanceInfo.crewSize,
        type: ambulanceInfo.type,
      },
      handoverInstructions: this.generateHandoverInstructions(patientInfo),
      contactNumber: process.env.DISPATCH_CENTER_PHONE,
    };
  }

  /**
   * Generate specific handover instructions based on patient condition
   * @param {Object} patientInfo - Patient information
   * @returns {String} Handover instructions
   */
  generateHandoverInstructions(patientInfo) {
    const instructions = [];

    const { condition, severity } = patientInfo;

    instructions.push(`Severity Level: ${severity.toUpperCase()}`);

    if (severity === 'critical') {
      instructions.push('Activate emergency response team');
      instructions.push('Prepare ICU bed');
      instructions.push('Have crash cart ready');
    }

    if (condition === 'trauma' || condition === 'accident') {
      instructions.push('Prepare trauma bay');
      instructions.push('Notify orthopedics if fractures suspected');
    }

    if (condition === 'cardiac' || condition === 'chest_pain') {
      instructions.push('Prepare cardiac monitoring');
      instructions.push('Have ECG ready');
      instructions.push('Alert cardiology team');
    }

    if (condition === 'stroke' || condition === 'neurological') {
      instructions.push('Prepare for neuro assessment');
      instructions.push('Alert stroke team');
      instructions.push('Time note critical for treatment window');
    }

    return instructions.join('\n');
  }

  /**
   * Send email alert to hospital
   * @param {Object} hospital - Hospital object
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Boolean>} Success status
   */
  async sendEmailAlert(hospital, notificationData) {
    try {
      const emailContent = this.generateEmailContent(hospital, notificationData);

      const mailOptions = {
        to: hospital.emailAddress,
        subject: `[AMBULANCE PRE-ALERT] Incoming Patient - ETA ${notificationData.etaMinutes} min`,
        html: emailContent,
        priority: 'high',
      };

      await this.emailTransporter.sendMail(mailOptions);

      logger.info(
        `[EmailAlert] Sent to ${hospital.id} for incident ${notificationData.incidentId}`
      );

      return true;
    } catch (error) {
      logger.error(`[EmailAlert] Error sending to ${hospital.id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate formatted email content
   * @param {Object} hospital - Hospital object
   * @param {Object} notificationData - Notification data
   * @returns {String} HTML email content
   */
  generateEmailContent(hospital, notificationData) {
    const { patient, eta, etaMinutes, ambulance, incidentId, handoverInstructions } = notificationData;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; }
          .header { background: #d32f2f; color: white; padding: 15px; text-align: center; }
          .section { margin: 20px 0; padding: 15px; border-left: 4px solid #d32f2f; }
          .label { font-weight: bold; color: #333; }
          .alert { background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          .urgent { color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🚑 AMBULANCE PRE-ALERT</h2>
            <p class="urgent">Incoming Patient - ETA: ${etaMinutes} minutes</p>
          </div>

          <div class="section">
            <p class="label">Incident ID: ${incidentId}</p>
            <p class="label">Alert Time: ${new Date(notificationData.timestamp).toLocaleString()}</p>
          </div>

          <div class="section">
            <h3>👤 PATIENT INFORMATION</h3>
            <table>
              <tr>
                <td class="label">Age:</td>
                <td>${patient.age} years</td>
              </tr>
              <tr>
                <td class="label">Gender:</td>
                <td>${patient.gender}</td>
              </tr>
              <tr>
                <td class="label">Condition:</td>
                <td class="urgent">${patient.condition.toUpperCase()}</td>
              </tr>
              <tr>
                <td class="label">Severity:</td>
                <td class="urgent">${patient.severity.toUpperCase()}</td>
              </tr>
              <tr>
                <td class="label">Main Complaint:</td>
                <td>${patient.mainComplaint}</td>
              </tr>
              ${patient.allergies ? `<tr>
                <td class="label">Allergies:</td>
                <td class="alert">${patient.allergies}</td>
              </tr>` : ''}
              ${patient.medicalHistory ? `<tr>
                <td class="label">Medical History:</td>
                <td>${patient.medicalHistory}</td>
              </tr>` : ''}
            </table>
          </div>

          <div class="section">
            <h3>🚗 AMBULANCE DETAILS</h3>
            <table>
              <tr>
                <td class="label">Ambulance:</td>
                <td>${ambulance.number}</td>
              </tr>
              <tr>
                <td class="label">Type:</td>
                <td>${ambulance.type}</td>
              </tr>
              <tr>
                <td class="label">Crew Size:</td>
                <td>${ambulance.crewSize}</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <h3>📋 HANDOVER INSTRUCTIONS</h3>
            <div style="background: #f9f9f9; padding: 10px; border-radius: 4px; white-space: pre-wrap;">
${handoverInstructions}
            </div>
          </div>

          <div class="section" style="background: #e3f2fd; border-left: 4px solid #2196f3;">
            <p style="margin: 0;"><strong>For queries, contact dispatch center: ${notificationData.contactNumber}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send SMS alert to hospital
   * @param {Object} hospital - Hospital object
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Boolean>} Success status
   */
  async sendSmsAlert(hospital, notificationData) {
    try {
      const message = this.generateSmsContent(notificationData);

      if (this.smsProvider === 'twilio') {
        await this.sendTwilioSms(hospital.smsNumber, message);
      } else if (this.smsProvider === 'aws') {
        await this.sendAwsSms(hospital.smsNumber, message);
      }

      logger.info(
        `[SmsAlert] Sent to ${hospital.id} for incident ${notificationData.incidentId}`
      );

      return true;
    } catch (error) {
      logger.error(`[SmsAlert] Error sending to ${hospital.id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate SMS content (concise format)
   * @param {Object} notificationData - Notification data
   * @returns {String} SMS message
   */
  generateSmsContent(notificationData) {
    const { etaMinutes, patient, incidentId } = notificationData;
    return `AMBULANCE PRE-ALERT: ${patient.condition.toUpperCase()} patient, ${patient.severity.toUpperCase()}, ETA ${etaMinutes}min. Incident #${incidentId}. Age:${patient.age}, Gender:${patient.gender}.`;
  }

  /**
   * Send SMS via Twilio
   * @param {String} phoneNumber - Recipient phone number
   * @param {String} message - SMS message
   * @returns {Promise<Boolean>}
   */
  async sendTwilioSms(phoneNumber, message) {
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      return true;
    } catch (error) {
      logger.error(`[Twilio] SMS error: ${error.message}`);
      return false;
    }
  }

  /**
   * Send SMS via AWS SNS
   * @param {String} phoneNumber - Recipient phone number
   * @param {String} message - SMS message
   * @returns {Promise<Boolean>}
   */
  async sendAwsSms(phoneNumber, message) {
    try {
      const AWS = require('aws-sdk');
      const sns = new AWS.SNS();

      await sns
        .publish({
          Message: message,
          PhoneNumber: phoneNumber,
        })
        .promise();

      return true;
    } catch (error) {
      logger.error(`[AWS SNS] SMS error: ${error.message}`);
      return false;
    }
  }

  /**
   * Send API webhook alert to hospital
   * @param {Object} hospital - Hospital object
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Boolean>} Success status
   */
  async sendApiAlert(hospital, notificationData) {
    try {
      const response = await axios.post(hospital.apiEndpoint, notificationData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hospital.apiKey}`,
        },
      });

      logger.info(
        `[ApiAlert] Sent to ${hospital.id} for incident ${notificationData.incidentId}`
      );

      return response.status === 200 || response.status === 201;
    } catch (error) {
      logger.error(`[ApiAlert] Error sending to ${hospital.id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Log pre-alert in database
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @param {Object} result - Notification result
   * @returns {Promise<Object>}
   */
  async logPreAlert(incidentId, hospitalId, result) {
    try {
      return await PreAlert.create({
        incidentId,
        hospitalId,
        sentAt: new Date(),
        success: result.success,
        channels: JSON.stringify(result.channels),
        status: result.success ? 'sent' : 'failed',
      });
    } catch (error) {
      logger.error(`[LogPreAlert] Error logging: ${error.message}`);
    }
  }

  /**
   * Update hospital acceptance status
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @param {String} status - Acceptance status (accepted/rejected)
   * @returns {Promise<Object>}
   */
  async updateHospitalStatus(incidentId, hospitalId, status) {
    try {
      return await PreAlert.update(
        { hospitalStatus: status, statusUpdatedAt: new Date() },
        {
          where: { incidentId, hospitalId },
        }
      );
    } catch (error) {
      logger.error(`[UpdateStatus] Error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new HospitalNotifier();
