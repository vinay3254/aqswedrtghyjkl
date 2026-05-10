/**
 * Handover Report Service
 * Generates comprehensive digital handover reports with patient vitals, timeline, and PDF export
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const {
  AmbulanceDispatch,
  PatientVitals,
  IncidentTimeline,
  HandoverReport,
  Incident,
} = require('../../models');

class HandoverReportService {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports/handovers');
    this.ensureReportsDirectory();
  }

  /**
   * Ensure reports directory exists
   */
  ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate comprehensive handover report
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>} Report data and file paths
   */
  async generateHandoverReport(incidentId) {
    try {
      logger.info(`[HandoverReport] Generating report for incident ${incidentId}`);

      // Gather all necessary data
      const reportData = await this.collectReportData(incidentId);

      if (!reportData) {
        throw new Error('Unable to collect report data');
      }

      // Generate digital report (JSON format)
      const digitalReport = this.formatDigitalReport(reportData);

      // Generate PDF report
      const pdfPath = await this.generatePdfReport(reportData);

      // Save report metadata to database
      const savedReport = await this.saveReportMetadata(incidentId, digitalReport, pdfPath);

      logger.info(`[HandoverReport] Report generated successfully: ${savedReport.id}`);

      return {
        success: true,
        reportId: savedReport.id,
        incidentId,
        pdfPath,
        digitalReport,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error(`[HandoverReport] Error generating report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Collect all data needed for handover report
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>} Comprehensive report data
   */
  async collectReportData(incidentId) {
    try {
      // Fetch incident details
      const incident = await Incident.findByPk(incidentId, {
        include: ['patient', 'location'],
      });

      if (!incident) {
        throw new Error('Incident not found');
      }

      // Fetch dispatch details
      const dispatch = await AmbulanceDispatch.findOne({
        where: { incidentId },
        include: ['ambulance', 'crew', 'hospital'],
      });

      // Fetch patient vitals over time
      const vitals = await PatientVitals.findAll({
        where: { incidentId },
        order: [['recordedAt', 'ASC']],
      });

      // Fetch incident timeline
      const timeline = await IncidentTimeline.findAll({
        where: { incidentId },
        order: [['timestamp', 'ASC']],
      });

      // Fetch initial and final vitals for comparison
      const initialVitals = vitals.length > 0 ? vitals[0] : null;
      const finalVitals = vitals.length > 0 ? vitals[vitals.length - 1] : null;

      return {
        incident,
        dispatch,
        vitals,
        timeline,
        initialVitals,
        finalVitals,
        vitalsTrend: this.analyzeVitalsTrend(vitals),
      };
    } catch (error) {
      logger.error(`[CollectData] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze vitals trend to identify improvements/deterioration
   * @param {Array} vitals - Array of vitals records
   * @returns {Object} Trend analysis
   */
  analyzeVitalsTrend(vitals) {
    if (vitals.length < 2) {
      return { trendAnalysis: 'Insufficient data' };
    }

    const first = vitals[0];
    const last = vitals[vitals.length - 1];

    const trends = {
      heartRate: {
        initial: first.heartRate,
        final: last.heartRate,
        change: last.heartRate - first.heartRate,
        status: last.heartRate < first.heartRate ? 'improving' : 'deteriorating',
      },
      bloodPressure: {
        initial: first.bloodPressure,
        final: last.bloodPressure,
        status: this.analyzeBPTrend(first.bloodPressure, last.bloodPressure),
      },
      oxygenSaturation: {
        initial: first.oxygenSaturation,
        final: last.oxygenSaturation,
        change: last.oxygenSaturation - first.oxygenSaturation,
        status: last.oxygenSaturation >= first.oxygenSaturation ? 'improving' : 'deteriorating',
      },
      respiratoryRate: {
        initial: first.respiratoryRate,
        final: last.respiratoryRate,
        change: last.respiratoryRate - first.respiratoryRate,
        status: last.respiratoryRate < first.respiratoryRate ? 'improving' : 'worsening',
      },
    };

    return trends;
  }

  /**
   * Analyze blood pressure trend
   * @param {String} initial - Initial BP reading
   * @param {String} final - Final BP reading
   * @returns {String} Status
   */
  analyzeBPTrend(initial, final) {
    // Assuming format like "120/80"
    const [initSys, initDias] = initial.split('/').map(Number);
    const [finSys, finDias] = final.split('/').map(Number);

    const sysChange = finSys - initSys;
    const diasChange = finDias - initDias;

    if (Math.abs(sysChange) < 10 && Math.abs(diasChange) < 10) {
      return 'stable';
    } else if (sysChange > 0 && diasChange > 0) {
      return 'elevated';
    } else if (sysChange < 0 && diasChange < 0) {
      return 'declined';
    } else {
      return 'fluctuating';
    }
  }

  /**
   * Format data into digital report structure
   * @param {Object} reportData - Collected report data
   * @returns {Object} Formatted digital report
   */
  formatDigitalReport(reportData) {
    const {
      incident,
      dispatch,
      vitals,
      timeline,
      initialVitals,
      finalVitals,
      vitalsTrend,
    } = reportData;

    const durationMinutes = Math.round(
      (dispatch.handoverTime - new Date(incident.reportedAt)) / 60000
    );

    return {
      reportMetadata: {
        incidentId: incident.id,
        reportGeneratedAt: new Date().toISOString(),
        reportType: 'digital_handover',
        version: '1.0',
      },
      incidentSummary: {
        incidentId: incident.id,
        reportedAt: incident.reportedAt,
        location: {
          address: incident.location?.address,
          latitude: incident.location?.latitude,
          longitude: incident.location?.longitude,
        },
        incidentType: incident.type,
        severity: incident.severity,
        totalDuration: `${durationMinutes} minutes`,
      },
      patientInformation: {
        patientId: incident.patient?.id,
        name: incident.patient?.firstName + ' ' + incident.patient?.lastName,
        age: incident.patient?.age,
        gender: incident.patient?.gender,
        bloodType: incident.patient?.bloodType,
        allergies: incident.patient?.allergies || 'None recorded',
        medicalHistory: incident.patient?.medicalHistory || 'None recorded',
      },
      ambulanceDetails: {
        ambulanceNumber: dispatch.ambulance?.number,
        ambulanceType: dispatch.ambulance?.type,
        crewMembers: dispatch.crew?.map(c => ({
          name: c.name,
          role: c.role,
          license: c.license,
        })),
      },
      hospitalDetails: {
        hospitalId: dispatch.hospital?.id,
        hospitalName: dispatch.hospital?.name,
        arrivedAt: dispatch.hospitalArrivalTime?.toISOString(),
        handoverAt: dispatch.handoverTime?.toISOString(),
      },
      patientVitals: {
        initialVitals: this.formatVitals(initialVitals),
        finalVitals: this.formatVitals(finalVitals),
        vitalRecordCount: vitals.length,
        vitalsTrend,
        fullVitalsTimeline: vitals.map(v => ({
          timestamp: v.recordedAt.toISOString(),
          vitals: this.formatVitals(v),
        })),
      },
      treatments: {
        interventions: timeline
          .filter(t => t.eventType === 'intervention')
          .map(t => ({
            timestamp: t.timestamp.toISOString(),
            description: t.description,
            performedBy: t.performedBy,
          })),
        medications: timeline
          .filter(t => t.eventType === 'medication')
          .map(t => ({
            timestamp: t.timestamp.toISOString(),
            medicationName: t.description,
            dosage: t.performedBy,
          })),
      },
      timeline: timeline.map(t => ({
        timestamp: t.timestamp.toISOString(),
        event: t.eventType,
        description: t.description,
        performer: t.performedBy,
      })),
      clinicalNotes: incident.clinicalNotes || 'No additional notes',
      patientConsent: {
        consentGiven: incident.patientConsent,
        consentType: incident.consentType || 'Verbal',
        witness: incident.consentWitness || null,
      },
      signatures: {
        ambulanceCrewSignature: dispatch.crewSignature || null,
        hospitalReceivingStaffSignature: dispatch.hospitalSignature || null,
        patientOrGuardianSignature: dispatch.patientSignature || null,
      },
    };
  }

  /**
   * Format vitals object for display
   * @param {Object} vitals - Vitals record
   * @returns {Object} Formatted vitals
   */
  formatVitals(vitals) {
    if (!vitals) {
      return null;
    }

    return {
      heartRate: `${vitals.heartRate} bpm`,
      bloodPressure: vitals.bloodPressure,
      respiratoryRate: `${vitals.respiratoryRate} breaths/min`,
      oxygenSaturation: `${vitals.oxygenSaturation}%`,
      temperature: `${vitals.temperature}°C`,
      bloodGlucose: vitals.bloodGlucose ? `${vitals.bloodGlucose} mg/dL` : 'N/A',
      painLevel: vitals.painLevel ? `${vitals.painLevel}/10` : 'N/A',
      recordedAt: vitals.recordedAt.toISOString(),
    };
  }

  /**
   * Generate PDF report from report data
   * @param {Object} reportData - Collected report data
   * @returns {Promise<String>} Path to generated PDF
   */
  async generatePdfReport(reportData) {
    return new Promise((resolve, reject) => {
      try {
        const {
          incident,
          dispatch,
          vitals,
          timeline,
          initialVitals,
          finalVitals,
          vitalsTrend,
        } = reportData;

        // Create PDF document
        const doc = new PDFDocument({ margin: 40 });

        // Generate filename
        const fileName = `handover_${incident.id}_${Date.now()}.pdf`;
        const filePath = path.join(this.reportsDir, fileName);

        // Create write stream
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Add content
        this.addPdfHeader(doc, incident);
        this.addIncidentSummary(doc, incident, dispatch);
        this.addPatientInformation(doc, incident);
        this.addVitalsSection(doc, initialVitals, finalVitals, vitalsTrend, vitals);
        this.addTimelineSection(doc, timeline);
        this.addTreatmentsSection(doc, timeline);
        this.addSignatureSection(doc, dispatch);
        this.addFooter(doc, incident.id);

        // Finalize PDF
        doc.end();

        stream.on('finish', () => {
          logger.info(`[PDF] Report generated: ${filePath}`);
          resolve(filePath);
        });

        stream.on('error', (error) => {
          logger.error(`[PDF] Stream error: ${error.message}`);
          reject(error);
        });

        doc.on('error', (error) => {
          logger.error(`[PDF] Document error: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        logger.error(`[GeneratePdf] Error: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Add header to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Object} incident - Incident record
   */
  addPdfHeader(doc, incident) {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('AMBULANCE HANDOVER REPORT', { align: 'center' })
      .fontSize(10)
      .font('Helvetica')
      .text(`Report Date: ${new Date().toLocaleString()}`, { align: 'center' })
      .text(`Incident ID: ${incident.id}`, { align: 'center' })
      .moveDown();

    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();
  }

  /**
   * Add incident summary section to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Object} incident - Incident record
   * @param {Object} dispatch - Dispatch record
   */
  addIncidentSummary(doc, incident, dispatch) {
    doc.fontSize(12).font('Helvetica-Bold').text('INCIDENT SUMMARY');
    doc.fontSize(10).font('Helvetica');

    const summaryData = [
      ['Incident ID:', incident.id],
      ['Type:', incident.type],
      ['Severity:', incident.severity],
      ['Reported At:', new Date(incident.reportedAt).toLocaleString()],
      ['Location:', incident.location?.address || 'N/A'],
      ['Hospital:', dispatch.hospital?.name || 'N/A'],
    ];

    this.addTable(doc, summaryData);
    doc.moveDown();
  }

  /**
   * Add patient information section to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Object} incident - Incident record
   */
  addPatientInformation(doc, incident) {
    doc.fontSize(12).font('Helvetica-Bold').text('PATIENT INFORMATION');
    doc.fontSize(10).font('Helvetica');

    const patientData = [
      ['Name:', incident.patient?.firstName + ' ' + incident.patient?.lastName],
      ['Age:', incident.patient?.age],
      ['Gender:', incident.patient?.gender],
      ['Blood Type:', incident.patient?.bloodType || 'N/A'],
      ['Allergies:', incident.patient?.allergies || 'None recorded'],
      ['Medical History:', incident.patient?.medicalHistory || 'None recorded'],
    ];

    this.addTable(doc, patientData);
    doc.moveDown();
  }

  /**
   * Add vitals section to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Object} initialVitals - Initial vitals
   * @param {Object} finalVitals - Final vitals
   * @param {Object} vitalsTrend - Vitals trend analysis
   * @param {Array} vitals - All vitals records
   */
  addVitalsSection(doc, initialVitals, finalVitals, vitalsTrend, vitals) {
    doc.fontSize(12).font('Helvetica-Bold').text('PATIENT VITALS');
    doc.fontSize(10).font('Helvetica');

    if (initialVitals && finalVitals) {
      doc.fontSize(11).font('Helvetica-Bold').text('Initial vs Final Vitals');
      doc.fontSize(9).font('Helvetica');

      const vitalsData = [
        ['Vital Sign', 'Initial', 'Final', 'Trend'],
        [
          'Heart Rate',
          `${initialVitals.heartRate} bpm`,
          `${finalVitals.heartRate} bpm`,
          vitalsTrend.heartRate?.status || '-',
        ],
        [
          'Blood Pressure',
          initialVitals.bloodPressure,
          finalVitals.bloodPressure,
          vitalsTrend.bloodPressure?.status || '-',
        ],
        [
          'O2 Saturation',
          `${initialVitals.oxygenSaturation}%`,
          `${finalVitals.oxygenSaturation}%`,
          vitalsTrend.oxygenSaturation?.status || '-',
        ],
        [
          'Respiratory Rate',
          `${initialVitals.respiratoryRate} breaths/min`,
          `${finalVitals.respiratoryRate} breaths/min`,
          vitalsTrend.respiratoryRate?.status || '-',
        ],
        [
          'Temperature',
          `${initialVitals.temperature}°C`,
          `${finalVitals.temperature}°C`,
          '-',
        ],
      ];

      this.addTable(doc, vitalsData);
    }

    doc.moveDown();
  }

  /**
   * Add timeline section to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Array} timeline - Timeline events
   */
  addTimelineSection(doc, timeline) {
    doc.fontSize(12).font('Helvetica-Bold').text('INCIDENT TIMELINE');
    doc.fontSize(9).font('Helvetica');

    const timelineData = [['Time', 'Event', 'Description']];

    timeline.slice(0, 15).forEach(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      timelineData.push([time, event.eventType, event.description.substring(0, 40)]);
    });

    this.addTable(doc, timelineData);
    doc.moveDown();
  }

  /**
   * Add treatments section to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Array} timeline - Timeline events
   */
  addTreatmentsSection(doc, timeline) {
    const interventions = timeline.filter(t => t.eventType === 'intervention');
    const medications = timeline.filter(t => t.eventType === 'medication');

    if (interventions.length > 0 || medications.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('TREATMENTS PROVIDED');
      doc.fontSize(10).font('Helvetica');

      if (interventions.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').text('Interventions:');
        interventions.forEach(intervention => {
          doc
            .fontSize(9)
            .text(`• ${intervention.description} (${new Date(intervention.timestamp).toLocaleTimeString()})`);
        });
      }

      if (medications.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').text('Medications:');
        medications.forEach(medication => {
          doc
            .fontSize(9)
            .text(`• ${medication.description} (${new Date(medication.timestamp).toLocaleTimeString()})`);
        });
      }

      doc.moveDown();
    }
  }

  /**
   * Add signature section to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Object} dispatch - Dispatch record
   */
  addSignatureSection(doc, dispatch) {
    doc.fontSize(12).font('Helvetica-Bold').text('ACKNOWLEDGMENTS & SIGNATURES');
    doc.fontSize(10).font('Helvetica');

    const signatureDate = new Date().toLocaleDateString();

    doc
      .text(`Date: ${signatureDate}`)
      .moveDown()
      .text('Ambulance Crew: ___________________________')
      .text(`Signature: ___________________________  Date: ${signatureDate}`)
      .moveDown()
      .text('Hospital Receiving Staff: ___________________________')
      .text(`Signature: ___________________________  Date: ${signatureDate}`)
      .moveDown()
      .text('Patient/Guardian: ___________________________')
      .text(`Signature: ___________________________  Date: ${signatureDate}`);
  }

  /**
   * Add footer to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {String} incidentId - Incident ID
   */
  addFooter(doc, incidentId) {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .text(
          `Page ${i + 1} of ${pageCount} | Incident ID: ${incidentId} | Document is confidential`,
          40,
          doc.page.height - 30,
          { align: 'center' }
        );
    }
  }

  /**
   * Helper function to add table to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Array} data - Table data (rows of cells)
   */
  addTable(doc, data) {
    const startX = 50;
    const rowHeight = 20;
    const cellPadding = 5;
    const columnWidths = [150, 150, 150];

    let y = doc.y;

    data.forEach((row, rowIndex) => {
      let x = startX;

      row.forEach((cell, colIndex) => {
        const width = columnWidths[colIndex] || 100;

        // Draw cell border
        doc.rect(x, y, width, rowHeight).stroke();

        // Add text
        doc
          .fontSize(rowIndex === 0 ? 10 : 9)
          .font(rowIndex === 0 ? 'Helvetica-Bold' : 'Helvetica')
          .text(String(cell).substring(0, 20), x + cellPadding, y + cellPadding, {
            width: width - cellPadding * 2,
          });

        x += width;
      });

      y += rowHeight;
    });

    doc.y = y;
  }

  /**
   * Save report metadata to database
   * @param {String} incidentId - Incident ID
   * @param {Object} digitalReport - Digital report data
   * @param {String} pdfPath - Path to PDF file
   * @returns {Promise<Object>}
   */
  async saveReportMetadata(incidentId, digitalReport, pdfPath) {
    try {
      const report = await HandoverReport.create({
        incidentId,
        reportType: 'digital_handover',
        reportData: JSON.stringify(digitalReport),
        pdfPath,
        generatedAt: new Date(),
      });

      logger.info(`[SaveMetadata] Report metadata saved: ${report.id}`);

      return report;
    } catch (error) {
      logger.error(`[SaveMetadata] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve handover report
   * @param {String} incidentId - Incident ID
   * @returns {Promise<Object>}
   */
  async getHandoverReport(incidentId) {
    try {
      const report = await HandoverReport.findOne({
        where: { incidentId },
      });

      if (!report) {
        throw new Error('Report not found');
      }

      return {
        id: report.id,
        incidentId: report.incidentId,
        generatedAt: report.generatedAt,
        pdfPath: report.pdfPath,
        digitalReport: JSON.parse(report.reportData),
      };
    } catch (error) {
      logger.error(`[GetReport] Error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new HandoverReportService();
