const db = require('../../api/config/database');
const { IncidentModel } = require('../incidents/model');
const { HospitalScorer } = require('./hospital-scorer');
const { HospitalFilters } = require('./filters');
const { TransparencyService } = require('./transparency');
const { NotFoundError, ValidationError } = require('../../api/utils/errors');
const logger = require('../../api/utils/logger');

class AllocationService {
  /**
   * Get all hospitals from database
   */
  static async getHospitals(filters = {}) {
    let query = `
      SELECT 
        id,
        name,
        address,
        latitude,
        longitude,
        phone,
        email,
        total_general_beds,
        general_beds_available,
        total_icu_beds,
        icu_beds_available,
        specialists,
        capabilities,
        trauma_level,
        is_active,
        created_at,
        updated_at
      FROM hospitals
      WHERE is_active = true
    `;
    
    const params = [];
    
    if (filters.has_icu) {
      query += ` AND icu_beds_available > 0`;
    }
    
    if (filters.has_general_beds) {
      query += ` AND general_beds_available > 0`;
    }
    
    if (filters.trauma_level) {
      params.push(filters.trauma_level);
      query += ` AND trauma_level >= $${params.length}`;
    }
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get travel data for hospitals from incident location
   * This would integrate with a routing service (Google Maps, OSRM, etc.)
   * For now, we'll calculate simple straight-line distance and estimate time
   */
  static async getTravelData(incidentLat, incidentLng, hospitals) {
    const travelDataMap = {};
    
    for (const hospital of hospitals) {
      // Haversine formula for distance
      const R = 6371; // Earth radius in km
      const dLat = this.toRad(hospital.latitude - incidentLat);
      const dLng = this.toRad(hospital.longitude - incidentLng);
      
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(incidentLat)) * 
        Math.cos(this.toRad(hospital.latitude)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      // Estimate travel time: assume 60 km/h average with urban traffic
      // This should be replaced with actual routing API
      const estimatedTime = (distance / 60) * 60; // minutes
      
      // Apply traffic multiplier based on time of day (simplified)
      const hour = new Date().getHours();
      let trafficMultiplier = 1.0;
      
      if (hour >= 7 && hour <= 9) trafficMultiplier = 1.5; // Morning rush
      if (hour >= 17 && hour <= 19) trafficMultiplier = 1.5; // Evening rush
      
      travelDataMap[hospital.id] = {
        travel_time_minutes: estimatedTime,
        distance_km: distance,
        traffic_multiplier: trafficMultiplier,
      };
    }
    
    return travelDataMap;
  }

  static toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Score hospitals for an incident
   */
  static async scoreHospitalsForIncident(incidentId, maxResults = 5) {
    // Get incident data
    const incident = await IncidentModel.findById(incidentId);
    
    // Get all active hospitals
    const hospitals = await this.getHospitals();
    
    if (hospitals.length === 0) {
      throw new ValidationError('No hospitals available in the system');
    }
    
    // Get travel data
    const travelDataMap = await this.getTravelData(
      incident.location_lat,
      incident.location_lng,
      hospitals
    );
    
    // Apply filters
    const { passed: filteredHospitals, rejected: rejectedHospitals } = 
      HospitalFilters.filterHospitals(hospitals, incident, travelDataMap, {
        isRural: false, // Could be determined from incident location
      });
    
    if (filteredHospitals.length === 0) {
      logger.warn(`No hospitals passed filters for incident ${incidentId}`);
      throw new ValidationError('No suitable hospitals found for this incident');
    }
    
    // Score hospitals
    const scoredHospitals = await HospitalScorer.scoreHospitals(
      filteredHospitals,
      incident,
      travelDataMap,
      maxResults
    );
    
    return {
      incident,
      recommended_hospitals: scoredHospitals,
      rejected_hospitals: rejectedHospitals,
      filter_summary: HospitalFilters.generateFilterSummary(rejectedHospitals),
    };
  }

  /**
   * Get top N recommended hospitals
   */
  static async getRecommendations(incidentId, topN = 3) {
    const result = await this.scoreHospitalsForIncident(incidentId, topN);
    
    const recommendations = result.recommended_hospitals.map((hospital, index) => ({
      ...hospital,
      rank: index + 1,
      reasoning: HospitalScorer.generateReasoning(hospital, index + 1),
    }));
    
    return {
      incident_id: incidentId,
      incident_type: result.incident.incident_type,
      incident_severity: result.incident.severity,
      recommended_hospitals: recommendations,
      total_evaluated: result.recommended_hospitals.length + result.rejected_hospitals.length,
      rejected_count: result.rejected_hospitals.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log allocation decision
   */
  static async logAllocation(incidentId, selectedHospitalId, recommendedHospitals, isOverride, overrideReason = null) {
    const query = `
      INSERT INTO allocation_logs (
        incident_id,
        selected_hospital_id,
        recommended_hospital_ids,
        is_override,
        override_reason,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    
    const recommendedIds = recommendedHospitals.map(h => h.hospital_id);
    
    const values = [
      incidentId,
      selectedHospitalId,
      JSON.stringify(recommendedIds),
      isOverride,
      overrideReason,
    ];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      // Table might not exist yet, log warning but don't fail
      logger.warn('Could not log allocation decision:', error.message);
      return null;
    }
  }

  /**
   * Allocate hospital to incident
   */
  static async allocateHospital(incidentId, hospitalId, userId, overrideReason = null) {
    // Get recommendations
    const recommendations = await this.getRecommendations(incidentId, 5);
    
    const topRecommendation = recommendations.recommended_hospitals[0];
    const isOverride = topRecommendation.hospital_id !== hospitalId;
    
    // Assign hospital to incident
    const incident = await IncidentModel.assignHospital(incidentId, hospitalId, userId);
    
    // Log the allocation decision
    await this.logAllocation(
      incidentId,
      hospitalId,
      recommendations.recommended_hospitals,
      isOverride,
      overrideReason
    );
    
    // Get the selected hospital details
    const selectedHospital = recommendations.recommended_hospitals.find(
      h => h.hospital_id === hospitalId
    );
    
    return {
      incident,
      selected_hospital: selectedHospital,
      was_override: isOverride,
      recommendations: recommendations.recommended_hospitals,
    };
  }

  /**
   * Get allocation reasoning for an incident
   */
  static async getAllocationReasoning(incidentId) {
    const incident = await IncidentModel.findById(incidentId);
    
    if (!incident.hospital_id) {
      throw new ValidationError('No hospital assigned to this incident');
    }
    
    // Get current recommendations (they might differ from when allocation was made)
    const result = await this.scoreHospitalsForIncident(incidentId, 5);
    
    const selectedHospital = result.recommended_hospitals.find(
      h => h.hospital_id === incident.hospital_id
    );
    
    if (!selectedHospital) {
      // Hospital was selected but didn't pass current filters
      return {
        incident_id: incidentId,
        selected_hospital_id: incident.hospital_id,
        note: 'Selected hospital no longer meets criteria (may have been valid at allocation time)',
        current_recommendations: result.recommended_hospitals,
      };
    }
    
    const explanation = TransparencyService.explainDecision(
      result.recommended_hospitals,
      selectedHospital,
      result.rejected_hospitals
    );
    
    return {
      incident_id: incidentId,
      incident_type: incident.incident_type,
      incident_severity: incident.severity,
      ...explanation,
    };
  }

  /**
   * Get allocation metrics and override patterns
   */
  static async getAllocationMetrics(days = 7) {
    const query = `
      SELECT 
        COUNT(*) as total_allocations,
        COUNT(*) FILTER (WHERE is_override = true) as total_overrides,
        COUNT(*) FILTER (WHERE is_override = false) as followed_recommendations,
        ROUND(
          (COUNT(*) FILTER (WHERE is_override = true)::NUMERIC / COUNT(*)::NUMERIC) * 100,
          2
        ) as override_percentage,
        COUNT(DISTINCT override_reason) FILTER (WHERE override_reason IS NOT NULL) as unique_override_reasons
      FROM allocation_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
    `;
    
    try {
      const result = await db.query(query);
      
      const reasonsQuery = `
        SELECT 
          override_reason,
          COUNT(*) as count
        FROM allocation_logs
        WHERE 
          is_override = true 
          AND override_reason IS NOT NULL
          AND created_at > NOW() - INTERVAL '${days} days'
        GROUP BY override_reason
        ORDER BY count DESC
        LIMIT 10
      `;
      
      const reasonsResult = await db.query(reasonsQuery);
      
      return {
        period_days: days,
        ...result.rows[0],
        top_override_reasons: reasonsResult.rows,
      };
    } catch (error) {
      logger.warn('Could not fetch allocation metrics:', error.message);
      return null;
    }
  }
}

module.exports = {
  AllocationService,
};
