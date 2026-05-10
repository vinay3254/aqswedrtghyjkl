const { ValidationError } = require('../../api/utils/errors');
const { SEVERITY_LEVELS, INCIDENT_TYPES } = require('./model');

const validateIncidentCreation = (data) => {
  const errors = [];

  // Required fields
  if (!data.caller_phone || typeof data.caller_phone !== 'string') {
    errors.push({
      field: 'caller_phone',
      message: 'Caller phone number is required',
    });
  } else if (!/^\+?[1-9]\d{1,14}$/.test(data.caller_phone.replace(/[\s\-()]/g, ''))) {
    errors.push({
      field: 'caller_phone',
      message: 'Invalid phone number format',
    });
  }

  if (!data.location_lat || typeof data.location_lat !== 'number') {
    errors.push({
      field: 'location_lat',
      message: 'Location latitude is required and must be a number',
    });
  } else if (data.location_lat < -90 || data.location_lat > 90) {
    errors.push({
      field: 'location_lat',
      message: 'Latitude must be between -90 and 90',
    });
  }

  if (!data.location_lng || typeof data.location_lng !== 'number') {
    errors.push({
      field: 'location_lng',
      message: 'Location longitude is required and must be a number',
    });
  } else if (data.location_lng < -180 || data.location_lng > 180) {
    errors.push({
      field: 'location_lng',
      message: 'Longitude must be between -180 and 180',
    });
  }

  if (!data.location_address || typeof data.location_address !== 'string') {
    errors.push({
      field: 'location_address',
      message: 'Location address is required',
    });
  } else if (data.location_address.length < 5) {
    errors.push({
      field: 'location_address',
      message: 'Location address must be at least 5 characters',
    });
  }

  if (!data.severity || !Object.values(SEVERITY_LEVELS).includes(data.severity)) {
    errors.push({
      field: 'severity',
      message: `Severity must be one of: ${Object.values(SEVERITY_LEVELS).join(', ')}`,
    });
  }

  if (!data.incident_type || !Object.values(INCIDENT_TYPES).includes(data.incident_type)) {
    errors.push({
      field: 'incident_type',
      message: `Incident type must be one of: ${Object.values(INCIDENT_TYPES).join(', ')}`,
    });
  }

  if (!data.description || typeof data.description !== 'string') {
    errors.push({
      field: 'description',
      message: 'Description is required',
    });
  } else if (data.description.length < 10) {
    errors.push({
      field: 'description',
      message: 'Description must be at least 10 characters',
    });
  }

  // Optional fields validation
  if (data.patient_count !== undefined) {
    if (typeof data.patient_count !== 'number' || data.patient_count < 1 || data.patient_count > 100) {
      errors.push({
        field: 'patient_count',
        message: 'Patient count must be a number between 1 and 100',
      });
    }
  }

  if (data.caller_name !== undefined && typeof data.caller_name !== 'string') {
    errors.push({
      field: 'caller_name',
      message: 'Caller name must be a string',
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Incident validation failed', errors);
  }

  return true;
};

const validateStateTransition = (data) => {
  const errors = [];

  if (!data.status || typeof data.status !== 'string') {
    errors.push({
      field: 'status',
      message: 'Status is required',
    });
  }

  if (data.reason && typeof data.reason !== 'string') {
    errors.push({
      field: 'reason',
      message: 'Reason must be a string',
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('State transition validation failed', errors);
  }

  return true;
};

const validateSeverityUpdate = (data) => {
  const errors = [];

  if (!data.severity || !Object.values(SEVERITY_LEVELS).includes(data.severity)) {
    errors.push({
      field: 'severity',
      message: `Severity must be one of: ${Object.values(SEVERITY_LEVELS).join(', ')}`,
    });
  }

  if (data.reason && typeof data.reason !== 'string') {
    errors.push({
      field: 'reason',
      message: 'Reason must be a string',
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Severity update validation failed', errors);
  }

  return true;
};

const validateHospitalAssignment = (data) => {
  const errors = [];

  if (!data.hospital_id || typeof data.hospital_id !== 'string') {
    errors.push({
      field: 'hospital_id',
      message: 'Hospital ID is required',
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Hospital assignment validation failed', errors);
  }

  return true;
};

const sanitizeIncidentData = (data) => {
  const sanitized = {
    caller_name: data.caller_name?.trim() || null,
    caller_phone: data.caller_phone?.replace(/[\s\-()]/g, ''),
    location_lat: parseFloat(data.location_lat),
    location_lng: parseFloat(data.location_lng),
    location_address: data.location_address?.trim(),
    severity: data.severity?.toUpperCase(),
    incident_type: data.incident_type?.toUpperCase(),
    description: data.description?.trim(),
    patient_count: data.patient_count ? parseInt(data.patient_count, 10) : 1,
  };

  return sanitized;
};

const validateQueryParams = (params) => {
  const errors = [];

  if (params.page !== undefined) {
    const page = parseInt(params.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({
        field: 'page',
        message: 'Page must be a positive integer',
      });
    }
  }

  if (params.limit !== undefined) {
    const limit = parseInt(params.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({
        field: 'limit',
        message: 'Limit must be between 1 and 100',
      });
    }
  }

  if (params.severity && !Object.values(SEVERITY_LEVELS).includes(params.severity)) {
    errors.push({
      field: 'severity',
      message: `Severity must be one of: ${Object.values(SEVERITY_LEVELS).join(', ')}`,
    });
  }

  if (params.incident_type && !Object.values(INCIDENT_TYPES).includes(params.incident_type)) {
    errors.push({
      field: 'incident_type',
      message: `Incident type must be one of: ${Object.values(INCIDENT_TYPES).join(', ')}`,
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Query parameter validation failed', errors);
  }

  return true;
};

module.exports = {
  validateIncidentCreation,
  validateStateTransition,
  validateSeverityUpdate,
  validateHospitalAssignment,
  validateQueryParams,
  sanitizeIncidentData,
};
