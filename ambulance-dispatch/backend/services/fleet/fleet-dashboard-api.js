/**
 * Fleet Dashboard API
 * Provides endpoints for fleet operators to manage vehicles, drivers, and view analytics
 */

const express = require('express');
const router = express.Router();
const { handleAsyncErrors } = require('../../utils/middleware');
const logger = require('../../utils/logger');

// In-memory storage (replace with database in production)
const fleetDashboards = new Map();
const performanceMetrics = new Map();

/**
 * GET /fleets/:fleetId/dashboard
 * Get comprehensive fleet dashboard
 */
router.get(
  '/fleets/:fleetId/dashboard',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;

    // Simulate fetching fleet data from other services
    const dashboard = {
      fleetId,
      lastUpdated: new Date(),
      overview: {
        totalVehicles: 15,
        activeVehicles: 12,
        totalDrivers: 28,
        certifiedDrivers: 25,
        pendingVerifications: 2,
        complianceScore: 92
      },
      vehicles: {
        total: 15,
        byStatus: {
          active: 12,
          maintenance: 2,
          inactive: 1
        },
        byType: {
          'Type A': 8,
          'Type B': 5,
          'Type C': 2
        },
        needsAttention: [
          {
            vehicleId: 'VEH_123',
            licensePlate: 'AMB-001',
            issue: 'Insurance expiring in 30 days',
            priority: 'high'
          },
          {
            vehicleId: 'VEH_124',
            licensePlate: 'AMB-002',
            issue: 'Inspection due',
            priority: 'medium'
          }
        ]
      },
      drivers: {
        total: 28,
        byStatus: {
          certified: 25,
          inProgress: 2,
          inactive: 1
        },
        certificationDueWithin30Days: 3,
        needsAttention: [
          {
            driverId: 'DRV_101',
            name: 'John Doe',
            issue: 'CPR certification expiring in 15 days',
            priority: 'high'
          },
          {
            driverId: 'DRV_102',
            name: 'Jane Smith',
            issue: 'License renewal due',
            priority: 'high'
          }
        ]
      },
      recentActivity: [
        {
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          action: 'Vehicle verified',
          details: 'AMB-015 inspection completed',
          status: 'success'
        },
        {
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
          action: 'Driver certified',
          details: 'Mike Johnson completed all certifications',
          status: 'success'
        },
        {
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          action: 'Compliance alert',
          details: 'Vehicle AMB-005 insurance expiring soon',
          status: 'warning'
        }
      ]
    };

    res.status(200).json({
      success: true,
      data: dashboard
    });
  })
);

/**
 * GET /fleets/:fleetId/vehicles/status
 * Get vehicle status summary
 */
router.get(
  '/fleets/:fleetId/vehicles/status',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;

    const vehicleStatus = {
      fleetId,
      summary: {
        total: 15,
        operationalPercentage: 80,
        maintenancePercentage: 13,
        inactivePercentage: 7
      },
      vehicles: [
        {
          vehicleId: 'VEH_001',
          licensePlate: 'AMB-001',
          type: 'Type A',
          status: 'active',
          lastServiceDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          nextServiceDue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          insuranceStatus: 'active',
          insuranceExpiryDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
          inspectionStatus: 'valid',
          inspectionExpiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
          equipmentChecklist: 95,
          lastActivityDate: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
          vehicleId: 'VEH_002',
          licensePlate: 'AMB-002',
          type: 'Type B',
          status: 'active',
          lastServiceDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          nextServiceDue: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
          insuranceStatus: 'active',
          insuranceExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          inspectionStatus: 'expiring_soon',
          inspectionExpiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
          equipmentChecklist: 98,
          lastActivityDate: new Date(Date.now() - 1 * 60 * 60 * 1000)
        }
      ],
      reportGeneratedAt: new Date()
    };

    res.status(200).json({
      success: true,
      data: vehicleStatus
    });
  })
);

/**
 * GET /fleets/:fleetId/drivers/status
 * Get driver status summary
 */
router.get(
  '/fleets/:fleetId/drivers/status',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;

    const driverStatus = {
      fleetId,
      summary: {
        total: 28,
        certifiedPercentage: 89,
        inProgressPercentage: 7,
        inactivePercentage: 4
      },
      drivers: [
        {
          driverId: 'DRV_001',
          name: 'John Doe',
          status: 'certified',
          licenseNumber: 'DL123456',
          licenseClass: 'B',
          licenseExpiry: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
          certifications: {
            'EMT Basic': { status: 'completed', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000) },
            'CPR Certification': { status: 'completed', expiryDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000) },
            'First Aid Certification': { status: 'completed', expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
            'Ambulance Operator License': { status: 'completed', expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }
          },
          backgroundCheckStatus: 'approved',
          medicalClearanceStatus: 'approved',
          assignedVehicles: ['AMB-001', 'AMB-005'],
          totalShifts: 156,
          averageRating: 4.8
        },
        {
          driverId: 'DRV_002',
          name: 'Jane Smith',
          status: 'certified',
          licenseNumber: 'DL654321',
          licenseClass: 'B',
          licenseExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          certifications: {
            'EMT Basic': { status: 'completed', expiryDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000) },
            'CPR Certification': { status: 'completed', expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
            'First Aid Certification': { status: 'completed', expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000) }
          },
          backgroundCheckStatus: 'approved',
          medicalClearanceStatus: 'approved',
          assignedVehicles: ['AMB-002', 'AMB-007'],
          totalShifts: 142,
          averageRating: 4.7
        }
      ],
      reportGeneratedAt: new Date()
    };

    res.status(200).json({
      success: true,
      data: driverStatus
    });
  })
);

/**
 * GET /fleets/:fleetId/compliance/report
 * Get compliance report
 */
router.get(
  '/fleets/:fleetId/compliance/report',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;

    const complianceReport = {
      fleetId,
      reportDate: new Date(),
      overallScore: 92,
      scoreBreakdown: {
        vehicleCompliance: {
          score: 94,
          details: 'Vehicle documentation and verification status'
        },
        driverCompliance: {
          score: 91,
          details: 'Driver certification and licensing status'
        },
        equipmentCompliance: {
          score: 93,
          details: 'Emergency equipment and safety measures'
        },
        insuranceCompliance: {
          score: 90,
          details: 'Insurance coverage and renewal status'
        },
        safetyCompliance: {
          score: 88,
          details: 'Safety protocols and incident reporting'
        }
      },
      issues: [
        {
          id: 'ISSUE_001',
          severity: 'high',
          category: 'Insurance',
          description: 'Vehicle AMB-001 insurance expiring in 30 days',
          affectedItems: ['AMB-001'],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'open',
          assignedTo: 'Manager'
        },
        {
          id: 'ISSUE_002',
          severity: 'medium',
          category: 'Certification',
          description: 'Driver John Doe CPR certification expiring in 45 days',
          affectedItems: ['DRV_001'],
          dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          status: 'open',
          assignedTo: 'HR'
        }
      ],
      recommendations: [
        'Renew insurance for AMB-001 before expiration',
        'Schedule CPR training for drivers with certifications expiring within 60 days',
        'Review equipment inventory for Type A vehicles',
        'Update safety protocols training for all drivers'
      ],
      lastAuditDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      nextAuditDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    };

    res.status(200).json({
      success: true,
      data: complianceReport
    });
  })
);

/**
 * GET /fleets/:fleetId/alerts
 * Get active alerts for fleet
 */
router.get(
  '/fleets/:fleetId/alerts',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;
    const { severity, status } = req.query;

    let alerts = [
      {
        alertId: 'ALERT_001',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        severity: 'high',
        type: 'insurance_expiring',
        title: 'Vehicle Insurance Expiring Soon',
        message: 'Insurance for vehicle AMB-001 expires on ' + new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toDateString(),
        affectedItem: { type: 'vehicle', id: 'AMB-001' },
        status: 'active',
        actionRequired: true,
        actionUrl: '/fleet/vehicles/AMB-001/insurance'
      },
      {
        alertId: 'ALERT_002',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
        severity: 'medium',
        type: 'certification_expiring',
        title: 'Driver Certification Expiring',
        message: 'CPR certification for John Doe expires on ' + new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toDateString(),
        affectedItem: { type: 'driver', id: 'DRV_001' },
        status: 'active',
        actionRequired: true,
        actionUrl: '/fleet/drivers/DRV_001/certifications'
      },
      {
        alertId: 'ALERT_003',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        severity: 'low',
        type: 'maintenance_due',
        title: 'Vehicle Maintenance Due',
        message: 'Scheduled maintenance for vehicle AMB-005 is due',
        affectedItem: { type: 'vehicle', id: 'AMB-005' },
        status: 'active',
        actionRequired: false,
        actionUrl: '/fleet/vehicles/AMB-005/maintenance'
      }
    ];

    // Filter by severity if provided
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    // Filter by status if provided
    if (status) {
      alerts = alerts.filter(a => a.status === status);
    }

    res.status(200).json({
      success: true,
      data: {
        fleetId,
        alertCount: alerts.length,
        alerts: alerts.sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
      }
    });
  })
);

/**
 * POST /fleets/:fleetId/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post(
  '/fleets/:fleetId/alerts/:alertId/acknowledge',
  handleAsyncErrors(async (req, res) => {
    const { fleetId, alertId } = req.params;
    const { acknowledgedBy, notes } = req.body;

    logger.info(`Alert acknowledged: ${alertId}`, {
      fleetId,
      acknowledgedBy,
      notes
    });

    res.status(200).json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        alertId,
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy
      }
    });
  })
);

/**
 * GET /fleets/:fleetId/performance/metrics
 * Get fleet performance metrics
 */
router.get(
  '/fleets/:fleetId/performance/metrics',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;
    const { period = 'monthly' } = req.query;

    const metrics = {
      fleetId,
      period,
      generatedAt: new Date(),
      vehicles: {
        totalVehicles: 15,
        averageAge: 4.2,
        maintenanceHours: 245,
        downtimeHours: 12,
        operationalEfficiency: 95.2,
        fuelEfficiency: 8.5,
        emissionsCompliance: 'pass'
      },
      drivers: {
        totalDrivers: 28,
        averageExperience: 6.5,
        safetyIncidents: 1,
        trainingCompletionRate: 96,
        averagePerformanceRating: 4.6,
        turnooverRate: 5
      },
      operations: {
        totalDispatches: 2450,
        averageResponseTime: 8.2,
        completionRate: 98.5,
        customerSatisfaction: 4.7,
        costPerDispatch: 125.50,
        revenueGenerated: 307250
      },
      compliance: {
        documentCompletionRate: 98,
        inspectionPassRate: 100,
        insuranceCoverageRate: 100,
        safetyViolations: 0,
        complianceScore: 92
      },
      trends: {
        dispatches: 'increasing',
        incidents: 'stable',
        costs: 'decreasing',
        satisfaction: 'increasing'
      }
    };

    res.status(200).json({
      success: true,
      data: metrics
    });
  })
);

/**
 * GET /fleets/:fleetId/maintenance/schedule
 * Get maintenance schedule
 */
router.get(
  '/fleets/:fleetId/maintenance/schedule',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;

    const maintenanceSchedule = {
      fleetId,
      upcomingMaintenance: [
        {
          maintenanceId: 'MAINT_001',
          vehicleId: 'VEH_001',
          licensePlate: 'AMB-001',
          type: 'scheduled_service',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          daysUntilDue: 5,
          priority: 'high',
          estimatedDuration: 4,
          estimatedCost: 500,
          description: 'Oil change and filter replacement',
          status: 'pending'
        },
        {
          maintenanceId: 'MAINT_002',
          vehicleId: 'VEH_002',
          licensePlate: 'AMB-002',
          type: 'inspection',
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          daysUntilDue: 15,
          priority: 'medium',
          estimatedDuration: 2,
          estimatedCost: 300,
          description: 'Annual inspection',
          status: 'scheduled'
        },
        {
          maintenanceId: 'MAINT_003',
          vehicleId: 'VEH_003',
          licensePlate: 'AMB-003',
          type: 'tire_rotation',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          daysUntilDue: 30,
          priority: 'low',
          estimatedDuration: 1,
          estimatedCost: 150,
          description: 'Tire rotation and balance',
          status: 'pending'
        }
      ],
      completedMaintenance: [
        {
          maintenanceId: 'MAINT_100',
          vehicleId: 'VEH_005',
          licensePlate: 'AMB-005',
          type: 'brake_service',
          completedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          cost: 750,
          nextDueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'completed'
        }
      ],
      totalEstimatedCost: 950,
      generatedAt: new Date()
    };

    res.status(200).json({
      success: true,
      data: maintenanceSchedule
    });
  })
);

/**
 * POST /fleets/:fleetId/documents/generate-report
 * Generate compliance report as PDF
 */
router.post(
  '/fleets/:fleetId/documents/generate-report',
  handleAsyncErrors(async (req, res) => {
    const { fleetId } = req.params;
    const { reportType, startDate, endDate } = req.body;

    if (!reportType || !['compliance', 'performance', 'audit'].includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report type. Must be compliance, performance, or audit'
      });
    }

    const reportId = `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info(`Report generation initiated: ${reportId}`, {
      fleetId,
      reportType,
      startDate,
      endDate
    });

    res.status(202).json({
      success: true,
      message: 'Report generation initiated',
      data: {
        reportId,
        reportType,
        fleetId,
        status: 'generating',
        estimatedCompletionTime: '5 minutes',
        downloadUrl: `/fleets/${fleetId}/documents/reports/${reportId}`
      }
    });
  })
);

module.exports = router;
