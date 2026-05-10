const { calculateDistance } = require('./hotspots');

const MAX_RESPONSE_TIME_MINUTES = 15;
const MAX_RESPONSE_DISTANCE_KM = 20;
const AVERAGE_SPEED_KMH = 60;

function calculateCoverageGaps(ambulances, zones) {
  const gaps = [];
  
  zones.forEach(zone => {
    const nearestAmbulance = findNearestAmbulance(
      zone.center_lat || zone.lat,
      zone.center_lng || zone.lng,
      ambulances
    );
    
    if (!nearestAmbulance) {
      gaps.push({
        zone_lat: zone.center_lat || zone.lat,
        zone_lng: zone.center_lng || zone.lng,
        incident_count: zone.incident_count,
        risk_level: zone.risk_level,
        gap_type: 'NO_COVERAGE',
        message: 'No ambulance within coverage area'
      });
      return;
    }
    
    const estimatedResponseTime = (nearestAmbulance.distance / AVERAGE_SPEED_KMH) * 60;
    
    if (estimatedResponseTime > MAX_RESPONSE_TIME_MINUTES) {
      gaps.push({
        zone_lat: zone.center_lat || zone.lat,
        zone_lng: zone.center_lng || zone.lng,
        incident_count: zone.incident_count,
        risk_level: zone.risk_level,
        gap_type: 'POOR_COVERAGE',
        nearest_ambulance: nearestAmbulance.call_sign,
        distance_km: nearestAmbulance.distance,
        estimated_response_minutes: Math.round(estimatedResponseTime),
        message: `Nearest ambulance ${nearestAmbulance.call_sign} is ${Math.round(estimatedResponseTime)} min away`
      });
    }
  });
  
  gaps.sort((a, b) => (b.incident_count || 0) - (a.incident_count || 0));
  
  return gaps;
}

function findNearestAmbulance(lat, lng, ambulances) {
  let nearest = null;
  let minDistance = Infinity;
  
  ambulances.forEach(ambulance => {
    if (!ambulance.latitude || !ambulance.longitude) return;
    if (ambulance.status === 'OFFLINE' || ambulance.status === 'OUT_OF_SERVICE') return;
    
    const distance = calculateDistance(
      lat, lng,
      ambulance.latitude, ambulance.longitude
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = {
        ...ambulance,
        distance
      };
    }
  });
  
  return nearest;
}

function calculateOptimalDistribution(ambulances, demandZones) {
  const availableAmbulances = ambulances.filter(a => 
    a.status === 'AVAILABLE' && a.latitude && a.longitude
  );
  
  const sortedZones = [...demandZones].sort((a, b) => 
    (b.predicted_incidents || b.incident_count || 0) - 
    (a.predicted_incidents || a.incident_count || 0)
  );
  
  const assignments = new Map();
  const assignedAmbulances = new Set();
  
  sortedZones.forEach(zone => {
    const zoneLat = zone.center_lat || zone.lat;
    const zoneLng = zone.center_lng || zone.lng;
    
    const unassignedAmbulances = availableAmbulances.filter(a => 
      !assignedAmbulances.has(a.id)
    );
    
    if (unassignedAmbulances.length === 0) return;
    
    const nearest = findNearestAmbulance(zoneLat, zoneLng, unassignedAmbulances);
    
    if (nearest) {
      assignments.set(zone, nearest);
      assignedAmbulances.add(nearest.id);
    }
  });
  
  return {
    assignments: Array.from(assignments.entries()).map(([zone, ambulance]) => ({
      zone: {
        lat: zone.center_lat || zone.lat,
        lng: zone.center_lng || zone.lng,
        demand: zone.predicted_incidents || zone.incident_count || 0,
        risk_level: zone.risk_level
      },
      ambulance: {
        id: ambulance.id,
        call_sign: ambulance.call_sign,
        current_lat: ambulance.latitude,
        current_lng: ambulance.longitude,
        distance_to_zone: ambulance.distance
      }
    })),
    unassigned_ambulances: availableAmbulances.filter(a => !assignedAmbulances.has(a.id)),
    coverage_percentage: (assignedAmbulances.size / sortedZones.length) * 100
  };
}

function suggestRepositioning(ambulances, hotspots, demandZones = []) {
  const gaps = calculateCoverageGaps(ambulances, hotspots);
  const currentDistribution = calculateCurrentDistribution(ambulances);
  const moves = [];
  
  const availableAmbulances = ambulances.filter(a => a.status === 'AVAILABLE');
  
  gaps.forEach(gap => {
    if (availableAmbulances.length === 0) return;
    
    const candidateAmbulances = availableAmbulances.filter(a => {
      if (!a.latitude || !a.longitude) return false;
      
      const movesAffectingThis = moves.filter(m => m.ambulance_id === a.id);
      if (movesAffectingThis.length > 0) return false;
      
      const distance = calculateDistance(
        a.latitude, a.longitude,
        gap.zone_lat, gap.zone_lng
      );
      
      return distance < MAX_RESPONSE_DISTANCE_KM;
    });
    
    if (candidateAmbulances.length === 0) return;
    
    candidateAmbulances.sort((a, b) => {
      const distA = calculateDistance(a.latitude, a.longitude, gap.zone_lat, gap.zone_lng);
      const distB = calculateDistance(b.latitude, b.longitude, gap.zone_lat, gap.zone_lng);
      return distA - distB;
    });
    
    const selectedAmbulance = candidateAmbulances[0];
    const distance = calculateDistance(
      selectedAmbulance.latitude, selectedAmbulance.longitude,
      gap.zone_lat, gap.zone_lng
    );
    
    const priority = gap.risk_level === 'HIGH' ? 'HIGH' : 
                    gap.incident_count >= 10 ? 'HIGH' :
                    gap.risk_level === 'MEDIUM' ? 'MEDIUM' : 'LOW';
    
    moves.push({
      ambulance_id: selectedAmbulance.id,
      ambulance_call_sign: selectedAmbulance.call_sign,
      from_lat: selectedAmbulance.latitude,
      from_lng: selectedAmbulance.longitude,
      to_lat: gap.zone_lat,
      to_lng: gap.zone_lng,
      distance_km: Math.round(distance * 10) / 10,
      estimated_time_minutes: Math.round((distance / AVERAGE_SPEED_KMH) * 60),
      reason: gap.message,
      priority: priority,
      gap_type: gap.gap_type,
      zone_risk: gap.risk_level,
      zone_incidents: gap.incident_count || 0
    });
  });
  
  demandZones.forEach(zone => {
    if (zone.risk_level !== 'HIGH') return;
    if (moves.find(m => 
      Math.abs(m.to_lat - zone.lat) < 0.01 && 
      Math.abs(m.to_lng - zone.lng) < 0.01
    )) return;
    
    const nearest = findNearestAmbulance(zone.lat, zone.lng, availableAmbulances);
    if (!nearest) return;
    
    const estimatedTime = (nearest.distance / AVERAGE_SPEED_KMH) * 60;
    if (estimatedTime < 10) return;
    
    if (moves.find(m => m.ambulance_id === nearest.id)) return;
    
    moves.push({
      ambulance_id: nearest.id,
      ambulance_call_sign: nearest.call_sign,
      from_lat: nearest.latitude,
      from_lng: nearest.longitude,
      to_lat: zone.lat,
      to_lng: zone.lng,
      distance_km: Math.round(nearest.distance * 10) / 10,
      estimated_time_minutes: Math.round(estimatedTime),
      reason: `High demand zone predicted: ${zone.predicted_incidents} incidents expected`,
      priority: 'MEDIUM',
      gap_type: 'PREDICTED_DEMAND',
      zone_risk: zone.risk_level,
      zone_incidents: zone.predicted_incidents
    });
  });
  
  moves.sort((a, b) => {
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    return b.zone_incidents - a.zone_incidents;
  });
  
  return {
    timestamp: new Date().toISOString(),
    current_distribution: currentDistribution,
    coverage_gaps: gaps.length,
    suggested_moves: moves,
    total_moves: moves.length,
    high_priority_moves: moves.filter(m => m.priority === 'HIGH').length,
    summary: {
      critical_gaps: gaps.filter(g => g.risk_level === 'HIGH').length,
      total_gaps: gaps.length,
      ambulances_available: availableAmbulances.length,
      coverage_improvement: moves.length > 0 ? 
        `Repositioning ${moves.length} ambulances will cover ${Math.min(moves.length, gaps.length)} gaps` :
        'No repositioning needed - coverage is adequate'
    }
  };
}

function calculateCurrentDistribution(ambulances) {
  const distribution = {
    total: ambulances.length,
    by_status: {},
    by_type: {},
    by_zone: {}
  };
  
  ambulances.forEach(a => {
    distribution.by_status[a.status] = (distribution.by_status[a.status] || 0) + 1;
    distribution.by_type[a.type] = (distribution.by_type[a.type] || 0) + 1;
    
    if (a.base_station) {
      distribution.by_zone[a.base_station] = (distribution.by_zone[a.base_station] || 0) + 1;
    }
  });
  
  return distribution;
}

function evaluateRepositioningImpact(currentPositions, suggestedMoves, hotspots) {
  const beforeCoverage = calculateCoverageMetrics(currentPositions, hotspots);
  
  const afterPositions = currentPositions.map(amb => {
    const move = suggestedMoves.find(m => m.ambulance_id === amb.id);
    if (move) {
      return {
        ...amb,
        latitude: move.to_lat,
        longitude: move.to_lng
      };
    }
    return amb;
  });
  
  const afterCoverage = calculateCoverageMetrics(afterPositions, hotspots);
  
  return {
    before: beforeCoverage,
    after: afterCoverage,
    improvement: {
      avg_response_time_reduction: beforeCoverage.avg_response_time - afterCoverage.avg_response_time,
      zones_with_coverage_increase: afterCoverage.zones_covered - beforeCoverage.zones_covered,
      percentage_improvement: ((afterCoverage.zones_covered - beforeCoverage.zones_covered) / hotspots.length) * 100
    }
  };
}

function calculateCoverageMetrics(ambulances, zones) {
  let totalResponseTime = 0;
  let zonesCovered = 0;
  
  zones.forEach(zone => {
    const nearest = findNearestAmbulance(
      zone.center_lat || zone.lat,
      zone.center_lng || zone.lng,
      ambulances
    );
    
    if (nearest) {
      const responseTime = (nearest.distance / AVERAGE_SPEED_KMH) * 60;
      totalResponseTime += responseTime;
      
      if (responseTime <= MAX_RESPONSE_TIME_MINUTES) {
        zonesCovered++;
      }
    }
  });
  
  return {
    zones_covered: zonesCovered,
    avg_response_time: zones.length > 0 ? totalResponseTime / zones.length : 0,
    coverage_percentage: (zonesCovered / zones.length) * 100
  };
}

module.exports = {
  suggestRepositioning,
  calculateCoverageGaps,
  calculateOptimalDistribution,
  findNearestAmbulance,
  evaluateRepositioningImpact,
  calculateCoverageMetrics
};
