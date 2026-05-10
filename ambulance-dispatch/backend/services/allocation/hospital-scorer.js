const { SEVERITY_LEVELS, INCIDENT_TYPES } = require('../incidents/model');

const WEIGHTS = {
  TRAVEL_TIME: 0.30,
  BED_AVAILABILITY: 0.25,
  SPECIALIST_MATCH: 0.20,
  URGENCY_MATCH: 0.15,
  FACILITY_CAPABILITY: 0.10,
};

const SPECIALIST_REQUIREMENTS = {
  [INCIDENT_TYPES.CARDIAC]: 'cardiologist',
  [INCIDENT_TYPES.STROKE]: 'neurologist',
  [INCIDENT_TYPES.TRAUMA]: 'trauma_surgeon',
  [INCIDENT_TYPES.MATERNITY]: 'obstetrician',
  [INCIDENT_TYPES.MEDICAL]: 'general_physician',
  [INCIDENT_TYPES.ACCIDENT]: 'emergency_physician',
  [INCIDENT_TYPES.OTHER]: 'general_physician',
};

const CAPABILITY_REQUIREMENTS = {
  [INCIDENT_TYPES.CARDIAC]: ['cath_lab', 'ecg'],
  [INCIDENT_TYPES.STROKE]: ['ct_scan', 'mri'],
  [INCIDENT_TYPES.TRAUMA]: ['trauma_center', 'blood_bank', 'operating_room'],
  [INCIDENT_TYPES.MATERNITY]: ['nicu', 'labor_delivery'],
};

class HospitalScorer {
  /**
   * Calculate travel time score (30% weight)
   * Lower time = higher score
   * Formula: 100 - (travel_time_minutes * 2)
   * Cap at 0 for >50 minute travel
   */
  static calculateTravelTimeScore(travelTimeMinutes, trafficMultiplier = 1.0) {
    const adjustedTime = travelTimeMinutes * trafficMultiplier;
    
    if (adjustedTime > 50) {
      return 0;
    }
    
    const rawScore = 100 - (adjustedTime * 2);
    return Math.max(0, rawScore);
  }

  /**
   * Calculate bed availability score (25% weight)
   * More beds = higher score
   * Returns 0 if no beds of required type available
   */
  static calculateBedAvailabilityScore(hospital, severity) {
    const requiresICU = [SEVERITY_LEVELS.CRITICAL, SEVERITY_LEVELS.HIGH].includes(severity);
    
    if (requiresICU && hospital.icu_beds_available > 0) {
      const icuPercentage = (hospital.icu_beds_available / hospital.total_icu_beds) * 100;
      return Math.min(100, icuPercentage);
    }
    
    if (hospital.general_beds_available > 0) {
      const generalPercentage = (hospital.general_beds_available / hospital.total_general_beds) * 100;
      return Math.min(100, generalPercentage);
    }
    
    return 0;
  }

  /**
   * Calculate specialist match score (20% weight)
   * Has required specialist = 100, doesn't have = 0
   * Baseline 50 for general cases
   */
  static calculateSpecialistMatchScore(hospital, incidentType) {
    const requiredSpecialist = SPECIALIST_REQUIREMENTS[incidentType];
    
    if (!requiredSpecialist) {
      return 50; // Baseline for unknown types
    }
    
    if (incidentType === INCIDENT_TYPES.MEDICAL || incidentType === INCIDENT_TYPES.OTHER) {
      return 50; // General cases get baseline
    }
    
    const hasSpecialist = hospital.specialists && 
                         hospital.specialists.includes(requiredSpecialist);
    
    return hasSpecialist ? 100 : 0;
  }

  /**
   * Calculate urgency match score (15% weight)
   * CRITICAL → needs ICU → 100 if ICU available, 20 if not
   * HIGH → prefers ICU → 80 if ICU, 50 if general
   * MEDIUM/LOW → general bed fine → 100 if any bed
   */
  static calculateUrgencyMatchScore(hospital, severity) {
    const hasICU = hospital.icu_beds_available > 0;
    const hasGeneralBed = hospital.general_beds_available > 0;
    
    switch (severity) {
      case SEVERITY_LEVELS.CRITICAL:
        return hasICU ? 100 : 20;
      
      case SEVERITY_LEVELS.HIGH:
        if (hasICU) return 80;
        if (hasGeneralBed) return 50;
        return 0;
      
      case SEVERITY_LEVELS.MEDIUM:
      case SEVERITY_LEVELS.LOW:
        return (hasICU || hasGeneralBed) ? 100 : 0;
      
      default:
        return hasGeneralBed ? 50 : 0;
    }
  }

  /**
   * Calculate facility capability score (10% weight)
   * Base 50, +10 for each matched capability (max 100)
   */
  static calculateFacilityCapabilityScore(hospital, incidentType) {
    const requiredCapabilities = CAPABILITY_REQUIREMENTS[incidentType] || [];
    
    if (requiredCapabilities.length === 0) {
      return 50; // Base score if no special requirements
    }
    
    let baseScore = 50;
    let matchedCount = 0;
    
    const hospitalCapabilities = hospital.capabilities || [];
    
    for (const capability of requiredCapabilities) {
      if (hospitalCapabilities.includes(capability)) {
        matchedCount++;
      }
    }
    
    const bonusScore = matchedCount * 10;
    return Math.min(100, baseScore + bonusScore);
  }

  /**
   * Calculate total weighted score for a hospital
   */
  static calculateTotalScore(hospital, incident, travelData) {
    const travelTimeScore = this.calculateTravelTimeScore(
      travelData.travel_time_minutes,
      travelData.traffic_multiplier || 1.0
    );
    
    const bedAvailabilityScore = this.calculateBedAvailabilityScore(
      hospital,
      incident.severity
    );
    
    const specialistMatchScore = this.calculateSpecialistMatchScore(
      hospital,
      incident.incident_type
    );
    
    const urgencyMatchScore = this.calculateUrgencyMatchScore(
      hospital,
      incident.severity
    );
    
    const facilityCapabilityScore = this.calculateFacilityCapabilityScore(
      hospital,
      incident.incident_type
    );
    
    const weightedTravelTime = travelTimeScore * WEIGHTS.TRAVEL_TIME;
    const weightedBedAvailability = bedAvailabilityScore * WEIGHTS.BED_AVAILABILITY;
    const weightedSpecialistMatch = specialistMatchScore * WEIGHTS.SPECIALIST_MATCH;
    const weightedUrgencyMatch = urgencyMatchScore * WEIGHTS.URGENCY_MATCH;
    const weightedFacilityCapability = facilityCapabilityScore * WEIGHTS.FACILITY_CAPABILITY;
    
    const totalScore = 
      weightedTravelTime +
      weightedBedAvailability +
      weightedSpecialistMatch +
      weightedUrgencyMatch +
      weightedFacilityCapability;
    
    return {
      total_score: parseFloat(totalScore.toFixed(2)),
      score_breakdown: {
        travel_time: parseFloat(weightedTravelTime.toFixed(2)),
        bed_availability: parseFloat(weightedBedAvailability.toFixed(2)),
        specialist_match: parseFloat(weightedSpecialistMatch.toFixed(2)),
        urgency_match: parseFloat(weightedUrgencyMatch.toFixed(2)),
        facility_capability: parseFloat(weightedFacilityCapability.toFixed(2)),
      },
      raw_scores: {
        travel_time: travelTimeScore,
        bed_availability: bedAvailabilityScore,
        specialist_match: specialistMatchScore,
        urgency_match: urgencyMatchScore,
        facility_capability: facilityCapabilityScore,
      },
    };
  }

  /**
   * Score multiple hospitals and return ranked list
   */
  static async scoreHospitals(hospitals, incident, travelDataMap, maxResults = 5) {
    const scoredHospitals = [];
    
    for (const hospital of hospitals) {
      const travelData = travelDataMap[hospital.id] || {
        travel_time_minutes: 999,
        distance_km: 999,
        traffic_multiplier: 1.0,
      };
      
      const scores = this.calculateTotalScore(hospital, incident, travelData);
      
      const requiredSpecialist = SPECIALIST_REQUIREMENTS[incident.incident_type];
      const hasRequiredSpecialist = hospital.specialists && 
                                   hospital.specialists.includes(requiredSpecialist);
      
      scoredHospitals.push({
        hospital_id: hospital.id,
        hospital_name: hospital.name,
        hospital_address: hospital.address,
        total_score: scores.total_score,
        score_breakdown: scores.score_breakdown,
        raw_scores: scores.raw_scores,
        eta_minutes: Math.round(travelData.travel_time_minutes * (travelData.traffic_multiplier || 1.0)),
        distance_km: parseFloat(travelData.distance_km.toFixed(2)),
        available_beds: hospital.general_beds_available + hospital.icu_beds_available,
        general_beds_available: hospital.general_beds_available,
        icu_beds_available: hospital.icu_beds_available,
        has_required_specialist: hasRequiredSpecialist,
        required_specialist: requiredSpecialist,
        capabilities: hospital.capabilities || [],
        location: {
          lat: hospital.latitude,
          lng: hospital.longitude,
        },
      });
    }
    
    // Sort by total score descending
    scoredHospitals.sort((a, b) => b.total_score - a.total_score);
    
    // Return top N results
    return scoredHospitals.slice(0, maxResults);
  }

  /**
   * Generate reasoning explanation for why a hospital was recommended
   */
  static generateReasoning(scoredHospital, rank = 1) {
    const reasons = [];
    const breakdown = scoredHospital.score_breakdown;
    
    // Find the highest scoring factor
    const factors = [
      { name: 'travel_time', score: breakdown.travel_time, label: 'shortest travel time' },
      { name: 'bed_availability', score: breakdown.bed_availability, label: 'high bed availability' },
      { name: 'specialist_match', score: breakdown.specialist_match, label: 'specialist availability' },
      { name: 'urgency_match', score: breakdown.urgency_match, label: 'urgency match' },
      { name: 'facility_capability', score: breakdown.facility_capability, label: 'facility capabilities' },
    ];
    
    factors.sort((a, b) => b.score - a.score);
    
    const topFactor = factors[0];
    const secondFactor = factors[1];
    
    if (rank === 1) {
      reasons.push(`Top hospital due to ${topFactor.label}`);
    } else {
      reasons.push(`Ranked #${rank}`);
    }
    
    if (scoredHospital.has_required_specialist) {
      reasons.push(`has required ${scoredHospital.required_specialist}`);
    }
    
    if (scoredHospital.eta_minutes <= 10) {
      reasons.push(`very close (${scoredHospital.eta_minutes} min ETA)`);
    } else if (scoredHospital.eta_minutes <= 20) {
      reasons.push(`nearby (${scoredHospital.eta_minutes} min ETA)`);
    }
    
    if (scoredHospital.icu_beds_available > 0) {
      reasons.push(`${scoredHospital.icu_beds_available} ICU bed(s) available`);
    }
    
    if (secondFactor.score > 15) {
      reasons.push(`good ${secondFactor.label}`);
    }
    
    return reasons.join(' and ');
  }
}

module.exports = {
  HospitalScorer,
  WEIGHTS,
  SPECIALIST_REQUIREMENTS,
  CAPABILITY_REQUIREMENTS,
};
