const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

const ALERT_TTL = 3600;
const ACKNOWLEDGMENT_TIMEOUT = 120; // 2 minutes

class AlertsManager {
  static async sendPreArrivalAlert(hospitalId, ambulanceData) {
    const alertId = uuidv4();
    const alert = {
      id: alertId,
      hospital_id: hospitalId,
      ambulance_id: ambulanceData.ambulance_id,
      patient_info: {
        severity: ambulanceData.severity,
        incident_type: ambulanceData.incident_type,
        vital_signs: ambulanceData.vital_signs,
        medical_history: ambulanceData.medical_history,
      },
      eta: ambulanceData.eta,
      required_preparation: this.getRequiredPreparation(ambulanceData),
      sent_at: new Date().toISOString(),
      acknowledged: false,
      acknowledgment_deadline: new Date(Date.now() + ACKNOWLEDGMENT_TIMEOUT * 1000).toISOString(),
      escalated: false,
    };

    await redis.setex(
      `alert:${alertId}`,
      ALERT_TTL,
      JSON.stringify(alert)
    );

    await redis.lpush(`hospital:${hospitalId}:alerts`, alertId);
    await redis.expire(`hospital:${hospitalId}:alerts`, ALERT_TTL);

    logger.info('Pre-arrival alert sent', {
      alertId,
      hospitalId,
      ambulanceId: ambulanceData.ambulance_id,
      severity: ambulanceData.severity,
      eta: ambulanceData.eta,
    });

    setTimeout(() => {
      this.checkAcknowledgment(alertId);
    }, ACKNOWLEDGMENT_TIMEOUT * 1000);

    return alert;
  }

  static getRequiredPreparation(ambulanceData) {
    const preparation = [];

    if (ambulanceData.severity === 'critical') {
      preparation.push('Prepare trauma bay');
      preparation.push('Alert trauma team');
    }

    if (ambulanceData.incident_type === 'CARDIAC') {
      preparation.push('Prepare cardiac catheterization lab');
      preparation.push('Alert cardiologist on call');
      preparation.push('Have defibrillator ready');
    }

    if (ambulanceData.incident_type === 'STROKE') {
      preparation.push('Prepare CT scan');
      preparation.push('Alert stroke team');
      preparation.push('Have tPA ready');
    }

    if (ambulanceData.incident_type === 'TRAUMA') {
      preparation.push('Prepare operating room');
      preparation.push('Alert trauma surgeon');
      preparation.push('Type and cross-match blood');
    }

    if (ambulanceData.vital_signs?.oxygen_saturation < 90) {
      preparation.push('Prepare oxygen and ventilator');
    }

    if (ambulanceData.vital_signs?.blood_pressure_systolic < 90) {
      preparation.push('Prepare IV fluids and vasopressors');
    }

    if (ambulanceData.requires_blood) {
      preparation.push(`Prepare ${ambulanceData.blood_type} blood units`);
    }

    if (preparation.length === 0) {
      preparation.push('Prepare general emergency bay');
    }

    return preparation;
  }

  static async acknowledgeAlert(alertId, staffId) {
    const alertData = await redis.get(`alert:${alertId}`);
    
    if (!alertData) {
      throw new Error('Alert not found or expired');
    }

    const alert = JSON.parse(alertData);
    
    if (alert.acknowledged) {
      return {
        success: false,
        message: 'Alert already acknowledged',
        alert,
      };
    }

    alert.acknowledged = true;
    alert.acknowledged_by = staffId;
    alert.acknowledged_at = new Date().toISOString();

    await redis.setex(
      `alert:${alertId}`,
      ALERT_TTL,
      JSON.stringify(alert)
    );

    logger.info('Alert acknowledged', {
      alertId,
      staffId,
      hospitalId: alert.hospital_id,
      timeTaken: new Date(alert.acknowledged_at) - new Date(alert.sent_at),
    });

    return {
      success: true,
      message: 'Alert acknowledged successfully',
      alert,
    };
  }

  static async checkAcknowledgment(alertId) {
    const alertData = await redis.get(`alert:${alertId}`);
    
    if (!alertData) {
      return;
    }

    const alert = JSON.parse(alertData);
    
    if (!alert.acknowledged && !alert.escalated) {
      await this.escalateAlert(alertId, alert);
    }
  }

  static async escalateAlert(alertId, alert) {
    alert.escalated = true;
    alert.escalated_at = new Date().toISOString();
    alert.escalation_reason = 'No acknowledgment within timeout period';

    await redis.setex(
      `alert:${alertId}`,
      ALERT_TTL,
      JSON.stringify(alert)
    );

    await redis.lpush(
      `hospital:${alert.hospital_id}:escalated_alerts`,
      alertId
    );

    logger.warn('Alert escalated due to no acknowledgment', {
      alertId,
      hospitalId: alert.hospital_id,
      ambulanceId: alert.ambulance_id,
      severity: alert.patient_info.severity,
    });

    return alert;
  }

  static async getHospitalAlerts(hospitalId, includeAcknowledged = false) {
    const alertIds = await redis.lrange(`hospital:${hospitalId}:alerts`, 0, -1);
    
    const alerts = [];
    for (const alertId of alertIds) {
      const alertData = await redis.get(`alert:${alertId}`);
      if (alertData) {
        const alert = JSON.parse(alertData);
        if (includeAcknowledged || !alert.acknowledged) {
          alerts.push(alert);
        }
      }
    }

    return alerts.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
  }

  static async getEscalatedAlerts(hospitalId) {
    const alertIds = await redis.lrange(`hospital:${hospitalId}:escalated_alerts`, 0, -1);
    
    const alerts = [];
    for (const alertId of alertIds) {
      const alertData = await redis.get(`alert:${alertId}`);
      if (alertData) {
        alerts.push(JSON.parse(alertData));
      }
    }

    return alerts.sort((a, b) => new Date(b.escalated_at) - new Date(a.escalated_at));
  }

  static async updateAmbulanceETA(alertId, newETA) {
    const alertData = await redis.get(`alert:${alertId}`);
    
    if (!alertData) {
      throw new Error('Alert not found or expired');
    }

    const alert = JSON.parse(alertData);
    alert.eta = newETA;
    alert.eta_updated_at = new Date().toISOString();

    await redis.setex(
      `alert:${alertId}`,
      ALERT_TTL,
      JSON.stringify(alert)
    );

    logger.info('Alert ETA updated', { alertId, newETA });

    return alert;
  }

  static async cancelAlert(alertId, reason) {
    const alertData = await redis.get(`alert:${alertId}`);
    
    if (!alertData) {
      throw new Error('Alert not found or expired');
    }

    const alert = JSON.parse(alertData);
    alert.cancelled = true;
    alert.cancelled_at = new Date().toISOString();
    alert.cancellation_reason = reason;

    await redis.setex(
      `alert:${alertId}`,
      ALERT_TTL,
      JSON.stringify(alert)
    );

    logger.info('Alert cancelled', { alertId, reason });

    return alert;
  }

  static async patientArrived(alertId) {
    const alertData = await redis.get(`alert:${alertId}`);
    
    if (!alertData) {
      throw new Error('Alert not found or expired');
    }

    const alert = JSON.parse(alertData);
    alert.patient_arrived = true;
    alert.arrival_time = new Date().toISOString();

    const expectedArrival = new Date(alert.sent_at).getTime() + (alert.eta * 60 * 1000);
    const actualArrival = new Date(alert.arrival_time).getTime();
    alert.arrival_variance = Math.round((actualArrival - expectedArrival) / 60000);

    await redis.setex(
      `alert:${alertId}`,
      ALERT_TTL,
      JSON.stringify(alert)
    );

    logger.info('Patient arrived', {
      alertId,
      hospitalId: alert.hospital_id,
      varianceMinutes: alert.arrival_variance,
    });

    return alert;
  }

  static async getAlertStatistics(hospitalId, timeRangeHours = 24) {
    const alerts = await this.getHospitalAlerts(hospitalId, true);
    const cutoffTime = new Date(Date.now() - timeRangeHours * 3600 * 1000);

    const recentAlerts = alerts.filter(alert => 
      new Date(alert.sent_at) > cutoffTime
    );

    const acknowledged = recentAlerts.filter(a => a.acknowledged).length;
    const escalated = recentAlerts.filter(a => a.escalated).length;
    const arrived = recentAlerts.filter(a => a.patient_arrived).length;

    const acknowledgmentTimes = recentAlerts
      .filter(a => a.acknowledged)
      .map(a => new Date(a.acknowledged_at) - new Date(a.sent_at));

    const avgAcknowledgmentTime = acknowledgmentTimes.length > 0
      ? Math.round(acknowledgmentTimes.reduce((a, b) => a + b, 0) / acknowledgmentTimes.length / 1000)
      : 0;

    return {
      total_alerts: recentAlerts.length,
      acknowledged,
      escalated,
      patient_arrived: arrived,
      acknowledgment_rate: recentAlerts.length > 0
        ? Math.round((acknowledged / recentAlerts.length) * 100)
        : 0,
      avg_acknowledgment_time_seconds: avgAcknowledgmentTime,
      time_range_hours: timeRangeHours,
    };
  }
}

module.exports = AlertsManager;
