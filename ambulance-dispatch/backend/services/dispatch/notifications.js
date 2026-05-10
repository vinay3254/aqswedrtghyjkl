const logger = require('../../api/utils/logger');

class NotificationService {
  static async notifyDriver(assignment, action = 'NEW_ASSIGNMENT') {
    logger.info('Driver notification (stub)', {
      assignment_id: assignment.id,
      ambulance_id: assignment.ambulance_id,
      driver_name: assignment.driver_name,
      driver_phone: assignment.driver_phone,
      action,
    });

    return {
      success: true,
      method: 'stub',
      message: 'Notification logged (real implementation pending)',
    };
  }

  static async notifyDispatcher(dispatcherId, notification) {
    logger.info('Dispatcher notification (stub)', {
      dispatcher_id: dispatcherId,
      type: notification.type,
      title: notification.title,
    });

    return {
      success: true,
      method: 'stub',
    };
  }

  static async sendPushNotification(userId, payload) {
    logger.info('Push notification (stub)', {
      user_id: userId,
      payload,
    });

    return { success: true };
  }

  static async sendSMS(phoneNumber, message) {
    logger.info('SMS notification (stub)', {
      phone: phoneNumber,
      message_preview: message.substring(0, 50),
    });

    return { success: true };
  }

  static formatAssignmentMessage(assignment) {
    return `New emergency assignment: ${assignment.incident_type} at ${assignment.incident_address}. Destination: ${assignment.hospital_name}. ETA: ${assignment.estimated_arrival_time} min. Accept within 60 seconds.`;
  }
}

module.exports = NotificationService;
