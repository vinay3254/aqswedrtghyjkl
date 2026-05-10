const db = require('../../api/config/database');
const logger = require('../../api/utils/logger');

class GeospatialService {
  async findNearestAmbulances(latitude, longitude, options = {}) {
    const {
      type,
      maxDistance = 50,
      limit = 10,
      minFuelLevel = 25,
      requiredEquipment = [],
      status = 'AVAILABLE',
    } = options;

    const conditions = ['a.deleted_at IS NULL'];
    const values = [latitude, longitude];
    let paramCount = 2;

    if (status) {
      paramCount++;
      conditions.push(`a.status = $${paramCount}`);
      values.push(status);
    }

    if (type) {
      paramCount++;
      conditions.push(`a.type = $${paramCount}`);
      values.push(type);
    }

    paramCount++;
    conditions.push(`a.fuel_level >= $${paramCount}`);
    values.push(minFuelLevel);

    if (requiredEquipment.length > 0) {
      paramCount++;
      conditions.push(`a.equipment @> $${paramCount}::jsonb`);
      values.push(JSON.stringify(requiredEquipment));
    }

    paramCount++;
    const distanceParam = paramCount;
    paramCount++;
    const limitParam = paramCount;
    values.push(maxDistance, limit);

    const query = `
      SELECT 
        a.*,
        ST_Distance(
          a.location,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1000.0 as distance,
        d.id as driver_id,
        d.user_id as driver_user_id,
        d.license_number as driver_license,
        d.shift_status as driver_shift_status
      FROM ambulances a
      LEFT JOIN ambulance_drivers d ON a.id = d.current_ambulance_id AND d.deleted_at IS NULL
      WHERE ${conditions.join(' AND ')}
        AND ST_Distance(
          a.location,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1000.0 <= $${distanceParam}
      ORDER BY distance ASC
      LIMIT $${limitParam}
    `;

    const result = await db.query(query, values);

    logger.debug('Nearest ambulances search', {
      latitude,
      longitude,
      found: result.rows.length,
      options,
    });

    return result.rows.map(row => this.formatAmbulanceWithDistance(row));
  }

  async findAmbulancesInRadius(latitude, longitude, radiusKm, filters = {}) {
    const { type, status, minFuelLevel = 0 } = filters;

    const conditions = ['a.deleted_at IS NULL'];
    const values = [latitude, longitude, radiusKm];
    let paramCount = 3;

    if (type) {
      paramCount++;
      conditions.push(`a.type = $${paramCount}`);
      values.push(type);
    }

    if (status) {
      paramCount++;
      conditions.push(`a.status = $${paramCount}`);
      values.push(status);
    }

    if (minFuelLevel > 0) {
      paramCount++;
      conditions.push(`a.fuel_level >= $${paramCount}`);
      values.push(minFuelLevel);
    }

    const query = `
      SELECT 
        a.*,
        ST_Distance(
          a.location,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1000.0 as distance,
        d.id as driver_id,
        d.user_id as driver_user_id,
        d.license_number as driver_license,
        d.shift_status as driver_shift_status
      FROM ambulances a
      LEFT JOIN ambulance_drivers d ON a.id = d.current_ambulance_id AND d.deleted_at IS NULL
      WHERE ${conditions.join(' AND ')}
        AND ST_DWithin(
          a.location,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          $3 * 1000
        )
      ORDER BY distance ASC
    `;

    const result = await db.query(query, values);

    logger.debug('Radius search', {
      latitude,
      longitude,
      radiusKm,
      found: result.rows.length,
    });

    return result.rows.map(row => this.formatAmbulanceWithDistance(row));
  }

  async calculateDistance(fromLat, fromLon, toLat, toLon) {
    const query = `
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
      ) / 1000.0 as distance_km
    `;

    const result = await db.query(query, [fromLon, fromLat, toLon, toLat]);
    return parseFloat(result.rows[0].distance_km);
  }

  async getDistanceToAmbulance(ambulanceId, latitude, longitude) {
    const query = `
      SELECT 
        a.id,
        a.call_sign,
        a.latitude,
        a.longitude,
        ST_Distance(
          a.location,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
        ) / 1000.0 as distance_km
      FROM ambulances a
      WHERE a.id = $1 AND a.deleted_at IS NULL
    `;

    const result = await db.query(query, [ambulanceId, longitude, latitude]);

    if (result.rows.length === 0) {
      throw new Error('Ambulance not found');
    }

    return {
      ambulanceId: result.rows[0].id,
      callSign: result.rows[0].call_sign,
      ambulanceLatitude: parseFloat(result.rows[0].latitude),
      ambulanceLongitude: parseFloat(result.rows[0].longitude),
      distanceKm: parseFloat(result.rows[0].distance_km),
    };
  }

  async findOptimalAmbulance(incidentLocation, requirements = {}) {
    const { latitude, longitude } = incidentLocation;
    const {
      type,
      requiredEquipment = [],
      minFuelLevel = 25,
      maxResponseTime = 15,
    } = requirements;

    const estimatedSpeed = 60;
    const maxDistance = (estimatedSpeed * maxResponseTime) / 60;

    const ambulances = await this.findNearestAmbulances(latitude, longitude, {
      type,
      requiredEquipment,
      minFuelLevel,
      maxDistance,
      limit: 5,
      status: 'AVAILABLE',
    });

    if (ambulances.length === 0) {
      return null;
    }

    ambulances.forEach(ambulance => {
      const estimatedMinutes = (ambulance.distance / estimatedSpeed) * 60;
      ambulance.estimatedResponseTime = Math.round(estimatedMinutes);

      let score = 100;
      score -= ambulance.distance * 2;
      if (ambulance.fuelLevel < 50) score -= (50 - ambulance.fuelLevel);
      if (ambulance.type === 'ALS') score += 10;
      
      ambulance.priorityScore = Math.max(0, score);
    });

    ambulances.sort((a, b) => b.priorityScore - a.priorityScore);

    return ambulances[0];
  }

  async getCoverageMap(gridSize = 5) {
    const query = `
      SELECT 
        a.type,
        a.status,
        a.latitude,
        a.longitude,
        a.call_sign
      FROM ambulances a
      WHERE a.deleted_at IS NULL
        AND a.latitude IS NOT NULL
        AND a.longitude IS NOT NULL
        AND a.status IN ('AVAILABLE', 'DISPATCHED', 'BUSY')
    `;

    const result = await db.query(query);

    const coverage = {
      ambulances: result.rows.map(row => ({
        callSign: row.call_sign,
        type: row.type,
        status: row.status,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      })),
      stats: {
        total: result.rows.length,
        available: result.rows.filter(r => r.status === 'AVAILABLE').length,
        dispatched: result.rows.filter(r => r.status === 'DISPATCHED').length,
        busy: result.rows.filter(r => r.status === 'BUSY').length,
      },
    };

    return coverage;
  }

  async findCoverageGaps(targetCoverageRadius = 10) {
    const query = `
      WITH ambulance_coverage AS (
        SELECT 
          a.id,
          a.call_sign,
          a.location,
          a.type,
          ST_Buffer(a.location::geometry, $1 * 1000) as coverage_area
        FROM ambulances a
        WHERE a.deleted_at IS NULL
          AND a.status IN ('AVAILABLE', 'DISPATCHED')
          AND a.location IS NOT NULL
      )
      SELECT 
        type,
        COUNT(*) as coverage_count,
        ST_Union(coverage_area) as total_coverage
      FROM ambulance_coverage
      GROUP BY type
    `;

    const result = await db.query(query, [targetCoverageRadius]);

    return result.rows.map(row => ({
      type: row.type,
      coverageCount: parseInt(row.coverage_count),
    }));
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  formatAmbulanceWithDistance(row) {
    return {
      id: row.id,
      callSign: row.call_sign,
      type: row.type,
      status: row.status,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      fuelLevel: row.fuel_level,
      baseStation: row.base_station,
      equipment: typeof row.equipment === 'string' ? JSON.parse(row.equipment) : row.equipment,
      distance: parseFloat(row.distance) || 0,
      driver: row.driver_id
        ? {
            id: row.driver_id,
            userId: row.driver_user_id,
            licenseNumber: row.driver_license,
            shiftStatus: row.driver_shift_status,
          }
        : null,
    };
  }
}

module.exports = new GeospatialService();
