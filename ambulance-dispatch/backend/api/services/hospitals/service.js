const HospitalModel = require('./model');
const CapacityManager = require('./capacity');
const SpecialistManager = require('./specialists');
const GeospatialService = require('./geospatial');
const AlertsManager = require('./alerts');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const { ValidationError, NotFoundError } = require('../../utils/errors');

class HospitalService {
  async createHospital(hospitalData) {
    this.validateHospitalData(hospitalData);
    
    const hospital = await HospitalModel.create(hospitalData);
    
    logger.info('Hospital created', { hospitalId: hospital.id, name: hospital.name });
    
    return hospital;
  }

  async getHospitalById(id) {
    return await HospitalModel.findById(id);
  }

  async getAllHospitals(filters = {}) {
    return await HospitalModel.findAll(filters);
  }

  async updateHospital(id, updates) {
    this.validateHospitalUpdates(updates);
    
    const hospital = await HospitalModel.update(id, updates);
    
    logger.info('Hospital updated', { hospitalId: id });
    
    return hospital;
  }

  async deleteHospital(id) {
    const hospital = await HospitalModel.delete(id);
    
    logger.info('Hospital deleted', { hospitalId: id, name: hospital.name });
    
    return hospital;
  }

  async updateBedAvailability(id, bedUpdates) {
    this.validateBedUpdates(bedUpdates);
    
    const hospital = await HospitalModel.updateBedAvailability(id, bedUpdates);
    
    logger.info('Bed availability updated', {
      hospitalId: id,
      beds: bedUpdates.available_beds,
      icu: bedUpdates.available_icu_beds,
      trauma: bedUpdates.available_trauma_bays,
    });
    
    return hospital;
  }

  async updateBloodInventory(id, bloodInventory) {
    this.validateBloodInventory(bloodInventory);
    
    const hospital = await HospitalModel.updateBloodInventory(id, bloodInventory);
    
    logger.info('Blood inventory updated', { hospitalId: id });
    
    return hospital;
  }

  async updateSpecialistAvailability(id, specialists) {
    this.validateSpecialists(specialists);
    
    await SpecialistManager.updateSpecialistAvailability(id, specialists);
    
    const hospital = await HospitalModel.findById(id);
    
    logger.info('Specialist availability updated', { hospitalId: id, specialists });
    
    return hospital;
  }

  async findNearbyHospitals(latitude, longitude, options = {}) {
    this.validateCoordinates(latitude, longitude);
    
    return await GeospatialService.findNearbyHospitals(latitude, longitude, options);
  }

  async findOptimalHospital(incident) {
    this.validateIncident(incident);
    
    return await GeospatialService.findOptimalHospital(incident);
  }

  async reserveBed(hospitalId, bedType, reservationId = null) {
    return await CapacityManager.reserveBed(hospitalId, bedType, reservationId);
  }

  async releaseBedReservation(reservationId) {
    return await CapacityManager.releaseBed(reservationId);
  }

  async confirmBedReservation(reservationId) {
    return await CapacityManager.confirmReservation(reservationId);
  }

  async acceptPatient(hospitalId, patientData, staffId) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const hospital = await HospitalModel.findById(hospitalId);

      const bedType = patientData.requires_icu ? 'icu' : 
                     patientData.requires_trauma ? 'trauma' : 'general';

      let availableColumn;
      switch (bedType) {
        case 'icu':
          availableColumn = 'available_icu_beds';
          break;
        case 'trauma':
          availableColumn = 'available_trauma_bays';
          break;
        default:
          availableColumn = 'available_beds';
      }

      if (hospital.capacity[bedType === 'trauma' ? 'trauma' : bedType].available <= 0) {
        throw new ValidationError(`No ${bedType} beds available`);
      }

      const updateQuery = `
        UPDATE hospitals
        SET ${availableColumn} = ${availableColumn} - 1, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      await client.query(updateQuery, [hospitalId]);

      await client.query('COMMIT');

      logger.info('Patient accepted', {
        hospitalId,
        patientId: patientData.patient_id,
        bedType,
        acceptedBy: staffId,
      });

      if (patientData.alert_id) {
        await AlertsManager.acknowledgeAlert(patientData.alert_id, staffId);
      }

      return {
        success: true,
        message: 'Patient accepted',
        bed_type: bedType,
        hospital_id: hospitalId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectPatient(hospitalId, patientData, reason, staffId) {
    logger.warn('Patient rejected', {
      hospitalId,
      patientId: patientData.patient_id,
      reason,
      rejectedBy: staffId,
    });

    if (patientData.alert_id) {
      await AlertsManager.cancelAlert(patientData.alert_id, reason);
    }

    return {
      success: true,
      message: 'Patient rejected',
      reason,
      hospital_id: hospitalId,
    };
  }

  async sendPreArrivalAlert(hospitalId, ambulanceData) {
    await HospitalModel.findById(hospitalId);
    
    return await AlertsManager.sendPreArrivalAlert(hospitalId, ambulanceData);
  }

  async getHospitalAlerts(hospitalId) {
    return await AlertsManager.getHospitalAlerts(hospitalId);
  }

  async acknowledgeAlert(alertId, staffId) {
    return await AlertsManager.acknowledgeAlert(alertId, staffId);
  }

  async getCapacityUtilization(hospitalId) {
    return await CapacityManager.getHospitalUtilization(hospitalId);
  }

  async checkBloodAvailability(hospitalId, bloodType, unitsRequired) {
    return await CapacityManager.checkBloodAvailability(hospitalId, bloodType, unitsRequired);
  }

  async findHospitalsWithBlood(bloodType, latitude, longitude, radiusKm) {
    return await CapacityManager.findHospitalsWithBlood(bloodType, latitude, longitude, radiusKm);
  }

  async getAlertStatistics(hospitalId, timeRangeHours) {
    return await AlertsManager.getAlertStatistics(hospitalId, timeRangeHours);
  }

  validateHospitalData(data) {
    const required = ['name', 'address', 'latitude', 'longitude', 'phone'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    this.validateCoordinates(data.latitude, data.longitude);

    if (data.trauma_level && !['Level 1', 'Level 2', 'Level 3'].includes(data.trauma_level)) {
      throw new ValidationError('Invalid trauma level. Must be Level 1, 2, or 3');
    }
  }

  validateHospitalUpdates(updates) {
    if (updates.trauma_level && !['Level 1', 'Level 2', 'Level 3'].includes(updates.trauma_level)) {
      throw new ValidationError('Invalid trauma level. Must be Level 1, 2, or 3');
    }

    if (updates.status && !['active', 'inactive', 'maintenance'].includes(updates.status)) {
      throw new ValidationError('Invalid status');
    }

    if (updates.latitude !== undefined || updates.longitude !== undefined) {
      const lat = updates.latitude || 0;
      const lng = updates.longitude || 0;
      this.validateCoordinates(lat, lng);
    }
  }

  validateBedUpdates(updates) {
    if (updates.available_beds !== undefined && updates.available_beds < 0) {
      throw new ValidationError('Available beds cannot be negative');
    }

    if (updates.available_icu_beds !== undefined && updates.available_icu_beds < 0) {
      throw new ValidationError('Available ICU beds cannot be negative');
    }

    if (updates.available_trauma_bays !== undefined && updates.available_trauma_bays < 0) {
      throw new ValidationError('Available trauma bays cannot be negative');
    }
  }

  validateBloodInventory(inventory) {
    const validTypes = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    
    for (const type in inventory) {
      if (!validTypes.includes(type)) {
        throw new ValidationError(`Invalid blood type: ${type}`);
      }
      
      if (typeof inventory[type] !== 'number' || inventory[type] < 0) {
        throw new ValidationError(`Invalid inventory count for ${type}`);
      }
    }
  }

  validateSpecialists(specialists) {
    if (!Array.isArray(specialists)) {
      throw new ValidationError('Specialists must be an array');
    }

    for (const specialist of specialists) {
      if (!SpecialistManager.validateSpecialist(specialist)) {
        throw new ValidationError(`Invalid specialist type: ${specialist}`);
      }
    }
  }

  validateCoordinates(latitude, longitude) {
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      throw new ValidationError('Invalid latitude. Must be between -90 and 90');
    }

    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      throw new ValidationError('Invalid longitude. Must be between -180 and 180');
    }
  }

  validateIncident(incident) {
    if (!incident.latitude || !incident.longitude) {
      throw new ValidationError('Incident location is required');
    }

    this.validateCoordinates(incident.latitude, incident.longitude);

    if (!incident.incident_type) {
      throw new ValidationError('Incident type is required');
    }
  }
}

module.exports = new HospitalService();
