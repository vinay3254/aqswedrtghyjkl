/**
 * Radio Integration Service
 * 
 * Fallback to radio-based dispatch when digital systems fail.
 * Manages radio frequencies, call scripts, and voice communication logging.
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class RadioIntegrationService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.enabled = config.enabled !== false;
    this.enabledAt = null;
    this.primaryFrequency = config.primaryFrequency || '463.50'; // MHz
    this.backupFrequencies = config.backupFrequencies || ['464.00', '464.50'];
    this.systemCallSign = config.systemCallSign || 'DISPATCH-1';
    this.recordingEnabled = config.recordingEnabled !== false;
    this.autoTranscription = config.autoTranscription !== false;

    this.radioChannels = new Map();
    this.activeDispatches = new Map();
    this.radioLog = [];
    this.callScripts = this.initializeCallScripts();
    this.ambulanceCallSigns = new Map();
    this.frequencyStatus = new Map();

    // Initialize frequency status
    [this.primaryFrequency, ...this.backupFrequencies].forEach(freq => {
      this.frequencyStatus.set(freq, {
        frequency: freq,
        status: 'available',
        signalStrength: 0,
        lastCheck: null,
        failureCount: 0
      });
    });
  }

  /**
   * Initialize call scripts for common situations
   */
  initializeCallScripts() {
    return {
      unitDispatch: {
        template: 'Unit {{unitCallSign}}, respond Code {{code}} to {{location}} - {{addressDetails}}. {{additionalInfo}}',
        required: ['unitCallSign', 'code', 'location', 'addressDetails']
      },
      statusRequest: {
        template: 'All units, status check on {{unitCallSign}}. Advise current location and ETA to incident.',
        required: ['unitCallSign']
      },
      emergencyAlert: {
        template: 'EMERGENCY ALERT. Unit {{unitCallSign}} requesting immediate assistance. Last known location: {{location}}. All available units respond.',
        required: ['unitCallSign', 'location']
      },
      cannotReach: {
        template: 'Unable to establish contact with {{unitCallSign}}. Attempting on backup frequency.',
        required: ['unitCallSign']
      },
      frequencyChange: {
        template: 'All units, switch to frequency {{frequency}}. I say again, switch to {{frequency}}.',
        required: ['frequency']
      },
      sceneSecure: {
        template: 'Unit {{unitCallSign}}, on scene. Advise scene safety and patient condition.',
        required: ['unitCallSign']
      },
      eta: {
        template: 'Unit {{unitCallSign}}, report your current location and ETA to {{location}}.',
        required: ['unitCallSign', 'location']
      }
    };
  }

  /**
   * Register ambulance unit with call sign
   */
  registerAmbulanceUnit(ambulanceId, callSign, config = {}) {
    this.ambulanceCallSigns.set(ambulanceId, {
      callSign,
      primaryUnitId: config.primaryUnitId || ambulanceId,
      backupUnitId: config.backupUnitId || null,
      status: 'available',
      lastContact: null,
      frequency: config.frequency || this.primaryFrequency,
      registeredAt: new Date()
    });

    logger.info(`Ambulance unit registered: ${callSign} (${ambulanceId})`);
  }

  /**
   * Activate radio dispatch mode
   */
  activateRadioDispatch(reason = 'Digital systems unavailable') {
    if (this.enabled) {
      this.enabledAt = new Date();
      logger.warn('RADIO DISPATCH MODE ACTIVATED', { reason });

      this.logRadioEvent({
        type: 'MODE_ACTIVATED',
        reason,
        timestamp: new Date(),
        frequency: this.primaryFrequency
      });

      this.emit('radiodispatchActivated', {
        timestamp: this.enabledAt,
        frequency: this.primaryFrequency,
        reason
      });

      return {
        success: true,
        message: 'Radio dispatch mode activated',
        frequency: this.primaryFrequency,
        callSign: this.systemCallSign
      };
    }

    return {
      success: false,
      error: 'Radio integration disabled in configuration'
    };
  }

  /**
   * Deactivate radio dispatch mode
   */
  deactivateRadioDispatch() {
    const activeDuration = this.enabledAt ? Date.now() - this.enabledAt.getTime() : 0;
    
    this.enabledAt = null;

    logger.info('Radio dispatch mode deactivated', {
      activeDurationMs: activeDuration,
      dispatchesHandled: this.activeDispatches.size
    });

    this.logRadioEvent({
      type: 'MODE_DEACTIVATED',
      activeDurationMs: activeDuration,
      timestamp: new Date()
    });

    this.emit('radioDispatchDeactivated');

    return {
      success: true,
      activeDurationMs: activeDuration,
      dispatchesHandled: this.activeDispatches.size
    };
  }

  /**
   * Dispatch unit via radio
   */
  dispatchUnitByRadio(dispatchRequest) {
    const {
      incidentId,
      ambulanceId,
      location,
      addressDetails,
      incidentType,
      code = '1',
      priority = 'normal',
      additionalInfo = ''
    } = dispatchRequest;

    const unitRegistration = this.ambulanceCallSigns.get(ambulanceId);

    if (!unitRegistration) {
      return {
        success: false,
        error: 'Ambulance unit not registered',
        code: 'UNIT_NOT_FOUND'
      };
    }

    const radioDispatch = {
      dispatchId: this.generateDispatchId(),
      incidentId,
      ambulanceId,
      callSign: unitRegistration.callSign,
      location,
      addressDetails,
      incidentType,
      code,
      priority,
      additionalInfo,
      frequency: unitRegistration.frequency,
      initiatedAt: new Date(),
      status: 'transmitted',
      acknowledged: false,
      acknowledgementTime: null,
      callScript: this.buildCallScript('unitDispatch', {
        unitCallSign: unitRegistration.callSign,
        code,
        location,
        addressDetails,
        additionalInfo
      })
    };

    this.activeDispatches.set(radioDispatch.dispatchId, radioDispatch);

    logger.info(`Radio dispatch initiated: ${radioDispatch.dispatchId}`, {
      unit: unitRegistration.callSign,
      location,
      incidentType,
      frequency: radioDispatch.frequency
    });

    this.logRadioEvent({
      type: 'DISPATCH_INITIATED',
      dispatchId: radioDispatch.dispatchId,
      unit: unitRegistration.callSign,
      location,
      callScript: radioDispatch.callScript,
      timestamp: new Date()
    });

    this.emit('radioDispatchInitiated', {
      dispatchId: radioDispatch.dispatchId,
      callSign: unitRegistration.callSign,
      callScript: radioDispatch.callScript
    });

    return {
      success: true,
      dispatchId: radioDispatch.dispatchId,
      callScript: radioDispatch.callScript,
      frequency: radioDispatch.frequency,
      message: 'Dispatch transmitted via radio'
    };
  }

  /**
   * Record unit acknowledgement
   */
  acknowledgeDispatch(dispatchId, callSign) {
    const dispatch = this.activeDispatches.get(dispatchId);

    if (!dispatch) {
      return {
        success: false,
        error: 'Dispatch not found',
        code: 'DISPATCH_NOT_FOUND'
      };
    }

    const now = new Date();
    const responseTime = now.getTime() - dispatch.initiatedAt.getTime();

    dispatch.acknowledged = true;
    dispatch.acknowledgementTime = now;
    dispatch.status = 'acknowledged';

    logger.info(`Dispatch acknowledged: ${dispatchId}`, {
      unit: callSign,
      responseTimeMs: responseTime
    });

    this.logRadioEvent({
      type: 'DISPATCH_ACKNOWLEDGED',
      dispatchId,
      unit: callSign,
      responseTimeMs: responseTime,
      timestamp: now
    });

    this.emit('dispatchAcknowledged', {
      dispatchId,
      callSign,
      responseTimeMs: responseTime
    });

    return {
      success: true,
      dispatchId,
      responseTimeMs: responseTime
    };
  }

  /**
   * Request status update from unit
   */
  requestStatusUpdate(ambulanceId) {
    const unitRegistration = this.ambulanceCallSigns.get(ambulanceId);

    if (!unitRegistration) {
      return {
        success: false,
        error: 'Ambulance unit not registered'
      };
    }

    const statusRequest = {
      requestId: this.generateRequestId(),
      ambulanceId,
      callSign: unitRegistration.callSign,
      requestedAt: new Date(),
      status: 'sent',
      callScript: this.buildCallScript('statusRequest', {
        unitCallSign: unitRegistration.callSign
      })
    };

    logger.info(`Status update requested: ${statusRequest.requestId}`, {
      unit: unitRegistration.callSign
    });

    this.logRadioEvent({
      type: 'STATUS_REQUESTED',
      requestId: statusRequest.requestId,
      unit: unitRegistration.callSign,
      callScript: statusRequest.callScript,
      timestamp: new Date()
    });

    this.emit('statusUpdateRequested', {
      requestId: statusRequest.requestId,
      callScript: statusRequest.callScript
    });

    return {
      success: true,
      requestId: statusRequest.requestId,
      callScript: statusRequest.callScript
    };
  }

  /**
   * Handle incoming radio transmission
   */
  handleIncomingTransmission(transmission) {
    const {
      fromCallSign,
      message,
      frequency,
      signalStrength = 0,
      timestamp = new Date()
    } = transmission;

    const radioTransmission = {
      transmissionId: this.generateTransmissionId(),
      fromCallSign,
      message,
      frequency,
      signalStrength,
      timestamp,
      transcription: this.autoTranscription ? this.transcribeMessage(message) : null,
      interpreted: false,
      interpretation: null
    };

    logger.info(`Radio transmission received: ${radioTransmission.transmissionId}`, {
      from: fromCallSign,
      frequency,
      signalStrength
    });

    // Attempt to find associated dispatch
    const associatedDispatch = this.findAssociatedDispatch(fromCallSign);

    if (associatedDispatch) {
      radioTransmission.associatedDispatchId = associatedDispatch.dispatchId;
      this.interpretTransmission(radioTransmission, associatedDispatch);
    }

    this.logRadioEvent({
      type: 'TRANSMISSION_RECEIVED',
      transmissionId: radioTransmission.transmissionId,
      from: fromCallSign,
      frequency,
      signalStrength,
      message,
      timestamp
    });

    this.emit('transmissionReceived', {
      transmissionId: radioTransmission.transmissionId,
      fromCallSign,
      message,
      interpretation: radioTransmission.interpretation
    });

    return radioTransmission;
  }

  /**
   * Interpret incoming transmission
   */
  interpretTransmission(transmission, associatedDispatch) {
    const message = transmission.message.toLowerCase();

    let interpretation = {};

    // Scene safety indicators
    if (message.includes('on scene') || message.includes('arrived')) {
      interpretation.type = 'scene_arrival';
      interpretation.status = 'on_scene';
    } else if (message.includes('en route') || message.includes('responding')) {
      interpretation.type = 'unit_responding';
      interpretation.status = 'responding';
    } else if (message.includes('patient') && message.includes('condition')) {
      interpretation.type = 'patient_status';
    } else if (message.includes('transported') || message.includes('transport')) {
      interpretation.type = 'transport_initiated';
      interpretation.status = 'transporting';
    } else if (message.includes('standby') || message.includes('standby mode')) {
      interpretation.type = 'standby_mode';
      interpretation.status = 'standby';
    } else if (message.includes('emergency')) {
      interpretation.type = 'emergency_alert';
      interpretation.priority = 'critical';
    }

    if (Object.keys(interpretation).length > 0) {
      transmission.interpreted = true;
      transmission.interpretation = interpretation;
    }
  }

  /**
   * Find dispatch associated with call sign
   */
  findAssociatedDispatch(callSign) {
    for (const dispatch of this.activeDispatches.values()) {
      if (dispatch.callSign === callSign) {
        return dispatch;
      }
    }
    return null;
  }

  /**
   * Build call script from template
   */
  buildCallScript(scriptType, variables = {}) {
    const script = this.callScripts[scriptType];

    if (!script) {
      return '';
    }

    let output = script.template;

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      output = output.replace(new RegExp(placeholder, 'g'), value);
    });

    return output;
  }

  /**
   * Request frequency change
   */
  requestFrequencyChange(newFrequency) {
    const frequencyStatus = this.frequencyStatus.get(newFrequency);

    if (!frequencyStatus) {
      return {
        success: false,
        error: `Unknown frequency: ${newFrequency}`
      };
    }

    if (frequencyStatus.status !== 'available') {
      return {
        success: false,
        error: `Frequency ${newFrequency} is not available`,
        status: frequencyStatus.status
      };
    }

    const callScript = this.buildCallScript('frequencyChange', {
      frequency: newFrequency
    });

    logger.info(`Frequency change requested: ${newFrequency}`);

    this.logRadioEvent({
      type: 'FREQUENCY_CHANGE_REQUESTED',
      newFrequency,
      callScript,
      timestamp: new Date()
    });

    this.emit('frequencyChangeRequested', {
      frequency: newFrequency,
      callScript
    });

    return {
      success: true,
      frequency: newFrequency,
      callScript
    };
  }

  /**
   * Check frequency availability
   */
  checkFrequencyStatus() {
    const status = {};

    this.frequencyStatus.forEach((freq, key) => {
      status[key] = {
        ...freq,
        signalStrength: Math.round(Math.random() * 100) // Simulated
      };
    });

    return status;
  }

  /**
   * Report frequency problem
   */
  reportFrequencyProblem(frequency, problem) {
    const frequencyStatus = this.frequencyStatus.get(frequency);

    if (!frequencyStatus) {
      return { success: false, error: 'Unknown frequency' };
    }

    frequencyStatus.failureCount++;
    frequencyStatus.lastCheck = new Date();

    if (problem === 'interference' || problem === 'noSignal') {
      frequencyStatus.status = 'degraded';
    }

    logger.warn(`Frequency problem reported: ${frequency}`, {
      problem,
      failureCount: frequencyStatus.failureCount
    });

    this.logRadioEvent({
      type: 'FREQUENCY_PROBLEM',
      frequency,
      problem,
      timestamp: new Date()
    });

    return {
      success: true,
      frequency,
      status: frequencyStatus.status
    };
  }

  /**
   * Transcribe radio message (placeholder)
   */
  transcribeMessage(message) {
    // In production, this would use speech-to-text API
    return message;
  }

  /**
   * Get active dispatch status
   */
  getDispatchStatus(dispatchId) {
    return this.activeDispatches.get(dispatchId);
  }

  /**
   * Get all active radio dispatches
   */
  getActiveDispatches() {
    return Array.from(this.activeDispatches.values())
      .filter(d => d.status !== 'completed' && d.status !== 'cancelled');
  }

  /**
   * Complete dispatch
   */
  completeDispatch(dispatchId, completionNotes = '') {
    const dispatch = this.activeDispatches.get(dispatchId);

    if (!dispatch) {
      return { success: false, error: 'Dispatch not found' };
    }

    dispatch.status = 'completed';
    dispatch.completedAt = new Date();
    dispatch.completionNotes = completionNotes;

    logger.info(`Radio dispatch completed: ${dispatchId}`);

    this.logRadioEvent({
      type: 'DISPATCH_COMPLETED',
      dispatchId,
      completionNotes,
      timestamp: new Date()
    });

    return {
      success: true,
      dispatchId,
      duration: dispatch.completedAt - dispatch.initiatedAt
    };
  }

  /**
   * Get radio log for period
   */
  getRadioLog(startDate, endDate) {
    return this.radioLog.filter(event =>
      event.timestamp >= startDate && event.timestamp <= endDate
    );
  }

  /**
   * Log radio event
   */
  logRadioEvent(event) {
    this.radioLog.push({
      ...event,
      loggedAt: new Date()
    });

    // Keep only last 10000 events
    if (this.radioLog.length > 10000) {
      this.radioLog = this.radioLog.slice(-10000);
    }
  }

  /**
   * Generate IDs
   */
  generateDispatchId() {
    return `RAD-D-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRequestId() {
    return `RAD-R-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTransmissionId() {
    return `RAD-T-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown service
   */
  shutdown() {
    if (this.enabledAt) {
      this.deactivateRadioDispatch();
    }

    logger.info('Radio Integration Service shutdown', {
      activeDispatches: this.activeDispatches.size,
      registeredUnits: this.ambulanceCallSigns.size,
      logEvents: this.radioLog.length
    });
  }
}

module.exports = RadioIntegrationService;
