const EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function getGridCell(lat, lng, gridSizeKm) {
  const latDegrees = (gridSizeKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const lngDegrees = (gridSizeKm / EARTH_RADIUS_KM) * (180 / Math.PI) / Math.cos(toRadians(lat));
  
  const gridLat = Math.floor(lat / latDegrees) * latDegrees;
  const gridLng = Math.floor(lng / lngDegrees) * lngDegrees;
  
  return {
    lat: gridLat,
    lng: gridLng,
    center_lat: gridLat + latDegrees / 2,
    center_lng: gridLng + lngDegrees / 2,
    key: `${gridLat.toFixed(4)},${gridLng.toFixed(4)}`
  };
}

function calculateHotspots(incidents, gridSizeKm = 1) {
  const gridMap = new Map();
  
  incidents.forEach(incident => {
    if (!incident.location_lat || !incident.location_lng) return;
    
    const cell = getGridCell(incident.location_lat, incident.location_lng, gridSizeKm);
    
    if (!gridMap.has(cell.key)) {
      gridMap.set(cell.key, {
        grid_lat: cell.lat,
        grid_lng: cell.lng,
        center_lat: cell.center_lat,
        center_lng: cell.center_lng,
        incident_count: 0,
        critical_count: 0,
        high_count: 0,
        incidents: [],
        severity_breakdown: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0
        },
        type_breakdown: {
          MEDICAL: 0,
          ACCIDENT: 0,
          CARDIAC: 0,
          STROKE: 0,
          TRAUMA: 0,
          MATERNITY: 0,
          OTHER: 0
        }
      });
    }
    
    const grid = gridMap.get(cell.key);
    grid.incident_count++;
    grid.incidents.push(incident.id);
    
    if (incident.severity === 'CRITICAL') grid.critical_count++;
    if (incident.severity === 'HIGH') grid.high_count++;
    
    if (grid.severity_breakdown[incident.severity] !== undefined) {
      grid.severity_breakdown[incident.severity]++;
    }
    
    if (grid.type_breakdown[incident.incident_type] !== undefined) {
      grid.type_breakdown[incident.incident_type]++;
    }
  });
  
  const analysisStartDate = incidents.length > 0 
    ? new Date(Math.min(...incidents.map(i => new Date(i.created_at))))
    : new Date();
  const analysisEndDate = incidents.length > 0
    ? new Date(Math.max(...incidents.map(i => new Date(i.created_at))))
    : new Date();
  const daysDiff = Math.max(1, (analysisEndDate - analysisStartDate) / (1000 * 60 * 60 * 24));
  
  const hotspots = Array.from(gridMap.values()).map(grid => ({
    ...grid,
    incidents_per_day: Math.round((grid.incident_count / daysDiff) * 100) / 100,
    risk_level: getRiskLevel(grid.incident_count, daysDiff),
    primary_incident_type: getPrimaryType(grid.type_breakdown)
  }));
  
  hotspots.sort((a, b) => b.incident_count - a.incident_count);
  
  return hotspots;
}

function getRiskLevel(incidentCount, days) {
  const incidentsPerDay = incidentCount / days;
  
  if (incidentsPerDay >= 5) return 'HIGH';
  if (incidentsPerDay >= 2) return 'MEDIUM';
  return 'LOW';
}

function getPrimaryType(typeBreakdown) {
  let maxType = 'MEDICAL';
  let maxCount = 0;
  
  Object.entries(typeBreakdown).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxType = type;
    }
  });
  
  return maxType;
}

function getIncidentsByGrid(incidents, gridSizeKm = 1) {
  const gridMap = new Map();
  
  incidents.forEach(incident => {
    if (!incident.location_lat || !incident.location_lng) return;
    
    const cell = getGridCell(incident.location_lat, incident.location_lng, gridSizeKm);
    
    if (!gridMap.has(cell.key)) {
      gridMap.set(cell.key, []);
    }
    
    gridMap.get(cell.key).push(incident);
  });
  
  return gridMap;
}

function identifyHighRiskZones(hotspots, threshold = 'MEDIUM') {
  const thresholdMap = {
    HIGH: ['HIGH'],
    MEDIUM: ['HIGH', 'MEDIUM'],
    LOW: ['HIGH', 'MEDIUM', 'LOW']
  };
  
  const allowedLevels = thresholdMap[threshold] || thresholdMap.MEDIUM;
  
  return hotspots.filter(h => allowedLevels.includes(h.risk_level));
}

function getHeatmapData(hotspots) {
  return hotspots.map(h => ({
    lat: h.center_lat,
    lng: h.center_lng,
    intensity: h.incident_count,
    risk_level: h.risk_level
  }));
}

module.exports = {
  calculateHotspots,
  getIncidentsByGrid,
  identifyHighRiskZones,
  getHeatmapData,
  calculateDistance,
  getGridCell
};
