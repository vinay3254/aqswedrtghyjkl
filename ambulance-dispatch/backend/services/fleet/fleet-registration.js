/**
 * Fleet Registration Service
 * Handles registration of private ambulance operators with company info, vehicles, and drivers
 */

const express = require('express');
const router = express.Router();
const { validateRequestBody, handleAsyncErrors } = require('../../utils/middleware');
const logger = require('../../utils/logger');

// In-memory storage (replace with database in production)
const registeredFleets = new Map();
const fleetValidationRules = {
  company: {
    name: { required: true, type: 'string', minLength: 3 },
    registrationNumber: { required: true, type: 'string', pattern: /^[A-Z0-9-]+$/ },
    licenseNumber: { required: true, type: 'string' },
    address: { required: true, type: 'string' },
    city: { required: true, type: 'string' },
    state: { required: true, type: 'string' },
    zipCode: { required: true, type: 'string', pattern: /^\d{5}(-\d{4})?$/ },
    phone: { required: true, type: 'string', pattern: /^[\d\-\+\(\)\s]+$/ },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    taxId: { required: true, type: 'string' },
    emergencyContact: { required: true, type: 'string' },
    operatingAreas: { required: true, type: 'array', minItems: 1 }
  }
};

/**
 * POST /register
 * Register a new private ambulance fleet
 */
router.post(
  '/register',
  handleAsyncErrors(async (req, res) => {
    const { company, vehicles = [], drivers = [] } = req.body;

    // Validation
    if (!company) {
      return res.status(400).json({
        success: false,
        error: 'Company information is required'
      });
    }

    const validation = validateFleetRegistration(company);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Check for duplicate registration
    if (registeredFleets.has(company.registrationNumber)) {
      return res.status(409).json({
        success: false,
        error: 'Fleet already registered with this registration number'
      });
    }

    // Create fleet record
    const fleetId = `FLEET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fleetRecord = {
      fleetId,
      company,
      vehicles: vehicles.map(v => ({
        ...v,
        vehicleId: `VEH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        verificationStatus: 'pending',
        registeredAt: new Date()
      })),
      drivers: drivers.map(d => ({
        ...d,
        driverId: `DRV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        certificationStatus: 'pending',
        registeredAt: new Date()
      })),
      registrationStatus: 'approved',
      registeredAt: new Date(),
      lastUpdated: new Date(),
      documentsSubmitted: {
        companyLicense: false,
        insuranceCertificate: false,
        operatingPermit: false,
        complianceCertificate: false
      },
      complianceScore: 0,
      notes: []
    };

    registeredFleets.set(company.registrationNumber, fleetRecord);

    logger.info(`Fleet registered: ${fleetId}`, {
      company: company.name,
      vehicleCount: vehicles.length,
      driverCount: drivers.length
    });

    res.status(201).json({
      success: true,
      message: 'Fleet registration successful',
      data: {
        fleetId,
        registrationNumber: company.registrationNumber,
        registrationStatus: fleetRecord.registrationStatus,
        vehicleCount: vehicles.length,
        driverCount: drivers.length,
        registeredAt: fleetRecord.registeredAt
      }
    });
  })
);

/**
 * GET /fleets/:fleetId
 * Retrieve fleet details
 */
router.get(
  '/fleets/:fleetId',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;

    const fleet = findFleetByFleetId(fleetId);
    if (!fleet) {
      return res.status(404).json({
        success: false,
        error: 'Fleet not found'
      });
    }

    res.status(200).json({
      success: true,
      data: fleet
    });
  })
);

/**
 * POST /fleets/:fleetId/vehicles
 * Add a new vehicle to the fleet
 */
router.post(
  '/fleets/:fleetId/vehicles',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;
    const vehicleData = req.body;

    const fleet = findFleetByFleetId(fleetId);
    if (!fleet) {
      return res.status(404).json({
        success: false,
        error: 'Fleet not found'
      });
    }

    // Validate vehicle data
    const vehicleValidation = validateVehicleData(vehicleData);
    if (!vehicleValidation.valid) {
      return res.status(400).json({
        success: false,
        errors: vehicleValidation.errors
      });
    }

    const vehicleId = `VEH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newVehicle = {
      ...vehicleData,
      vehicleId,
      verificationStatus: 'pending',
      registeredAt: new Date()
    };

    fleet.vehicles.push(newVehicle);
    fleet.lastUpdated = new Date();

    logger.info(`Vehicle added to fleet: ${vehicleId}`, {
      fleetId,
      licensePlate: vehicleData.licensePlate
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle added successfully',
      data: {
        vehicleId,
        licensePlate: vehicleData.licensePlate,
        verificationStatus: newVehicle.verificationStatus
      }
    });
  })
);

/**
 * POST /fleets/:fleetId/drivers
 * Add a new driver to the fleet
 */
router.post(
  '/fleets/:fleetId/drivers',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;
    const driverData = req.body;

    const fleet = findFleetByFleetId(fleetId);
    if (!fleet) {
      return res.status(404).json({
        success: false,
        error: 'Fleet not found'
      });
    }

    // Validate driver data
    const driverValidation = validateDriverData(driverData);
    if (!driverValidation.valid) {
      return res.status(400).json({
        success: false,
        errors: driverValidation.errors
      });
    }

    const driverId = `DRV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newDriver = {
      ...driverData,
      driverId,
      certificationStatus: 'pending',
      registeredAt: new Date()
    };

    fleet.drivers.push(newDriver);
    fleet.lastUpdated = new Date();

    logger.info(`Driver added to fleet: ${driverId}`, {
      fleetId,
      driverName: driverData.fullName
    });

    res.status(201).json({
      success: true,
      message: 'Driver added successfully',
      data: {
        driverId,
        fullName: driverData.fullName,
        certificationStatus: newDriver.certificationStatus
      }
    });
  })
);

/**
 * PUT /fleets/:fleetId
 * Update fleet information
 */
router.put(
  '/fleets/:fleetId',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;
    const updates = req.body;

    const fleet = findFleetByFleetId(fleetId);
    if (!fleet) {
      return res.status(404).json({
        success: false,
        error: 'Fleet not found'
      });
    }

    // Validate updates
    const validation = validateFleetUpdates(updates);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Update allowed fields only
    const allowedFields = ['phone', 'email', 'emergencyContact', 'operatingAreas', 'notes'];
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'notes') {
          fleet[key].push(updates[key]);
        } else {
          fleet.company[key] = updates[key];
        }
      }
    });

    fleet.lastUpdated = new Date();

    logger.info(`Fleet updated: ${fleetId}`, { updatedFields: Object.keys(updates) });

    res.status(200).json({
      success: true,
      message: 'Fleet information updated successfully',
      data: {
        fleetId,
        lastUpdated: fleet.lastUpdated
      }
    });
  })
);

/**
 * GET /fleets/:fleetId/summary
 * Get fleet registration summary
 */
router.get(
  '/fleets/:fleetId/summary',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;

    const fleet = findFleetByFleetId(fleetId);
    if (!fleet) {
      return res.status(404).json({
        success: false,
        error: 'Fleet not found'
      });
    }

    const summary = {
      fleetId,
      companyName: fleet.company.name,
      registrationNumber: fleet.company.registrationNumber,
      registrationStatus: fleet.registrationStatus,
      vehicleCount: fleet.vehicles.length,
      driverCount: fleet.drivers.length,
      verifiedVehicles: fleet.vehicles.filter(v => v.verificationStatus === 'verified').length,
      certifiedDrivers: fleet.drivers.filter(d => d.certificationStatus === 'certified').length,
      complianceScore: fleet.complianceScore,
      documentsSubmitted: fleet.documentsSubmitted,
      registeredAt: fleet.registeredAt,
      lastUpdated: fleet.lastUpdated
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  })
);

/**
 * GET /fleets
 * List all registered fleets (with pagination)
 */
router.get(
  '/fleets',
  handleAsyncErrors(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    let fleets = Array.from(registeredFleets.values());

    if (status) {
      fleets = fleets.filter(f => f.registrationStatus === status);
    }

    const total = fleets.length;
    const startIdx = (pageNum - 1) * limitNum;
    const paginatedFleets = fleets.slice(startIdx, startIdx + limitNum);

    res.status(200).json({
      success: true,
      data: paginatedFleets.map(f => ({
        fleetId: f.fleetId,
        companyName: f.company.name,
        registrationNumber: f.company.registrationNumber,
        registrationStatus: f.registrationStatus,
        vehicleCount: f.vehicles.length,
        driverCount: f.drivers.length,
        registeredAt: f.registeredAt
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  })
);

/**
 * Helper function to validate fleet registration
 */
function validateFleetRegistration(company) {
  const errors = [];

  if (!company.name || company.name.length < 3) {
    errors.push('Company name must be at least 3 characters');
  }

  if (!company.registrationNumber || !/^[A-Z0-9-]+$/.test(company.registrationNumber)) {
    errors.push('Invalid registration number format');
  }

  if (!company.licenseNumber) {
    errors.push('License number is required');
  }

  if (!company.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) {
    errors.push('Invalid email address');
  }

  if (!company.phone) {
    errors.push('Phone number is required');
  }

  if (!company.zipCode || !/^\d{5}(-\d{4})?$/.test(company.zipCode)) {
    errors.push('Invalid ZIP code format');
  }

  if (!company.operatingAreas || !Array.isArray(company.operatingAreas) || company.operatingAreas.length === 0) {
    errors.push('At least one operating area is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to validate vehicle data
 */
function validateVehicleData(vehicle) {
  const errors = [];

  if (!vehicle.licensePlate) {
    errors.push('License plate is required');
  }

  if (!vehicle.vin) {
    errors.push('VIN is required');
  }

  if (!vehicle.year || vehicle.year < 1990 || vehicle.year > new Date().getFullYear() + 1) {
    errors.push('Invalid vehicle year');
  }

  if (!vehicle.make) {
    errors.push('Vehicle make is required');
  }

  if (!vehicle.model) {
    errors.push('Vehicle model is required');
  }

  if (!vehicle.type || !['Type A', 'Type B', 'Type C'].includes(vehicle.type)) {
    errors.push('Invalid vehicle type. Must be Type A, Type B, or Type C');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to validate driver data
 */
function validateDriverData(driver) {
  const errors = [];

  if (!driver.fullName || driver.fullName.length < 3) {
    errors.push('Full name must be at least 3 characters');
  }

  if (!driver.licenseNumber) {
    errors.push('Driver license number is required');
  }

  if (!driver.licenseExpiry) {
    errors.push('License expiry date is required');
  }

  if (new Date(driver.licenseExpiry) <= new Date()) {
    errors.push('Driver license has expired');
  }

  if (!driver.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(driver.email)) {
    errors.push('Invalid email address');
  }

  if (!driver.phone) {
    errors.push('Phone number is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to validate fleet updates
 */
function validateFleetUpdates(updates) {
  const errors = [];

  if (updates.phone && !updates.phone.match(/^[\d\-\+\(\)\s]+$/)) {
    errors.push('Invalid phone number format');
  }

  if (updates.email && !updates.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    errors.push('Invalid email address');
  }

  if (updates.operatingAreas && (!Array.isArray(updates.operatingAreas) || updates.operatingAreas.length === 0)) {
    errors.push('Operating areas must be a non-empty array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to find fleet by fleetId
 */
function findFleetByFleetId(fleetId) {
  for (const fleet of registeredFleets.values()) {
    if (fleet.fleetId === fleetId) {
      return fleet;
    }
  }
  return null;
}

module.exports = router;
