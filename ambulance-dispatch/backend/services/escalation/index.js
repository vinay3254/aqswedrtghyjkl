/**
 * Mutual Aid & Escalation System - Index
 * 
 * Complete system for managing ambulance resources across jurisdictions,
 * handling escalations, mutual aid requests, and mass casualty incidents.
 */

const EscalationRules = require('./escalation-rules');
const MutualAidCoordinator = require('./mutual-aid-coordinator');
const MassCasualtyHandler = require('./mass-casualty-handler');
const ResourcePoolingManager = require('./resource-pooling');

/**
 * Initialize complete escalation system with default configuration
 * @returns {Object} All components initialized and ready
 */
function initializeSystem(config = {}) {
  return {
    escalationRules: new EscalationRules(config.escalationRules),
    maidCoordinator: new MutualAidCoordinator(config.maidCoordinator),
    mciHandler: new MassCasualtyHandler(config.mciHandler),
    poolingManager: new ResourcePoolingManager(config.poolingManager),
  };
}

/**
 * System Status Interface
 */
class EscalationSystem {
  constructor(config = {}) {
    this.components = initializeSystem(config);
    this.incidents = new Map();
  }

  /**
   * Get all components
   */
  getComponents() {
    return this.components;
  }

  /**
   * Get escalation rules
   */
  getEscalationRules() {
    return this.components.escalationRules;
  }

  /**
   * Get mutual aid coordinator
   */
  getMutualAidCoordinator() {
    return this.components.maidCoordinator;
  }

  /**
   * Get MCI handler
   */
  getMCIHandler() {
    return this.components.mciHandler;
  }

  /**
   * Get resource pooling manager
   */
  getPoolingManager() {
    return this.components.poolingManager;
  }

  /**
   * Get system status summary
   */
  getSystemStatus() {
    const escalationAlerts = this.components.escalationRules.getActiveAlerts();
    const activeMCIs = this.components.mciHandler.getActiveMCIs();
    const activeRequests = this.components.maidCoordinator.getActiveRequests();
    const poolStatus = this.components.poolingManager.getPoolStatus();

    return {
      timestamp: new Date(),
      escalationAlerts: escalationAlerts.length,
      activeMCIs: activeMCIs.length,
      activeMutualAidRequests: activeRequests.length,
      resourcePool: {
        jurisdictions: poolStatus.totalJurisdictions,
        allocations: poolStatus.totalAllocations,
        activeAllocations: poolStatus.activeAllocations,
      },
      incidents: this.incidents.size,
    };
  }

  /**
   * Register incident
   */
  registerIncident(incidentId, data) {
    this.incidents.set(incidentId, {
      id: incidentId,
      createdAt: new Date(),
      ...data,
    });
  }

  /**
   * Get incident
   */
  getIncident(incidentId) {
    return this.incidents.get(incidentId);
  }

  /**
   * Close incident
   */
  closeIncident(incidentId) {
    const incident = this.incidents.get(incidentId);
    if (incident) {
      incident.closedAt = new Date();
      incident.status = 'CLOSED';
    }
  }

  /**
   * Get all incidents
   */
  getAllIncidents() {
    return Array.from(this.incidents.values());
  }
}

// Export all components and factory
module.exports = {
  // Components
  EscalationRules,
  MutualAidCoordinator,
  MassCasualtyHandler,
  ResourcePoolingManager,

  // Factory function
  initializeSystem,

  // System class
  EscalationSystem,

  // Convenience function to create system
  createSystem: (config) => new EscalationSystem(config),

  // Version
  version: '1.0.0',
  
  // Documentation
  docs: {
    README: './README.md',
    WORKFLOW: './ESCALATION_WORKFLOW.md',
    EXAMPLES: './USAGE_EXAMPLES.js',
    INTEGRATION_TEST: './INTEGRATION_TEST.js',
  },

  // Quick reference
  reference: {
    escalationLevels: ['LOCAL', 'DISTRICT', 'REGIONAL', 'MUTUAL_AID'],
    triageCategories: ['RED', 'YELLOW', 'GREEN', 'BLACK'],
    incidentStatus: ['PENDING', 'ACTIVE', 'TRANSPORTED', 'COMPLETED', 'CLOSED'],
    resourceStatus: ['AVAILABLE', 'DEPLOYED', 'IN_SERVICE', 'RETURNING'],
  },
};

/**
 * QUICK START GUIDE
 * 
 * 1. Initialize System
 *    const { EscalationSystem } = require('./index');
 *    const system = new EscalationSystem();
 * 
 * 2. Check Escalation
 *    const escalation = system.getEscalationRules()
 *      .determineEscalationLevel(incidentData);
 * 
 * 3. Declare MCI
 *    const mciId = system.getMCIHandler()
 *      .declareMCI(incidentData);
 * 
 * 4. Request Mutual Aid
 *    const request = await system.getMutualAidCoordinator()
 *      .requestMutualAid(requestData);
 * 
 * 5. Request Pooled Resources
 *    const allocation = await system.getPoolingManager()
 *      .requestPooledResources(jurisdiction, requestData);
 * 
 * 6. Monitor System
 *    const status = system.getSystemStatus();
 * 
 * See README.md, ESCALATION_WORKFLOW.md, and USAGE_EXAMPLES.js for details.
 */
