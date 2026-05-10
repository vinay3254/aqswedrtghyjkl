/**
 * Escalation Rules Engine
 * Determines when to trigger mutual aid requests and escalation protocols
 */

class EscalationRules {
  constructor(config = {}) {
    this.config = {
      localUnitThreshold: config.localUnitThreshold || 0.85, // 85% of units busy
      mciDeclarationThreshold: config.mciDeclarationThreshold || 3, // 3+ patients from single incident
      responseTimeThreshold: config.responseTimeThreshold || 15, // minutes
      escalationLevels: config.escalationLevels || ['LOCAL', 'DISTRICT', 'REGIONAL', 'MUTUAL_AID'],
      ...config,
    };

    this.escalationHistory = [];
    this.activeAlerts = new Map();
  }

  /**
   * Check if local resources are overwhelmed
   * @param {Object} resourceStatus - Current resource availability
   * @returns {boolean}
   */
  isLocalCapacityExceeded(resourceStatus) {
    const { totalUnits, availableUnits } = resourceStatus;
    
    if (!totalUnits || totalUnits === 0) {
      return false;
    }

    const utilization = (totalUnits - availableUnits) / totalUnits;
    return utilization >= this.config.localUnitThreshold;
  }

  /**
   * Check if mass casualty incident (MCI) criteria met
   * @param {Object} incident - Incident details
   * @returns {boolean}
   */
  isMassCasualtyIncident(incident) {
    const { patientCount = 0, severity = 'MINOR' } = incident;
    
    // MCI if 3+ patients OR severity is CATASTROPHIC
    if (severity === 'CATASTROPHIC') {
      return true;
    }

    return patientCount >= this.config.mciDeclarationThreshold;
  }

  /**
   * Determine escalation level based on multiple factors
   * @param {Object} incidentData - Current incident and resource data
   * @returns {Object} Escalation recommendation
   */
  determineEscalationLevel(incidentData) {
    const {
      resourceStatus,
      incident,
      averageResponseTime,
      pendingDispatches,
    } = incidentData;

    const escalation = {
      level: 'LOCAL',
      factors: [],
      timestamp: new Date(),
      recommended: false,
    };

    // Factor 1: Check local capacity
    if (this.isLocalCapacityExceeded(resourceStatus)) {
      escalation.factors.push({
        type: 'LOCAL_CAPACITY_EXCEEDED',
        utilization: ((resourceStatus.totalUnits - resourceStatus.availableUnits) / resourceStatus.totalUnits),
      });
    }

    // Factor 2: Check for MCI
    if (this.isMassCasualtyIncident(incident)) {
      escalation.factors.push({
        type: 'MCI_DECLARED',
        patientCount: incident.patientCount,
        severity: incident.severity,
      });
      escalation.level = 'DISTRICT';
      escalation.recommended = true;
    }

    // Factor 3: Response time degradation
    if (averageResponseTime > this.config.responseTimeThreshold) {
      escalation.factors.push({
        type: 'RESPONSE_TIME_DEGRADATION',
        currentTime: averageResponseTime,
        threshold: this.config.responseTimeThreshold,
      });
    }

    // Factor 4: Excessive pending dispatches
    const pendingRatio = pendingDispatches / (resourceStatus.availableUnits || 1);
    if (pendingRatio > 2) {
      escalation.factors.push({
        type: 'HIGH_DISPATCH_QUEUE',
        pendingDispatches,
        ratio: pendingRatio,
      });
    }

    // Calculate escalation level based on factors
    if (escalation.factors.length >= 3) {
      escalation.level = 'REGIONAL';
      escalation.recommended = true;
    } else if (escalation.factors.length >= 2) {
      escalation.level = 'DISTRICT';
      escalation.recommended = true;
    } else if (escalation.factors.length >= 1) {
      escalation.level = 'DISTRICT';
      escalation.recommended = false;
    }

    // Store history
    this.escalationHistory.push(escalation);
    if (this.escalationHistory.length > 1000) {
      this.escalationHistory = this.escalationHistory.slice(-1000);
    }

    return escalation;
  }

  /**
   * Check if escalation criteria triggered
   * @param {Object} incidentData - Incident and resource data
   * @returns {boolean}
   */
  shouldEscalate(incidentData) {
    const escalation = this.determineEscalationLevel(incidentData);
    return escalation.recommended || escalation.factors.length > 0;
  }

  /**
   * Get next escalation level
   * @param {string} currentLevel - Current escalation level
   * @returns {string|null} Next level or null if at max
   */
  getNextEscalationLevel(currentLevel) {
    const currentIndex = this.config.escalationLevels.indexOf(currentLevel);
    if (currentIndex === -1 || currentIndex === this.config.escalationLevels.length - 1) {
      return null;
    }
    return this.config.escalationLevels[currentIndex + 1];
  }

  /**
   * Create escalation alert
   * @param {string} incidentId - Incident identifier
   * @param {Object} escalationData - Escalation details
   * @returns {string} Alert ID
   */
  createEscalationAlert(incidentId, escalationData) {
    const alertId = `ALERT-${incidentId}-${Date.now()}`;
    
    this.activeAlerts.set(alertId, {
      incidentId,
      createdAt: new Date(),
      escalationData,
      status: 'ACTIVE',
      responses: [],
    });

    return alertId;
  }

  /**
   * Get active escalation alerts
   * @returns {Array}
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values()).filter(
      (alert) => alert.status === 'ACTIVE'
    );
  }

  /**
   * Close escalation alert
   * @param {string} alertId - Alert identifier
   * @param {string} reason - Closure reason
   */
  closeAlert(alertId, reason = 'RESOLVED') {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'CLOSED';
      alert.closedAt = new Date();
      alert.closeReason = reason;
    }
  }

  /**
   * Get escalation history for incident
   * @param {string} incidentId - Incident identifier
   * @returns {Array}
   */
  getEscalationHistory(incidentId) {
    return this.escalationHistory.filter((esc) =>
      esc.incidentId === incidentId
    );
  }

  /**
   * Reset escalation state
   */
  reset() {
    this.escalationHistory = [];
    this.activeAlerts.clear();
  }
}

module.exports = EscalationRules;
