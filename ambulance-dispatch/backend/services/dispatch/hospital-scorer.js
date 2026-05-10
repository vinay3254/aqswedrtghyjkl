const db = require('../../api/config/database');
const logger = require('../../api/utils/logger');

const INCIDENT_TYPE_SPECIALTIES = {
  CARDIAC: ['Cardiology', 'ICU'],
  STROKE: ['Neurology', 'Stroke Unit'],
  TRAUMA: ['Trauma Center', 'Surgery'],
  MATERNITY: ['Maternity', 'Obstetrics'],
  ACCIDENT: ['Emergency', 'Trauma Center'],
  MEDICAL: ['Emergency', 'General Medicine'],
  OTHER: ['Emergency'],
};

class HospitalScorer {
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  static estimateTravelTime(distanceKm) {
    const avgSpeedKmh = 60;
    return Math.ceil((distanceKm / avgSpeedKmh) * 60);
  }

  static async getAllHospitals() {
    const query = `
      SELECT 
        id,
        name,
        address,
        latitude,
        longitude,
        available_beds,
        available_icu_beds as icu_beds,
        available_trauma_bays as emergency_beds,
        specialties,
        status
      FROM hospitals
      WHERE LOWER(status) IN ('active', 'operational')
      ORDER BY id
    `;

    const result = await db.query(query);
    return result.rows;
  }

  static scoreHospital(hospital, incidentType, severity, fromLat, fromLng) {
    let score = 100;

    const distance = this.calculateDistance(fromLat, fromLng, hospital.latitude, hospital.longitude);
    const travelTime = this.estimateTravelTime(distance);

    // Distance scoring: closer is better
    if (distance < 5) {
      score += 30;
    } else if (distance < 10) {
      score += 20;
    } else if (distance < 20) {
      score += 10;
    } else {
      score -= (distance - 20) * 2; // Penalty for far hospitals
    }

    // Bed availability
    const totalAvailableBeds = (hospital.available_beds || 0) + (hospital.emergency_beds || 0);
    if (totalAvailableBeds > 10) {
      score += 20;
    } else if (totalAvailableBeds > 5) {
      score += 10;
    } else if (totalAvailableBeds > 0) {
      score += 5;
    } else {
      score -= 30; // Heavy penalty for no beds
    }

    // ICU beds for critical cases
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      if (hospital.icu_beds > 5) {
        score += 15;
      } else if (hospital.icu_beds > 0) {
        score += 8;
      } else {
        score -= 20;
      }
    }

    // Specialty matching
    const requiredSpecialties = INCIDENT_TYPE_SPECIALTIES[incidentType] || [];
    const hospitalSpecialties = hospital.specialties || [];
    
    const matchingSpecialties = requiredSpecialties.filter(req =>
      hospitalSpecialties.some(hosp => hosp.toLowerCase().includes(req.toLowerCase()))
    );

    score += matchingSpecialties.length * 15;

    return {
      hospital_id: hospital.id,
      hospital_name: hospital.name,
      hospital_address: hospital.address,
      distance_km: distance,
      travel_time_minutes: travelTime,
      available_beds: totalAvailableBeds,
      icu_beds: hospital.icu_beds || 0,
      matching_specialties: matchingSpecialties,
      score: Math.max(0, score),
    };
  }

  static async scoreAllHospitals(incidentType, severity, fromLat, fromLng) {
    const hospitals = await this.getAllHospitals();

    if (hospitals.length === 0) {
      logger.warn('No operational hospitals found');
      return [];
    }

    const scoredHospitals = hospitals.map(hospital =>
      this.scoreHospital(hospital, incidentType, severity, fromLat, fromLng)
    );

    scoredHospitals.sort((a, b) => b.score - a.score);

    return scoredHospitals;
  }

  static async selectBestHospitals(incidentType, severity, fromLat, fromLng, count = 3) {
    const scoredHospitals = await this.scoreAllHospitals(incidentType, severity, fromLat, fromLng);
    
    const topHospitals = scoredHospitals.slice(0, count);

    logger.info('Selected top hospitals', {
      count: topHospitals.length,
      top_choice: topHospitals[0]?.hospital_name,
      top_score: topHospitals[0]?.score,
    });

    return topHospitals;
  }

  static generateHospitalReasoning(selectedHospital) {
    const reasons = [];

    if (selectedHospital.distance_km < 5) {
      reasons.push(`Very close (${selectedHospital.distance_km.toFixed(1)} km)`);
    } else {
      reasons.push(`${selectedHospital.travel_time_minutes} min travel time`);
    }

    if (selectedHospital.matching_specialties.length > 0) {
      reasons.push(`has ${selectedHospital.matching_specialties.join(', ')}`);
    }

    if (selectedHospital.icu_beds > 0) {
      reasons.push(`${selectedHospital.icu_beds} ICU beds available`);
    }

    if (selectedHospital.available_beds > 0) {
      reasons.push(`${selectedHospital.available_beds} beds available`);
    }

    return reasons.join(' + ');
  }
}

module.exports = HospitalScorer;
