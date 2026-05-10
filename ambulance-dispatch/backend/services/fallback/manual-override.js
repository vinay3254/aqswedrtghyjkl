/**
 * Manual Override Service
 * 
 * Allows dispatchers to override AI-generated dispatch decisions.
 * Implements approval workflows and audit trails for compliance.
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class ManualOverrideService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.maxConcurrentOverrides = config.maxConcurrentOverrides || 10;
    this.overrideApprovalRequired = config.overrideApprovalRequired !== false;
    this.auditLogging = config.auditLogging !== false;
    this.rateLimitWindow = config.rateLimitWindow || 3600000; // 1 hour
    this.maxOverridesPerWindow = config.maxOverridesPerWindow || 50;

    this.activeOverrides = new Map();
    this.pendingApprovals = new Map();
    this.overrideHistory = [];
    this.dispatcherRateLimits = new Map();
  }

  /**
   * Request override of AI dispatch decision
   */
  requestOverride(overrideRequest) {
    const {
      dispatchId,
      dispatcherId,
      dispatcherName,
      incidentId,
      currentAssignment,
      proposedAssignment,
      reason,
      urgency = 'normal',
      metadata = {}
    } = overrideRequest;

    // Validate request
    const validation = this.validateOverrideRequest(overrideRequest);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        code: validation.code
      };
    }

    // Check rate limiting
    const rateLimitCheck = this.checkRateLimit(dispatcherId);
    if (!rateLimitCheck.allowed) {
      logger.warn(`Rate limit exceeded for dispatcher ${dispatcherId}`, {
        overridesInWindow: rateLimitCheck.overridesInWindow,
        limit: this.maxOverridesPerWindow
      });
      return {
        success: false,
        error: 'Rate limit exceeded. Too many overrides in the current time window.',
        code: 'RATE_LIMIT_EXCEEDED'
      };
    }

    const overrideId = this.generateOverrideId();
    const timestamp = new Date();

    const override = {
      overrideId,
      dispatchId,
      incidentId,
      dispatcherId,
      dispatcherName,
      currentAssignment,
      proposedAssignment,
      reason,
      urgency,
      metadata,
      status: this.overrideApprovalRequired ? 'pending_approval' : 'approved',
      requestedAt: timestamp,
      approvedAt: null,
      approvedBy: null,
      executedAt: null,
      rejectionReason: null
    };

    if (this.overrideApprovalRequired) {
      // Require approval - add to pending queue
      this.pendingApprovals.set(overrideId, override);
      logger.info(`Override request created (pending approval): ${overrideId}`, {
        dispatchId,
        dispatcherId,
        reason
      });
    } else {
      // Auto-approve
      override.status = 'approved';
      override.approvedAt = timestamp;
      override.approvedBy = 'SYSTEM_AUTO_APPROVAL';
      this.activeOverrides.set(overrideId, override);
      logger.info(`Override request auto-approved: ${overrideId}`, {
        dispatchId,
        dispatcherId,
        reason
      });
    }

    // Log for audit
    if (this.auditLogging) {
      this.logAuditEvent({
        type: 'OVERRIDE_REQUESTED',
        overrideId,
        dispatcherId,
        dispatcherName,
        incidentId,
        reason,
        timestamp
      });
    }

    this.emit('overrideRequested', {
      overrideId,
      status: override.status,
      timestamp
    });

    return {
      success: true,
      overrideId,
      status: override.status,
      message: this.overrideApprovalRequired 
        ? 'Override request submitted for approval'
        : 'Override auto-approved'
    };
  }

  /**
   * Validate override request
   */
  validateOverrideRequest(request) {
    const required = ['dispatchId', 'dispatcherId', 'dispatcherName', 'incidentId', 'reason'];
    
    for (const field of required) {
      if (!request[field]) {
        return {
          valid: false,
          error: `Missing required field: ${field}`,
          code: 'MISSING_REQUIRED_FIELD'
        };
      }
    }

    if (!request.currentAssignment || !request.proposedAssignment) {
      return {
        valid: false,
        error: 'Must provide both current and proposed assignments',
        code: 'INVALID_ASSIGNMENT'
      };
    }

    if (request.reason.length < 10) {
      return {
        valid: false,
        error: 'Reason must be at least 10 characters',
        code: 'INSUFFICIENT_REASON'
      };
    }

    return { valid: true };
  }

  /**
   * Check rate limiting for dispatcher
   */
  checkRateLimit(dispatcherId) {
    const now = Date.now();
    
    if (!this.dispatcherRateLimits.has(dispatcherId)) {
      this.dispatcherRateLimits.set(dispatcherId, {
        overrides: [],
        lastChecked: now
      });
    }

    const limit = this.dispatcherRateLimits.get(dispatcherId);

    // Clean old entries outside the window
    limit.overrides = limit.overrides.filter(timestamp => now - timestamp < this.rateLimitWindow);

    const allowed = limit.overrides.length < this.maxOverridesPerWindow;

    return {
      allowed,
      overridesInWindow: limit.overrides.length,
      limit: this.maxOverridesPerWindow
    };
  }

  /**
   * Approve pending override request (Supervisor action)
   */
  approveOverride(overrideId, supervisorId, supervisorName, notes = '') {
    const override = this.pendingApprovals.get(overrideId);

    if (!override) {
      return {
        success: false,
        error: 'Override request not found or already processed',
        code: 'NOT_FOUND'
      };
    }

    const now = new Date();

    override.status = 'approved';
    override.approvedAt = now;
    override.approvedBy = supervisorName;
    override.approvalNotes = notes;

    this.pendingApprovals.delete(overrideId);
    this.activeOverrides.set(overrideId, override);

    logger.info(`Override approved: ${overrideId}`, {
      approvedBy: supervisorName,
      notes
    });

    if (this.auditLogging) {
      this.logAuditEvent({
        type: 'OVERRIDE_APPROVED',
        overrideId,
        supervisorId,
        supervisorName,
        notes,
        timestamp: now
      });
    }

    this.emit('overrideApproved', { overrideId, approvedBy: supervisorName });

    return {
      success: true,
      overrideId,
      message: 'Override approved and activated'
    };
  }

  /**
   * Reject override request (Supervisor action)
   */
  rejectOverride(overrideId, supervisorId, supervisorName, rejectionReason) {
    const override = this.pendingApprovals.get(overrideId);

    if (!override) {
      return {
        success: false,
        error: 'Override request not found',
        code: 'NOT_FOUND'
      };
    }

    const now = new Date();

    override.status = 'rejected';
    override.rejectionReason = rejectionReason;
    override.rejectedAt = now;
    override.rejectedBy = supervisorName;

    this.pendingApprovals.delete(overrideId);

    logger.info(`Override rejected: ${overrideId}`, {
      rejectedBy: supervisorName,
      reason: rejectionReason
    });

    if (this.auditLogging) {
      this.logAuditEvent({
        type: 'OVERRIDE_REJECTED',
        overrideId,
        supervisorId,
        supervisorName,
        rejectionReason,
        timestamp: now
      });
    }

    this.emit('overrideRejected', { overrideId, rejectedBy: supervisorName });

    return {
      success: true,
      overrideId,
      message: 'Override request rejected'
    };
  }

  /**
   * Execute approved override
   */
  executeOverride(overrideId) {
    const override = this.activeOverrides.get(overrideId);

    if (!override) {
      return {
        success: false,
        error: 'Override not found',
        code: 'NOT_FOUND'
      };
    }

    if (override.status !== 'approved') {
      return {
        success: false,
        error: `Cannot execute override with status: ${override.status}`,
        code: 'INVALID_STATUS'
      };
    }

    const now = new Date();
    override.status = 'executed';
    override.executedAt = now;

    logger.info(`Override executed: ${overrideId}`, {
      dispatchId: override.dispatchId,
      from: override.currentAssignment,
      to: override.proposedAssignment
    });

    if (this.auditLogging) {
      this.logAuditEvent({
        type: 'OVERRIDE_EXECUTED',
        overrideId,
        dispatchId: override.dispatchId,
        incidentId: override.incidentId,
        from: override.currentAssignment,
        to: override.proposedAssignment,
        timestamp: now
      });
    }

    // Track in history
    this.overrideHistory.push(override);
    this.recordDispatcherOverride(override.dispatcherId);

    this.emit('overrideExecuted', {
      overrideId,
      dispatchId: override.dispatchId,
      proposedAssignment: override.proposedAssignment
    });

    return {
      success: true,
      overrideId,
      newAssignment: override.proposedAssignment,
      message: 'Override executed successfully'
    };
  }

  /**
   * Record dispatcher override for rate limiting
   */
  recordDispatcherOverride(dispatcherId) {
    const now = Date.now();
    const limit = this.dispatcherRateLimits.get(dispatcherId);

    if (limit) {
      limit.overrides.push(now);
    }
  }

  /**
   * Cancel pending or active override
   */
  cancelOverride(overrideId, cancelledBy) {
    const override = this.pendingApprovals.get(overrideId) || 
                     this.activeOverrides.get(overrideId);

    if (!override) {
      return {
        success: false,
        error: 'Override not found',
        code: 'NOT_FOUND'
      };
    }

    if (override.status === 'executed' || override.status === 'cancelled') {
      return {
        success: false,
        error: `Cannot cancel override with status: ${override.status}`,
        code: 'INVALID_STATUS'
      };
    }

    override.status = 'cancelled';
    override.cancelledAt = new Date();
    override.cancelledBy = cancelledBy;

    this.pendingApprovals.delete(overrideId);
    this.activeOverrides.delete(overrideId);

    logger.info(`Override cancelled: ${overrideId}`, { cancelledBy });

    if (this.auditLogging) {
      this.logAuditEvent({
        type: 'OVERRIDE_CANCELLED',
        overrideId,
        cancelledBy,
        timestamp: new Date()
      });
    }

    this.emit('overrideCancelled', { overrideId });

    return {
      success: true,
      overrideId,
      message: 'Override cancelled'
    };
  }

  /**
   * Get override by ID
   */
  getOverride(overrideId) {
    return this.pendingApprovals.get(overrideId) || 
           this.activeOverrides.get(overrideId) ||
           this.overrideHistory.find(o => o.overrideId === overrideId);
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(limit = 20) {
    return Array.from(this.pendingApprovals.values())
      .sort((a, b) => {
        // Prioritize urgent overrides
        if (a.urgency === 'critical' && b.urgency !== 'critical') return -1;
        if (a.urgency !== 'critical' && b.urgency === 'critical') return 1;
        // Then sort by timestamp
        return a.requestedAt - b.requestedAt;
      })
      .slice(0, limit);
  }

  /**
   * Get dispatcher override history
   */
  getDispatcherHistory(dispatcherId, limit = 50) {
    return this.overrideHistory
      .filter(o => o.dispatcherId === dispatcherId)
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .slice(0, limit);
  }

  /**
   * Get override statistics
   */
  getStatistics(timeWindow = 86400000) { // 24 hours
    const now = Date.now();
    const cutoff = now - timeWindow;

    const recentHistory = this.overrideHistory.filter(o => 
      o.requestedAt.getTime() > cutoff
    );

    const byStatus = {};
    const byDispatcher = {};
    const byReason = {};

    recentHistory.forEach(override => {
      // By status
      byStatus[override.status] = (byStatus[override.status] || 0) + 1;

      // By dispatcher
      byDispatcher[override.dispatcherId] = (byDispatcher[override.dispatcherId] || 0) + 1;

      // By reason category
      const reasonCategory = override.reason.split(' ')[0];
      byReason[reasonCategory] = (byReason[reasonCategory] || 0) + 1;
    });

    return {
      totalOverrides: recentHistory.length,
      pendingApprovals: this.pendingApprovals.size,
      activeOverrides: this.activeOverrides.size,
      byStatus,
      byDispatcher,
      byReason,
      averageApprovalTime: this.calculateAverageApprovalTime(recentHistory),
      topDispatchers: Object.entries(byDispatcher)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }

  /**
   * Calculate average approval time
   */
  calculateAverageApprovalTime(overrides) {
    const approvedOverrides = overrides.filter(o => o.approvedAt);
    
    if (approvedOverrides.length === 0) return 0;

    const totalTime = approvedOverrides.reduce((sum, o) => {
      const time = o.approvedAt.getTime() - o.requestedAt.getTime();
      return sum + time;
    }, 0);

    return Math.round(totalTime / approvedOverrides.length);
  }

  /**
   * Generate compliance report
   */
  getComplianceReport(startDate, endDate) {
    const filtered = this.overrideHistory.filter(o =>
      o.requestedAt >= startDate && o.requestedAt <= endDate
    );

    return {
      period: { startDate, endDate },
      totalOverrides: filtered.length,
      executedOverrides: filtered.filter(o => o.status === 'executed').length,
      rejectedOverrides: filtered.filter(o => o.status === 'rejected').length,
      dispatcherBreakdown: this.getDispatcherBreakdown(filtered),
      complianceMetrics: {
        overrideRate: filtered.length > 0 ? 
          (filtered.filter(o => o.status === 'executed').length / filtered.length * 100).toFixed(2) + '%' : 
          '0%',
        approvalRate: filtered.length > 0 ?
          (filtered.filter(o => o.status !== 'rejected').length / filtered.length * 100).toFixed(2) + '%' :
          '0%'
      },
      auditLog: filtered.slice(-100) // Last 100 for review
    };
  }

  /**
   * Get dispatcher breakdown for compliance
   */
  getDispatcherBreakdown(overrides) {
    const breakdown = {};

    overrides.forEach(o => {
      if (!breakdown[o.dispatcherId]) {
        breakdown[o.dispatcherId] = {
          name: o.dispatcherName,
          total: 0,
          executed: 0,
          rejected: 0,
          pending: 0
        };
      }

      breakdown[o.dispatcherId].total++;
      if (o.status === 'executed') breakdown[o.dispatcherId].executed++;
      if (o.status === 'rejected') breakdown[o.dispatcherId].rejected++;
      if (o.status === 'pending_approval') breakdown[o.dispatcherId].pending++;
    });

    return breakdown;
  }

  /**
   * Log audit event
   */
  logAuditEvent(event) {
    logger.info(`[AUDIT] ${event.type}`, {
      ...event,
      timestamp: event.timestamp.toISOString()
    });

    // In production, this would persist to a dedicated audit log storage
  }

  /**
   * Generate override ID
   */
  generateOverrideId() {
    return `OVR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown service
   */
  shutdown() {
    logger.info('Manual Override Service shutdown', {
      pendingApprovals: this.pendingApprovals.size,
      activeOverrides: this.activeOverrides.size
    });
  }
}

module.exports = ManualOverrideService;
