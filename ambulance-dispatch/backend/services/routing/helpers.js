const RoutingService = require('./service');

const routingService = new RoutingService();

/**
 * Integration helpers for ambulance dispatch system
 */

/**
 * Calculate route from ambulance to incident
 * @param {String} ambulanceId - Ambulance ID (to fetch location)
 * @param {String} incidentId - Incident ID (to fetch location)
 * @param {Object} db - Database connection
 * @returns {Object} Route information
 */
async function calculateAmbulanceToIncident(ambulanceId, incidentId, db) {
  try {
    // Fetch ambulance location
    const ambulance = await db.query(
      'SELECT current_location FROM ambulances WHERE id = $1',
      [ambulanceId]
    );

    if (!ambulance.rows[0]) {
      throw new Error(`Ambulance ${ambulanceId} not found`);
    }

    // Fetch incident location
    const incident = await db.query(
      'SELECT location FROM incidents WHERE id = $1',
      [incidentId]
    );

    if (!incident.rows[0]) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const ambulanceLocation = ambulance.rows[0].current_location.coordinates;
    const incidentLocation = incident.rows[0].location.coordinates;

    const route = await routingService.calculateRoute(
      [ambulanceLocation, incidentLocation],
      { useCache: true, simplify: true }
    );

    const eta = await routingService.calculateETA(
      ambulanceLocation,
      incidentLocation
    );

    return {
      ambulanceId,
      incidentId,
      route: route.routes[0],
      eta: eta.eta,
      distance: eta.distance,
      duration: eta.duration,
      durationMinutes: eta.durationMinutes,
      trafficLevel: eta.trafficLevel
    };

  } catch (error) {
    throw new Error(`Failed to calculate ambulance-to-incident route: ${error.message}`);
  }
}

/**
 * Calculate route from incident to hospital
 * @param {String} incidentId - Incident ID
 * @param {String} hospitalId - Hospital ID
 * @param {Object} db - Database connection
 * @returns {Object} Route information
 */
async function calculateIncidentToHospital(incidentId, hospitalId, db) {
  try {
    // Fetch incident location
    const incident = await db.query(
      'SELECT location FROM incidents WHERE id = $1',
      [incidentId]
    );

    if (!incident.rows[0]) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    // Fetch hospital location
    const hospital = await db.query(
      'SELECT location FROM hospitals WHERE id = $1',
      [hospitalId]
    );

    if (!hospital.rows[0]) {
      throw new Error(`Hospital ${hospitalId} not found`);
    }

    const incidentLocation = incident.rows[0].location.coordinates;
    const hospitalLocation = hospital.rows[0].location.coordinates;

    const route = await routingService.calculateRoute(
      [incidentLocation, hospitalLocation],
      { useCache: true, simplify: true }
    );

    const eta = await routingService.calculateETA(
      incidentLocation,
      hospitalLocation
    );

    return {
      incidentId,
      hospitalId,
      route: route.routes[0],
      eta: eta.eta,
      distance: eta.distance,
      duration: eta.duration,
      durationMinutes: eta.durationMinutes,
      trafficLevel: eta.trafficLevel
    };

  } catch (error) {
    throw new Error(`Failed to calculate incident-to-hospital route: ${error.message}`);
  }
}

/**
 * Calculate full route: Ambulance -> Incident -> Hospital
 * @param {String} ambulanceId - Ambulance ID
 * @param {String} incidentId - Incident ID
 * @param {String} hospitalId - Hospital ID
 * @param {Object} db - Database connection
 * @returns {Object} Complete route information
 */
async function calculateFullRoute(ambulanceId, incidentId, hospitalId, db) {
  try {
    // Fetch all locations
    const [ambulance, incident, hospital] = await Promise.all([
      db.query('SELECT current_location FROM ambulances WHERE id = $1', [ambulanceId]),
      db.query('SELECT location FROM incidents WHERE id = $1', [incidentId]),
      db.query('SELECT location FROM hospitals WHERE id = $1', [hospitalId])
    ]);

    if (!ambulance.rows[0]) throw new Error(`Ambulance ${ambulanceId} not found`);
    if (!incident.rows[0]) throw new Error(`Incident ${incidentId} not found`);
    if (!hospital.rows[0]) throw new Error(`Hospital ${hospitalId} not found`);

    const ambulanceLocation = ambulance.rows[0].current_location.coordinates;
    const incidentLocation = incident.rows[0].location.coordinates;
    const hospitalLocation = hospital.rows[0].location.coordinates;

    const fullRoute = await routingService.calculateFullRoute(
      ambulanceLocation,
      incidentLocation,
      hospitalLocation
    );

    return {
      ambulanceId,
      incidentId,
      hospitalId,
      legs: fullRoute.legs,
      total: fullRoute.total,
      eta: {
        toIncident: new Date(Date.now() + fullRoute.legs[0].duration * 1000).toISOString(),
        toHospital: new Date(Date.now() + fullRoute.total.duration * 1000).toISOString()
      }
    };

  } catch (error) {
    throw new Error(`Failed to calculate full route: ${error.message}`);
  }
}

/**
 * Find nearest ambulances to an incident with route information
 * @param {String} incidentId - Incident ID
 * @param {Object} db - Database connection
 * @param {Number} limit - Maximum number of ambulances to return
 * @returns {Array} Ambulances with route information
 */
async function findNearestAmbulances(incidentId, db, limit = 5) {
  try {
    // Fetch incident location
    const incident = await db.query(
      'SELECT location FROM incidents WHERE id = $1',
      [incidentId]
    );

    if (!incident.rows[0]) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const incidentLocation = incident.rows[0].location.coordinates;

    // Fetch available ambulances
    const ambulances = await db.query(
      `SELECT id, vehicle_number, current_location, type
       FROM ambulances
       WHERE status = 'available'
       ORDER BY current_location <-> ST_SetSRID(ST_Point($1, $2), 4326)
       LIMIT $3`,
      [incidentLocation[0], incidentLocation[1], limit * 2] // Fetch more for routing
    );

    if (ambulances.rows.length === 0) {
      return [];
    }

    // Calculate routes in batch
    const routeRequests = ambulances.rows.map(amb => ({
      origin: amb.current_location.coordinates,
      destination: incidentLocation
    }));

    const routeResults = await routingService.batchCalculate(routeRequests);

    // Combine ambulance data with routes
    const ambulancesWithRoutes = ambulances.rows
      .map((amb, index) => {
        const routeResult = routeResults[index];
        
        if (routeResult.status !== 'fulfilled' || !routeResult.data) {
          return null;
        }

        const route = routeResult.data.routes[0];
        
        return {
          id: amb.id,
          vehicleNumber: amb.vehicle_number,
          type: amb.type,
          location: amb.current_location.coordinates,
          distance: route.distance,
          distanceKm: Math.round(route.distance / 10) / 100,
          duration: route.duration,
          durationMinutes: Math.round(route.duration / 60),
          eta: new Date(Date.now() + route.duration * 1000).toISOString(),
          trafficMultiplier: route.trafficMultiplier,
          geometry: route.geometry
        };
      })
      .filter(amb => amb !== null)
      .sort((a, b) => a.duration - b.duration)
      .slice(0, limit);

    return ambulancesWithRoutes;

  } catch (error) {
    throw new Error(`Failed to find nearest ambulances: ${error.message}`);
  }
}

/**
 * Save route to database
 * @param {String} assignmentId - Assignment ID to link route
 * @param {Object} routeData - Route data from routing service
 * @param {Object} db - Database connection
 * @returns {Object} Saved route record
 */
async function saveRoute(assignmentId, routeData, db) {
  try {
    const route = routeData.routes[0];

    const result = await db.query(
      `INSERT INTO routes (
        assignment_id,
        route_json,
        distance,
        duration,
        traffic_multiplier,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [
        assignmentId,
        JSON.stringify(route.geometry),
        route.distance,
        route.duration,
        route.trafficMultiplier || 1.0
      ]
    );

    return result.rows[0];

  } catch (error) {
    throw new Error(`Failed to save route: ${error.message}`);
  }
}

/**
 * Update route with actual GPS tracking
 * @param {String} routeId - Route ID
 * @param {Array} gpsPoints - Array of [lng, lat] GPS coordinates
 * @param {Object} db - Database connection
 * @returns {Object} Updated route
 */
async function updateRouteWithTracking(routeId, gpsPoints, db) {
  try {
    // Match GPS points to road network
    const matched = await routingService.osrmClient.match(gpsPoints);

    const result = await db.query(
      `UPDATE routes
       SET actual_route_json = $1,
           actual_distance = $2,
           actual_duration = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        JSON.stringify(matched.matchings[0].geometry),
        matched.matchings[0].distance,
        matched.matchings[0].duration,
        routeId
      ]
    );

    return result.rows[0];

  } catch (error) {
    throw new Error(`Failed to update route with tracking: ${error.message}`);
  }
}

module.exports = {
  calculateAmbulanceToIncident,
  calculateIncidentToHospital,
  calculateFullRoute,
  findNearestAmbulances,
  saveRoute,
  updateRouteWithTracking
};
