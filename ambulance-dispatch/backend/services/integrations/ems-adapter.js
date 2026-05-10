/**
 * EMS Adapter
 * Normalizes different government EMS API formats into a unified format
 * Supports: 108, 102, 1099, and other emergency service providers
 */

const logger = require('../../utils/logger');
const { ValidationError, AdapterError } = require('../../errors');

class EMSAdapter {
  constructor() {
    this.adapters = {
      '108': new Adapter108(),
      '102': new Adapter102(),
      '1099': new Adapter1099(),
      'default': new DefaultAdapter(),
    };
  }

  /**
   * Get adapter for a specific service code
   * @param {string} serviceCode - Service code (108, 102, 1099, etc.)
   * @returns {Object} Adapter instance
   */
  getAdapter(serviceCode) {
    const adapter = this.adapters[serviceCode] || this.adapters['default'];
    logger.debug('[EMSAdapter] Got adapter', { serviceCode, adapterName: adapter.name });
    return adapter;
  }

  /**
   * Normalize ambulance registration data from EMS format to internal format
   * @param {string} serviceCode - Service code
   * @param {Object} emsData - Data from EMS system
   * @returns {Object} Normalized ambulance data
   */
  normalizeAmbulanceRegistration(serviceCode, emsData) {
    const adapter = this.getAdapter(serviceCode);
    return adapter.normalizeAmbulanceRegistration(emsData);
  }

  /**
   * Normalize incident data from EMS format to internal format
   * @param {string} serviceCode - Service code
   * @param {Object} emsData - Data from EMS system
   * @returns {Object} Normalized incident data
   */
  normalizeIncident(serviceCode, emsData) {
    const adapter = this.getAdapter(serviceCode);
    return adapter.normalizeIncident(emsData);
  }

  /**
   * Normalize status data from EMS format to internal format
   * @param {string} serviceCode - Service code
   * @param {Object} emsData - Data from EMS system
   * @returns {Object} Normalized status data
   */
  normalizeStatus(serviceCode, emsData) {
    const adapter = this.getAdapter(serviceCode);
    return adapter.normalizeStatus(emsData);
  }

  /**
   * Convert internal format to EMS format for submission
   * @param {string} serviceCode - Service code
   * @param {Object} internalData - Data in internal format
   * @param {string} dataType - Type of data (ambulance, incident, status)
   * @returns {Object} Data in EMS format
   */
  convertToEMSFormat(serviceCode, internalData, dataType) {
    const adapter = this.getAdapter(serviceCode);
    const methodName = `convertTo${dataType.charAt(0).toUpperCase()}${dataType.slice(1)}`;
    
    if (typeof adapter[methodName] !== 'function') {
      throw new AdapterError(`Method ${methodName} not implemented for adapter`);
    }

    return adapter[methodName](internalData);
  }

  /**
   * Register a custom adapter
   * @param {string} serviceCode - Service code to register
   * @param {Object} adapter - Adapter instance
   */
  registerAdapter(serviceCode, adapter) {
    if (!adapter.normalizeAmbulanceRegistration || !adapter.normalizeIncident) {
      throw new ValidationError('Adapter must implement required methods');
    }
    this.adapters[serviceCode] = adapter;
    logger.info('[EMSAdapter] Registered custom adapter', { serviceCode });
  }
}

/**
 * Base Adapter class
 */
class BaseAdapter {
  constructor(name) {
    this.name = name;
  }

  normalizeAmbulanceRegistration(emsData) {
    return {
      ambulanceId: emsData.ambulanceId || emsData.id,
      name: emsData.ambulanceName || emsData.name,
      phone: emsData.contactNumber || emsData.phone,
      type: emsData.ambulanceType || 'Basic Life Support',
      latitude: emsData.location?.latitude || emsData.lat,
      longitude: emsData.location?.longitude || emsData.lng,
      status: this._normalizeStatus(emsData.status),
      registeredAt: new Date().toISOString(),
    };
  }

  normalizeIncident(emsData) {
    return {
      incidentId: emsData.incidentId || emsData.id,
      type: this._normalizeIncidentType(emsData.incidentType || emsData.type),
      severity: this._normalizeSeverity(emsData.severity || emsData.priority),
      address: emsData.address || emsData.location?.address,
      latitude: emsData.location?.latitude || emsData.lat,
      longitude: emsData.location?.longitude || emsData.lng,
      patientAge: emsData.patientAge || emsData.age,
      patientGender: emsData.patientGender || emsData.gender,
      condition: emsData.condition || emsData.medicalCondition,
      contactPhone: emsData.contactPhone || emsData.phone,
      timestamp: emsData.timestamp || new Date().toISOString(),
    };
  }

  normalizeStatus(emsData) {
    return {
      ambulanceId: emsData.ambulanceId || emsData.id,
      status: this._normalizeStatus(emsData.status),
      latitude: emsData.location?.latitude || emsData.lat,
      longitude: emsData.location?.longitude || emsData.lng,
      timestamp: emsData.timestamp || new Date().toISOString(),
      fuelLevel: emsData.fuelLevel || 100,
      equipmentStatus: emsData.equipmentStatus || 'operational',
    };
  }

  _normalizeStatus(status) {
    const statusMap = {
      'available': 'available',
      'free': 'available',
      'busy': 'busy',
      'occupied': 'busy',
      'maintenance': 'maintenance',
      'unavailable': 'unavailable',
    };
    return statusMap[status?.toLowerCase()] || 'unavailable';
  }

  _normalizeIncidentType(type) {
    const typeMap = {
      'medical': 'medical',
      'trauma': 'trauma',
      'accident': 'trauma',
      'cardiac': 'medical',
      'respiratory': 'medical',
      'psychiatric': 'psychiatric',
      'obstetric': 'obstetric',
      'pediatric': 'pediatric',
      'burn': 'trauma',
      'poisoning': 'medical',
    };
    return typeMap[type?.toLowerCase()] || 'medical';
  }

  _normalizeSeverity(severity) {
    const severityMap = {
      'critical': 'critical',
      '1': 'critical',
      'high': 'critical',
      'moderate': 'moderate',
      '2': 'moderate',
      'medium': 'moderate',
      'low': 'low',
      '3': 'low',
      'minor': 'low',
    };
    return severityMap[severity?.toString().toLowerCase()] || 'moderate';
  }

  convertToAmbulance(internalData) {
    return internalData;
  }

  convertToIncident(internalData) {
    return internalData;
  }

  convertToStatus(internalData) {
    return internalData;
  }
}

/**
 * Adapter for Service 108 (Pan-India Emergency Services)
 */
class Adapter108 extends BaseAdapter {
  constructor() {
    super('Adapter108');
  }

  normalizeAmbulanceRegistration(emsData) {
    const base = super.normalizeAmbulanceRegistration(emsData);
    return {
      ...base,
      operatorCode: emsData.operator_code,
      licenseNumber: emsData.license_number,
      insuranceProvider: emsData.insurance_provider,
    };
  }

  normalizeIncident(emsData) {
    const base = super.normalizeIncident(emsData);
    return {
      ...base,
      callerName: emsData.caller_name,
      callReceivedAt: emsData.call_received_time,
      dispatchedAt: emsData.dispatched_time,
    };
  }

  convertToIncident(internalData) {
    return {
      incident_id: internalData.incidentId,
      incident_type: internalData.type,
      severity: internalData.severity,
      location: {
        address: internalData.address,
        latitude: internalData.latitude,
        longitude: internalData.longitude,
      },
      patient: {
        age: internalData.patientAge,
        gender: internalData.patientGender,
      },
      contact_number: internalData.contactPhone,
      remarks: internalData.condition,
    };
  }
}

/**
 * Adapter for Service 102 (State Ambulance Service)
 */
class Adapter102 extends BaseAdapter {
  constructor() {
    super('Adapter102');
  }

  normalizeAmbulanceRegistration(emsData) {
    const base = super.normalizeAmbulanceRegistration(emsData);
    return {
      ...base,
      governmentAmbulanceId: emsData.govt_ambulance_id,
      stateCode: emsData.state_code,
      districtCode: emsData.district_code,
    };
  }

  normalizeIncident(emsData) {
    const base = super.normalizeIncident(emsData);
    return {
      ...base,
      refNumber: emsData.ref_number,
      priority: emsData.priority_level,
    };
  }

  convertToIncident(internalData) {
    return {
      ref_no: internalData.incidentId,
      category: internalData.type,
      priority: internalData.severity === 'critical' ? 'high' : 'normal',
      location_address: internalData.address,
      gps_coordinates: {
        lat: internalData.latitude,
        lng: internalData.longitude,
      },
      patient_details: {
        approximate_age: internalData.patientAge,
        gender: internalData.patientGender,
      },
      phone_number: internalData.contactPhone,
    };
  }
}

/**
 * Adapter for Service 1099 (State-specific Emergency Services)
 */
class Adapter1099 extends BaseAdapter {
  constructor() {
    super('Adapter1099');
  }

  normalizeAmbulanceRegistration(emsData) {
    const base = super.normalizeAmbulanceRegistration(emsData);
    return {
      ...base,
      stateServiceId: emsData.state_service_id,
      baseStation: emsData.base_station,
      zone: emsData.zone,
    };
  }

  normalizeIncident(emsData) {
    const base = super.normalizeIncident(emsData);
    return {
      ...base,
      ticketNumber: emsData.ticket_number,
      zone: emsData.zone,
    };
  }

  convertToIncident(internalData) {
    return {
      ticket_num: internalData.incidentId,
      incident_category: internalData.type,
      urgency_level: internalData.severity,
      incident_address: internalData.address,
      location: {
        latitude: internalData.latitude,
        longitude: internalData.longitude,
      },
      patient_info: {
        age_bracket: internalData.patientAge,
        sex: internalData.patientGender,
      },
      caller_phone: internalData.contactPhone,
    };
  }
}

/**
 * Default adapter for unknown services
 */
class DefaultAdapter extends BaseAdapter {
  constructor() {
    super('DefaultAdapter');
  }
}

module.exports = EMSAdapter;
