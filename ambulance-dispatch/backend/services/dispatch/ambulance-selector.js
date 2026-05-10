const db = require('../../api/config/database');
const logger = require('../../api/utils/logger');

const EQUIPMENT_REQUIREMENTS = {
  CRITICAL: 'ALS',
  HIGH: 'ALS',
  MEDIUM: 'BLS',
  LOW: 'BLS',
};

class AmbulanceSelector {
  static async getAvailableAmbulances() {
    const query = `
      SELECT 
        id,
        vehicle_number,
        equipment_type,
        status,
        current_location_lat,
        current_location_lng,
        fuel_level,
        driver_name,
        driver_phone,
        last_maintenance_date
      FROM ambulances
      WHERE status = 'AVAILABLE'
      AND fuel_level > 10
      ORDER BY id
    `;

    const result = await db.query(query);
    return result.rows;
  }

  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  static estimateTravelTime(distanceKm) {
    const avgSpeedKmh = 60; // Average emergency vehicle speed
    const timeHours = distanceKm / avgSpeedKmh;
    const timeMinutes = timeHours * 60;
    return Math.ceil(timeMinutes);
  }

  static filterByEquipment(ambulances, requiredEquipment) {
    if (requiredEquipment === 'BLS') {
      return ambulances;
    }
    
    return ambulances.filter(amb => amb.equipment_type === requiredEquipment);
  }

  static scoreAmbulance(ambulance, travelTimeMinutes, requiredEquipment) {
    let score = 100;

    // Distance penalty: -3 points per minute
    score -= travelTimeMinutes * 3;

    // Equipment match bonus
    if (ambulance.equipment_type === requiredEquipment) {
      score += 20;
    } else if (requiredEquipment === 'BLS' && ambulance.equipment_type === 'ALS') {
      score += 10; // ALS can handle BLS cases
    }

    // Fuel level bonus
    if (ambulance.fuel_level > 50) {
      score += 10;
    } else if (ambulance.fuel_level > 25) {
      score += 5;
    }

    // Recent maintenance bonus
    if (ambulance.last_maintenance_date) {
      const daysSinceMaintenance = (Date.now() - new Date(ambulance.last_maintenance_date)) / (1000 * 60 * 60 * 24);
      if (daysSinceMaintenance < 30) {
        score += 5;
      }
    }

    return Math.max(0, score);
  }

  static async selectBestAmbulance(incidentLat, incidentLng, severity) {
    const availableAmbulances = await this.getAvailableAmbulances();

    if (availableAmbulances.length === 0) {
      logger.warn('No available ambulances found');
      return null;
    }

    const requiredEquipment = EQUIPMENT_REQUIREMENTS[severity] || 'BLS';
    
    const scoredAmbulances = availableAmbulances.map(ambulance => {
      const distance = this.calculateDistance(
        ambulance.current_location_lat,
        ambulance.current_location_lng,
        incidentLat,
        incidentLng
      );

      const travelTime = this.estimateTravelTime(distance);
      const score = this.scoreAmbulance(ambulance, travelTime, requiredEquipment);

      return {
        ...ambulance,
        distance_km: distance,
        travel_time_minutes: travelTime,
        score,
        required_equipment: requiredEquipment,
      };
    });

    scoredAmbulances.sort((a, b) => b.score - a.score);

    const preferred = this.filterByEquipment(scoredAmbulances, requiredEquipment);
    
    if (preferred.length > 0) {
      logger.info('Selected ambulance (preferred equipment)', {
        ambulance_id: preferred[0].id,
        vehicle_number: preferred[0].vehicle_number,
        score: preferred[0].score,
        travel_time: preferred[0].travel_time_minutes,
      });
      return preferred[0];
    }

    logger.info('Selected ambulance (fallback)', {
      ambulance_id: scoredAmbulances[0].id,
      vehicle_number: scoredAmbulances[0].vehicle_number,
      score: scoredAmbulances[0].score,
    });

    return scoredAmbulances[0];
  }

  static generateAmbulanceReasoning(selectedAmbulance) {
    const reasons = [];

    if (selectedAmbulance.distance_km < 5) {
      reasons.push(`Very close (${selectedAmbulance.distance_km.toFixed(1)} km)`);
    } else if (selectedAmbulance.distance_km < 10) {
      reasons.push(`Close proximity (${selectedAmbulance.distance_km.toFixed(1)} km)`);
    } else {
      reasons.push(`${selectedAmbulance.distance_km.toFixed(1)} km away`);
    }

    reasons.push(`${selectedAmbulance.travel_time_minutes} min ETA`);

    if (selectedAmbulance.equipment_type === selectedAmbulance.required_equipment) {
      reasons.push(`${selectedAmbulance.equipment_type} equipped`);
    } else {
      reasons.push(`${selectedAmbulance.equipment_type} (exceeds ${selectedAmbulance.required_equipment} requirement)`);
    }

    if (selectedAmbulance.fuel_level > 50) {
      reasons.push(`adequate fuel (${selectedAmbulance.fuel_level}%)`);
    }

    return reasons.join(', ');
  }
}

module.exports = AmbulanceSelector;
