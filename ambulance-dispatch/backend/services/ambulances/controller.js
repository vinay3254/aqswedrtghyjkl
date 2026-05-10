const ambulanceService = require('./service');
const driverService = require('./driver-service');
const availabilityService = require('./availability');
const geospatialService = require('./geospatial');
const { successResponse, paginatedResponse, errorResponse } = require('../../api/utils/response');
const { ValidationError } = require('../../api/utils/errors');
const logger = require('../../api/utils/logger');

class AmbulanceController {
  async createAmbulance(req, res, next) {
    try {
      const ambulance = await ambulanceService.create(req.body);
      return successResponse(res, ambulance, 'Ambulance created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAmbulances(req, res, next) {
    try {
      const filters = {
        type: req.query.type,
        status: req.query.status,
        baseStation: req.query.baseStation,
        minFuelLevel: req.query.minFuelLevel ? parseInt(req.query.minFuelLevel) : undefined,
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
      };

      const result = await ambulanceService.findAll(filters);
      return paginatedResponse(res, result.ambulances, result.pagination, 'Ambulances retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAvailableAmbulances(req, res, next) {
    try {
      const filters = {
        type: req.query.type,
        latitude: req.query.latitude ? parseFloat(req.query.latitude) : undefined,
        longitude: req.query.longitude ? parseFloat(req.query.longitude) : undefined,
        maxDistance: req.query.maxDistance ? parseFloat(req.query.maxDistance) : undefined,
        minFuelLevel: req.query.minFuelLevel ? parseInt(req.query.minFuelLevel) : 25,
      };

      const ambulances = await ambulanceService.findAvailable(filters);
      return successResponse(res, ambulances, 'Available ambulances retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAmbulanceById(req, res, next) {
    try {
      const ambulance = await ambulanceService.findById(req.params.id);
      return successResponse(res, ambulance, 'Ambulance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateAmbulance(req, res, next) {
    try {
      const ambulance = await ambulanceService.update(req.params.id, req.body);
      return successResponse(res, ambulance, 'Ambulance updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateAmbulanceStatus(req, res, next) {
    try {
      const { status, reason } = req.body;
      
      if (!status) {
        throw new ValidationError('Status is required');
      }

      const options = {
        userId: req.user?.id,
        reason,
      };

      const ambulance = await ambulanceService.updateStatus(req.params.id, status, options);
      return successResponse(res, ambulance, 'Ambulance status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateAmbulanceLocation(req, res, next) {
    try {
      const { latitude, longitude } = req.body;

      if (latitude === undefined || longitude === undefined) {
        throw new ValidationError('Latitude and longitude are required');
      }

      const ambulance = await ambulanceService.updateLocation(
        req.params.id,
        parseFloat(latitude),
        parseFloat(longitude)
      );

      return successResponse(res, ambulance, 'Ambulance location updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateFuelLevel(req, res, next) {
    try {
      const { fuelLevel } = req.body;

      if (fuelLevel === undefined) {
        throw new ValidationError('Fuel level is required');
      }

      const ambulance = await ambulanceService.updateFuelLevel(
        req.params.id,
        parseInt(fuelLevel)
      );

      return successResponse(res, ambulance, 'Fuel level updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getNearbyAmbulances(req, res, next) {
    try {
      const { latitude, longitude } = req.query;

      if (!latitude || !longitude) {
        throw new ValidationError('Latitude and longitude are required');
      }

      const options = {
        type: req.query.type,
        maxDistance: req.query.maxDistance ? parseFloat(req.query.maxDistance) : 50,
        limit: req.query.limit ? parseInt(req.query.limit) : 10,
        minFuelLevel: req.query.minFuelLevel ? parseInt(req.query.minFuelLevel) : 25,
        requiredEquipment: req.query.equipment ? JSON.parse(req.query.equipment) : [],
        status: req.query.status || 'AVAILABLE',
      };

      const ambulances = await geospatialService.findNearestAmbulances(
        parseFloat(latitude),
        parseFloat(longitude),
        options
      );

      return successResponse(res, ambulances, 'Nearby ambulances retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAmbulanceStatusHistory(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const history = await ambulanceService.getStatusHistory(req.params.id, limit);
      return successResponse(res, history, 'Status history retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteAmbulance(req, res, next) {
    try {
      await ambulanceService.delete(req.params.id);
      return successResponse(res, null, 'Ambulance deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAvailabilityStats(req, res, next) {
    try {
      const stats = await availabilityService.getAvailabilityStats();
      return successResponse(res, stats, 'Availability stats retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getLowFuelAmbulances(req, res, next) {
    try {
      const threshold = req.query.threshold ? parseInt(req.query.threshold) : 25;
      const ambulances = await availabilityService.checkLowFuelAmbulances(threshold);
      return successResponse(res, ambulances, 'Low fuel ambulances retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCoverageMap(req, res, next) {
    try {
      const gridSize = req.query.gridSize ? parseInt(req.query.gridSize) : 5;
      const coverage = await geospatialService.getCoverageMap(gridSize);
      return successResponse(res, coverage, 'Coverage map retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async findOptimalAmbulance(req, res, next) {
    try {
      const { latitude, longitude, type, equipment, minFuelLevel, maxResponseTime } = req.body;

      if (!latitude || !longitude) {
        throw new ValidationError('Incident location (latitude, longitude) is required');
      }

      const optimal = await geospatialService.findOptimalAmbulance(
        { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
        {
          type,
          requiredEquipment: equipment || [],
          minFuelLevel: minFuelLevel || 25,
          maxResponseTime: maxResponseTime || 15,
        }
      );

      if (!optimal) {
        return successResponse(res, null, 'No suitable ambulance found', 404);
      }

      return successResponse(res, optimal, 'Optimal ambulance found');
    } catch (error) {
      next(error);
    }
  }

  async createDriver(req, res, next) {
    try {
      const driver = await driverService.create(req.body);
      return successResponse(res, driver, 'Driver created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getDriver(req, res, next) {
    try {
      const driver = await driverService.findById(req.params.id);
      return successResponse(res, driver, 'Driver retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignDriver(req, res, next) {
    try {
      const { driverId, ambulanceId } = req.body;

      if (!driverId || !ambulanceId) {
        throw new ValidationError('Driver ID and Ambulance ID are required');
      }

      const driver = await driverService.assignToAmbulance(driverId, ambulanceId);
      return successResponse(res, driver, 'Driver assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async startDriverShift(req, res, next) {
    try {
      const { ambulanceId } = req.body;
      const driver = await driverService.startShift(req.params.id, ambulanceId);
      return successResponse(res, driver, 'Driver shift started successfully');
    } catch (error) {
      next(error);
    }
  }

  async endDriverShift(req, res, next) {
    try {
      const driver = await driverService.endShift(req.params.id);
      return successResponse(res, driver, 'Driver shift ended successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateDriverLocation(req, res, next) {
    try {
      const { latitude, longitude } = req.body;

      if (latitude === undefined || longitude === undefined) {
        throw new ValidationError('Latitude and longitude are required');
      }

      const driver = await driverService.updateLocation(
        req.params.id,
        parseFloat(latitude),
        parseFloat(longitude)
      );

      return successResponse(res, driver, 'Driver location updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOnDutyDrivers(req, res, next) {
    try {
      const drivers = await driverService.getOnDutyDrivers();
      return successResponse(res, drivers, 'On-duty drivers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AmbulanceController();
