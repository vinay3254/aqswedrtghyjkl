const { SEVERITY_LEVELS, INCIDENT_TYPES } = require('../incidents/model');
const { SPECIALIST_REQUIREMENTS } = require('./hospital-scorer');

const FILTER_REASONS = {
  NO_BEDS: 'no_beds_available',
  TOO_FAR: 'exceeds_max_distance',
  NO_SPECIALIST: 'missing_required_specialist',
  NO_ICU: 'no_icu_for_critical',
  NO_CAPABILITY: 'missing_required_capability',
  OUTSIDE_COVERAGE: 'outside_coverage_area',
};

class HospitalFilters {
  /**
   * Filter out hospitals with no available beds
   */
  static filterByBedAvailability(hospital, severity) {
    const requiresICU = severity === SEVERITY_LEVELS.CRITICAL;
    
    if (requiresICU) {
      if (hospital.icu_beds_available <= 0) {
        return {
          passed: false,
          reason: FILTER_REASONS.NO_ICU,
          message: 'No ICU beds available for critical patient',
        };
      }
    } else {
      const totalBeds = hospital.general_beds_available + hospital.icu_beds_available;
      if (totalBeds <= 0) {
        return {
          passed: false,
          reason: FILTER_REASONS.NO_BEDS,
          message: 'No beds available',
        };
      }
    }
    
    return { passed: true };
  }

  /**
   * Filter out hospitals that are too far away
   * Default max: 60 minutes
   * Rural areas: 90 minutes
   */
  static filterByDistance(travelData, isRural = false) {
    const maxMinutes = isRural ? 90 : 60;
    const adjustedTime = travelData.travel_time_minutes * (travelData.traffic_multiplier || 1.0);
    
    if (adjustedTime > maxMinutes) {
      return {
        passed: false,
        reason: FILTER_REASONS.TOO_FAR,
        message: `Travel time ${Math.round(adjustedTime)} minutes exceeds maximum ${maxMinutes} minutes`,
      };
    }
    
    return { passed: true };
  }

  /**
   * Filter out hospitals without required specialist for life-threatening cases
   */
  static filterBySpecialist(hospital, incidentType, severity) {
    const lifeThreatening = [
      INCIDENT_TYPES.CARDIAC,
      INCIDENT_TYPES.STROKE,
      INCIDENT_TYPES.TRAUMA,
    ];
    
    const isCritical = [SEVERITY_LEVELS.CRITICAL, SEVERITY_LEVELS.HIGH].includes(severity);
    
    // Only enforce specialist filter for life-threatening + critical cases
    if (lifeThreatening.includes(incidentType) && isCritical) {
      const requiredSpecialist = SPECIALIST_REQUIREMENTS[incidentType];
      const hasSpecialist = hospital.specialists && 
                          hospital.specialists.includes(requiredSpecialist);
      
      if (!hasSpecialist) {
        return {
          passed: false,
          reason: FILTER_REASONS.NO_SPECIALIST,
          message: `Missing required specialist: ${requiredSpecialist}`,
        };
      }
    }
    
    return { passed: true };
  }

  /**
   * Filter out hospitals without required capabilities
   */
  static filterByCapabilities(hospital, incidentType) {
    // Only enforce for trauma cases requiring trauma center
    if (incidentType === INCIDENT_TYPES.TRAUMA) {
      const hasTraumaCenter = hospital.capabilities && 
                            hospital.capabilities.includes('trauma_center');
      
      if (!hasTraumaCenter) {
        return {
          passed: false,
          reason: FILTER_REASONS.NO_CAPABILITY,
          message: 'Not a designated trauma center',
        };
      }
    }
    
    return { passed: true };
  }

  /**
   * Apply all filters to a hospital
   */
  static applyFilters(hospital, incident, travelData, options = {}) {
    const filters = [
      () => this.filterByBedAvailability(hospital, incident.severity),
      () => this.filterByDistance(travelData, options.isRural),
      () => this.filterBySpecialist(hospital, incident.incident_type, incident.severity),
      () => this.filterByCapabilities(hospital, incident.incident_type),
    ];
    
    for (const filter of filters) {
      const result = filter();
      if (!result.passed) {
        return result;
      }
    }
    
    return { passed: true };
  }

  /**
   * Filter a list of hospitals and return passed/rejected lists
   */
  static filterHospitals(hospitals, incident, travelDataMap, options = {}) {
    const passed = [];
    const rejected = [];
    
    for (const hospital of hospitals) {
      const travelData = travelDataMap[hospital.id];
      
      if (!travelData) {
        rejected.push({
          hospital,
          reason: FILTER_REASONS.OUTSIDE_COVERAGE,
          message: 'No route data available',
        });
        continue;
      }
      
      const filterResult = this.applyFilters(hospital, incident, travelData, options);
      
      if (filterResult.passed) {
        passed.push(hospital);
      } else {
        rejected.push({
          hospital,
          reason: filterResult.reason,
          message: filterResult.message,
        });
      }
    }
    
    return { passed, rejected };
  }

  /**
   * Generate filter summary
   */
  static generateFilterSummary(rejected) {
    const summary = {
      total_rejected: rejected.length,
      rejection_reasons: {},
    };
    
    for (const item of rejected) {
      if (!summary.rejection_reasons[item.reason]) {
        summary.rejection_reasons[item.reason] = 0;
      }
      summary.rejection_reasons[item.reason]++;
    }
    
    return summary;
  }
}

module.exports = {
  HospitalFilters,
  FILTER_REASONS,
};
