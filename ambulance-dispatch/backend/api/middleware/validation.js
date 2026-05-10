const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    next(new ValidationError('Validation failed', extractedErrors));
  };
};

const incidentValidation = {
  create: [
    body('location.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude required'),
    body('location.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude required'),
    body('location.address')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 5, max: 500 }),
    body('severity')
      .isIn(['critical', 'high', 'medium', 'low'])
      .withMessage('Invalid severity level'),
    body('description')
      .isString()
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be 10-1000 characters'),
    body('patientInfo.name')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 }),
    body('patientInfo.age')
      .optional()
      .isInt({ min: 0, max: 150 }),
    body('patientInfo.gender')
      .optional()
      .isIn(['male', 'female', 'other']),
    body('contactNumber')
      .isMobilePhone()
      .withMessage('Valid phone number required'),
  ],
  
  updateStatus: [
    param('id').isUUID().withMessage('Valid incident ID required'),
    body('status')
      .isIn(['pending', 'dispatched', 'in_progress', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
    body('notes').optional().isString().trim().isLength({ max: 500 }),
  ],
};

const ambulanceValidation = {
  updateLocation: [
    param('id').isUUID().withMessage('Valid ambulance ID required'),
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude required'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude required'),
    body('heading').optional().isFloat({ min: 0, max: 360 }),
    body('speed').optional().isFloat({ min: 0 }),
  ],

  list: [
    query('status')
      .optional()
      .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
      .isIn(['AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'OFFLINE', 'BUSY', 'OUT_OF_SERVICE'])
      .withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  ],
};

const hospitalValidation = {
  nearby: [
    query('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude required'),
    query('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude required'),
    query('radius')
      .optional()
      .isFloat({ min: 0.1, max: 100 })
      .withMessage('Radius must be 0.1-100 km'),
    query('specialty').optional().isString().trim(),
  ],
};

const assignmentValidation = {
  create: [
    body('incidentId').isUUID().withMessage('Valid incident ID required'),
    body('ambulanceId').isUUID().withMessage('Valid ambulance ID required'),
    body('driverId').optional().isUUID(),
    body('paramedicIds').optional().isArray(),
    body('paramedicIds.*').optional().isUUID(),
    body('priority')
      .optional()
      .isIn(['emergency', 'urgent', 'normal'])
      .withMessage('Invalid priority'),
  ],
};

const authValidation = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('firstName').isString().trim().isLength({ min: 2, max: 50 }),
    body('lastName').isString().trim().isLength({ min: 2, max: 50 }),
    body('phoneNumber').isMobilePhone(),
    body('role')
      .optional()
      .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
      .isIn(['CITIZEN', 'DISPATCHER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN']),
  ],

  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password required'),
  ],
};

module.exports = {
  validate,
  incidentValidation,
  ambulanceValidation,
  hospitalValidation,
  assignmentValidation,
  authValidation,
};
