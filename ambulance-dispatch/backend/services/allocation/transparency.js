const { WEIGHTS } = require('./hospital-scorer');

class TransparencyService {
  /**
   * Format score breakdown for human readability
   */
  static formatScoreBreakdown(scoredHospital) {
    const breakdown = scoredHospital.score_breakdown;
    const raw = scoredHospital.raw_scores;
    
    return {
      total_score: scoredHospital.total_score,
      components: [
        {
          factor: 'Travel Time',
          weight: `${(WEIGHTS.TRAVEL_TIME * 100).toFixed(0)}%`,
          raw_score: raw.travel_time,
          weighted_score: breakdown.travel_time,
          details: `${scoredHospital.eta_minutes} minutes ETA, ${scoredHospital.distance_km} km`,
        },
        {
          factor: 'Bed Availability',
          weight: `${(WEIGHTS.BED_AVAILABILITY * 100).toFixed(0)}%`,
          raw_score: raw.bed_availability,
          weighted_score: breakdown.bed_availability,
          details: `${scoredHospital.general_beds_available} general, ${scoredHospital.icu_beds_available} ICU beds`,
        },
        {
          factor: 'Specialist Match',
          weight: `${(WEIGHTS.SPECIALIST_MATCH * 100).toFixed(0)}%`,
          raw_score: raw.specialist_match,
          weighted_score: breakdown.specialist_match,
          details: scoredHospital.has_required_specialist 
            ? `Has ${scoredHospital.required_specialist}` 
            : `Missing ${scoredHospital.required_specialist}`,
        },
        {
          factor: 'Urgency Match',
          weight: `${(WEIGHTS.URGENCY_MATCH * 100).toFixed(0)}%`,
          raw_score: raw.urgency_match,
          weighted_score: breakdown.urgency_match,
          details: scoredHospital.icu_beds_available > 0 
            ? 'ICU available' 
            : 'General beds only',
        },
        {
          factor: 'Facility Capability',
          weight: `${(WEIGHTS.FACILITY_CAPABILITY * 100).toFixed(0)}%`,
          raw_score: raw.facility_capability,
          weighted_score: breakdown.facility_capability,
          details: `${scoredHospital.capabilities.length} capabilities matched`,
        },
      ],
    };
  }

  /**
   * Find the most important factor for a decision
   */
  static findPrimaryFactor(scoredHospital) {
    const breakdown = scoredHospital.score_breakdown;
    
    const factors = [
      { name: 'travel_time', score: breakdown.travel_time, label: 'Travel Time' },
      { name: 'bed_availability', score: breakdown.bed_availability, label: 'Bed Availability' },
      { name: 'specialist_match', score: breakdown.specialist_match, label: 'Specialist Match' },
      { name: 'urgency_match', score: breakdown.urgency_match, label: 'Urgency Match' },
      { name: 'facility_capability', score: breakdown.facility_capability, label: 'Facility Capability' },
    ];
    
    factors.sort((a, b) => b.score - a.score);
    
    return {
      primary: factors[0],
      secondary: factors[1],
      tertiary: factors[2],
    };
  }

  /**
   * Generate comparison between hospitals
   */
  static compareHospitals(hospital1, hospital2) {
    const scoreDiff = hospital1.total_score - hospital2.total_score;
    const percentDiff = ((scoreDiff / hospital2.total_score) * 100).toFixed(1);
    
    const advantages = [];
    const disadvantages = [];
    
    // Compare each factor
    const factors = [
      { key: 'travel_time', label: 'travel time' },
      { key: 'bed_availability', label: 'bed availability' },
      { key: 'specialist_match', label: 'specialist match' },
      { key: 'urgency_match', label: 'urgency match' },
      { key: 'facility_capability', label: 'facility capability' },
    ];
    
    for (const factor of factors) {
      const diff = hospital1.score_breakdown[factor.key] - hospital2.score_breakdown[factor.key];
      
      if (diff > 1) {
        advantages.push({
          factor: factor.label,
          difference: diff.toFixed(2),
        });
      } else if (diff < -1) {
        disadvantages.push({
          factor: factor.label,
          difference: Math.abs(diff).toFixed(2),
        });
      }
    }
    
    return {
      score_difference: scoreDiff.toFixed(2),
      percent_difference: percentDiff,
      hospital1_better: scoreDiff > 0,
      advantages,
      disadvantages,
    };
  }

  /**
   * Generate decision explanation
   */
  static explainDecision(recommendedHospitals, selectedHospital, rejectedHospitals) {
    const topHospital = recommendedHospitals[0];
    const isTopChoice = topHospital.hospital_id === selectedHospital.hospital_id;
    
    const explanation = {
      selected_hospital: {
        id: selectedHospital.hospital_id,
        name: selectedHospital.hospital_name,
        score: selectedHospital.total_score,
        rank: recommendedHospitals.findIndex(h => h.hospital_id === selectedHospital.hospital_id) + 1,
      },
      is_top_recommendation: isTopChoice,
      primary_factors: this.findPrimaryFactor(selectedHospital),
      score_breakdown: this.formatScoreBreakdown(selectedHospital),
      alternatives_considered: recommendedHospitals.length,
      hospitals_rejected: rejectedHospitals.length,
    };
    
    if (!isTopChoice && recommendedHospitals.length > 0) {
      explanation.override_comparison = this.compareHospitals(topHospital, selectedHospital);
      explanation.override_note = 'Manual override - top recommendation was not selected';
    }
    
    return explanation;
  }

  /**
   * Generate allocation summary report
   */
  static generateAllocationReport(incident, recommendedHospitals, rejectedHospitals, selectedHospital = null) {
    const report = {
      incident: {
        id: incident.id,
        type: incident.incident_type,
        severity: incident.severity,
        location: {
          lat: incident.location_lat,
          lng: incident.location_lng,
          address: incident.location_address,
        },
      },
      recommended_hospitals: recommendedHospitals.map((h, index) => ({
        rank: index + 1,
        hospital_id: h.hospital_id,
        hospital_name: h.hospital_name,
        total_score: h.total_score,
        eta_minutes: h.eta_minutes,
        distance_km: h.distance_km,
        available_beds: h.available_beds,
        has_required_specialist: h.has_required_specialist,
        primary_strength: this.findPrimaryFactor(h).primary.label,
      })),
      filter_summary: {
        total_hospitals_evaluated: recommendedHospitals.length + rejectedHospitals.length,
        passed_filters: recommendedHospitals.length,
        rejected: rejectedHospitals.length,
      },
      timestamp: new Date().toISOString(),
    };
    
    if (selectedHospital) {
      report.selection = this.explainDecision(recommendedHospitals, selectedHospital, rejectedHospitals);
    }
    
    return report;
  }

  /**
   * Format rejection reasons for display
   */
  static formatRejectionReasons(rejectedHospitals) {
    const formatted = [];
    
    for (const item of rejectedHospitals) {
      formatted.push({
        hospital_id: item.hospital.id,
        hospital_name: item.hospital.name,
        reason_code: item.reason,
        reason_message: item.message,
      });
    }
    
    return formatted;
  }

  /**
   * Generate scoring weights explanation
   */
  static explainWeights() {
    return {
      description: 'Hospital scoring uses weighted multi-factor analysis',
      weights: [
        {
          factor: 'Travel Time',
          weight: WEIGHTS.TRAVEL_TIME,
          percentage: `${(WEIGHTS.TRAVEL_TIME * 100).toFixed(0)}%`,
          description: 'Time to reach hospital including traffic',
        },
        {
          factor: 'Bed Availability',
          weight: WEIGHTS.BED_AVAILABILITY,
          percentage: `${(WEIGHTS.BED_AVAILABILITY * 100).toFixed(0)}%`,
          description: 'Percentage of available beds (ICU for critical)',
        },
        {
          factor: 'Specialist Match',
          weight: WEIGHTS.SPECIALIST_MATCH,
          percentage: `${(WEIGHTS.SPECIALIST_MATCH * 100).toFixed(0)}%`,
          description: 'Availability of required medical specialist',
        },
        {
          factor: 'Urgency Match',
          weight: WEIGHTS.URGENCY_MATCH,
          percentage: `${(WEIGHTS.URGENCY_MATCH * 100).toFixed(0)}%`,
          description: 'Match between patient severity and facility type',
        },
        {
          factor: 'Facility Capability',
          weight: WEIGHTS.FACILITY_CAPABILITY,
          percentage: `${(WEIGHTS.FACILITY_CAPABILITY * 100).toFixed(0)}%`,
          description: 'Required equipment and capabilities',
        },
      ],
      total: 1.0,
    };
  }
}

module.exports = {
  TransparencyService,
};
