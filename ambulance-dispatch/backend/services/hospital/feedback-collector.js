/**
 * Feedback Collector Service
 * Collects feedback and ratings from patients and hospitals
 */

const logger = require('../../utils/logger');
const {
  PatientFeedback,
  HospitalFeedback,
  FeedbackQuestion,
  FeedbackResponse,
  Incident,
} = require('../../models');
const nodemailer = require('nodemailer');

class FeedbackCollector {
  constructor() {
    this.emailTransporter = this.initializeEmailTransport();
    this.feedbackQuestions = this.initializeFeedbackQuestions();
  }

  /**
   * Initialize email transport for feedback requests
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
   * Initialize feedback questions by type
   */
  initializeFeedbackQuestions() {
    return {
      patient: [
        {
          id: 'response_time',
          question: 'How would you rate the ambulance response time?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'crew_professionalism',
          question: 'How would you rate the professionalism of the ambulance crew?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'communication',
          question: 'Did the crew communicate clearly with you about your condition?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'comfort',
          question: 'How comfortable was the ambulance ride?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'pain_management',
          question: 'Was pain management adequate during transport?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'overall_experience',
          question: 'Overall, how would you rate your experience?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'additional_comments',
          question: 'Do you have any additional comments or suggestions?',
          type: 'text',
        },
      ],
      hospital: [
        {
          id: 'pre_alert_timing',
          question: 'Was the pre-alert notification timely?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'pre_alert_completeness',
          question: 'Was the patient information in the pre-alert complete and accurate?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'handover_process',
          question: 'How smooth was the handover process?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'crew_professionalism',
          question: 'How would you rate the ambulance crew\'s professionalism?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'documentation',
          question: 'Was the documentation complete and legible?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'response_effectiveness',
          question: 'How would you rate the ambulance service\'s response effectiveness?',
          type: 'rating',
          scale: 5,
        },
        {
          id: 'improvement_areas',
          question: 'What areas could be improved in future interactions?',
          type: 'text',
        },
      ],
    };
  }

  /**
   * Request feedback from patient
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>} Feedback request result
   */
  async requestPatientFeedback(incidentId) {
    try {
      logger.info(`[PatientFeedback] Requesting feedback for incident ${incidentId}`);

      const incident = await Incident.findByPk(incidentId, {
        include: ['patient'],
      });

      if (!incident || !incident.patient) {
        throw new Error('Incident or patient not found');
      }

      // Check if feedback already requested
      const existingRequest = await PatientFeedback.findOne({
        where: { incidentId },
      });

      if (existingRequest) {
        throw new Error('Feedback already requested for this incident');
      }

      // Create feedback record
      const feedbackRecord = await PatientFeedback.create({
        incidentId,
        patientId: incident.patient.id,
        feedbackToken: this.generateFeedbackToken(),
        requestedAt: new Date(),
        status: 'pending',
      });

      // Send feedback request email
      if (incident.patient.email) {
        await this.sendPatientFeedbackEmail(
          incident,
          feedbackRecord
        );
      }

      // Send feedback request SMS
      if (incident.patient.phoneNumber) {
        await this.sendPatientFeedbackSms(
          incident.patient.phoneNumber,
          feedbackRecord
        );
      }

      logger.info(
        `[PatientFeedback] Feedback request created: ${feedbackRecord.id}`
      );

      return {
        success: true,
        feedbackId: feedbackRecord.id,
        feedbackToken: feedbackRecord.feedbackToken,
        message: 'Feedback request sent to patient',
      };
    } catch (error) {
      logger.error(`[PatientFeedback] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Request feedback from hospital
   * @param {String} incidentId - Incident ID
   * @param {String} hospitalId - Hospital ID
   * @returns {Promise<Object>} Feedback request result
   */
  async requestHospitalFeedback(incidentId, hospitalId) {
    try {
      logger.info(
        `[HospitalFeedback] Requesting feedback for incident ${incidentId} from hospital ${hospitalId}`
      );

      const { Hospital } = require('../../models');
      const hospital = await Hospital.findByPk(hospitalId);

      if (!hospital) {
        throw new Error('Hospital not found');
      }

      // Check if feedback already requested
      const existingRequest = await HospitalFeedback.findOne({
        where: { incidentId, hospitalId },
      });

      if (existingRequest) {
        throw new Error('Feedback already requested from this hospital');
      }

      // Create feedback record
      const feedbackRecord = await HospitalFeedback.create({
        incidentId,
        hospitalId,
        feedbackToken: this.generateFeedbackToken(),
        requestedAt: new Date(),
        status: 'pending',
      });

      // Send feedback request email
      if (hospital.feedbackEmail || hospital.emailAddress) {
        await this.sendHospitalFeedbackEmail(
          hospital,
          incidentId,
          feedbackRecord
        );
      }

      logger.info(
        `[HospitalFeedback] Feedback request created: ${feedbackRecord.id}`
      );

      return {
        success: true,
        feedbackId: feedbackRecord.id,
        feedbackToken: feedbackRecord.feedbackToken,
        message: 'Feedback request sent to hospital',
      };
    } catch (error) {
      logger.error(`[HospitalFeedback] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit patient feedback
   * @param {String} feedbackToken - Feedback token
   * @param {Array} responses - Feedback responses
   * @returns {Promise<Object>}
   */
  async submitPatientFeedback(feedbackToken, responses) {
    try {
      logger.info(`[PatientFeedback] Submitting feedback with token: ${feedbackToken}`);

      // Verify token
      const feedbackRecord = await PatientFeedback.findOne({
        where: { feedbackToken },
      });

      if (!feedbackRecord) {
        throw new Error('Invalid feedback token');
      }

      if (feedbackRecord.status === 'completed') {
        throw new Error('Feedback already submitted');
      }

      // Calculate overall rating
      const ratingResponses = responses.filter(r => r.type === 'rating');
      const overallRating = ratingResponses.length > 0
        ? (ratingResponses.reduce((sum, r) => sum + r.value, 0) / ratingResponses.length)
        : null;

      // Save responses
      for (const response of responses) {
        await FeedbackResponse.create({
          feedbackId: feedbackRecord.id,
          feedbackType: 'patient',
          questionId: response.questionId,
          response: response.type === 'rating' ? response.value : response.text,
          responseType: response.type,
        });
      }

      // Update feedback record
      await feedbackRecord.update({
        status: 'completed',
        submittedAt: new Date(),
        overallRating,
      });

      // Store sentiment analysis
      await this.analyzeFeedbackSentiment(feedbackRecord, responses);

      logger.info(`[PatientFeedback] Feedback submitted: ${feedbackRecord.id}`);

      return {
        success: true,
        feedbackId: feedbackRecord.id,
        overallRating,
        message: 'Thank you for your feedback!',
      };
    } catch (error) {
      logger.error(`[PatientFeedback] Error submitting feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit hospital feedback
   * @param {String} feedbackToken - Feedback token
   * @param {Array} responses - Feedback responses
   * @returns {Promise<Object>}
   */
  async submitHospitalFeedback(feedbackToken, responses) {
    try {
      logger.info(`[HospitalFeedback] Submitting feedback with token: ${feedbackToken}`);

      // Verify token
      const feedbackRecord = await HospitalFeedback.findOne({
        where: { feedbackToken },
      });

      if (!feedbackRecord) {
        throw new Error('Invalid feedback token');
      }

      if (feedbackRecord.status === 'completed') {
        throw new Error('Feedback already submitted');
      }

      // Calculate overall rating
      const ratingResponses = responses.filter(r => r.type === 'rating');
      const overallRating = ratingResponses.length > 0
        ? (ratingResponses.reduce((sum, r) => sum + r.value, 0) / ratingResponses.length)
        : null;

      // Save responses
      for (const response of responses) {
        await FeedbackResponse.create({
          feedbackId: feedbackRecord.id,
          feedbackType: 'hospital',
          questionId: response.questionId,
          response: response.type === 'rating' ? response.value : response.text,
          responseType: response.type,
        });
      }

      // Update feedback record
      await feedbackRecord.update({
        status: 'completed',
        submittedAt: new Date(),
        overallRating,
      });

      // Update hospital metrics
      await this.updateHospitalMetrics(feedbackRecord.hospitalId, overallRating);

      logger.info(`[HospitalFeedback] Feedback submitted: ${feedbackRecord.id}`);

      return {
        success: true,
        feedbackId: feedbackRecord.id,
        overallRating,
        message: 'Thank you for your feedback!',
      };
    } catch (error) {
      logger.error(`[HospitalFeedback] Error submitting feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get feedback questions by type
   * @param {String} feedbackType - Type of feedback (patient/hospital)
   * @returns {Array} Feedback questions
   */
  getFeedbackQuestions(feedbackType) {
    return this.feedbackQuestions[feedbackType] || [];
  }

  /**
   * Send patient feedback request email
   * @param {Object} incident - Incident record
   * @param {Object} feedbackRecord - Feedback record
   * @returns {Promise<Boolean>}
   */
  async sendPatientFeedbackEmail(incident, feedbackRecord) {
    try {
      const feedbackUrl = `${process.env.PATIENT_FEEDBACK_URL}/${feedbackRecord.feedbackToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; }
            .header { background: #2196f3; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { display: inline-block; background: #2196f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>We Value Your Feedback</h2>
            </div>
            <div class="content">
              <p>Dear ${incident.patient.firstName},</p>
              <p>Thank you for using our ambulance service. We would appreciate your feedback about your experience.</p>
              <p>Your feedback helps us improve our services and provide better care to you and other patients.</p>
              <p>Please take 5 minutes to answer a few questions about your experience:</p>
              <center>
                <a href="${feedbackUrl}" class="button">Complete Feedback Survey</a>
              </center>
              <p style="color: #666; font-size: 12px;">If the button above doesn't work, copy and paste this link in your browser:<br>${feedbackUrl}</p>
              <p>The survey is confidential and will be used only for quality improvement purposes.</p>
              <p>Thank you,<br>Emergency Services Team</p>
            </div>
            <div class="footer">
              <p>Incident ID: ${incident.id}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.emailTransporter.sendMail({
        to: incident.patient.email,
        subject: 'We Would Like Your Feedback - Emergency Services',
        html: htmlContent,
      });

      logger.info(`[PatientEmail] Feedback request sent to ${incident.patient.email}`);
      return true;
    } catch (error) {
      logger.error(`[PatientEmail] Error sending email: ${error.message}`);
      return false;
    }
  }

  /**
   * Send patient feedback request SMS
   * @param {String} phoneNumber - Patient phone number
   * @param {Object} feedbackRecord - Feedback record
   * @returns {Promise<Boolean>}
   */
  async sendPatientFeedbackSms(phoneNumber, feedbackRecord) {
    try {
      const feedbackUrl = `${process.env.PATIENT_FEEDBACK_URL}/${feedbackRecord.feedbackToken}`;
      const message = `Thank you for using our ambulance service. Please share your feedback: ${feedbackUrl}`;

      // Send via Twilio or SMS provider
      const twilio = require('twilio');
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      logger.info(`[PatientSms] Feedback request sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`[PatientSms] Error sending SMS: ${error.message}`);
      return false;
    }
  }

  /**
   * Send hospital feedback request email
   * @param {Object} hospital - Hospital record
   * @param {String} incidentId - Incident ID
   * @param {Object} feedbackRecord - Feedback record
   * @returns {Promise<Boolean>}
   */
  async sendHospitalFeedbackEmail(hospital, incidentId, feedbackRecord) {
    try {
      const feedbackUrl = `${process.env.HOSPITAL_FEEDBACK_URL}/${feedbackRecord.feedbackToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; }
            .header { background: #d32f2f; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { display: inline-block; background: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Ambulance Service Feedback</h2>
            </div>
            <div class="content">
              <p>Dear ${hospital.name} Team,</p>
              <p>We would like to gather your feedback regarding the ambulance service interaction for incident ID: <strong>${incidentId}</strong></p>
              <p>Your feedback is valuable to us and helps us maintain the highest standards of emergency response coordination.</p>
              <p>Please take 5 minutes to answer a few questions:</p>
              <center>
                <a href="${feedbackUrl}" class="button">Provide Feedback</a>
              </center>
              <p style="color: #666; font-size: 12px;">If the button above doesn't work, copy and paste this link:<br>${feedbackUrl}</p>
              <p>Thank you for your partnership in providing excellent emergency care.</p>
              <p>Best regards,<br>Emergency Dispatch Team</p>
            </div>
            <div class="footer">
              <p>Incident ID: ${incidentId}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailAddress = hospital.feedbackEmail || hospital.emailAddress;

      await this.emailTransporter.sendMail({
        to: emailAddress,
        subject: `Feedback Request - Incident ${incidentId}`,
        html: htmlContent,
      });

      logger.info(`[HospitalEmail] Feedback request sent to ${emailAddress}`);
      return true;
    } catch (error) {
      logger.error(`[HospitalEmail] Error sending email: ${error.message}`);
      return false;
    }
  }

  /**
   * Get feedback summary for incident
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>}
   */
  async getFeedbackSummary(incidentId) {
    try {
      const patientFeedback = await PatientFeedback.findOne({
        where: { incidentId },
        include: [{
          association: 'responses',
          separate: true,
        }],
      });

      const hospitalFeedback = await HospitalFeedback.findAll({
        where: { incidentId },
        include: [{
          association: 'responses',
          separate: true,
        }],
      });

      return {
        incidentId,
        patientFeedback: patientFeedback ? {
          id: patientFeedback.id,
          status: patientFeedback.status,
          overallRating: patientFeedback.overallRating,
          responses: patientFeedback.responses,
          submittedAt: patientFeedback.submittedAt,
        } : null,
        hospitalFeedback: hospitalFeedback.map(hf => ({
          id: hf.id,
          hospitalId: hf.hospitalId,
          status: hf.status,
          overallRating: hf.overallRating,
          responses: hf.responses,
          submittedAt: hf.submittedAt,
        })),
      };
    } catch (error) {
      logger.error(`[GetSummary] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze feedback sentiment
   * @param {Object} feedbackRecord - Feedback record
   * @param {Array} responses - Feedback responses
   * @returns {Promise<Object>}
   */
  async analyzeFeedbackSentiment(feedbackRecord, responses) {
    try {
      // Simple sentiment analysis based on ratings
      const textResponses = responses
        .filter(r => r.type === 'text')
        .map(r => r.text || '')
        .join(' ');

      const sentiment = this.extractSentiment(textResponses);

      // Could integrate with more sophisticated NLP service
      logger.info(
        `[Sentiment] Analyzed feedback ${feedbackRecord.id}: ${sentiment}`
      );

      return sentiment;
    } catch (error) {
      logger.error(`[Sentiment] Error: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract basic sentiment from text
   * @param {String} text - Text to analyze
   * @returns {String} Sentiment (positive/neutral/negative)
   */
  extractSentiment(text) {
    const text_lower = text.toLowerCase();

    const positiveWords = [
      'excellent', 'great', 'good', 'amazing', 'wonderful',
      'helpful', 'professional', 'quick', 'efficient', 'satisfied'
    ];
    const negativeWords = [
      'poor', 'bad', 'terrible', 'awful', 'slow',
      'unprofessional', 'rude', 'unhelpful', 'dissatisfied'
    ];

    const positiveCount = positiveWords.filter(w => text_lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text_lower.includes(w)).length;

    if (positiveCount > negativeCount) {
      return 'positive';
    } else if (negativeCount > positiveCount) {
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  /**
   * Update hospital performance metrics based on feedback
   * @param {String} hospitalId - Hospital ID
   * @param {Number} rating - Overall rating
   * @returns {Promise<void>}
   */
  async updateHospitalMetrics(hospitalId, rating) {
    try {
      const { Hospital, HospitalMetric } = require('../../models');

      // Create or update metric record
      await HospitalMetric.create({
        hospitalId,
        metricType: 'feedback_rating',
        value: rating,
        recordedAt: new Date(),
      });

      // Update hospital average rating
      const metrics = await HospitalMetric.findAll({
        where: { hospitalId, metricType: 'feedback_rating' },
        raw: true,
      });

      const avgRating = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;

      await Hospital.update(
        { averageFeedbackRating: avgRating },
        { where: { id: hospitalId } }
      );

      logger.info(
        `[Metrics] Updated hospital ${hospitalId} average rating to ${avgRating.toFixed(2)}`
      );
    } catch (error) {
      logger.error(`[Metrics] Error: ${error.message}`);
    }
  }

  /**
   * Generate feedback token
   * @returns {String} Unique feedback token
   */
  generateFeedbackToken() {
    return `fb_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get feedback analytics
   * @param {Object} filters - Filter criteria (hospitalId, dateRange, etc.)
   * @returns {Promise<Object>}
   */
  async getFeedbackAnalytics(filters = {}) {
    try {
      const { hospitalId, startDate, endDate } = filters;

      let whereClause = {};
      if (startDate || endDate) {
        whereClause.submittedAt = {};
        if (startDate) whereClause.submittedAt[require('sequelize').Op.gte] = startDate;
        if (endDate) whereClause.submittedAt[require('sequelize').Op.lte] = endDate;
      }

      // Get hospital feedback analytics
      let hospitalFeedback = await HospitalFeedback.findAll({
        where: hospitalId ? { hospitalId, ...whereClause } : whereClause,
        attributes: [
          'hospitalId',
          [require('sequelize').fn('AVG', require('sequelize').col('overallRating')), 'avgRating'],
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'totalFeedbacks'],
        ],
        group: ['hospitalId'],
        raw: true,
      });

      // Get patient feedback analytics
      const patientFeedback = await PatientFeedback.findAll({
        where: whereClause,
        attributes: [
          [require('sequelize').fn('AVG', require('sequelize').col('overallRating')), 'avgRating'],
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'totalFeedbacks'],
        ],
        raw: true,
      });

      return {
        period: { startDate, endDate },
        patientFeedback: patientFeedback[0] || { avgRating: 0, totalFeedbacks: 0 },
        hospitalFeedback: hospitalFeedback.map(hf => ({
          hospitalId: hf.hospitalId,
          avgRating: parseFloat(hf.avgRating || 0).toFixed(2),
          totalFeedbacks: hf.totalFeedbacks,
        })),
      };
    } catch (error) {
      logger.error(`[Analytics] Error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new FeedbackCollector();
