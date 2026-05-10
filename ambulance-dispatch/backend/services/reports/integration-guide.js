/**
 * Integration Guide & Test Script
 * Use this file to test the report generation system
 */

const IncidentReportGenerator = require('./report-generator');
const PDFBuilder = require('./pdf-builder');
const express = require('express');

// ============================================
// Example 1: Generate a Sample Report
// ============================================
console.log('🔧 Example 1: Generating Sample Report...');

const sampleData = IncidentReportGenerator.getSampleIncidentData();
const report = IncidentReportGenerator.generateReport(sampleData);

console.log('✅ Report Generated:');
console.log(`   Report ID: ${report.reportId}`);
console.log(`   Patient: ${report.patient.firstName} ${report.patient.lastName}`);
console.log(`   Incident Type: ${report.incident.incidentType}`);
console.log(`   Severity: ${report.incident.severity}`);

// ============================================
// Example 2: Calculate Metrics
// ============================================
console.log('\n🔧 Example 2: Calculating Metrics...');

IncidentReportGenerator.calculateMetrics(report);

console.log('✅ Metrics Calculated:');
console.log(`   Total Incident Time: ${report.metrics.totalIncidentTime} minutes`);
console.log(`   Dispatch to Arrival: ${report.metrics.dispatchToArrivalTime} minutes`);
console.log(`   Scene Time: ${report.metrics.sceneTime} minutes`);
console.log(`   Transport Time: ${report.metrics.transportTime} minutes`);

// ============================================
// Example 3: Validate Report
// ============================================
console.log('\n🔧 Example 3: Validating Report...');

const validation = IncidentReportGenerator.validateReport(report);

console.log('✅ Validation Results:');
console.log(`   Is Valid: ${validation.isValid}`);
console.log(`   Completion: ${validation.completionPercentage}%`);
console.log(`   Errors: ${validation.errors.length}`);
console.log(`   Warnings: ${validation.warnings.length}`);

if (validation.warnings.length > 0) {
  console.log('   ⚠️  Warnings:');
  validation.warnings.forEach((w) => console.log(`      - ${w}`));
}

// ============================================
// Example 4: Add Signatures
// ============================================
console.log('\n🔧 Example 4: Adding Signatures...');

IncidentReportGenerator.addSignature(report, 'paramedic1', {
  name: 'James Kipchoge',
  licenseNumber: 'PAR-2024-001',
  signature: null,
});

IncidentReportGenerator.addSignature(report, 'paramedic2', {
  name: 'Mary Wanjiru',
  licenseNumber: 'PAR-2024-002',
  signature: null,
});

IncidentReportGenerator.addSignature(report, 'supervisor', {
  name: 'Dr. Peter Mwangi',
  licenseNumber: 'SUP-2024-001',
  signature: null,
});

console.log('✅ Signatures Added:');
console.log(`   Status: ${report.compliance.reportStatus}`);
console.log(`   Is Complete: ${report.compliance.isComplete}`);
console.log(`   Paramedic 1: ${report.signatures.paramedic1.name}`);
console.log(`   Paramedic 2: ${report.signatures.paramedic2.name}`);
console.log(`   Supervisor: ${report.signatures.supervisor.name}`);

// ============================================
// Example 5: Generate PDFs
// ============================================
console.log('\n🔧 Example 5: Generating PDFs...');

(async () => {
  try {
    // Generate incident report PDF
    const incidentPdfPath = await PDFBuilder.generateIncidentReportPDF(
      report,
      './test-incident-report.pdf'
    );
    console.log(`✅ Incident PDF Generated: ${incidentPdfPath}`);
    const incidentSize = PDFBuilder.getFileSize(incidentPdfPath);
    console.log(`   File Size: ${incidentSize} MB`);

    // Generate handover PDF
    const handoverPdfPath = await PDFBuilder.generateHandoverPDF(
      report,
      './test-handover-summary.pdf'
    );
    console.log(`✅ Handover PDF Generated: ${handoverPdfPath}`);
    const handoverSize = PDFBuilder.getFileSize(handoverPdfPath);
    console.log(`   File Size: ${handoverSize} MB`);

    // ============================================
    // Example 6: API Integration Example
    // ============================================
    console.log('\n🔧 Example 6: API Integration Setup...');

    const app = express();
    app.use(express.json());

    // Import API router
    const reportRouter = require('./report-api');
    app.use('/api/reports', reportRouter);

    console.log('✅ API Router Configured');
    console.log('   Available Endpoints:');
    console.log('   - POST   /api/reports/generate');
    console.log('   - GET    /api/reports');
    console.log('   - GET    /api/reports/:reportId');
    console.log('   - PUT    /api/reports/:reportId');
    console.log('   - POST   /api/reports/:reportId/signature');
    console.log('   - GET    /api/reports/:reportId/validate');
    console.log('   - POST   /api/reports/:reportId/pdf');
    console.log('   - GET    /api/reports/:reportId/download');
    console.log('   - POST   /api/reports/sample');
    console.log('   - GET    /api/reports/statistics');
    console.log('   - DELETE /api/reports/:reportId');

    // ============================================
    // Example 7: Custom Report Data
    // ============================================
    console.log('\n🔧 Example 7: Creating Custom Report...');

    const customData = {
      incidentId: 'INC-CUSTOM-001',
      incidentType: 'TRAUMA',
      severity: 'CRITICAL',
      description: 'Motor vehicle accident with multiple casualties',
      generatedBy: 'Field Paramedic',

      location: {
        address: 'Junction of Karura Road and Forest Road',
        coordinates: {
          latitude: -1.2548,
          longitude: 36.7689,
        },
        district: 'Karura',
        region: 'Nairobi',
        landmark: 'Near Karura Forest entrance',
        accessNotes: 'Multiple vehicles involved, roads partially blocked',
      },

      patient: {
        firstName: 'Michael',
        lastName: 'Johnson',
        age: '42',
        gender: 'Male',
        phoneNumber: '+254722123456',
        idNumber: '12345678',
        allergies: [],
        medicalHistory: ['Asthma'],
        chronicConditions: [],
      },

      ambulance: {
        ambulanceId: 'AMB-005',
        registrationPlate: 'KDN 505P',
        baseStation: 'Central Station',
        crewSize: 2,
        crew: [
          {
            name: 'Samuel Ochieng',
            role: 'Paramedic',
            licenseNumber: 'PAR-2024-005',
            yearsExperience: 6,
          },
          {
            name: 'Alice Kariuki',
            role: 'Paramedic',
            licenseNumber: 'PAR-2024-006',
            yearsExperience: 4,
          },
        ],
      },

      paramedic: {
        assessment: {
          primaryComplaint: 'Multiple trauma, suspected internal injuries',
          secondaryComplaints: ['Leg fracture', 'Chest pain'],
          consciousness: 'Alert but confused',
          breathing: 'Rapid',
          circulation: 'Weak radial pulse',
          skinColor: 'Pale and sweaty',
        },
        vitals: {
          bloodPressure: '100/60',
          heartRate: 125,
          respirationRate: 28,
          temperature: '35.5°C',
          spO2: '92%',
          glucoseLevel: '',
        },
        actions: [
          {
            action: 'TRIAGE_ASSESSMENT',
            description: 'Rapid trauma assessment performed',
            outcome: 'COMPLETED',
          },
          {
            action: 'SPINE_IMMOBILIZATION',
            description: 'Cervical spine stabilized with c-collar',
            outcome: 'COMPLETED',
          },
          {
            action: 'IV_ACCESS',
            description: 'Two large bore IVs established for fluid resuscitation',
            outcome: 'COMPLETED',
          },
          {
            action: 'OXYGEN_THERAPY',
            description: 'High-flow oxygen at 15 L/min via non-rebreather',
            outcome: 'COMPLETED',
          },
        ],
        medications: [
          {
            name: 'Normal Saline',
            dose: '1000 mL',
            route: 'IV',
            time: '14:15',
            administration: 'Running',
          },
        ],
        notes:
          'Patient conscious and alert. Rapid transport to trauma center initiated. All actions aimed at stabilization.',
      },

      handover: {
        hospitalId: 'HOSP-TRAUMA',
        hospitalName: 'Kenya National Trauma Center',
        arrivalTime: '14:45',
        dischargeTime: null,
        receivingStaff: {
          name: 'Dr. Amina Hassan',
          role: 'Trauma Surgeon',
        },
        department: 'Trauma Unit',
        handoverNotes:
          '42M MVC with suspected internal injuries. HR 125, BP 100/60. Pale and sweaty. Two large-bore IVs running NS, high-flow O2 in place. Cervical spine protected.',
      },

      metrics: {
        callToDispatchTime: 3,
        dispatchToArrivalTime: 8,
        sceneTime: 20,
        transportTime: 30,
        totalIncidentTime: 61,
        distanceTraveled: 12.3,
        qualityScore: 0,
      },

      compliance: {
        hasPhotos: true,
        hasConsent: true,
        followUpRequired: true,
        incidentCategory: 'TRAUMA',
      },
    };

    const customReport = IncidentReportGenerator.generateReport(customData);
    IncidentReportGenerator.calculateMetrics(customReport);

    console.log('✅ Custom Report Created:');
    console.log(`   Report ID: ${customReport.reportId}`);
    console.log(`   Patient: ${customReport.patient.firstName} ${customReport.patient.lastName}`);
    console.log(`   Incident: ${customReport.incident.description}`);
    console.log(`   Hospital: ${customReport.handover.hospitalName}`);

    // ============================================
    // Summary
    // ============================================
    console.log('\n\n📊 INTEGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log('✅ Report Generation System Ready for Integration');
    console.log('\nKey Features:');
    console.log('  • Automated report generation from incident data');
    console.log('  • PDF export with professional styling');
    console.log('  • HTML templates for web viewing');
    console.log('  • REST API for all operations');
    console.log('  • Data validation and completion tracking');
    console.log('  • Signature management');
    console.log('  • Performance metrics calculation');
    console.log('  • Privacy protection (phone/ID masking)');
    console.log('\nTo Integrate:');
    console.log('  1. npm install pdfkit uuid date-fns express');
    console.log('  2. Import reportRouter from report-api.js');
    console.log('  3. Mount router: app.use("/api/reports", reportRouter)');
    console.log('  4. Start using API endpoints');
    console.log('\nFiles Generated in Test:');
    console.log(`  • ${incidentPdfPath}`);
    console.log(`  • ${handoverPdfPath}`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();

module.exports = {
  IncidentReportGenerator,
  PDFBuilder,
};
