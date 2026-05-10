const logger = require('../../api/utils/logger');
const { AssignmentManager, ASSIGNMENT_STATES } = require('./assignment-manager');
const AmbulanceSelector = require('./ambulance-selector');
const db = require('../../api/config/database');

const TIMEOUT_SECONDS = 60;
const MAX_REASSIGNMENT_ATTEMPTS = 3;

class TimeoutHandler {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
  }

  start(intervalMs = 10000) {
    if (this.isRunning) {
      logger.warn('TimeoutHandler already running');
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.checkTimeouts().catch(error => {
        logger.error('Error checking timeouts', { error: error.message });
      });
    }, intervalMs);

    logger.info('TimeoutHandler started', { interval_ms: intervalMs });
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.isRunning = false;
      logger.info('TimeoutHandler stopped');
    }
  }

  async checkTimeouts() {
    try {
      const timedOutAssignments = await AssignmentManager.getPendingTimeouts(TIMEOUT_SECONDS);

      if (timedOutAssignments.length === 0) {
        return;
      }

      logger.info('Found timed out assignments', { count: timedOutAssignments.length });

      for (const assignment of timedOutAssignments) {
        await this.handleTimeout(assignment);
      }
    } catch (error) {
      logger.error('Error in checkTimeouts', { error: error.message });
    }
  }

  async handleTimeout(assignment) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE assignments SET timeout_handled = true WHERE id = $1`,
        [assignment.id]
      );

      await client.query(
        `UPDATE assignments 
         SET status = $1, rejected_at = NOW(), rejection_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [ASSIGNMENT_STATES.REJECTED, 'Driver did not respond within timeout period', assignment.id]
      );

      await client.query(
        `UPDATE ambulances SET status = 'AVAILABLE' WHERE id = $1`,
        [assignment.ambulance_id]
      );

      logger.info('Assignment timed out', {
        assignment_id: assignment.id,
        ambulance_id: assignment.ambulance_id,
        age_seconds: assignment.age_seconds,
      });

      await this.logAudit(client, {
        assignment_id: assignment.id,
        action: 'TIMEOUT',
        details: `Assignment timed out after ${assignment.age_seconds} seconds`,
      });

      const reassignmentCount = await this.getReassignmentCount(client, assignment.incident_id);

      if (reassignmentCount >= MAX_REASSIGNMENT_ATTEMPTS) {
        logger.warn('Max reassignment attempts reached', {
          incident_id: assignment.incident_id,
          attempts: reassignmentCount,
        });

        await client.query(
          `INSERT INTO notifications (
            user_id, type, title, message, severity, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            assignment.dispatcher_id,
            'DISPATCH_FAILURE',
            'Assignment Failed',
            `Incident ${assignment.incident_id} failed after ${reassignmentCount} attempts. Manual intervention required.`,
            'CRITICAL',
          ]
        );

        await client.query('COMMIT');
        return;
      }

      const incident = await client.query(
        `SELECT * FROM incidents WHERE id = $1`,
        [assignment.incident_id]
      );

      if (incident.rows.length === 0) {
        logger.error('Incident not found for reassignment', { incident_id: assignment.incident_id });
        await client.query('COMMIT');
        return;
      }

      const incidentData = incident.rows[0];
      const excludedAmbulanceIds = await this.getExcludedAmbulances(client, assignment.incident_id);

      logger.info('Attempting auto-reassignment', {
        incident_id: assignment.incident_id,
        attempt: reassignmentCount + 1,
        excluded_ambulances: excludedAmbulanceIds,
      });

      await client.query('COMMIT');

      setTimeout(() => {
        this.attemptReassignment(incidentData, excludedAmbulanceIds, assignment.dispatcher_id).catch(error => {
          logger.error('Reassignment failed', { error: error.message });
        });
      }, 5000);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error handling timeout', {
        assignment_id: assignment.id,
        error: error.message,
      });
    } finally {
      client.release();
    }
  }

  async attemptReassignment(incident, excludedAmbulanceIds, dispatcherId) {
    try {
      const DispatchService = require('./service');
      
      const result = await DispatchService.createAssignment(incident.id, dispatcherId, {
        excludeAmbulances: excludedAmbulanceIds,
      });

      logger.info('Auto-reassignment successful', {
        incident_id: incident.id,
        new_assignment_id: result.assignment.id,
        new_ambulance_id: result.assignment.ambulance_id,
      });

      await this.logAudit(null, {
        assignment_id: result.assignment.id,
        action: 'AUTO_REASSIGN',
        details: `Automatically reassigned after timeout. Excluded ambulances: ${excludedAmbulanceIds.join(', ')}`,
      });

    } catch (error) {
      logger.error('Auto-reassignment failed', {
        incident_id: incident.id,
        error: error.message,
      });
    }
  }

  async getReassignmentCount(client, incidentId) {
    const result = await client.query(
      `SELECT COUNT(*) as count FROM assignments WHERE incident_id = $1`,
      [incidentId]
    );
    return parseInt(result.rows[0].count);
  }

  async getExcludedAmbulances(client, incidentId) {
    const result = await client.query(
      `SELECT DISTINCT ambulance_id FROM assignments 
       WHERE incident_id = $1 AND status IN ('REJECTED', 'CANCELLED')`,
      [incidentId]
    );
    return result.rows.map(row => row.ambulance_id);
  }

  async logAudit(client, auditData) {
    const query = `
      INSERT INTO audit_log (
        entity_type, entity_id, action, details, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `;

    const dbClient = client || db;
    await dbClient.query(query, [
      'ASSIGNMENT',
      auditData.assignment_id,
      auditData.action,
      auditData.details,
    ]);
  }
}

module.exports = TimeoutHandler;
