const HospitalModel = require('./model');
const CapacityManager = require('./capacity');
const SpecialistManager = require('./specialists');
const logger = require('../../utils/logger');

class GeospatialService {
  static async findNearbyHospitals(latitude, longitude, options = {}) {
    const radiusKm = options.radius || 50;
    const filters = {};

    if (options.min_beds) filters.min_beds = options.min_beds;
    if (options.min_icu_beds) filters.min_icu_beds = options.min_icu_beds;
    if (options.trauma_bay_required) filters.trauma_bay_required = true;
    if (options.trauma_level) filters.trauma_level = options.trauma_level;
    if (options.service) filters.service = options.service;
    if (options.blood_type) filters.blood_type = options.blood_type;
    if (options.equipment) filters.equipment = options.equipment;
    if (options.limit) filters.limit = options.limit;

    const hospitals = await HospitalModel.findNearby(latitude, longitude, radiusKm, filters);

    logger.info('Nearby hospitals found', {
      location: { latitude, longitude },
      radius: radiusKm,
      count: hospitals.length,
    });

    return hospitals;
  }

  static async findOptimalHospital(incident, options = {}) {
    const { latitude, longitude, incident_type, severity, patient_condition } = incident;
    const radiusKm = options.radius || 50;

    const requirements = {
      requires_icu: severity === 'critical' || patient_condition?.requires_icu,
      requires_trauma: ['TRAUMA', 'ACCIDENT', 'FALL'].includes(incident_type?.toUpperCase()),
      specialist_required: SpecialistManager.getRequiredSpecialists(incident_type)[0],
      blood_type: patient_condition?.blood_type,
      equipment_required: patient_condition?.equipment_required,
    };

    const matchOptions = {
      radius: radiusKm,
      requires_icu: requirements.requires_icu,
      requires_trauma: requirements.requires_trauma,
      limit: options.limit || 10,
    };

    if (severity === 'critical' && requirements.requires_trauma) {
      matchOptions.min_trauma_level = 'Level 1';
    }

    const hospitals = await SpecialistManager.matchHospitalToIncident(
      incident_type,
      latitude,
      longitude,
      matchOptions
    );

    const rankedHospitals = hospitals.map(hospital => {
      const capacityScore = CapacityManager.calculateCapacityScore(
        {
          capacity: {
            beds: { total: 100, available: hospital.capacity.beds },
            icu: { total: 20, available: hospital.capacity.icu },
            trauma: { total: 10, available: hospital.capacity.trauma },
          },
          services: hospital.services,
          equipment: {},
        },
        requirements
      );

      const distanceScore = this.calculateDistanceScore(parseFloat(hospital.distance), radiusKm);
      const specialistScore = hospital.match_score || 0;

      const totalScore = (capacityScore * 0.4) + (distanceScore * 0.3) + (specialistScore * 0.3);

      return {
        ...hospital,
        scores: {
          capacity: capacityScore,
          distance: distanceScore,
          specialist: specialistScore,
          total: Math.round(totalScore * 10) / 10,
        },
        recommended: totalScore >= 70,
      };
    });

    rankedHospitals.sort((a, b) => b.scores.total - a.scores.total);

    logger.info('Optimal hospitals ranked', {
      incident_type,
      severity,
      hospitals_found: rankedHospitals.length,
      top_hospital: rankedHospitals[0]?.name,
      top_score: rankedHospitals[0]?.scores.total,
    });

    return rankedHospitals;
  }

  static calculateDistanceScore(distanceKm, maxRadius) {
    if (distanceKm >= maxRadius) return 0;
    
    const score = 100 - (distanceKm / maxRadius) * 100;
    return Math.max(0, Math.min(100, score));
  }

  static async findHospitalsInPolygon(coordinates) {
    const polygon = coordinates.map(coord => `${coord.longitude} ${coord.latitude}`).join(',');
    
    const query = `
      SELECT *
      FROM hospitals
      WHERE status = 'active'
        AND ST_Contains(
          ST_GeomFromText('POLYGON((${polygon}))', 4326),
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        )
      ORDER BY name ASC
    `;

    const result = await db.query(query);
    return result.rows.map(row => HospitalModel.formatHospital(row));
  }

  static async getHospitalsByRegion(region) {
    const regionBounds = this.getRegionBounds(region);
    
    if (!regionBounds) {
      return [];
    }

    const { minLat, maxLat, minLng, maxLng } = regionBounds;

    const query = `
      SELECT *
      FROM hospitals
      WHERE status = 'active'
        AND latitude BETWEEN $1 AND $2
        AND longitude BETWEEN $3 AND $4
      ORDER BY name ASC
    `;

    const result = await db.query(query, [minLat, maxLat, minLng, maxLng]);
    return result.rows.map(row => HospitalModel.formatHospital(row));
  }

  static getRegionBounds(region) {
    const regions = {
      north: { minLat: 40.0, maxLat: 45.0, minLng: -75.0, maxLng: -70.0 },
      south: { minLat: 35.0, maxLat: 40.0, minLng: -75.0, maxLng: -70.0 },
      east: { minLat: 37.0, maxLat: 42.0, minLng: -72.0, maxLng: -67.0 },
      west: { minLat: 37.0, maxLat: 42.0, minLng: -78.0, maxLng: -73.0 },
    };

    return regions[region.toLowerCase()] || null;
  }

  static calculateETA(distanceKm, ambulanceSpeed = 60) {
    const timeHours = distanceKm / ambulanceSpeed;
    const timeMinutes = Math.ceil(timeHours * 60);
    
    return {
      distance_km: distanceKm,
      eta_minutes: timeMinutes,
      eta_formatted: `${timeMinutes} minutes`,
    };
  }

  static async findAlternativeHospitals(primaryHospitalId, incidentLocation, count = 3) {
    const primary = await HospitalModel.findById(primaryHospitalId);
    
    const nearby = await HospitalModel.findNearby(
      incidentLocation.latitude,
      incidentLocation.longitude,
      50,
      { limit: count + 1 }
    );

    const alternatives = nearby.filter(h => h.id !== primaryHospitalId).slice(0, count);

    return {
      primary,
      alternatives,
    };
  }

  static async clusterHospitalsByProximity(latitude, longitude, clusterRadiusKm = 5) {
    const allHospitals = await HospitalModel.findNearby(latitude, longitude, 50);

    const clusters = [];
    const processed = new Set();

    for (const hospital of allHospitals) {
      if (processed.has(hospital.id)) continue;

      const cluster = {
        center: hospital,
        members: [hospital],
        avg_distance: parseFloat(hospital.distance),
      };

      for (const other of allHospitals) {
        if (other.id === hospital.id || processed.has(other.id)) continue;

        const distance = this.calculateDistance(
          hospital.location.latitude,
          hospital.location.longitude,
          other.location.latitude,
          other.location.longitude
        );

        if (distance <= clusterRadiusKm) {
          cluster.members.push(other);
          processed.add(other.id);
        }
      }

      processed.add(hospital.id);
      clusters.push(cluster);
    }

    return clusters;
  }

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

  static async getHospitalDensity(latitude, longitude, radiusKm = 10) {
    const hospitals = await HospitalModel.findNearby(latitude, longitude, radiusKm);
    
    const area = Math.PI * radiusKm * radiusKm;
    const density = hospitals.length / area;

    return {
      radius_km: radiusKm,
      hospital_count: hospitals.length,
      area_sq_km: area.toFixed(2),
      density: density.toFixed(4),
      hospitals,
    };
  }
}

module.exports = GeospatialService;
