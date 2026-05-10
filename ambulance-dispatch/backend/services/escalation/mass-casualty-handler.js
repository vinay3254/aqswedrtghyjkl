/**
 * Mass Casualty Incident (MCI) Handler
 * Manages large-scale incidents with multiple patients
 */

const EventEmitter = require('events');

class MassCasualtyHandler extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      mciThreshold: config.mciThreshold || 3, // Minimum patients for MCI
      triageProtocol: config.triageProtocol || 'START', // Simple Triage And Rapid Treatment
      commandStructure: config.commandStructure || 'ICS', // Incident Command System
      ...config,
    };

    this.activeIncidents = new Map();
    this.incidentHistory = [];
    this.resourceAllocations = new Map();
  }

  /**
   * Declare mass casualty incident
   * @param {Object} incidentData - Incident details
   * @returns {string} MCI ID
   */
  declareMCI(incidentData) {
    const {
      location,
      incidentType,
      estimatedPatients,
      severity = 'HIGH',
      coordinates = {},
    } = incidentData;

    if (!location || !incidentType) {
      throw new Error('Missing required fields: location, incidentType');
    }

    if (estimatedPatients < this.config.mciThreshold) {
      throw new Error(
        `Incident does not meet MCI threshold (${this.config.mciThreshold} patients)`
      );
    }

    const mciId = `MCI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const mci = {
      mciId,
      location,
      incidentType,
      estimatedPatients,
      severity,
      coordinates,
      declaredAt: new Date(),
      status: 'ACTIVE',
      commandPost: null,
      sectors: [],
      patients: new Map(),
      resources: [],
      triage: {
        red: 0,    // Immediate
        yellow: 0, // Delayed
        green: 0,  // Minor
        black: 0,  // Deceased/Expectant
      },
      timeline: [
        {
          event: 'MCI_DECLARED',
          timestamp: new Date(),
          details: incidentData,
        },
      ],
    };

    this.activeIncidents.set(mciId, mci);

    // Emit event
    this.emit('mci-declared', {
      mciId,
      location,
      estimatedPatients,
      severity,
    });

    // Initialize command structure
    this.initializeCommandStructure(mciId);

    return mciId;
  }

  /**
   * Initialize incident command structure
   * @private
   */
  initializeCommandStructure(mciId) {
    const mci = this.activeIncidents.get(mciId);

    if (!mci) return;

    // Create command post
    mci.commandPost = {
      id: `CMD-${mciId}`,
      location: mci.location,
      established: new Date(),
      commander: null,
      structure: this.config.commandStructure,
      personnel: [],
    };

    // Create operational sectors
    const sectors = ['North', 'South', 'East', 'West', 'Central'];
    mci.sectors = sectors.map((sector) => ({
      sectorId: `${mciId}-${sector}`,
      name: sector,
      leader: null,
      position: null,
      resources: [],
      patients: [],
    }));

    this.emit('command-structure-initialized', {
      mciId,
      commandPost: mci.commandPost,
      sectors: mci.sectors.length,
    });
  }

  /**
   * Register patient in MCI
   * @param {string} mciId - MCI identifier
   * @param {Object} patientData - Patient information
   * @returns {string} Patient ID
   */
  registerPatient(mciId, patientData) {
    const mci = this.activeIncidents.get(mciId);

    if (!mci) {
      throw new Error(`MCI not found: ${mciId}`);
    }

    const {
      location,
      age = null,
      gender = null,
      injuries = [],
      vitals = {},
      triageCategory = null,
    } = patientData;

    const patientId = `PT-${mciId}-${mci.patients.size + 1}`;

    // Perform triage if not already done
    const category = triageCategory || this.performTriage(vitals, injuries);

    const patient = {
      patientId,
      mciId,
      location,
      age,
      gender,
      injuries,
      vitals,
      triageCategory: category,
      registeredAt: new Date(),
      assignedSector: null,
      assignedUnit: null,
      status: 'WAITING',
      transportPriority: this.getTransportPriority(category),
      notes: [],
    };

    mci.patients.set(patientId, patient);

    // Update triage counts
    mci.triage[category.toLowerCase()]++;

    // Assign to nearest sector
    const sector = this.assignPatientToSector(mciId, patientId, location);
    patient.assignedSector = sector.sectorId;

    this.emit('patient-registered', {
      patientId,
      mciId,
      triageCategory: category,
      sector: sector.name,
    });

    return patientId;
  }

  /**
   * Perform triage assessment
   * @private
   */
  performTriage(vitals, injuries) {
    const { respiratoryRate = 0, capillaryRefill = 0, alertness = true } = vitals;

    // START protocol
    // RED: Immediate - abnormal breathing or delayed cap refill or unresponsive
    if (
      respiratoryRate > 30 ||
      capillaryRefill > 2 ||
      !alertness
    ) {
      return 'RED';
    }

    // YELLOW: Delayed - abnormal breathing corrected or altered mental status
    if (respiratoryRate > 12 && respiratoryRate <= 30) {
      return 'YELLOW';
    }

    // GREEN: Minor - walking wounded with minor injuries
    if (injuries.length <= 1) {
      return 'GREEN';
    }

    return 'YELLOW';
  }

  /**
   * Get transport priority
   * @private
   */
  getTransportPriority(category) {
    const priorities = {
      RED: 1,    // Highest
      YELLOW: 2,
      GREEN: 3,
      BLACK: 4,  // Lowest/Deceased
    };
    return priorities[category] || 99;
  }

  /**
   * Assign patient to sector
   * @private
   */
  assignPatientToSector(mciId, patientId, location) {
    const mci = this.activeIncidents.get(mciId);
    if (!mci) throw new Error(`MCI not found: ${mciId}`);

    // Simple assignment - assign to sector with fewest patients
    let leastPopulated = mci.sectors[0];
    for (const sector of mci.sectors) {
      if (sector.patients.length < leastPopulated.patients.length) {
        leastPopulated = sector;
      }
    }

    leastPopulated.patients.push(patientId);
    return leastPopulated;
  }

  /**
   * Dispatch resource to MCI
   * @param {string} mciId - MCI identifier
   * @param {Object} resourceData - Resource details
   * @returns {string} Resource assignment ID
   */
  dispatchResource(mciId, resourceData) {
    const mci = this.activeIncidents.get(mciId);

    if (!mci) {
      throw new Error(`MCI not found: ${mciId}`);
    }

    const {
      unitId,
      unitType,
      crew = [],
      equipment = [],
      assignedSector = null,
    } = resourceData;

    const assignment = {
      assignmentId: `ASSIGN-${mciId}-${Date.now()}`,
      unitId,
      unitType,
      crew,
      equipment,
      assignedSector: assignedSector || mci.sectors[0].sectorId,
      arrivedAt: new Date(),
      status: 'DEPLOYED',
      assignedPatients: [],
      tasksCompleted: [],
    };

    mci.resources.push(assignment);

    // Update sector resources
    if (assignedSector) {
      const sector = mci.sectors.find((s) => s.sectorId === assignedSector);
      if (sector) {
        sector.resources.push(assignment.assignmentId);
      }
    }

    this.emit('resource-deployed', {
      mciId,
      unitId,
      unitType,
      sector: assignedSector,
    });

    return assignment.assignmentId;
  }

  /**
   * Update patient transport status
   * @param {string} mciId - MCI identifier
   * @param {string} patientId - Patient identifier
   * @param {string} status - New status
   * @param {Object} transportDetails - Transport information
   */
  updatePatientTransport(mciId, patientId, status, transportDetails = {}) {
    const mci = this.activeIncidents.get(mciId);
    if (!mci) throw new Error(`MCI not found: ${mciId}`);

    const patient = mci.patients.get(patientId);
    if (!patient) throw new Error(`Patient not found: ${patientId}`);

    patient.status = status;
    patient.lastUpdate = new Date();

    if (status === 'TRANSPORTED') {
      patient.transportedAt = new Date();
      patient.transportDetails = transportDetails;

      // Log in timeline
      mci.timeline.push({
        event: 'PATIENT_TRANSPORTED',
        timestamp: new Date(),
        patientId,
        details: transportDetails,
      });
    }

    this.emit('patient-transport-updated', {
      mciId,
      patientId,
      status,
      ...transportDetails,
    });
  }

  /**
   * Get MCI status summary
   * @param {string} mciId - MCI identifier
   * @returns {Object}
   */
  getMCIStatus(mciId) {
    const mci = this.activeIncidents.get(mciId);

    if (!mci) {
      return null;
    }

    const stats = {
      mciId,
      status: mci.status,
      location: mci.location,
      declaredAt: mci.declaredAt,
      estimatedPatients: mci.estimatedPatients,
      registeredPatients: mci.patients.size,
      triage: mci.triage,
      resources: {
        deployed: mci.resources.length,
        byType: {},
      },
      sectors: mci.sectors.map((s) => ({
        name: s.name,
        patients: s.patients.length,
        resources: s.resources.length,
      })),
      transportSummary: {
        transported: 0,
        waiting: 0,
        inTreatment: 0,
      },
    };

    // Count resources by type
    mci.resources.forEach((r) => {
      stats.resources.byType[r.unitType] =
        (stats.resources.byType[r.unitType] || 0) + 1;
    });

    // Count patient transport status
    mci.patients.forEach((p) => {
      if (p.status === 'TRANSPORTED') {
        stats.transportSummary.transported++;
      } else if (p.status === 'WAITING') {
        stats.transportSummary.waiting++;
      } else if (p.status === 'IN_TREATMENT') {
        stats.transportSummary.inTreatment++;
      }
    });

    return stats;
  }

  /**
   * Close MCI incident
   * @param {string} mciId - MCI identifier
   * @param {Object} closeDetails - Closure details
   */
  closeMCI(mciId, closeDetails = {}) {
    const mci = this.activeIncidents.get(mciId);

    if (!mci) {
      throw new Error(`MCI not found: ${mciId}`);
    }

    mci.status = 'CLOSED';
    mci.closedAt = new Date();
    mci.closeDetails = closeDetails;

    // Move to history
    this.incidentHistory.push(mci);
    if (this.incidentHistory.length > 500) {
      this.incidentHistory = this.incidentHistory.slice(-500);
    }

    this.emit('mci-closed', {
      mciId,
      totalPatients: mci.patients.size,
      closeReason: closeDetails.reason,
    });
  }

  /**
   * Get active MCIs
   * @returns {Array}
   */
  getActiveMCIs() {
    return Array.from(this.activeIncidents.values()).filter(
      (m) => m.status === 'ACTIVE'
    );
  }

  /**
   * Get MCI by ID
   * @param {string} mciId - MCI identifier
   * @returns {Object|null}
   */
  getMCI(mciId) {
    return this.activeIncidents.get(mciId) || null;
  }
}

module.exports = MassCasualtyHandler;
