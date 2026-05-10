/**
 * Paper Trail Service
 * 
 * Generates printable dispatch tickets for offline use.
 * Creates archival records for incidents and provides emergency paper-based dispatch capability.
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class PaperTrailService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.enabled = config.enabled !== false;
    this.ticketFormat = config.ticketFormat || 'standard'; // standard, compact, detailed
    this.autoGenerate = config.autoGenerate !== false;
    this.printQueueSize = config.printQueueSize || 100;
    this.pageMargins = config.pageMargins || { top: 10, right: 10, bottom: 10, left: 10 }; // mm
    this.ticketDimensions = config.ticketDimensions || { width: 80, height: 120 }; // mm
    
    this.printQueue = [];
    this.printedTickets = [];
    this.ticketCounter = 0;
    this.ticketArchive = [];
    this.backupFormat = config.backupFormat || 'csv'; // csv, json, pdf
  }

  /**
   * Generate dispatch ticket from incident
   */
  generateDispatchTicket(incident) {
    const {
      incidentId,
      callTime,
      location,
      addressDetails,
      patientInfo = {},
      incidentType,
      priority,
      assignedAmbulances = [],
      specialInstructions = '',
      dispatchedBy = 'SYSTEM'
    } = incident;

    const ticketId = this.generateTicketId();
    const timestamp = new Date();

    const ticket = {
      ticketId,
      incidentId,
      ticketNumber: ++this.ticketCounter,
      generatedAt: timestamp,
      callTime: callTime || timestamp,
      status: 'generated',
      
      // Incident details
      incident: {
        type: incidentType,
        priority,
        description: this.generateIncidentDescription(incident)
      },

      // Location information
      location: {
        address: location,
        details: addressDetails,
        directions: this.generateDirections(addressDetails),
        mapReference: this.generateMapReference(location)
      },

      // Patient information
      patient: {
        name: patientInfo.name || 'N/A',
        age: patientInfo.age || 'N/A',
        gender: patientInfo.gender || 'N/A',
        condition: patientInfo.condition || 'Not specified',
        allergies: patientInfo.allergies || 'None known',
        medications: patientInfo.medications || 'None reported'
      },

      // Assignment
      assignment: {
        ambulances: assignedAmbulances,
        dispatchedBy,
        dispatchTime: timestamp
      },

      // Instructions
      specialInstructions,
      safetyNotes: this.generateSafetyNotes(incident),

      // Timestamps
      timestamps: {
        generated: timestamp,
        printed: null,
        completed: null
      },

      // Format information
      format: this.ticketFormat,
      pageNumber: null
    };

    this.ticketArchive.push(ticket);

    logger.info(`Dispatch ticket generated: ${ticketId}`, {
      incidentId,
      ticketNumber: this.ticketCounter
    });

    this.emit('ticketGenerated', {
      ticketId,
      ticketNumber: this.ticketCounter,
      incidentId
    });

    return ticket;
  }

  /**
   * Generate incident description
   */
  generateIncidentDescription(incident) {
    const type = incident.incidentType || 'Unknown';
    const priority = incident.priority || 'Normal';
    const caller = incident.callerName || 'Unknown caller';
    
    return `${priority} priority ${type} - Reported by ${caller}`;
  }

  /**
   * Generate directions from address details
   */
  generateDirections(addressDetails) {
    // In production, this would use mapping API
    const directions = {
      landmark: addressDetails.nearestLandmark || 'See address',
      accessRoute: addressDetails.accessRoute || 'Primary entrance',
      parkingInstructions: addressDetails.parking || 'Nearest available',
      buildingAccess: addressDetails.buildingAccess || 'Unlocked'
    };

    return `${directions.landmark}. Access: ${directions.accessRoute}. Parking: ${directions.parkingInstructions}`;
  }

  /**
   * Generate map reference grid
   */
  generateMapReference(location) {
    // Simplified map reference - in production would use actual mapping
    return {
      grid: 'MAP_REF_001', // Placeholder
      sector: 'North', // Placeholder
      coordinates: 'N/A', // Would be actual coordinates
      nearbyStreets: []
    };
  }

  /**
   * Generate safety notes from incident
   */
  generateSafetyNotes(incident) {
    const notes = [];

    if (incident.safetyHazards) {
      notes.push(`HAZARDS: ${incident.safetyHazards}`);
    }

    if (incident.sceneType === 'domestic') {
      notes.push('⚠ DOMESTIC SCENE - Use caution, law enforcement may be needed');
    }

    if (incident.animalPresent) {
      notes.push(`⚠ ANIMALS PRESENT: ${incident.animalPresent}`);
    }

    if (incident.violenceRisk) {
      notes.push('⚠ POTENTIAL VIOLENCE - Assess safety before entry');
    }

    if (incident.biohazardPresent) {
      notes.push('⚠ BIOHAZARD - Use appropriate PPE');
    }

    return notes;
  }

  /**
   * Queue ticket for printing
   */
  queueTicketForPrint(ticket) {
    if (this.printQueue.length >= this.printQueueSize) {
      return {
        success: false,
        error: 'Print queue full',
        queueSize: this.printQueue.length
      };
    }

    const printJob = {
      jobId: this.generatePrintJobId(),
      ticketId: ticket.ticketId,
      queuedAt: new Date(),
      status: 'queued',
      priority: ticket.incident.priority === 'critical' ? 'high' : 'normal',
      attempts: 0,
      maxAttempts: 3
    };

    this.printQueue.push(printJob);

    logger.info(`Ticket queued for printing: ${ticket.ticketId}`, {
      jobId: printJob.jobId,
      queuePosition: this.printQueue.length
    });

    this.emit('ticketQueued', {
      ticketId: ticket.ticketId,
      jobId: printJob.jobId,
      queuePosition: this.printQueue.length
    });

    return {
      success: true,
      jobId: printJob.jobId,
      queuePosition: this.printQueue.length
    };
  }

  /**
   * Get next print job
   */
  getNextPrintJob() {
    if (this.printQueue.length === 0) {
      return null;
    }

    // Sort by priority and queue time
    this.printQueue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return a.queuedAt - b.queuedAt;
    });

    const job = this.printQueue[0];
    job.status = 'printing';
    job.attempts++;

    return job;
  }

  /**
   * Mark print job as completed
   */
  completePrintJob(jobId) {
    const jobIndex = this.printQueue.findIndex(j => j.jobId === jobId);

    if (jobIndex === -1) {
      return { success: false, error: 'Print job not found' };
    }

    const job = this.printQueue[jobIndex];
    job.status = 'completed';
    job.completedAt = new Date();

    const ticket = this.ticketArchive.find(t => t.ticketId === job.ticketId);
    if (ticket) {
      ticket.timestamps.printed = new Date();
      ticket.status = 'printed';
    }

    this.printedTickets.push(job);
    this.printQueue.splice(jobIndex, 1);

    logger.info(`Print job completed: ${jobId}`, {
      ticketId: job.ticketId,
      attempts: job.attempts
    });

    this.emit('ticketPrinted', {
      jobId,
      ticketId: job.ticketId,
      attempts: job.attempts
    });

    return {
      success: true,
      jobId,
      printedTicketId: job.ticketId
    };
  }

  /**
   * Failed print job handling
   */
  reportPrintFailure(jobId, error) {
    const job = this.printQueue.find(j => j.jobId === jobId);

    if (!job) {
      return { success: false, error: 'Print job not found' };
    }

    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      logger.error(`Print job failed after ${job.maxAttempts} attempts: ${jobId}`, {
        error,
        ticketId: job.ticketId
      });

      this.emit('printJobFailed', {
        jobId,
        ticketId: job.ticketId,
        error
      });

      return {
        success: true,
        message: 'Max retry attempts exceeded',
        jobStatus: 'failed'
      };
    }

    job.status = 'queued';
    job.lastError = error;
    logger.warn(`Print job failed, retrying: ${jobId}`, { error, attempt: job.attempts });

    return {
      success: true,
      message: 'Print job requeued',
      attempts: job.attempts,
      maxAttempts: job.maxAttempts
    };
  }

  /**
   * Format ticket for printing (HTML/Text)
   */
  formatTicketForPrinting(ticket) {
    if (this.ticketFormat === 'detailed') {
      return this.formatDetailedTicket(ticket);
    } else if (this.ticketFormat === 'compact') {
      return this.formatCompactTicket(ticket);
    } else {
      return this.formatStandardTicket(ticket);
    }
  }

  /**
   * Format standard ticket layout
   */
  formatStandardTicket(ticket) {
    const border = '═'.repeat(40);
    const line = '─'.repeat(40);

    let output = `
${border}
DISPATCH TICKET #${ticket.ticketNumber}
${border}

INCIDENT ID: ${ticket.incidentId}
TICKET ID: ${ticket.ticketId}
GENERATED: ${this.formatDateTime(ticket.generatedAt)}
CALL TIME: ${this.formatDateTime(ticket.callTime)}

${line}
INCIDENT TYPE: ${ticket.incident.type.toUpperCase()}
PRIORITY: ${ticket.incident.priority.toUpperCase()}
${line}

LOCATION:
${ticket.location.address}
${ticket.location.details}

DIRECTIONS:
${ticket.location.directions}

${line}
PATIENT INFORMATION:
Name: ${ticket.patient.name}
Age/Gender: ${ticket.patient.age}/${ticket.patient.gender}
Condition: ${ticket.patient.condition}
Allergies: ${ticket.patient.allergies}
Medications: ${ticket.patient.medications}

${line}
ASSIGNED UNITS:
${ticket.assignment.ambulances.length > 0 
  ? ticket.assignment.ambulances.map(a => `  • Unit ${a.callSign || a.id}`).join('\n')
  : '  (To be assigned on scene)'}

DISPATCHED BY: ${ticket.assignment.dispatchedBy}
DISPATCH TIME: ${this.formatDateTime(ticket.assignment.dispatchTime)}

${line}
SPECIAL INSTRUCTIONS:
${ticket.specialInstructions || 'None'}

SAFETY NOTES:
${ticket.safetyNotes.length > 0 
  ? ticket.safetyNotes.map(n => `  ⚠ ${n}`).join('\n')
  : '  No special hazards reported'}

${border}
    `.trim();

    return output;
  }

  /**
   * Format compact ticket (single page)
   */
  formatCompactTicket(ticket) {
    return `
TICKET #${ticket.ticketNumber} | ${ticket.incidentId}
${ticket.incident.type} | ${ticket.incident.priority.toUpperCase()}
${ticket.location.address}
Patient: ${ticket.patient.name} (${ticket.patient.age}/${ticket.patient.gender})
Units: ${ticket.assignment.ambulances.map(a => a.callSign || a.id).join(', ') || 'Unassigned'}
Safety: ${ticket.safetyNotes.length > 0 ? '⚠ YES' : 'None'}
Notes: ${ticket.specialInstructions.substring(0, 50)}...
    `.trim();
  }

  /**
   * Format detailed ticket (multi-page)
   */
  formatDetailedTicket(ticket) {
    return this.formatStandardTicket(ticket) + `

${this.getDuplicateTicketLine()}

PAGE 2 - DISPATCH COPY
${this.getDuplicateTicketLine()}

[Copy for dispatch center records]
    `;
  }

  /**
   * Generate CSV export
   */
  exportTicketsAsCSV(startDate, endDate) {
    const filtered = this.ticketArchive.filter(t =>
      t.generatedAt >= startDate && t.generatedAt <= endDate
    );

    const headers = [
      'Ticket Number', 'Ticket ID', 'Incident ID', 'Type', 'Priority',
      'Address', 'Patient Name', 'Patient Condition', 'Assigned Units',
      'Generated Time', 'Printed Time', 'Status'
    ];

    const rows = filtered.map(t => [
      t.ticketNumber,
      t.ticketId,
      t.incidentId,
      t.incident.type,
      t.incident.priority,
      t.location.address,
      t.patient.name,
      t.patient.condition,
      t.assignment.ambulances.map(a => a.callSign || a.id).join(';'),
      this.formatDateTime(t.generatedAt),
      t.timestamps.printed ? this.formatDateTime(t.timestamps.printed) : 'Not printed',
      t.status
    ]);

    // Convert to CSV string
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Get print queue status
   */
  getPrintQueueStatus() {
    const byPriority = {
      high: this.printQueue.filter(j => j.priority === 'high').length,
      normal: this.printQueue.filter(j => j.priority === 'normal').length,
      low: this.printQueue.filter(j => j.priority === 'low').length
    };

    return {
      queueSize: this.printQueue.length,
      maxSize: this.printQueueSize,
      byPriority,
      oldestJob: this.printQueue.length > 0 ? {
        jobId: this.printQueue[0].jobId,
        queuedAt: this.printQueue[0].queuedAt,
        ageMs: Date.now() - this.printQueue[0].queuedAt.getTime()
      } : null
    };
  }

  /**
   * Get ticket statistics
   */
  getTicketStatistics(timeWindow = 86400000) { // 24 hours
    const now = Date.now();
    const cutoff = now - timeWindow;

    const recent = this.ticketArchive.filter(t =>
      t.generatedAt.getTime() > cutoff
    );

    const byStatus = {};
    const byPriority = {};
    const byType = {};

    recent.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.incident.priority] = (byPriority[t.incident.priority] || 0) + 1;
      byType[t.incident.type] = (byType[t.incident.type] || 0) + 1;
    });

    return {
      totalTickets: recent.length,
      printedTickets: recent.filter(t => t.status === 'printed').length,
      avgPrintTime: this.calculateAveragePrintTime(recent),
      byStatus,
      byPriority,
      byType
    };
  }

  /**
   * Calculate average print time
   */
  calculateAveragePrintTime(tickets) {
    const printedTickets = tickets.filter(t => t.timestamps.printed);
    
    if (printedTickets.length === 0) return 0;

    const totalTime = printedTickets.reduce((sum, t) => {
      const time = t.timestamps.printed.getTime() - t.generatedAt.getTime();
      return sum + time;
    }, 0);

    return Math.round(totalTime / printedTickets.length);
  }

  /**
   * Generate archival backup
   */
  generateArchivalBackup(startDate, endDate) {
    const filtered = this.ticketArchive.filter(t =>
      t.generatedAt >= startDate && t.generatedAt <= endDate
    );

    const backup = {
      backupId: `BACKUP-${Date.now()}`,
      createdAt: new Date(),
      period: { startDate, endDate },
      ticketCount: filtered.length,
      format: this.backupFormat,
      data: filtered,
      checksum: this.generateChecksum(filtered)
    };

    logger.info(`Archival backup generated: ${backup.backupId}`, {
      ticketCount: filtered.length,
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`
    });

    this.emit('backupGenerated', {
      backupId: backup.backupId,
      ticketCount: filtered.length
    });

    return backup;
  }

  /**
   * Helper: Format datetime for display
   */
  formatDateTime(date) {
    return new Date(date).toLocaleString('en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Helper: Get duplicate line
   */
  getDuplicateTicketLine() {
    return '✂ ─'.repeat(20);
  }

  /**
   * Generate checksum for archival integrity
   */
  generateChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate unique IDs
   */
  generateTicketId() {
    return `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generatePrintJobId() {
    return `PRT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown service
   */
  shutdown() {
    logger.info('Paper Trail Service shutdown', {
      totalTickets: this.ticketArchive.length,
      printedTickets: this.printedTickets.length,
      pendingPrintJobs: this.printQueue.length
    });
  }
}

module.exports = PaperTrailService;
