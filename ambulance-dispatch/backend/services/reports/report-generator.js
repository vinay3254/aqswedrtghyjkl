/**
 * Digital Incident Report Generator
 * Generates comprehensive incident reports with timestamps, locations, and actions
 */

const { v4: uuidv4 } = require('uuid');
const { formatDistanceToNow } = require('date-fns');

class IncidentReportGenerator {
  /**
   * Generate a new incident report
   * @param {Object} incidentData - Incident data from dispatch system
   * @returns {Object} Complete incident report
   */
  static generateReport(incidentData) {
    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const report = {
      // Report metadata
      reportId,
      reportType: 'INCIDENT_REPORT',
      generatedAt: new Date().toISOString(),
      generatedBy: incidentData.generatedBy || 'System',

      // Incident information
      incident: {
        incidentId: incidentData.incidentId || uuidv4(),
        callNumber: incidentData.callNumber || this._generateCallNumber(),
        caseNumber: incidentData.caseNumber || `CASE-${Date.now()}`,
        incidentType: incidentData.incidentType || 'EMERGENCY',
        severity: incidentData.severity || 'HIGH',
        description: incidentData.description || '',
        keywords: incidentData.keywords || [],
      },

      // Timeline events
      timeline: this._generateTimeline(incidentData.events || []),

      // Location details
      location: {
        address: incidentData.location?.address || 'Unknown Address',
        gpsCoordinates: incidentData.location?.coordinates || {
          latitude: 0,
          longitude: 0,
        },
        district: incidentData.location?.district || '',
        region: incidentData.location?.region || '',
        landmark: incidentData.location?.landmark || '',
        accessNotes: incidentData.location?.accessNotes || '',
      },

      // Patient information
      patient: {
        patientId: incidentData.patient?.patientId || 'PATIENT-' + uuidv4().substr(0, 8),
        firstName: incidentData.patient?.firstName || '',
        lastName: incidentData.patient?.lastName || '',
        age: incidentData.patient?.age || 'Unknown',
        gender: incidentData.patient?.gender || 'Unknown',
        phoneNumber: this._maskPhoneNumber(incidentData.patient?.phoneNumber || ''),
        idNumber: this._maskIdNumber(incidentData.patient?.idNumber || ''),
        allergies: incidentData.patient?.allergies || [],
        medicalHistory: incidentData.patient?.medicalHistory || [],
        chronicConditions: incidentData.patient?.chronicConditions || [],
      },

      // Ambulance dispatch information
      ambulance: {
        ambulanceId: incidentData.ambulance?.ambulanceId || '',
        registrationPlate: incidentData.ambulance?.registrationPlate || '',
        baseStation: incidentData.ambulance?.baseStation || '',
        crewSize: incidentData.ambulance?.crewSize || 2,
        crew: this._generateCrewInfo(incidentData.ambulance?.crew || []),
      },

      // Paramedic actions and observations
      paramedic: {
        assessment: {
          primaryComplaint: incidentData.paramedic?.assessment?.primaryComplaint || '',
          secondaryComplaints: incidentData.paramedic?.assessment?.secondaryComplaints || [],
          consciousness: incidentData.paramedic?.assessment?.consciousness || 'Alert',
          breathing: incidentData.paramedic?.assessment?.breathing || 'Normal',
          circulation: incidentData.paramedic?.assessment?.circulation || 'Normal',
          skinColor: incidentData.paramedic?.assessment?.skinColor || 'Normal',
        },
        vitals: {
          bloodPressure: incidentData.paramedic?.vitals?.bloodPressure || '120/80',
          heartRate: incidentData.paramedic?.vitals?.heartRate || 0,
          respirationRate: incidentData.paramedic?.vitals?.respirationRate || 0,
          temperature: incidentData.paramedic?.vitals?.temperature || '37°C',
          spO2: incidentData.paramedic?.vitals?.spO2 || '98%',
          glucoseLevel: incidentData.paramedic?.vitals?.glucoseLevel || '',
        },
        actions: this._generateActions(incidentData.paramedic?.actions || []),
        medications: incidentData.paramedic?.medications || [],
        notes: incidentData.paramedic?.notes || '',
      },

      // Hospital handover
      handover: {
        hospitalId: incidentData.handover?.hospitalId || '',
        hospitalName: incidentData.handover?.hospitalName || '',
        arrivalTime: incidentData.handover?.arrivalTime || new Date().toISOString(),
        dischargeTime: incidentData.handover?.dischargeTime || null,
        receivingStaff: incidentData.handover?.receivingStaff || {},
        department: incidentData.handover?.department || 'Emergency',
        handoverNotes: incidentData.handover?.handoverNotes || '',
      },

      // Quality metrics
      metrics: {
        callToDispatchTime: incidentData.metrics?.callToDispatchTime || 0,
        dispatchToArrivalTime: incidentData.metrics?.dispatchToArrivalTime || 0,
        sceneTime: incidentData.metrics?.sceneTime || 0,
        transportTime: incidentData.metrics?.transportTime || 0,
        totalIncidentTime: incidentData.metrics?.totalIncidentTime || 0,
        distanceTraveled: incidentData.metrics?.distanceTraveled || 0,
        qualityScore: incidentData.metrics?.qualityScore || 0,
      },

      // Compliance and signatures
      compliance: {
        reportStatus: 'DRAFT',
        isComplete: false,
        requiresReview: true,
        hasPhotos: incidentData.compliance?.hasPhotos || false,
        hasConsent: incidentData.compliance?.hasConsent || false,
        followUpRequired: incidentData.compliance?.followUpRequired || false,
        incidentCategory: incidentData.compliance?.incidentCategory || 'STANDARD',
      },

      // Signatures and approvals
      signatures: {
        paramedic1: {
          name: '',
          licenseNumber: '',
          signature: null,
          timestamp: null,
        },
        paramedic2: {
          name: '',
          licenseNumber: '',
          signature: null,
          timestamp: null,
        },
        supervisor: {
          name: '',
          licenseNumber: '',
          signature: null,
          timestamp: null,
        },
      },

      // Attachments
      attachments: {
        photos: [],
        audioRecordings: [],
        documents: [],
      },
    };

    return report;
  }

  /**
   * Generate timeline of events
   * @private
   */
  static _generateTimeline(events) {
    if (events.length === 0) {
      return [
        {
          timestamp: new Date().toISOString(),
          event: 'CALL_RECEIVED',
          description: 'Call received from dispatch center',
          actor: 'Dispatcher',
        },
        {
          timestamp: new Date(Date.now() + 60000).toISOString(),
          event: 'AMBULANCE_DISPATCHED',
          description: 'Ambulance dispatched to scene',
          actor: 'Dispatch System',
        },
        {
          timestamp: new Date(Date.now() + 300000).toISOString(),
          event: 'SCENE_ARRIVED',
          description: 'Ambulance arrived at scene',
          actor: 'Paramedic',
        },
      ];
    }

    return events.map((event) => ({
      timestamp: event.timestamp || new Date().toISOString(),
      event: event.event || 'UNKNOWN',
      description: event.description || '',
      actor: event.actor || 'Unknown',
      location: event.location || null,
      additionalData: event.additionalData || {},
    }));
  }

  /**
   * Generate paramedic actions
   * @private
   */
  static _generateActions(actions) {
    if (actions.length === 0) {
      return [
        {
          actionId: uuidv4(),
          timestamp: new Date().toISOString(),
          action: 'ASSESSMENT',
          description: 'Initial patient assessment performed',
          outcome: 'COMPLETED',
          notes: '',
        },
        {
          actionId: uuidv4(),
          timestamp: new Date(Date.now() + 120000).toISOString(),
          action: 'VITALS_RECORDED',
          description: 'Vital signs recorded',
          outcome: 'COMPLETED',
          notes: 'Stable vitals',
        },
      ];
    }

    return actions.map((action) => ({
      actionId: action.actionId || uuidv4(),
      timestamp: action.timestamp || new Date().toISOString(),
      action: action.action || 'OTHER',
      description: action.description || '',
      outcome: action.outcome || 'PENDING',
      notes: action.notes || '',
      createdBy: action.createdBy || 'Paramedic',
    }));
  }

  /**
   * Generate crew information with masked IDs
   * @private
   */
  static _generateCrewInfo(crew) {
    return crew.map((member) => ({
      name: member.name || 'Unknown',
      role: member.role || 'Paramedic',
      licenseNumber: this._maskIdNumber(member.licenseNumber || ''),
      yearsExperience: member.yearsExperience || 0,
    }));
  }

  /**
   * Generate call number
   * @private
   */
  static _generateCallNumber() {
    return `CALL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Mask phone number for privacy
   * @private
   */
  static _maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 4) return 'XXXX-XXXX';
    return `****${phoneNumber.slice(-4)}`;
  }

  /**
   * Mask ID number for privacy
   * @private
   */
  static _maskIdNumber(idNumber) {
    if (!idNumber || idNumber.length < 4) return 'XXXX-XXXX';
    return `****${idNumber.slice(-4)}`;
  }

  /**
   * Add signature to report
   * @param {string} reportId - Report ID
   * @param {string} role - Paramedic, Paramedic2, or Supervisor
   * @param {Object} signatureData - Signature data
   */
  static addSignature(report, role, signatureData) {
    if (!report.signatures[role.toLowerCase()]) {
      throw new Error(`Invalid role: ${role}`);
    }

    report.signatures[role.toLowerCase()] = {
      name: signatureData.name,
      licenseNumber: this._maskIdNumber(signatureData.licenseNumber),
      signature: signatureData.signature,
      timestamp: new Date().toISOString(),
    };

    // Check if all required signatures are present
    const allSigned =
      report.signatures.paramedic1.timestamp &&
      report.signatures.paramedic2.timestamp &&
      report.signatures.supervisor.timestamp;

    if (allSigned) {
      report.compliance.reportStatus = 'SUBMITTED';
      report.compliance.isComplete = true;
    }

    return report;
  }

  /**
   * Calculate performance metrics
   * @param {Object} report - The incident report
   */
  static calculateMetrics(report) {
    const timeline = report.timeline;
    if (timeline.length < 2) return report;

    const firstEvent = new Date(timeline[0].timestamp);
    const lastEvent = new Date(timeline[timeline.length - 1].timestamp);

    report.metrics.totalIncidentTime = Math.round(
      (lastEvent - firstEvent) / 1000 / 60
    ); // in minutes

    // Find specific events for time calculations
    const dispatchedEvent = timeline.find((e) => e.event === 'AMBULANCE_DISPATCHED');
    const arrivedEvent = timeline.find((e) => e.event === 'SCENE_ARRIVED');
    const hospitalEvent = timeline.find((e) => e.event === 'ARRIVED_AT_HOSPITAL');

    if (dispatchedEvent && arrivedEvent) {
      report.metrics.dispatchToArrivalTime = Math.round(
        (new Date(arrivedEvent.timestamp) - new Date(dispatchedEvent.timestamp)) / 1000 / 60
      );
    }

    if (arrivedEvent && hospitalEvent) {
      report.metrics.transportTime = Math.round(
        (new Date(hospitalEvent.timestamp) - new Date(arrivedEvent.timestamp)) / 1000 / 60
      );
    }

    return report;
  }

  /**
   * Validate report completeness
   * @param {Object} report - The incident report
   */
  static validateReport(report) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!report.incident.incidentId) errors.push('Incident ID is required');
    if (!report.patient.firstName && !report.patient.lastName)
      warnings.push('Patient name is missing');
    if (!report.location.address) errors.push('Location is required');

    // Vital signs should be recorded
    if (!report.paramedic.vitals.heartRate) warnings.push('Heart rate not recorded');
    if (!report.paramedic.vitals.respirationRate) warnings.push('Respiration rate not recorded');

    // Signatures
    if (!report.signatures.paramedic1.timestamp) warnings.push('Paramedic 1 signature missing');
    if (!report.signatures.paramedic2.timestamp) warnings.push('Paramedic 2 signature missing');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completionPercentage: this._calculateCompletion(report),
    };
  }

  /**
   * Calculate report completion percentage
   * @private
   */
  static _calculateCompletion(report) {
    const sections = [
      { name: 'incident', weight: 1 },
      { name: 'patient', weight: 1 },
      { name: 'location', weight: 0.8 },
      { name: 'paramedic', weight: 1 },
      { name: 'handover', weight: 0.8 },
      { name: 'signatures', weight: 1 },
    ];

    let totalScore = 0;
    let totalWeight = 0;

    sections.forEach((section) => {
      const sectionData = report[section.name];
      let fieldsFilled = 0;
      let totalFields = 0;

      Object.values(sectionData).forEach((value) => {
        if (typeof value === 'object' && value !== null) {
          Object.values(value).forEach((v) => {
            totalFields++;
            if (v !== null && v !== '' && v !== undefined) fieldsFilled++;
          });
        } else {
          totalFields++;
          if (value !== null && value !== '' && value !== undefined) fieldsFilled++;
        }
      });

      const sectionScore = totalFields > 0 ? fieldsFilled / totalFields : 0;
      totalScore += sectionScore * section.weight;
      totalWeight += section.weight;
    });

    return Math.round((totalScore / totalWeight) * 100);
  }

  /**
   * Get sample incident data for testing
   */
  static getSampleIncidentData() {
    return {
      incidentId: 'INC-001',
      callNumber: 'CALL-20240115-001',
      caseNumber: 'CASE-20240115-001',
      incidentType: 'MEDICAL',
      severity: 'HIGH',
      description: 'Patient experiencing chest pain and difficulty breathing',
      keywords: ['chest-pain', 'cardiac', 'difficulty-breathing'],
      generatedBy: 'System',

      location: {
        address: '123 Main Street, Apartment 4B',
        coordinates: {
          latitude: -1.2865,
          longitude: 36.8172,
        },
        district: 'Westlands',
        region: 'Nairobi',
        landmark: 'Near Safari Park Hotel',
        accessNotes: 'Main gate, intercom system available',
      },

      patient: {
        patientId: 'PT-001',
        firstName: 'John',
        lastName: 'Doe',
        age: '65',
        gender: 'Male',
        phoneNumber: '+254712345678',
        idNumber: '12345678',
        allergies: ['Penicillin'],
        medicalHistory: ['Hypertension', 'Type 2 Diabetes'],
        chronicConditions: ['Heart Disease'],
      },

      ambulance: {
        ambulanceId: 'AMB-001',
        registrationPlate: 'KDN 500P',
        baseStation: 'Westlands Station',
        crewSize: 2,
        crew: [
          {
            name: 'James Kipchoge',
            role: 'Paramedic',
            licenseNumber: 'PAR-2024-001',
            yearsExperience: 8,
          },
          {
            name: 'Mary Wanjiru',
            role: 'Paramedic',
            licenseNumber: 'PAR-2024-002',
            yearsExperience: 5,
          },
        ],
      },

      paramedic: {
        assessment: {
          primaryComplaint: 'Chest pain radiating to left arm',
          secondaryComplaints: ['Shortness of breath', 'Nausea'],
          consciousness: 'Alert and oriented',
          breathing: 'Rapid and shallow',
          circulation: 'Pale, diaphoretic',
          skinColor: 'Pale',
        },
        vitals: {
          bloodPressure: '160/95',
          heartRate: 102,
          respirationRate: 24,
          temperature: '36.8°C',
          spO2: '94%',
          glucoseLevel: '145 mg/dL',
        },
        actions: [
          {
            action: 'ASSESSMENT',
            description: 'Initial patient assessment performed',
            outcome: 'COMPLETED',
          },
          {
            action: 'VITALS_RECORDED',
            description: 'Vital signs recorded',
            outcome: 'COMPLETED',
          },
          {
            action: 'IV_ESTABLISHED',
            description: '18G IV established in left forearm',
            outcome: 'COMPLETED',
          },
          {
            action: 'OXYGEN_PROVIDED',
            description: 'Oxygen provided at 2L/min via nasal cannula',
            outcome: 'COMPLETED',
          },
        ],
        medications: [
          {
            name: 'Aspirin',
            dose: '300mg',
            route: 'Oral',
            time: '14:35',
            administration: 'Completed',
          },
        ],
        notes: 'Patient alert and responsive. Suspected acute coronary syndrome. Rapid transport initiated.',
      },

      handover: {
        hospitalId: 'HOSP-001',
        hospitalName: 'Nairobi Hospital',
        arrivalTime: '14:55',
        dischargeTime: null,
        receivingStaff: {
          name: 'Dr. Peter Mwangi',
          role: 'Emergency Physician',
        },
        department: 'Emergency Department',
        handoverNotes:
          ' 65-year-old male with chest pain and shortness of breath. IV in place, O2 saturation 94%. Patient conscious and oriented.',
      },

      metrics: {
        callToDispatchTime: 2,
        dispatchToArrivalTime: 12,
        sceneTime: 15,
        transportTime: 20,
        totalIncidentTime: 49,
        distanceTraveled: 8.5,
        qualityScore: 0,
      },

      compliance: {
        hasPhotos: false,
        hasConsent: true,
        followUpRequired: true,
        incidentCategory: 'CARDIAC',
      },

      events: [
        {
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          event: 'CALL_RECEIVED',
          description: 'Emergency call received',
          actor: 'Dispatcher',
        },
        {
          timestamp: new Date(Date.now() - 1740000).toISOString(),
          event: 'AMBULANCE_DISPATCHED',
          description: 'Ambulance AMB-001 dispatched',
          actor: 'Dispatch System',
        },
        {
          timestamp: new Date(Date.now() - 1440000).toISOString(),
          event: 'SCENE_ARRIVED',
          description: 'Ambulance arrived at scene',
          actor: 'Paramedic',
        },
        {
          timestamp: new Date(Date.now() - 900000).toISOString(),
          event: 'PATIENT_LOADED',
          description: 'Patient loaded into ambulance',
          actor: 'Paramedic',
        },
        {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          event: 'ARRIVED_AT_HOSPITAL',
          description: 'Arrived at Nairobi Hospital',
          actor: 'Paramedic',
        },
      ],
    };
  }
}

module.exports = IncidentReportGenerator;
