/**
 * Report API Endpoints
 * Handles fetching, generating, and downloading incident reports
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const IncidentReportGenerator = require('./report-generator');
const PDFBuilder = require('./pdf-builder');

// Mock database - in production, this would be a real database
const reportsDatabase = new Map();
const sampleReports = new Map();

/**
 * POST /api/reports/generate
 * Generate a new incident report
 * @body {Object} incidentData - The incident data
 * @returns {Object} Generated report
 */
router.post('/generate', (req, res) => {
  try {
    const incidentData = req.body;

    // Generate report
    const report = IncidentReportGenerator.generateReport(incidentData);

    // Calculate metrics
    IncidentReportGenerator.calculateMetrics(report);

    // Validate report
    const validation = IncidentReportGenerator.validateReport(report);

    // Store in database
    reportsDatabase.set(report.reportId, report);

    res.status(201).json({
      success: true,
      message: 'Report generated successfully',
      data: {
        report,
        validation,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/reports/:reportId
 * Fetch a specific incident report
 * @param {string} reportId - Report ID
 * @returns {Object} The incident report
 */
router.get('/:reportId', (req, res) => {
  try {
    const { reportId } = req.params;

    let report = reportsDatabase.get(reportId) || sampleReports.get(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/reports
 * Fetch all reports with optional filtering
 * @query {string} patientId - Filter by patient ID
 * @query {string} ambulanceId - Filter by ambulance ID
 * @query {string} status - Filter by status
 * @query {number} limit - Number of results
 * @query {number} offset - Pagination offset
 * @returns {Array} Array of reports
 */
router.get('/', (req, res) => {
  try {
    const { patientId, ambulanceId, status, limit = 10, offset = 0 } = req.query;

    let reports = Array.from(reportsDatabase.values()).concat(
      Array.from(sampleReports.values())
    );

    // Apply filters
    if (patientId) {
      reports = reports.filter((r) => r.patient.patientId === patientId);
    }

    if (ambulanceId) {
      reports = reports.filter((r) => r.ambulance.ambulanceId === ambulanceId);
    }

    if (status) {
      reports = reports.filter((r) => r.compliance.reportStatus === status);
    }

    // Sort by generated date (newest first)
    reports.sort(
      (a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)
    );

    // Pagination
    const total = reports.length;
    reports = reports.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: reports,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/reports/:reportId/signature
 * Add signature to report
 * @param {string} reportId - Report ID
 * @body {string} role - Role (paramedic1, paramedic2, supervisor)
 * @body {string} name - Signer name
 * @body {string} licenseNumber - License number
 * @body {string} signature - Base64 encoded signature
 * @returns {Object} Updated report
 */
router.post('/:reportId/signature', (req, res) => {
  try {
    const { reportId } = req.params;
    const { role, name, licenseNumber, signature } = req.body;

    let report = reportsDatabase.get(reportId) || sampleReports.get(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Add signature
    const signatureData = {
      name,
      licenseNumber,
      signature,
    };

    IncidentReportGenerator.addSignature(report, role, signatureData);

    // Update database
    reportsDatabase.set(reportId, report);

    res.json({
      success: true,
      message: 'Signature added successfully',
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/reports/:reportId/pdf
 * Generate PDF report
 * @param {string} reportId - Report ID
 * @query {string} type - Report type (incident or handover)
 * @returns {File} PDF file
 */
router.post('/:reportId/pdf', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { type = 'incident' } = req.query;

    let report = reportsDatabase.get(reportId) || sampleReports.get(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Create reports directory
    const reportsDir = path.join(process.cwd(), 'generated-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    let pdfPath;

    if (type === 'handover') {
      pdfPath = await PDFBuilder.generateHandoverPDF(
        report,
        path.join(reportsDir, `handover-${reportId}.pdf`)
      );
    } else {
      pdfPath = await PDFBuilder.generateIncidentReportPDF(
        report,
        path.join(reportsDir, `incident-${reportId}.pdf`)
      );
    }

    res.download(pdfPath, path.basename(pdfPath));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/reports/:reportId/download
 * Download report as PDF
 * @param {string} reportId - Report ID
 * @returns {File} PDF file
 */
router.get('/:reportId/download', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { type = 'incident' } = req.query;

    let report = reportsDatabase.get(reportId) || sampleReports.get(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    const reportsDir = path.join(process.cwd(), 'generated-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    let pdfPath;

    if (type === 'handover') {
      pdfPath = await PDFBuilder.generateHandoverPDF(
        report,
        path.join(reportsDir, `handover-${reportId}.pdf`)
      );
    } else {
      pdfPath = await PDFBuilder.generateIncidentReportPDF(
        report,
        path.join(reportsDir, `incident-${reportId}.pdf`)
      );
    }

    res.download(pdfPath);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/reports/:reportId
 * Update incident report
 * @param {string} reportId - Report ID
 * @body {Object} updates - Fields to update
 * @returns {Object} Updated report
 */
router.put('/:reportId', (req, res) => {
  try {
    const { reportId } = req.params;
    const updates = req.body;

    let report = reportsDatabase.get(reportId) || sampleReports.get(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Deep merge updates
    Object.keys(updates).forEach((key) => {
      if (typeof updates[key] === 'object' && updates[key] !== null) {
        report[key] = { ...report[key], ...updates[key] };
      } else {
        report[key] = updates[key];
      }
    });

    // Recalculate metrics and validation
    IncidentReportGenerator.calculateMetrics(report);
    const validation = IncidentReportGenerator.validateReport(report);

    // Update database
    reportsDatabase.set(reportId, report);

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: {
        report,
        validation,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/reports/:reportId/validate
 * Validate report completeness
 * @param {string} reportId - Report ID
 * @returns {Object} Validation results
 */
router.get('/:reportId/validate', (req, res) => {
  try {
    const { reportId } = req.params;

    let report = reportsDatabase.get(reportId) || sampleReports.get(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    const validation = IncidentReportGenerator.validateReport(report);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/reports/sample
 * Generate sample reports for testing
 * @returns {Object} Generated sample report
 */
router.post('/sample', (req, res) => {
  try {
    const sampleData = IncidentReportGenerator.getSampleIncidentData();
    const report = IncidentReportGenerator.generateReport(sampleData);

    IncidentReportGenerator.calculateMetrics(report);
    IncidentReportGenerator.validateReport(report);

    // Store as sample
    sampleReports.set(report.reportId, report);

    res.status(201).json({
      success: true,
      message: 'Sample report generated',
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/reports/statistics
 * Get report statistics
 * @returns {Object} Statistics
 */
router.get('/statistics', (req, res) => {
  try {
    const allReports = Array.from(reportsDatabase.values()).concat(
      Array.from(sampleReports.values())
    );

    const statistics = {
      totalReports: allReports.length,
      submitted: allReports.filter((r) => r.compliance.reportStatus === 'SUBMITTED').length,
      draft: allReports.filter((r) => r.compliance.reportStatus === 'DRAFT').length,
      byIncidentType: {},
      bySeverity: {},
      averageSceneTime: 0,
      averageTransportTime: 0,
    };

    let totalSceneTime = 0;
    let totalTransportTime = 0;
    let sceneTimeCount = 0;
    let transportTimeCount = 0;

    allReports.forEach((report) => {
      // Count by type
      const type = report.incident.incidentType;
      statistics.byIncidentType[type] = (statistics.byIncidentType[type] || 0) + 1;

      // Count by severity
      const severity = report.incident.severity;
      statistics.bySeverity[severity] = (statistics.bySeverity[severity] || 0) + 1;

      // Average times
      if (report.metrics.sceneTime > 0) {
        totalSceneTime += report.metrics.sceneTime;
        sceneTimeCount++;
      }
      if (report.metrics.transportTime > 0) {
        totalTransportTime += report.metrics.transportTime;
        transportTimeCount++;
      }
    });

    statistics.averageSceneTime = sceneTimeCount > 0 ? Math.round(totalSceneTime / sceneTimeCount) : 0;
    statistics.averageTransportTime = transportTimeCount > 0 ? Math.round(totalTransportTime / transportTimeCount) : 0;

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/reports/:reportId
 * Delete a report (soft delete - mark as archived)
 * @param {string} reportId - Report ID
 */
router.delete('/:reportId', (req, res) => {
  try {
    const { reportId } = req.params;

    let report = reportsDatabase.get(reportId) || sampleReports.get(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Soft delete
    report.compliance.reportStatus = 'ARCHIVED';
    reportsDatabase.set(reportId, report);

    res.json({
      success: true,
      message: 'Report archived',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
