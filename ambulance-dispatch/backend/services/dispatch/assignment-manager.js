const db = require('../../api/config/database');
const logger = require('../../api/utils/logger');
const { NotFoundError, ValidationError } = require('../../api/utils/errors');

const ASSIGNMENT_STATES = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
};

class AssignmentManager {
  static async createAssignment(assignmentData) {
    const {
      incident_id,
      ambulance_id,
      hospital_id,
      dispatcher_id,
      ambulance_reasoning,
      hospital_reasoning,
      auto_selected = true,
      override_reason = null,
      estimated_arrival_time,
      route_info,
    } = assignmentData;

    const query = `
      INSERT INTO assignments (
        incident_id,
        ambulance_id,
        hospital_id,
        dispatcher_id,
        status,
        ambulance_reasoning,
        hospital_reasoning,
        auto_selected,
        override_reason,
        estimated_arrival_time,
        route_info,
        assigned_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
      RETURNING *
    `;

    const values = [
      incident_id,
      ambulance_id,
      hospital_id,
      dispatcher_id,
      ASSIGNMENT_STATES.PENDING,
      ambulance_reasoning,
      hospital_reasoning,
      auto_selected,
      override_reason,
      estimated_arrival_time,
      JSON.stringify(route_info),
    ];

    try {
      const result = await db.query(query, values);
      logger.info('Assignment created', {
        assignment_id: result.rows[0].id,
        incident_id,
        ambulance_id,
        hospital_id,
        auto_selected,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create assignment', { error: error.message });
      throw error;
    }
  }

  static async findById(id) {
    const query = `
      SELECT 
        a.*,
        i.severity,
        i.incident_type,
        i.location_lat as incident_lat,
        i.location_lng as incident_lng,
        i.location_address as incident_address,
        i.status as incident_status,
        amb.vehicle_number,
        amb.driver_name,
        amb.driver_phone,
        amb.equipment_type,
        h.name as hospital_name,
        h.address as hospital_address,
        u.name as dispatcher_name
      FROM assignments a
      LEFT JOIN incidents i ON a.incident_id = i.id
      LEFT JOIN ambulances amb ON a.ambulance_id = amb.id
      LEFT JOIN hospitals h ON a.hospital_id = h.id
      LEFT JOIN users u ON a.dispatcher_id = u.id
      WHERE a.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Assignment with ID ${id} not found`);
    }

    const assignment = result.rows[0];
    if (assignment.route_info) {
      assignment.route_info = JSON.parse(assignment.route_info);
    }

    return assignment;
  }

  static async findByIncidentId(incidentId) {
    const query = `
      SELECT 
        a.*,
        amb.vehicle_number,
        amb.driver_name,
        h.name as hospital_name
      FROM assignments a
      LEFT JOIN ambulances amb ON a.ambulance_id = amb.id
      LEFT JOIN hospitals h ON a.hospital_id = h.id
      WHERE a.incident_id = $1
      ORDER BY a.created_at DESC
    `;

    const result = await db.query(query, [incidentId]);
    return result.rows.map(row => {
      if (row.route_info) {
        row.route_info = JSON.parse(row.route_info);
      }
      return row;
    });
  }

  static async findByDriverId(driverId, includeCompleted = false) {
    let query = `
      SELECT 
        a.*,
        i.severity,
        i.incident_type,
        i.location_address as incident_address,
        i.status as incident_status,
        h.name as hospital_name,
        h.address as hospital_address
      FROM assignments a
      LEFT JOIN incidents i ON a.incident_id = i.id
      LEFT JOIN hospitals h ON a.hospital_id = h.id
      LEFT JOIN ambulances amb ON a.ambulance_id = amb.id
      WHERE amb.driver_id = $1
    `;

    if (!includeCompleted) {
      query += ` AND a.status NOT IN ('COMPLETED', 'CANCELLED')`;
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await db.query(query, [driverId]);
    return result.rows.map(row => {
      if (row.route_info) {
        row.route_info = JSON.parse(row.route_info);
      }
      return row;
    });
  }

  static async getActiveAssignments() {
    const query = `
      SELECT 
        a.*,
        i.severity,
        i.incident_type,
        i.location_address as incident_address,
        i.status as incident_status,
        amb.vehicle_number,
        amb.driver_name,
        h.name as hospital_name,
        EXTRACT(EPOCH FROM (NOW() - a.assigned_at))::INTEGER as age_seconds
      FROM assignments a
      LEFT JOIN incidents i ON a.incident_id = i.id
      LEFT JOIN ambulances amb ON a.ambulance_id = amb.id
      LEFT JOIN hospitals h ON a.hospital_id = h.id
      WHERE a.status IN ('PENDING', 'ACCEPTED')
      ORDER BY a.assigned_at DESC
    `;

    const result = await db.query(query);
    return result.rows.map(row => {
      if (row.route_info) {
        row.route_info = JSON.parse(row.route_info);
      }
      return row;
    });
  }

  static async updateStatus(id, status, userId, additionalData = {}) {
    const fields = ['status = $1', 'updated_at = NOW()', 'updated_by = $2'];
    const values = [status, userId, id];
    let paramCount = 2;

    if (status === ASSIGNMENT_STATES.ACCEPTED && !additionalData.skipTimestamp) {
      fields.push('accepted_at = NOW()');
    }

    if (status === ASSIGNMENT_STATES.REJECTED && !additionalData.skipTimestamp) {
      fields.push('rejected_at = NOW()');
    }

    if (status === ASSIGNMENT_STATES.COMPLETED && !additionalData.skipTimestamp) {
      fields.push('completed_at = NOW()');
    }

    if (additionalData.rejection_reason) {
      paramCount++;
      fields.push(`rejection_reason = $${paramCount}`);
      values.splice(paramCount - 1, 0, additionalData.rejection_reason);
    }

    const query = `
      UPDATE assignments
      SET ${fields.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Assignment with ID ${id} not found`);
    }

    logger.info('Assignment status updated', {
      assignment_id: id,
      status,
      updated_by: userId,
    });

    return result.rows[0];
  }

  static async reassignAmbulance(id, newAmbulanceId, reason, userId) {
    const query = `
      UPDATE assignments
      SET 
        ambulance_id = $1,
        override_reason = $2,
        auto_selected = false,
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $4
      RETURNING *
    `;

    const result = await db.query(query, [newAmbulanceId, reason, userId, id]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Assignment with ID ${id} not found`);
    }

    logger.info('Ambulance reassigned', {
      assignment_id: id,
      new_ambulance_id: newAmbulanceId,
      reason,
    });

    return result.rows[0];
  }

  static async reassignHospital(id, newHospitalId, reason, userId) {
    const query = `
      UPDATE assignments
      SET 
        hospital_id = $1,
        override_reason = CASE 
          WHEN override_reason IS NULL THEN $2
          ELSE override_reason || '; ' || $2
        END,
        auto_selected = false,
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $4
      RETURNING *
    `;

    const result = await db.query(query, [newHospitalId, reason, userId, id]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Assignment with ID ${id} not found`);
    }

    logger.info('Hospital reassigned', {
      assignment_id: id,
      new_hospital_id: newHospitalId,
      reason,
    });

    return result.rows[0];
  }

  static async getPendingTimeouts(timeoutSeconds = 60) {
    const query = `
      SELECT 
        a.*,
        EXTRACT(EPOCH FROM (NOW() - a.assigned_at))::INTEGER as age_seconds
      FROM assignments a
      WHERE 
        a.status = 'PENDING'
        AND EXTRACT(EPOCH FROM (NOW() - a.assigned_at)) > $1
        AND a.timeout_handled = false
      ORDER BY a.assigned_at ASC
    `;

    const result = await db.query(query, [timeoutSeconds]);
    return result.rows;
  }

  static async markTimeoutHandled(id) {
    const query = `
      UPDATE assignments
      SET timeout_handled = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async getMetrics() {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
        COUNT(*) FILTER (WHERE status = 'ACCEPTED') as accepted_count,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count,
        AVG(EXTRACT(EPOCH FROM (accepted_at - assigned_at))) FILTER (WHERE accepted_at IS NOT NULL) as avg_acceptance_time_seconds,
        AVG(EXTRACT(EPOCH FROM (completed_at - accepted_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_completion_time_seconds,
        COUNT(*) FILTER (WHERE auto_selected = true) as auto_selected_count,
        COUNT(*) FILTER (WHERE auto_selected = false) as manual_override_count
      FROM assignments
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const result = await db.query(query);
    return result.rows[0];
  }
}

module.exports = {
  AssignmentManager,
  ASSIGNMENT_STATES,
};
