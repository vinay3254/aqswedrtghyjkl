/**
 * Vehicle Verification Service
 * Handles verification of vehicle documents, insurance, and equipment checklist
 */

const express = require('express');
const router = express.Router();
const { handleAsyncErrors } = require('../../utils/middleware');
const logger = require('../../utils/logger');

// In-memory storage (replace with database in production)
const vehicleVerifications = new Map();
const insuranceRecords = new Map();
const equipmentChecklists = new Map();

// Standard ambulance equipment requirements
const REQUIRED_EQUIPMENT = [
  'Stretcher',
  'Cardiac Monitor',
  'Defibrillator (AED)',
  'Oxygen Supply',
  'Suction Equipment',
  'Airway Management Kit',
  'IV Administration Supplies',
  'Trauma Kit',
  'Medications Kit',
  'First Aid Kit',
  'Spinal Immobilization Equipment',
  'Communication Equipment',
  'Safety Equipment (Reflective Vests, Gloves)',
  'Vehicle Emergency Lights',
  'Siren'
];

/**
 * POST /vehicles/:vehicleId/verification/start
 * Initiate vehicle verification process
 */
router.post(
  '/vehicles/:vehicleId/verification/start',
  handleAsyncErrors(async (req, res) => {
    const { vehicleId } = req.params;
    const { licensePlate, vin, year, make, model, type } = req.body;

    if (!licensePlate || !vin || !year || !make || !model || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required vehicle information'
      });
    }

    const verificationId = `VER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const verification = {
      verificationId,
      vehicleId,
      licensePlate,
      vin,
      year,
      make,
      model,
      type,
      status: 'in_progress',
      startedAt: new Date(),
      documents: {
        registrationCertificate: { submitted: false, verified: false, expiryDate: null },
        insuranceCertificate: { submitted: false, verified: false, expiryDate: null },
        inspectionCertificate: { submitted: false, verified: false, expiryDate: null },
        safetyCompliance: { submitted: false, verified: false, expiryDate: null }
      },
      checks: {
        mechanicalCondition: { status: 'pending', notes: '' },
        safetyFeatures: { status: 'pending', notes: '' },
        brakes: { status: 'pending', notes: '' },
        tires: { status: 'pending', notes: '' },
        lighting: { status: 'pending', notes: '' },
        emergencyEquipment: { status: 'pending', notes: '' }
      },
      equipmentChecklist: {},
      verificationHistory: []
    };

    // Initialize equipment checklist
    REQUIRED_EQUIPMENT.forEach(equipment => {
      verification.equipmentChecklist[equipment] = {
        present: false,
        condition: 'not_checked',
        notes: ''
      };
    });

    vehicleVerifications.set(verificationId, verification);

    logger.info(`Vehicle verification started: ${verificationId}`, {
      vehicleId,
      licensePlate,
      type
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle verification process initiated',
      data: {
        verificationId,
        vehicleId,
        status: verification.status,
        startedAt: verification.startedAt
      }
    });
  })
);

/**
 * POST /vehicles/:vehicleId/documents/upload
 * Upload vehicle documents
 */
router.post(
  '/vehicles/:vehicleId/documents/upload',
  handleAsyncErrors(async (req, res) => {
    const { vehicleId } = req.params;
    const { verificationId, documentType, documentNumber, expiryDate, filePath } = req.body;

    if (!verificationId || !documentType || !expiryDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required document information'
      });
    }

    const verification = vehicleVerifications.get(verificationId);
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification record not found'
      });
    }

    // Validate document type
    const validDocTypes = ['registrationCertificate', 'inspectionCertificate', 'safetyCompliance'];
    if (!validDocTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document type'
      });
    }

    // Check expiry date
    if (new Date(expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Document has expired'
      });
    }

    // Update document status
    verification.documents[documentType] = {
      submitted: true,
      verified: false,
      expiryDate: new Date(expiryDate),
      documentNumber,
      filePath,
      uploadedAt: new Date()
    };

    verification.verificationHistory.push({
      timestamp: new Date(),
      action: 'document_uploaded',
      details: { documentType, documentNumber }
    });

    logger.info(`Document uploaded for verification: ${verificationId}`, {
      documentType,
      vehicleId
    });

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        verificationId,
        documentType,
        status: 'submitted'
      }
    });
  })
);

/**
 * POST /vehicles/:vehicleId/insurance/register
 * Register vehicle insurance
 */
router.post(
  '/vehicles/:vehicleId/insurance/register',
  handleAsyncErrors(async (req, res) => {
    const { vehicleId } = req.params;
    const {
      verificationId,
      provider,
      policyNumber,
      coverageType,
      coverageAmount,
      deductible,
      effectiveDate,
      expiryDate,
      certificatePath
    } = req.body;

    if (!verificationId || !provider || !policyNumber || !coverageType || !coverageAmount || !expiryDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required insurance information'
      });
    }

    const verification = vehicleVerifications.get(verificationId);
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification record not found'
      });
    }

    // Validate insurance expiry
    if (new Date(expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Insurance policy has expired'
      });
    }

    const insuranceId = `INS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const insurance = {
      insuranceId,
      vehicleId,
      verificationId,
      provider,
      policyNumber,
      coverageType,
      coverageAmount,
      deductible,
      effectiveDate: new Date(effectiveDate || new Date()),
      expiryDate: new Date(expiryDate),
      certificatePath,
      status: 'verified',
      registeredAt: new Date()
    };

    insuranceRecords.set(insuranceId, insurance);

    // Update verification record
    verification.documents.insuranceCertificate = {
      submitted: true,
      verified: true,
      expiryDate: new Date(expiryDate),
      policyNumber,
      insuranceId,
      uploadedAt: new Date()
    };

    verification.verificationHistory.push({
      timestamp: new Date(),
      action: 'insurance_registered',
      details: { provider, policyNumber, coverageType }
    });

    logger.info(`Insurance registered for vehicle: ${vehicleId}`, {
      provider,
      policyNumber,
      insuranceId
    });

    res.status(201).json({
      success: true,
      message: 'Insurance registered successfully',
      data: {
        insuranceId,
        vehicleId,
        provider,
        policyNumber,
        expiryDate: insurance.expiryDate,
        status: insurance.status
      }
    });
  })
);

/**
 * POST /vehicles/:vehicleId/equipment/checklist
 * Submit equipment checklist
 */
router.post(
  '/vehicles/:vehicleId/equipment/checklist',
  handleAsyncErrors(async (req, res) => {
    const { vehicleId } = req.params;
    const { verificationId, equipment } = req.body;

    if (!verificationId || !equipment) {
      return res.status(400).json({
        success: false,
        error: 'Missing required equipment information'
      });
    }

    const verification = vehicleVerifications.get(verificationId);
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification record not found'
      });
    }

    let missingEquipment = [];
    const checklist = {
      checklistId: `CHK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vehicleId,
      verificationId,
      items: {},
      completionPercentage: 0,
      submittedAt: new Date()
    };

    // Process equipment checklist
    Object.keys(equipment).forEach(equipmentName => {
      const equipmentData = equipment[equipmentName];

      if (REQUIRED_EQUIPMENT.includes(equipmentName)) {
        verification.equipmentChecklist[equipmentName] = {
          present: equipmentData.present || false,
          condition: equipmentData.condition || 'not_checked',
          notes: equipmentData.notes || ''
        };

        checklist.items[equipmentName] = verification.equipmentChecklist[equipmentName];

        if (!equipmentData.present) {
          missingEquipment.push(equipmentName);
        }
      }
    });

    // Calculate completion percentage
    const presentEquipment = Object.values(verification.equipmentChecklist).filter(e => e.present).length;
    checklist.completionPercentage = Math.round((presentEquipment / REQUIRED_EQUIPMENT.length) * 100);

    equipmentChecklists.set(checklist.checklistId, checklist);

    // Update verification history
    verification.checks.emergencyEquipment = {
      status: missingEquipment.length === 0 ? 'passed' : 'failed',
      notes: missingEquipment.length > 0 ? `Missing: ${missingEquipment.join(', ')}` : 'All equipment present'
    };

    verification.verificationHistory.push({
      timestamp: new Date(),
      action: 'equipment_checklist_submitted',
      details: {
        completionPercentage: checklist.completionPercentage,
        missingEquipmentCount: missingEquipment.length
      }
    });

    logger.info(`Equipment checklist submitted: ${checklist.checklistId}`, {
      vehicleId,
      completionPercentage: checklist.completionPercentage,
      missingCount: missingEquipment.length
    });

    res.status(201).json({
      success: true,
      message: 'Equipment checklist submitted successfully',
      data: {
        checklistId: checklist.checklistId,
        vehicleId,
        completionPercentage: checklist.completionPercentage,
        missingEquipment,
        status: missingEquipment.length === 0 ? 'complete' : 'incomplete'
      }
    });
  })
);

/**
 * POST /vehicles/:vehicleId/verification/submit
 * Submit vehicle for final verification
 */
router.post(
  '/vehicles/:vehicleId/verification/submit',
  handleAsyncErrors(async (req, res) => {
    const { vehicleId } = req.params;
    const { verificationId, inspectorNotes } = req.body;

    if (!verificationId) {
      return res.status(400).json({
        success: false,
        error: 'Verification ID is required'
      });
    }

    const verification = vehicleVerifications.get(verificationId);
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification record not found'
      });
    }

    // Check all required documents are submitted
    const documentsSubmitted = verification.documents.registrationCertificate.submitted &&
                              verification.documents.inspectionCertificate.submitted &&
                              verification.documents.insuranceCertificate.submitted;

    if (!documentsSubmitted) {
      return res.status(400).json({
        success: false,
        error: 'All required documents must be submitted before verification'
      });
    }

    // Check equipment checklist completion
    const equipmentComplete = Object.values(verification.equipmentChecklist).every(e => e.present);

    if (!equipmentComplete) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle must have all required equipment for verification'
      });
    }

    // Mark as verified
    verification.status = 'verified';
    verification.completedAt = new Date();
    verification.inspectorNotes = inspectorNotes || '';

    verification.verificationHistory.push({
      timestamp: new Date(),
      action: 'verification_completed',
      details: { inspectorNotes }
    });

    logger.info(`Vehicle verification completed: ${verificationId}`, {
      vehicleId,
      status: 'verified'
    });

    res.status(200).json({
      success: true,
      message: 'Vehicle verification completed successfully',
      data: {
        verificationId,
        vehicleId,
        status: verification.status,
        completedAt: verification.completedAt
      }
    });
  })
);

/**
 * GET /vehicles/:vehicleId/verification/:verificationId
 * Get verification details
 */
router.get(
  '/vehicles/:vehicleId/verification/:verificationId',
  handleAsyncErrors(async (req, res) => {
    const { verificationId } = req.params;

    const verification = vehicleVerifications.get(verificationId);
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: verification
    });
  })
);

/**
 * GET /vehicles/:vehicleId/insurance
 * Get vehicle insurance details
 */
router.get(
  '/vehicles/:vehicleId/insurance',
  handleAsyncErrors(async (req, res) => {
    const { vehicleId } = req.params;

    const insurances = Array.from(insuranceRecords.values())
      .filter(ins => ins.vehicleId === vehicleId);

    if (insurances.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No insurance records found for this vehicle'
      });
    }

    // Return the most recent insurance
    const activeInsurance = insurances.find(ins => new Date(ins.expiryDate) > new Date());

    res.status(200).json({
      success: true,
      data: activeInsurance || insurances[insurances.length - 1]
    });
  })
);

/**
 * GET /vehicles/:vehicleId/equipment/checklist/:checklistId
 * Get equipment checklist
 */
router.get(
  '/vehicles/:vehicleId/equipment/checklist/:checklistId',
  handleAsyncErrors(async (req, res) => {
    const { checklistId } = req.params;

    const checklist = equipmentChecklists.get(checklistId);
    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: 'Checklist not found'
      });
    }

    res.status(200).json({
      success: true,
      data: checklist
    });
  })
);

/**
 * PUT /vehicles/:vehicleId/verification/:verificationId/checks
 * Update verification checks
 */
router.put(
  '/vehicles/:vehicleId/verification/:verificationId/checks',
  handleAsyncErrors(async (req, res) => {
    const { verificationId } = req.params;
    const { checks } = req.body;

    if (!checks) {
      return res.status(400).json({
        success: false,
        error: 'Checks data is required'
      });
    }

    const verification = vehicleVerifications.get(verificationId);
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification record not found'
      });
    }

    // Update checks
    Object.keys(checks).forEach(checkName => {
      if (verification.checks[checkName]) {
        verification.checks[checkName] = {
          status: checks[checkName].status || 'pending',
          notes: checks[checkName].notes || ''
        };
      }
    });

    verification.verificationHistory.push({
      timestamp: new Date(),
      action: 'checks_updated',
      details: checks
    });

    logger.info(`Verification checks updated: ${verificationId}`, { checks: Object.keys(checks) });

    res.status(200).json({
      success: true,
      message: 'Verification checks updated successfully',
      data: {
        verificationId,
        checks: verification.checks
      }
    });
  })
);

module.exports = router;
