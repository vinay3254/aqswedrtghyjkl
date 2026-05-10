const logger = require('../../api/middleware/logger');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Array} coord1 - [lng, lat]
 * @param {Array} coord2 - [lng, lat]
 * @returns {Number} Distance in meters
 */
function haversineDistance(coord1, coord2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = toRadians(coord1[1]);
  const φ2 = toRadians(coord2[1]);
  const Δφ = toRadians(coord2[1] - coord1[1]);
  const Δλ = toRadians(coord2[0] - coord1[0]);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * Calculate road distance from straight-line distance
 * Using typical road network factors
 * @param {Number} straightDistance - Distance in meters
 * @param {String} areaType - 'urban', 'suburban', or 'highway'
 * @returns {Number} Estimated road distance in meters
 */
function calculateRoadDistance(straightDistance, areaType = 'urban') {
  const factors = {
    urban: 1.4,      // Urban areas have more turns
    suburban: 1.3,   // Suburban areas slightly less
    highway: 1.2     // Highways more direct
  };

  const factor = factors[areaType] || factors.urban;
  return straightDistance * factor;
}

/**
 * Estimate travel time based on distance and area type
 * @param {Number} distance - Distance in meters
 * @param {String} areaType - 'urban', 'suburban', or 'highway'
 * @param {Number} trafficMultiplier - Traffic factor (1.0 = no traffic)
 * @returns {Number} Duration in seconds
 */
function estimateDuration(distance, areaType = 'urban', trafficMultiplier = 1.0) {
  // Average speeds in km/h
  const speeds = {
    urban: 30,       // Urban with traffic lights
    suburban: 45,    // Suburban roads
    highway: 65      // Highway speeds
  };

  const speedKmh = speeds[areaType] || speeds.urban;
  const speedMs = speedKmh * 1000 / 3600; // Convert to m/s
  
  const baseDuration = distance / speedMs; // Duration in seconds
  return baseDuration * trafficMultiplier;
}

/**
 * Detect area type based on coordinates (simplified)
 * In production, this would check against geographical boundaries
 * @param {Array} coord1 - [lng, lat]
 * @param {Array} coord2 - [lng, lat]
 * @returns {String} Area type
 */
function detectAreaType(coord1, coord2) {
  // Simplified: assume urban if distance is short
  const distance = haversineDistance(coord1, coord2);
  
  if (distance < 10000) return 'urban';      // < 10km
  if (distance < 50000) return 'suburban';   // 10-50km
  return 'highway';                          // > 50km
}

/**
 * Calculate fallback route when OSRM is unavailable
 * @param {Array} coordinates - Array of [lng, lat] coordinates
 * @param {Object} options - Calculation options
 * @returns {Object} Fallback route data
 */
function calculateFallbackRoute(coordinates, options = {}) {
  const { trafficMultiplier = 1.0 } = options;

  if (!coordinates || coordinates.length < 2) {
    throw new Error('At least 2 coordinates required');
  }

  let totalDistance = 0;
  let totalDuration = 0;
  const legs = [];

  // Calculate for each leg
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];

    const straightDistance = haversineDistance(start, end);
    const areaType = detectAreaType(start, end);
    const roadDistance = calculateRoadDistance(straightDistance, areaType);
    const duration = estimateDuration(roadDistance, areaType, trafficMultiplier);

    totalDistance += roadDistance;
    totalDuration += duration;

    legs.push({
      distance: roadDistance,
      duration: duration,
      steps: [],
      summary: `${areaType} route`,
      weight: duration
    });
  }

  // Create simplified GeoJSON geometry
  const geometry = {
    type: 'LineString',
    coordinates: coordinates
  };

  logger.warn('Using fallback route calculation', {
    coordinates: coordinates.length,
    totalDistance,
    totalDuration,
    trafficMultiplier
  });

  return {
    code: 'Ok',
    routes: [{
      distance: totalDistance,
      duration: totalDuration,
      weight: totalDuration,
      weight_name: 'duration',
      legs: legs,
      geometry: geometry
    }],
    waypoints: coordinates.map((coord, index) => ({
      hint: 'fallback',
      distance: 0,
      name: `Point ${index + 1}`,
      location: coord
    })),
    fallback: true,
    trafficMultiplier
  };
}

/**
 * Calculate simple ETA using fallback method
 * @param {Array} origin - [lng, lat]
 * @param {Array} destination - [lng, lat]
 * @param {Number} trafficMultiplier - Traffic factor
 * @returns {Object} ETA information
 */
function calculateFallbackETA(origin, destination, trafficMultiplier = 1.0) {
  const straightDistance = haversineDistance(origin, destination);
  const areaType = detectAreaType(origin, destination);
  const distance = calculateRoadDistance(straightDistance, areaType);
  const duration = estimateDuration(distance, areaType, trafficMultiplier);

  return {
    distance,
    duration,
    eta: new Date(Date.now() + duration * 1000),
    trafficMultiplier,
    areaType,
    fallback: true
  };
}

/**
 * Calculate distance matrix using fallback method
 * @param {Array} sources - Array of source coordinates
 * @param {Array} destinations - Array of destination coordinates
 * @returns {Object} Distance/duration matrices
 */
function calculateFallbackTable(sources, destinations = null) {
  const dests = destinations || sources;
  const durations = [];
  const distances = [];

  sources.forEach(source => {
    const durationRow = [];
    const distanceRow = [];

    dests.forEach(dest => {
      const straightDistance = haversineDistance(source, dest);
      const areaType = detectAreaType(source, dest);
      const distance = calculateRoadDistance(straightDistance, areaType);
      const duration = estimateDuration(distance, areaType);

      durationRow.push(duration);
      distanceRow.push(distance);
    });

    durations.push(durationRow);
    distances.push(distanceRow);
  });

  return {
    code: 'Ok',
    durations,
    distances,
    sources: sources.map((coord, i) => ({
      hint: 'fallback',
      distance: 0,
      name: `Source ${i + 1}`,
      location: coord
    })),
    destinations: dests.map((coord, i) => ({
      hint: 'fallback',
      distance: 0,
      name: `Destination ${i + 1}`,
      location: coord
    })),
    fallback: true
  };
}

module.exports = {
  haversineDistance,
  calculateRoadDistance,
  estimateDuration,
  detectAreaType,
  calculateFallbackRoute,
  calculateFallbackETA,
  calculateFallbackTable
};
