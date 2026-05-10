/**
 * PDF Report Builder
 * Uses pdfkit to generate professional PDF reports from incident data
 */

const PDFDocument = require('pdfkit');
const { formatDate, formatTime } = require('../../utils/date-formatter');
const path = require('path');
const fs = require('fs');

class PDFBuilder {
  /**
   * Generate incident report PDF
   * @param {Object} report - The incident report object
   * @param {string} outputPath - Path to save the PDF
   * @returns {Promise<string>} Path to generated PDF
   */
  static generateIncidentReportPDF(report, outputPath = null) {
    return new Promise((resolve, reject) => {
      try {
        // Create output directory if it doesn't exist
        if (outputPath) {
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        // Create PDF document
        const pdfPath =
          outputPath ||
          path.join(
            process.cwd(),
            'reports',
            `incident-${report.reportId}.pdf`
          );
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 40,
            bottom: 40,
            left: 40,
            right: 40,
          },
        });

        // Pipe to file
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        // Generate PDF content
        PDFBuilder._addHeader(doc, report);
        PDFBuilder._addIncidentInfo(doc, report);
        PDFBuilder._addLocationInfo(doc, report);
        PDFBuilder._addPatientInfo(doc, report);
        PDFBuilder._addParamedicInfo(doc, report);
        PDFBuilder._addTimeline(doc, report);
        PDFBuilder._addMetrics(doc, report);
        PDFBuilder._addFooter(doc, report);

        // Finalize PDF
        doc.end();

        stream.on('finish', () => {
          resolve(pdfPath);
        });

        stream.on('error', (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate handover summary PDF
   * @param {Object} report - The incident report object
   * @param {string} outputPath - Path to save the PDF
   * @returns {Promise<string>} Path to generated PDF
   */
  static generateHandoverPDF(report, outputPath = null) {
    return new Promise((resolve, reject) => {
      try {
        const pdfPath =
          outputPath ||
          path.join(
            process.cwd(),
            'reports',
            `handover-${report.reportId}.pdf`
          );
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 40,
            bottom: 40,
            left: 40,
            right: 40,
          },
        });

        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        // Generate handover document
        PDFBuilder._addHandoverHeader(doc, report);
        PDFBuilder._addHandoverPatientInfo(doc, report);
        PDFBuilder._addHandoverAssessment(doc, report);
        PDFBuilder._addHandoverVitals(doc, report);
        PDFBuilder._addHandoverActions(doc, report);
        PDFBuilder._addHandoverNotes(doc, report);
        PDFBuilder._addHandoverSignatures(doc, report);

        doc.end();

        stream.on('finish', () => {
          resolve(pdfPath);
        });

        stream.on('error', (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // ==================== Header & Footer ====================

  static _addHeader(doc, report) {
    // Logo/Title
    doc.fontSize(24).font('Helvetica-Bold').text('INCIDENT REPORT', {
      align: 'center',
    });

    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(
      `Report ID: ${report.reportId}`,
      {
        align: 'center',
      }
    );

    doc.fontSize(9).fillColor('#666666').text(
      `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
      {
        align: 'center',
      }
    );

    doc.fillColor('#000000');
    doc.moveTo(40, doc.y + 10).lineTo(555, doc.y + 10).stroke();
    doc.moveDown(1);
  }

  static _addFooter(doc, report) {
    const pageCount = doc.bufferedPageRange().count;
    const fileName = `incident-${report.reportId}.pdf`;
    const timestamp = new Date().toLocaleString();

    doc.fontSize(9).fillColor('#999999');
    doc.text(
      `${fileName} | Page ${doc.page.number} of ${pageCount} | ${timestamp}`,
      40,
      doc.page.height - 30,
      { width: 515, align: 'center' }
    );
    doc.fillColor('#000000');
  }

  // ==================== Incident Information ====================

  static _addIncidentInfo(doc, report) {
    doc.fontSize(12).font('Helvetica-Bold').text('INCIDENT INFORMATION');
    doc.moveDown(0.3);

    const incident = report.incident;

    const rows = [
      ['Call Number', incident.callNumber],
      ['Case Number', incident.caseNumber],
      ['Incident Type', incident.incidentType],
      ['Severity', incident.severity],
      ['Description', incident.description],
    ];

    PDFBuilder._drawTable(doc, rows, { width: 250 });
    doc.moveDown(0.5);
  }

  // ==================== Location Information ====================

  static _addLocationInfo(doc, report) {
    doc.fontSize(12).font('Helvetica-Bold').text('LOCATION DETAILS');
    doc.moveDown(0.3);

    const location = report.location;

    const rows = [
      ['Address', location.address],
      ['GPS Coordinates', `${location.gpsCoordinates.latitude}, ${location.gpsCoordinates.longitude}`],
      ['District', location.district],
      ['Region', location.region],
      ['Landmark', location.landmark || 'N/A'],
      ['Access Notes', location.accessNotes || 'N/A'],
    ];

    PDFBuilder._drawTable(doc, rows, { width: 250 });
    doc.moveDown(0.5);
  }

  // ==================== Patient Information ====================

  static _addPatientInfo(doc, report) {
    doc.fontSize(12).font('Helvetica-Bold').text('PATIENT INFORMATION');
    doc.moveDown(0.3);

    const patient = report.patient;

    const rows = [
      ['Patient ID', patient.patientId],
      ['Name', `${patient.firstName} ${patient.lastName}`],
      ['Age/Gender', `${patient.age} / ${patient.gender}`],
      ['Phone', patient.phoneNumber],
      ['ID Number', patient.idNumber],
    ];

    PDFBuilder._drawTable(doc, rows, { width: 250 });

    // Medical history
    if (patient.medicalHistory.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text('Medical History:');
      patient.medicalHistory.forEach((history) => {
        doc.fontSize(9).text(`• ${history}`, { indent: 20 });
      });
    }

    // Allergies
    if (patient.allergies.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text('Allergies:');
      patient.allergies.forEach((allergy) => {
        doc.fontSize(9).fillColor('#FF0000').text(`• ${allergy}`, { indent: 20 });
        doc.fillColor('#000000');
      });
    }

    doc.moveDown(0.5);
  }

  // ==================== Paramedic Information ====================

  static _addParamedicInfo(doc, report) {
    const paramedic = report.paramedic;

    // Assessment
    doc.fontSize(12).font('Helvetica-Bold').text('PARAMEDIC ASSESSMENT');
    doc.moveDown(0.3);

    const assessmentRows = [
      ['Primary Complaint', paramedic.assessment.primaryComplaint],
      ['Consciousness', paramedic.assessment.consciousness],
      ['Breathing', paramedic.assessment.breathing],
      ['Circulation', paramedic.assessment.circulation],
      ['Skin Color', paramedic.assessment.skinColor],
    ];

    PDFBuilder._drawTable(doc, assessmentRows, { width: 250 });

    // Vital Signs
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text('VITAL SIGNS');
    doc.moveDown(0.3);

    const vitalsRows = [
      ['Blood Pressure', paramedic.vitals.bloodPressure],
      ['Heart Rate', `${paramedic.vitals.heartRate} bpm`],
      ['Respiration Rate', `${paramedic.vitals.respirationRate} breaths/min`],
      ['Temperature', paramedic.vitals.temperature],
      ['SpO2', paramedic.vitals.spO2],
      ['Glucose Level', paramedic.vitals.glucoseLevel || 'N/A'],
    ];

    PDFBuilder._drawTable(doc, vitalsRows, { width: 250 });

    // Actions taken
    if (paramedic.actions.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('ACTIONS TAKEN');
      doc.moveDown(0.3);

      paramedic.actions.forEach((action, index) => {
        doc.fontSize(9).font('Helvetica-Bold').text(
          `${index + 1}. ${action.action}`,
          { indent: 20 }
        );
        doc.fontSize(8).text(`Description: ${action.description}`, { indent: 40 });
        doc.fontSize(8).text(`Outcome: ${action.outcome}`, { indent: 40 });
        if (action.notes) {
          doc.fontSize(8).text(`Notes: ${action.notes}`, { indent: 40 });
        }
        doc.moveDown(0.2);
      });
    }

    // Medications
    if (paramedic.medications.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('MEDICATIONS ADMINISTERED');
      doc.moveDown(0.3);

      paramedic.medications.forEach((med, index) => {
        const medInfo = `${index + 1}. ${med.name} - ${med.dose} (${med.route}) at ${med.time}`;
        doc.fontSize(9).text(medInfo, { indent: 20 });
      });
    }

    doc.moveDown(0.5);
  }

  // ==================== Timeline ====================

  static _addTimeline(doc, report) {
    if (!report.timeline || report.timeline.length === 0) return;

    doc.fontSize(12).font('Helvetica-Bold').text('INCIDENT TIMELINE');
    doc.moveDown(0.3);

    report.timeline.forEach((event, index) => {
      const timestamp = new Date(event.timestamp).toLocaleTimeString();
      doc.fontSize(9).font('Helvetica-Bold').text(
        `${timestamp} - ${event.event}`,
        { indent: 20 }
      );
      doc.fontSize(8).text(event.description, { indent: 40 });
      doc.moveDown(0.2);
    });

    doc.moveDown(0.5);
  }

  // ==================== Metrics ====================

  static _addMetrics(doc, report) {
    doc.fontSize(12).font('Helvetica-Bold').text('INCIDENT METRICS');
    doc.moveDown(0.3);

    const metrics = report.metrics;
    const rows = [
      ['Call to Dispatch', `${metrics.callToDispatchTime} min`],
      ['Dispatch to Arrival', `${metrics.dispatchToArrivalTime} min`],
      ['Scene Time', `${metrics.sceneTime} min`],
      ['Transport Time', `${metrics.transportTime} min`],
      ['Total Incident Time', `${metrics.totalIncidentTime} min`],
      ['Distance Traveled', `${metrics.distanceTraveled} km`],
    ];

    PDFBuilder._drawTable(doc, rows, { width: 250 });
    doc.moveDown(1);
  }

  // ==================== Handover PDF Sections ====================

  static _addHandoverHeader(doc, report) {
    doc.fontSize(20).font('Helvetica-Bold').text('HOSPITAL HANDOVER SUMMARY', {
      align: 'center',
    });

    doc.moveDown(0.3);
    doc.fontSize(10).text(
      `Report ID: ${report.reportId} | Patient: ${report.patient.firstName} ${report.patient.lastName}`,
      { align: 'center' }
    );

    doc.moveTo(40, doc.y + 10).lineTo(555, doc.y + 10).stroke();
    doc.moveDown(1);
  }

  static _addHandoverPatientInfo(doc, report) {
    doc.fontSize(11).font('Helvetica-Bold').text('PATIENT IDENTIFICATION');
    doc.moveDown(0.3);

    const patient = report.patient;
    doc.fontSize(9).text(`Name: ${patient.firstName} ${patient.lastName}`);
    doc.fontSize(9).text(`Age: ${patient.age} | Gender: ${patient.gender}`);
    doc.fontSize(9).text(`Patient ID: ${patient.patientId}`);

    if (patient.allergies.length > 0) {
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').fillColor('#FF0000').text('ALLERGIES:');
      patient.allergies.forEach((allergy) => {
        doc.text(`• ${allergy}`);
      });
      doc.fillColor('#000000');
    }

    doc.moveDown(0.5);
  }

  static _addHandoverAssessment(doc, report) {
    const assessment = report.paramedic.assessment;

    doc.fontSize(11).font('Helvetica-Bold').text('CLINICAL ASSESSMENT');
    doc.moveDown(0.3);

    doc.fontSize(9).text(`Primary Complaint: ${assessment.primaryComplaint}`);
    if (assessment.secondaryComplaints.length > 0) {
      doc.text('Secondary Complaints:', { underline: true });
      assessment.secondaryComplaints.forEach((complaint) => {
        doc.fontSize(8).text(`• ${complaint}`, { indent: 20 });
      });
    }

    doc.moveDown(0.3);
    doc.fontSize(9).text(`Consciousness: ${assessment.consciousness}`);
    doc.fontSize(9).text(`Breathing: ${assessment.breathing}`);
    doc.fontSize(9).text(`Circulation: ${assessment.circulation}`);
    doc.fontSize(9).text(`Skin: ${assessment.skinColor}`);

    doc.moveDown(0.5);
  }

  static _addHandoverVitals(doc, report) {
    const vitals = report.paramedic.vitals;

    doc.fontSize(11).font('Helvetica-Bold').text('VITAL SIGNS');
    doc.moveDown(0.3);

    doc.fontSize(9).text(`BP: ${vitals.bloodPressure}`);
    doc.fontSize(9).text(`HR: ${vitals.heartRate} bpm`);
    doc.fontSize(9).text(`RR: ${vitals.respirationRate} breaths/min`);
    doc.fontSize(9).text(`Temp: ${vitals.temperature}`);
    doc.fontSize(9).text(`SpO2: ${vitals.spO2}`);

    doc.moveDown(0.5);
  }

  static _addHandoverActions(doc, report) {
    if (report.paramedic.actions.length === 0) return;

    doc.fontSize(11).font('Helvetica-Bold').text('INTERVENTIONS PROVIDED');
    doc.moveDown(0.3);

    report.paramedic.actions.forEach((action) => {
      doc.fontSize(9).text(`• ${action.action}: ${action.description}`);
    });

    if (report.paramedic.medications.length > 0) {
      doc.moveDown(0.3);
      doc.text('Medications:', { underline: true });
      report.paramedic.medications.forEach((med) => {
        doc.fontSize(8).text(
          `• ${med.name} ${med.dose} - ${med.route}`,
          { indent: 20 }
        );
      });
    }

    doc.moveDown(0.5);
  }

  static _addHandoverNotes(doc, report) {
    doc.fontSize(11).font('Helvetica-Bold').text('CLINICAL NOTES');
    doc.moveDown(0.3);

    const notes = report.paramedic.notes || 'No additional notes.';
    doc.fontSize(9)
      .font('Helvetica')
      .text(notes, { align: 'justify' });

    doc.moveDown(0.5);

    // Handover details
    doc.fontSize(11).font('Helvetica-Bold').text('HOSPITAL HANDOVER');
    doc.moveDown(0.3);

    doc.fontSize(9).text(`Hospital: ${report.handover.hospitalName}`);
    doc.fontSize(9).text(`Department: ${report.handover.department}`);
    doc.fontSize(9).text(`Receiving Staff: ${report.handover.receivingStaff.name}`);
    doc.fontSize(9).text(`Arrival Time: ${report.handover.arrivalTime}`);

    if (report.handover.handoverNotes) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').text('Handover Notes:');
      doc.fontSize(8).text(report.handover.handoverNotes, { indent: 20 });
    }

    doc.moveDown(0.5);
  }

  static _addHandoverSignatures(doc, report) {
    doc.fontSize(11).font('Helvetica-Bold').text('SIGNATURES');
    doc.moveDown(0.5);

    const signatureY = doc.y;
    const lineWidth = 80;
    const spacing = 150;

    // Paramedic 1
    doc.fontSize(9).text('Paramedic 1', 50, signatureY + 50);
    doc.moveTo(50, signatureY + 60).lineTo(50 + lineWidth, signatureY + 60).stroke();

    // Paramedic 2
    doc.fontSize(9).text('Paramedic 2', 50 + spacing, signatureY + 50);
    doc.moveTo(50 + spacing, signatureY + 60).lineTo(50 + spacing + lineWidth, signatureY + 60).stroke();

    // Supervisor
    doc.fontSize(9).text('Supervisor', 50 + spacing * 2, signatureY + 50);
    doc.moveTo(50 + spacing * 2, signatureY + 60).lineTo(50 + spacing * 2 + lineWidth, signatureY + 60).stroke();

    doc.fontSize(8).fillColor('#999999');
    doc.text('Signature', 50, signatureY + 62);
    doc.text('Signature', 50 + spacing, signatureY + 62);
    doc.text('Signature', 50 + spacing * 2, signatureY + 62);
    doc.fillColor('#000000');
  }

  // ==================== Helper Methods ====================

  /**
   * Draw a table in the PDF
   * @private
   */
  static _drawTable(doc, rows, options = {}) {
    const colWidth = options.width || 200;
    const rowHeight = 20;
    const x = options.x || 60;
    let y = doc.y;

    rows.forEach((row) => {
      // Label column
      doc.fontSize(9).font('Helvetica-Bold').text(row[0], x, y, {
        width: colWidth,
        height: rowHeight,
      });

      // Value column
      doc.fontSize(9)
        .font('Helvetica')
        .text(row[1], x + colWidth + 20, y, {
          width: 300,
          height: rowHeight,
        });

      y += rowHeight;
    });

    doc.y = y;
  }

  /**
   * Get file size in MB
   * @param {string} filePath
   */
  static getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return (stats.size / 1024 / 1024).toFixed(2);
    } catch {
      return 0;
    }
  }
}

module.exports = PDFBuilder;
