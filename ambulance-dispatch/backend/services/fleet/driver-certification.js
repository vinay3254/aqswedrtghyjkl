/**
 * Driver Certification Service
 * Handles tracking of driver licenses, training certifications, and compliance
 */

const express = require('express');
const router = express.Router();
const { handleAsyncErrors } = require('../../utils/middleware');
const logger = require('../../utils/logger');

// In-memory storage (replace with database in production)
const driverCertifications = new Map();
const trainingRecords = new Map();
const licenseRecords = new Map();

// Standard certifications required for ambulance drivers
const REQUIRED_CERTIFICATIONS = [
  'EMT Basic',
  'CPR Certification',
  'First Aid Certification',
  'Ambulance Operator License',
  'Hazmat Training',
  'Patient Safety Training',
  'Infection Control Training',
  'Medical Records Handling'
];

/**
 * POST /drivers/:driverId/certification/start
 * Initiate driver certification process
 */
router.post(
  '/drivers/:driverId/certification/start',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;
    const { fullName, email, phone, licenseNumber, licenseClass } = req.body;

    if (!fullName || !email || !phone || !licenseNumber || !licenseClass) {
      return res.status(400).json({
        success: false,
        error: 'Missing required driver information'
      });
    }

    const certificationId = `CERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const certification = {
      certificationId,
      driverId,
      fullName,
      email,
      phone,
      licenseNumber,
      licenseClass,
      status: 'in_progress',
      startedAt: new Date(),
      licenses: {
        driverLicense: {
          number: licenseNumber,
          class: licenseClass,
          verified: false,
          expiryDate: null,
          verificationDate: null
        }
      },
      certifications: {},
      backgroundCheck: {
        status: 'pending',
        completedAt: null,
        result: null,
        notes: ''
      },
      medicalClearance: {
        status: 'pending',
        completedAt: null,
        result: null,
        notes: ''
      },
      trainingProgress: {},
      certificationHistory: []
    };

    // Initialize certifications
    REQUIRED_CERTIFICATIONS.forEach(cert => {
      certification.certifications[cert] = {
        status: 'not_started',
        completionDate: null,
        expiryDate: null,
        certificateNumber: null,
        provider: null,
        notes: ''
      };
      certification.trainingProgress[cert] = 0;
    });

    driverCertifications.set(certificationId, certification);

    logger.info(`Driver certification started: ${certificationId}`, {
      driverId,
      fullName,
      licenseNumber
    });

    res.status(201).json({
      success: true,
      message: 'Driver certification process initiated',
      data: {
        certificationId,
        driverId,
        status: certification.status,
        startedAt: certification.startedAt
      }
    });
  })
);

/**
 * POST /drivers/:driverId/license/verify
 * Verify driver license
 */
router.post(
  '/drivers/:driverId/license/verify',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;
    const { certificationId, licenseNumber, licenseClass, expiryDate, state } = req.body;

    if (!certificationId || !licenseNumber || !licenseClass || !expiryDate || !state) {
      return res.status(400).json({
        success: false,
        error: 'Missing required license information'
      });
    }

    const certification = driverCertifications.get(certificationId);
    if (!certification) {
      return res.status(404).json({
        success: false,
        error: 'Certification record not found'
      });
    }

    // Validate license expiry
    const expiryDateObj = new Date(expiryDate);
    if (expiryDateObj <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Driver license has expired'
      });
    }

    const licenseId = `LIC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const license = {
      licenseId,
      driverId,
      certificationId,
      licenseNumber,
      licenseClass,
      state,
      expiryDate: expiryDateObj,
      status: 'verified',
      verifiedAt: new Date()
    };

    licenseRecords.set(licenseId, license);

    // Update certification
    certification.licenses.driverLicense = {
      number: licenseNumber,
      class: licenseClass,
      state,
      verified: true,
      expiryDate: expiryDateObj,
      verificationDate: new Date(),
      licenseId
    };

    certification.certificationHistory.push({
      timestamp: new Date(),
      action: 'license_verified',
      details: { licenseNumber, state, expiryDate }
    });

    logger.info(`Driver license verified: ${licenseId}`, {
      driverId,
      licenseNumber,
      state
    });

    res.status(200).json({
      success: true,
      message: 'Driver license verified successfully',
      data: {
        licenseId,
        driverId,
        licenseNumber,
        status: license.status,
        expiryDate: license.expiryDate,
        verifiedAt: license.verifiedAt
      }
    });
  })
);

/**
 * POST /drivers/:driverId/certification/training
 * Add training certification
 */
router.post(
  '/drivers/:driverId/certification/training',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;
    const { certificationId, certificationName, provider, completionDate, expiryDate, certificateNumber } = req.body;

    if (!certificationId || !certificationName || !provider || !completionDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required training information'
      });
    }

    const certification = driverCertifications.get(certificationId);
    if (!certification) {
      return res.status(404).json({
        success: false,
        error: 'Certification record not found'
      });
    }

    // Validate certification type
    if (!REQUIRED_CERTIFICATIONS.includes(certificationName)) {
      return res.status(400).json({
        success: false,
        error: `${certificationName} is not a recognized certification type`
      });
    }

    // Check expiry date if provided
    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Certification has expired'
      });
    }

    const trainingId = `TRN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const training = {
      trainingId,
      driverId,
      certificationId,
      certificationName,
      provider,
      completionDate: new Date(completionDate),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      certificateNumber,
      status: 'completed',
      recordedAt: new Date()
    };

    trainingRecords.set(trainingId, training);

    // Update certification record
    certification.certifications[certificationName] = {
      status: 'completed',
      completionDate: new Date(completionDate),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      certificateNumber,
      provider,
      trainingId,
      notes: ''
    };

    certification.trainingProgress[certificationName] = 100;

    certification.certificationHistory.push({
      timestamp: new Date(),
      action: 'certification_added',
      details: { certificationName, provider, completionDate }
    });

    logger.info(`Training certification recorded: ${trainingId}`, {
      driverId,
      certificationName,
      provider
    });

    res.status(201).json({
      success: true,
      message: 'Training certification recorded successfully',
      data: {
        trainingId,
        driverId,
        certificationName,
        status: training.status,
        completionDate: training.completionDate,
        expiryDate: training.expiryDate
      }
    });
  })
);

/**
 * POST /drivers/:driverId/background-check
 * Submit for background check
 */
router.post(
  '/drivers/:driverId/background-check',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;
    const { certificationId, notes } = req.body;

    if (!certificationId) {
      return res.status(400).json({
        success: false,
        error: 'Certification ID is required'
      });
    }

    const certification = driverCertifications.get(certificationId);
    if (!certification) {
      return res.status(404).json({
        success: false,
        error: 'Certification record not found'
      });
    }

    // Update background check status
    certification.backgroundCheck = {
      status: 'in_progress',
      initiatedAt: new Date(),
      result: null,
      notes: notes || ''
    };

    certification.certificationHistory.push({
      timestamp: new Date(),
      action: 'background_check_initiated',
      details: { notes }
    });

    logger.info(`Background check initiated: ${certificationId}`, { driverId });

    res.status(200).json({
      success: true,
      message: 'Background check initiated successfully',
      data: {
        certificationId,
        driverId,
        status: certification.backgroundCheck.status,
        initiatedAt: certification.backgroundCheck.initiatedAt
      }
    });
  })
);

/**
 * POST /drivers/:driverId/medical-clearance
 * Submit for medical clearance
 */
router.post(
  '/drivers/:driverId/medical-clearance',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;
    const { certificationId, medicalFacility, notes } = req.body;

    if (!certificationId || !medicalFacility) {
      return res.status(400).json({
        success: false,
        error: 'Certification ID and medical facility are required'
      });
    }

    const certification = driverCertifications.get(certificationId);
    if (!certification) {
      return res.status(404).json({
        success: false,
        error: 'Certification record not found'
      });
    }

    // Update medical clearance status
    certification.medicalClearance = {
      status: 'in_progress',
      initiatedAt: new Date(),
      facility: medicalFacility,
      result: null,
      notes: notes || ''
    };

    certification.certificationHistory.push({
      timestamp: new Date(),
      action: 'medical_clearance_initiated',
      details: { medicalFacility, notes }
    });

    logger.info(`Medical clearance initiated: ${certificationId}`, { driverId, medicalFacility });

    res.status(200).json({
      success: true,
      message: 'Medical clearance initiated successfully',
      data: {
        certificationId,
        driverId,
        status: certification.medicalClearance.status,
        initiatedAt: certification.medicalClearance.initiatedAt
      }
    });
  })
);

/**
 * POST /drivers/:driverId/certification/complete
 * Complete driver certification
 */
router.post(
  '/drivers/:driverId/certification/complete',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;
    const { certificationId } = req.body;

    if (!certificationId) {
      return res.status(400).json({
        success: false,
        error: 'Certification ID is required'
      });
    }

    const certification = driverCertifications.get(certificationId);
    if (!certification) {
      return res.status(404).json({
        success: false,
        error: 'Certification record not found'
      });
    }

    // Check all required certifications are completed
    const allCertificationsComplete = REQUIRED_CERTIFICATIONS.every(
      cert => certification.certifications[cert].status === 'completed'
    );

    if (!allCertificationsComplete) {
      const missingCerts = REQUIRED_CERTIFICATIONS.filter(
        cert => certification.certifications[cert].status !== 'completed'
      );
      return res.status(400).json({
        success: false,
        error: 'All required certifications must be completed',
        missingCertifications: missingCerts
      });
    }

    // Check background check
    if (certification.backgroundCheck.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Background check must be approved before certification completion'
      });
    }

    // Check medical clearance
    if (certification.medicalClearance.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Medical clearance must be approved before certification completion'
      });
    }

    // Mark as certified
    certification.status = 'certified';
    certification.completedAt = new Date();

    certification.certificationHistory.push({
      timestamp: new Date(),
      action: 'certification_completed',
      details: { status: 'certified' }
    });

    logger.info(`Driver certification completed: ${certificationId}`, {
      driverId,
      status: 'certified'
    });

    res.status(200).json({
      success: true,
      message: 'Driver certification completed successfully',
      data: {
        certificationId,
        driverId,
        status: certification.status,
        completedAt: certification.completedAt
      }
    });
  })
);

/**
 * GET /drivers/:driverId/certification/:certificationId
 * Get driver certification details
 */
router.get(
  '/drivers/:driverId/certification/:certificationId',
  handleAsyncErrors(async (req, res) => {
    const { certificationId } = req.params;

    const certification = driverCertifications.get(certificationId);
    if (!certification) {
      return res.status(404).json({
        success: false,
        error: 'Certification record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: certification
    });
  })
);

/**
 * GET /drivers/:driverId/certifications
 * List all certifications for a driver
 */
router.get(
  '/drivers/:driverId/certifications',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;

    const driverCerts = Array.from(driverCertifications.values())
      .filter(cert => cert.driverId === driverId);

    if (driverCerts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No certifications found for this driver'
      });
    }

    res.status(200).json({
      success: true,
      data: driverCerts.map(cert => ({
        certificationId: cert.certificationId,
        fullName: cert.fullName,
        status: cert.status,
        startedAt: cert.startedAt,
        completedAt: cert.completedAt,
        certificationCount: Object.values(cert.certifications).filter(c => c.status === 'completed').length,
        requiredCount: REQUIRED_CERTIFICATIONS.length
      }))
    });
  })
);

/**
 * PUT /drivers/:driverId/background-check/approve
 * Approve background check
 */
router.put(
  '/drivers/:driverId/background-check/approve',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;
    const { certificationId, notes } = req.body;

    if (!certificationId) {
      return res.status(400).json({
        success: false,
        error: 'Certification ID is required'
      });
    }

    const certification = driverCertifications.get(certificationId);
    if (!certification) {
      return res.status(404).json({
        success: false,
        error: 'Certification record not found'
      });
    }

    certification.backgroundCheck = {
      status: 'approved',
      completedAt: new Date(),
      result: 'cleared',
      notes: notes || ''
    };

    certification.certificationHistory.push({
      timestamp: new Date(),
      action: 'background_check_approved',
      details: { notes }
    });

    logger.info(`Background check approved: ${certificationId}`, { driverId });

    res.status(200).json({
      success: true,
      message: 'Background check approved',
      data: {
        certificationId,
        backgroundCheckStatus: certification.backgroundCheck.status
      }
    });
  })
);

/**
 * PUT /drivers/:driverId/medical-clearance/approve
 * Approve medical clearance
 */
router.put(
  '/drivers/:driverId/medical-clearance/approve',
  handleAsyncErrors(async (req, res) => {
    const { driverId } = req.params;
    const { certificationId, notes } = req.body;

    if (!certificationId) {
      return res.status(400).json({
        success: false,
        error: 'Certification ID is required'
      });
    }

    const certification = driverCertifications.get(certificationId);
    if (!certification) {
      return res.status(404).json({
        success: false,
        error: 'Certification record not found'
      });
    }

    certification.medicalClearance = {
      status: 'approved',
      completedAt: new Date(),
      result: 'cleared',
      notes: notes || ''
    };

    certification.certificationHistory.push({
      timestamp: new Date(),
      action: 'medical_clearance_approved',
      details: { notes }
    });

    logger.info(`Medical clearance approved: ${certificationId}`, { driverId });

    res.status(200).json({
      success: true,
      message: 'Medical clearance approved',
      data: {
        certificationId,
        medicalClearanceStatus: certification.medicalClearance.status
      }
    });
  })
);

module.exports = router;
