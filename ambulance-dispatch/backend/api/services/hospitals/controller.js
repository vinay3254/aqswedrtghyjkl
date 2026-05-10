const hospitalService = require('./service');
const { successResponse, errorResponse, paginatedResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class HospitalController {
  async createHospital(req, res, next) {
    try {
      const hospital = await hospitalService.createHospital(req.body);
      return successResponse(res, hospital, 'Hospital created successfully', 201);
    } catch (error) {
      logger.error('Error creating hospital:', error);
      next(error);
    }
  }

  async getAllHospitals(req, res, next) {
    try {
      const { status, trauma_level, service, page = 1, limit = 20 } = req.query;
      
      const filters = {
        status,
        trauma_level,
        service,
        offset: (page - 1) * limit,
        limit: parseInt(limit),
      };

      const hospitals = await hospitalService.getAllHospitals(filters);
      const total = hospitals.length;

      return paginatedResponse(
        res,
        hospitals,
        { page: parseInt(page), limit: parseInt(limit), total },
        'Hospitals retrieved successfully'
      );
    } catch (error) {
      logger.error('Error getting hospitals:', error);
      next(error);
    }
  }

  async getHospitalById(req, res, next) {
    try {
      const hospital = await hospitalService.getHospitalById(req.params.id);
      return successResponse(res, hospital, 'Hospital retrieved successfully');
    } catch (error) {
      logger.error('Error getting hospital:', error);
      next(error);
    }
  }

  async updateHospital(req, res, next) {
    try {
      const hospital = await hospitalService.updateHospital(req.params.id, req.body);
      return successResponse(res, hospital, 'Hospital updated successfully');
    } catch (error) {
      logger.error('Error updating hospital:', error);
      next(error);
    }
  }

  async deleteHospital(req, res, next) {
    try {
      await hospitalService.deleteHospital(req.params.id);
      return successResponse(res, null, 'Hospital deleted successfully');
    } catch (error) {
      logger.error('Error deleting hospital:', error);
      next(error);
    }
  }

  async updateBedAvailability(req, res, next) {
    try {
      const { available_beds, available_icu_beds, available_trauma_bays } = req.body;
      
      const hospital = await hospitalService.updateBedAvailability(req.params.id, {
        available_beds,
        available_icu_beds,
        available_trauma_bays,
      });

      return successResponse(res, hospital, 'Bed availability updated successfully');
    } catch (error) {
      logger.error('Error updating bed availability:', error);
      next(error);
    }
  }

  async updateBloodInventory(req, res, next) {
    try {
      const hospital = await hospitalService.updateBloodInventory(req.params.id, req.body);
      return successResponse(res, hospital, 'Blood inventory updated successfully');
    } catch (error) {
      logger.error('Error updating blood inventory:', error);
      next(error);
    }
  }

  async updateSpecialistAvailability(req, res, next) {
    try {
      const { specialists } = req.body;
      
      const hospital = await hospitalService.updateSpecialistAvailability(
        req.params.id,
        specialists
      );

      return successResponse(res, hospital, 'Specialist availability updated successfully');
    } catch (error) {
      logger.error('Error updating specialist availability:', error);
      next(error);
    }
  }

  async getNearbyHospitals(req, res, next) {
    try {
      const { latitude, longitude, radius, min_beds, min_icu_beds, trauma_bay_required, 
              trauma_level, service, blood_type, equipment, limit } = req.query;

      if (!latitude || !longitude) {
        return errorResponse(res, 'Latitude and longitude are required', 400);
      }

      const options = {
        radius: radius ? parseFloat(radius) : 50,
        min_beds: min_beds ? parseInt(min_beds) : undefined,
        min_icu_beds: min_icu_beds ? parseInt(min_icu_beds) : undefined,
        trauma_bay_required: trauma_bay_required === 'true',
        trauma_level,
        service,
        blood_type,
        equipment,
        limit: limit ? parseInt(limit) : undefined,
      };

      const hospitals = await hospitalService.findNearbyHospitals(
        parseFloat(latitude),
        parseFloat(longitude),
        options
      );

      return successResponse(res, hospitals, 'Nearby hospitals retrieved successfully');
    } catch (error) {
      logger.error('Error finding nearby hospitals:', error);
      next(error);
    }
  }

  async findOptimalHospital(req, res, next) {
    try {
      const { latitude, longitude, incident_type, severity, patient_condition, radius, limit } = req.body;

      if (!latitude || !longitude || !incident_type) {
        return errorResponse(res, 'Latitude, longitude, and incident_type are required', 400);
      }

      const incident = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        incident_type,
        severity,
        patient_condition,
      };

      const options = {
        radius: radius ? parseFloat(radius) : 50,
        limit: limit ? parseInt(limit) : 10,
      };

      const hospitals = await hospitalService.findOptimalHospital(incident, options);

      return successResponse(res, hospitals, 'Optimal hospitals found');
    } catch (error) {
      logger.error('Error finding optimal hospital:', error);
      next(error);
    }
  }

  async acceptPatient(req, res, next) {
    try {
      const { patient_id, ambulance_id, requires_icu, requires_trauma, alert_id } = req.body;
      const staffId = req.user?.id;

      if (!patient_id) {
        return errorResponse(res, 'Patient ID is required', 400);
      }

      const result = await hospitalService.acceptPatient(
        req.params.id,
        { patient_id, ambulance_id, requires_icu, requires_trauma, alert_id },
        staffId
      );

      return successResponse(res, result, 'Patient accepted successfully');
    } catch (error) {
      logger.error('Error accepting patient:', error);
      next(error);
    }
  }

  async rejectPatient(req, res, next) {
    try {
      const { patient_id, reason } = req.body;
      const staffId = req.user?.id;

      if (!patient_id || !reason) {
        return errorResponse(res, 'Patient ID and reason are required', 400);
      }

      const result = await hospitalService.rejectPatient(
        req.params.id,
        { patient_id },
        reason,
        staffId
      );

      return successResponse(res, result, 'Patient rejection recorded');
    } catch (error) {
      logger.error('Error rejecting patient:', error);
      next(error);
    }
  }

  async sendPreArrivalAlert(req, res, next) {
    try {
      const { ambulance_id, severity, incident_type, eta, vital_signs, 
              medical_history, requires_blood, blood_type } = req.body;

      if (!ambulance_id || !severity || !incident_type || !eta) {
        return errorResponse(res, 'Missing required alert information', 400);
      }

      const alert = await hospitalService.sendPreArrivalAlert(req.params.id, {
        ambulance_id,
        severity,
        incident_type,
        eta,
        vital_signs,
        medical_history,
        requires_blood,
        blood_type,
      });

      return successResponse(res, alert, 'Pre-arrival alert sent successfully', 201);
    } catch (error) {
      logger.error('Error sending pre-arrival alert:', error);
      next(error);
    }
  }

  async getHospitalAlerts(req, res, next) {
    try {
      const alerts = await hospitalService.getHospitalAlerts(req.params.id);
      return successResponse(res, alerts, 'Hospital alerts retrieved successfully');
    } catch (error) {
      logger.error('Error getting hospital alerts:', error);
      next(error);
    }
  }

  async acknowledgeAlert(req, res, next) {
    try {
      const { alert_id } = req.body;
      const staffId = req.user?.id;

      if (!alert_id) {
        return errorResponse(res, 'Alert ID is required', 400);
      }

      const result = await hospitalService.acknowledgeAlert(alert_id, staffId);
      return successResponse(res, result, 'Alert acknowledged successfully');
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      next(error);
    }
  }

  async getCapacityUtilization(req, res, next) {
    try {
      const utilization = await hospitalService.getCapacityUtilization(req.params.id);
      return successResponse(res, utilization, 'Capacity utilization retrieved successfully');
    } catch (error) {
      logger.error('Error getting capacity utilization:', error);
      next(error);
    }
  }

  async checkBloodAvailability(req, res, next) {
    try {
      const { blood_type, units_required = 1 } = req.query;

      if (!blood_type) {
        return errorResponse(res, 'Blood type is required', 400);
      }

      const result = await hospitalService.checkBloodAvailability(
        req.params.id,
        blood_type,
        parseInt(units_required)
      );

      return successResponse(res, result, 'Blood availability checked successfully');
    } catch (error) {
      logger.error('Error checking blood availability:', error);
      next(error);
    }
  }

  async findHospitalsWithBlood(req, res, next) {
    try {
      const { blood_type, latitude, longitude, radius = 50 } = req.query;

      if (!blood_type || !latitude || !longitude) {
        return errorResponse(res, 'Blood type, latitude, and longitude are required', 400);
      }

      const hospitals = await hospitalService.findHospitalsWithBlood(
        blood_type,
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius)
      );

      return successResponse(res, hospitals, 'Hospitals with blood found successfully');
    } catch (error) {
      logger.error('Error finding hospitals with blood:', error);
      next(error);
    }
  }

  async reserveBed(req, res, next) {
    try {
      const { bed_type = 'general', reservation_id } = req.body;

      const result = await hospitalService.reserveBed(
        req.params.id,
        bed_type,
        reservation_id
      );

      return successResponse(res, result, 'Bed reserved successfully', 201);
    } catch (error) {
      logger.error('Error reserving bed:', error);
      next(error);
    }
  }

  async releaseBedReservation(req, res, next) {
    try {
      const { reservation_id } = req.body;

      if (!reservation_id) {
        return errorResponse(res, 'Reservation ID is required', 400);
      }

      const result = await hospitalService.releaseBedReservation(reservation_id);
      return successResponse(res, result, 'Bed reservation released successfully');
    } catch (error) {
      logger.error('Error releasing bed reservation:', error);
      next(error);
    }
  }

  async getAlertStatistics(req, res, next) {
    try {
      const { time_range = 24 } = req.query;

      const stats = await hospitalService.getAlertStatistics(
        req.params.id,
        parseInt(time_range)
      );

      return successResponse(res, stats, 'Alert statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting alert statistics:', error);
      next(error);
    }
  }
}

module.exports = new HospitalController();
