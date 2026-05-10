const db = require('../../api/config/database');
const { NotFoundError, ValidationError } = require('../../api/utils/errors');
const { STATES } = require('./fsm');

const SEVERITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

const INCIDENT_TYPES = {
  MEDICAL: 'MEDICAL',
  ACCIDENT: 'ACCIDENT',
  CARDIAC: 'CARDIAC',
  STROKE: 'STROKE',
  TRAUMA: 'TRAUMA',
  MATERNITY: 'MATERNITY',
  OTHER: 'OTHER',
};

const SEVERITY_WEIGHTS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const TYPE_WEIGHTS = {
  MEDICAL: 1,
  ACCIDENT: 2,
  CARDIAC: 4,
  STROKE: 4,
  TRAUMA: 3,
  MATERNITY: 3,
  OTHER: 1,
};

class IncidentModel {
  static calculatePriority(severity, incidentType) {
    const severityWeight = SEVERITY_WEIGHTS[severity] || 1;
    const typeWeight = TYPE_WEIGHTS[incidentType] || 1;
    return severityWeight * typeWeight * 10;
  }

  static async create(incidentData) {
    const {
      caller_name,
      caller_phone,
      location_lat,
      location_lng,
      location_address,
      severity,
      incident_type,
      description,
      patient_count = 1,
      created_by,
    } = incidentData;

    if (!location_lat || !location_lng) {
      throw new ValidationError('Location coordinates are required');
    }

    if (location_lat < -90 || location_lat > 90) {
      throw new ValidationError('Invalid latitude: must be between -90 and 90');
    }

    if (location_lng < -180 || location_lng > 180) {
      throw new ValidationError('Invalid longitude: must be between -180 and 180');
    }

    const priority = this.calculatePriority(severity, incident_type);

    const query = `
      INSERT INTO incidents (
        caller_name, caller_phone, location_lat, location_lng, location_address,
        severity, incident_type, description, patient_count, priority_score,
        status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      caller_name,
      caller_phone,
      location_lat,
      location_lng,
      location_address,
      severity,
      incident_type,
      description,
      patient_count,
      priority,
      STATES.PENDING,
      created_by,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findById(id) {
    const query = `
      SELECT 
        i.*,
        ass.ambulance_id,
        COALESCE(amb.vehicle_number, amb.call_sign) as ambulance_vehicle_number,
        amb.driver_name,
        amb.driver_phone,
        h.id as hospital_id,
        h.name as hospital_name,
        h.address as hospital_address,
        EXTRACT(EPOCH FROM (NOW() - i.created_at))::INTEGER as age_seconds,
        CASE 
          WHEN i.resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))::INTEGER
          ELSE NULL
        END as total_response_time_seconds
      FROM incidents i
      LEFT JOIN assignments ass ON i.id = ass.incident_id AND ass.status IN ('PENDING', 'ACCEPTED')
      LEFT JOIN ambulances amb ON ass.ambulance_id = amb.id
      LEFT JOIN hospitals h ON i.hospital_id = h.id
      WHERE i.id = $1
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }

    return result.rows[0];
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT 
        i.*,
        ass.ambulance_id,
        COALESCE(amb.vehicle_number, amb.call_sign) as ambulance_vehicle_number,
        h.name as hospital_name,
        EXTRACT(EPOCH FROM (NOW() - i.created_at))::INTEGER as age_seconds
      FROM incidents i
      LEFT JOIN assignments ass ON i.id = ass.incident_id AND ass.status IN ('PENDING', 'ACCEPTED')
      LEFT JOIN ambulances amb ON ass.ambulance_id = amb.id
      LEFT JOIN hospitals h ON i.hospital_id = h.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      query += ` AND i.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.severity) {
      paramCount++;
      query += ` AND i.severity = $${paramCount}`;
      params.push(filters.severity);
    }

    if (filters.incident_type) {
      paramCount++;
      query += ` AND i.incident_type = $${paramCount}`;
      params.push(filters.incident_type);
    }

    if (filters.active_only) {
      query += ` AND i.status NOT IN ('RESOLVED', 'CANCELLED')`;
    }

    if (filters.created_by) {
      paramCount++;
      query += ` AND i.created_by = $${paramCount}`;
      params.push(filters.created_by);
    }

    query += ` ORDER BY i.priority_score DESC, i.created_at ASC`;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(filters.offset);
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  static async updateStatus(id, status, userId) {
    const query = `
      UPDATE incidents
      SET 
        status = $1,
        updated_at = NOW(),
        updated_by = $2,
        acknowledged_at = CASE WHEN $1 = 'ACKNOWLEDGED' AND acknowledged_at IS NULL THEN NOW() ELSE acknowledged_at END,
        dispatched_at = CASE WHEN $1 = 'DISPATCHED' AND dispatched_at IS NULL THEN NOW() ELSE dispatched_at END,
        en_route_at = CASE WHEN $1 = 'EN_ROUTE' AND en_route_at IS NULL THEN NOW() ELSE en_route_at END,
        on_scene_at = CASE WHEN $1 = 'ON_SCENE' AND on_scene_at IS NULL THEN NOW() ELSE on_scene_at END,
        transporting_at = CASE WHEN $1 = 'TRANSPORTING' AND transporting_at IS NULL THEN NOW() ELSE transporting_at END,
        at_hospital_at = CASE WHEN $1 = 'AT_HOSPITAL' AND at_hospital_at IS NULL THEN NOW() ELSE at_hospital_at END,
        resolved_at = CASE WHEN $1 IN ('RESOLVED', 'CANCELLED') AND resolved_at IS NULL THEN NOW() ELSE resolved_at END
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(query, [status, userId, id]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }

    return result.rows[0];
  }

  static async updateSeverity(id, severity, userId) {
    const incident = await this.findById(id);
    const newPriority = this.calculatePriority(severity, incident.incident_type);

    const query = `
      UPDATE incidents
      SET 
        severity = $1,
        priority_score = $2,
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $4
      RETURNING *
    `;

    const result = await db.query(query, [severity, newPriority, userId, id]);
    return result.rows[0];
  }

  static async assignHospital(id, hospitalId, userId) {
    const query = `
      UPDATE incidents
      SET 
        hospital_id = $1,
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(query, [hospitalId, userId, id]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }

    return result.rows[0];
  }

  static async getActiveIncidents() {
    return this.findAll({ active_only: true });
  }

  static async getPendingEscalations(thresholdSeconds = 60) {
    const query = `
      SELECT 
        i.*,
        EXTRACT(EPOCH FROM (NOW() - i.created_at))::INTEGER as age_seconds
      FROM incidents i
      WHERE 
        i.status = 'PENDING'
        AND EXTRACT(EPOCH FROM (NOW() - i.created_at)) > $1
      ORDER BY i.created_at ASC
    `;

    const result = await db.query(query, [thresholdSeconds]);
    return result.rows;
  }

  static async getMetrics() {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
        COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED') as acknowledged_count,
        COUNT(*) FILTER (WHERE status = 'DISPATCHED') as dispatched_count,
        COUNT(*) FILTER (WHERE status = 'EN_ROUTE') as en_route_count,
        COUNT(*) FILTER (WHERE status = 'ON_SCENE') as on_scene_count,
        COUNT(*) FILTER (WHERE status = 'TRANSPORTING') as transporting_count,
        COUNT(*) FILTER (WHERE status = 'AT_HOSPITAL') as at_hospital_count,
        COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_count,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) FILTER (WHERE status = 'RESOLVED') as avg_response_time_seconds,
        AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))) FILTER (WHERE acknowledged_at IS NOT NULL) as avg_acknowledgment_time_seconds
      FROM incidents
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const result = await db.query(query);
    return result.rows[0];
  }
}

module.exports = {
  IncidentModel,
  SEVERITY_LEVELS,
  INCIDENT_TYPES,
};
