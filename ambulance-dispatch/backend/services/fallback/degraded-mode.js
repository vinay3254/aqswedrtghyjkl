/**
 * Degraded Mode Service
 * 
 * Manages system behavior when primary services fail.
 * Implements graceful degradation to maintain critical operations.
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class DegradedModeService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.isDegradedMode = false;
    this.failedServices = new Map();
    this.activeFeatures = new Set();
    this.healthCheckInterval = config.healthCheckInterval || 30000; // 30s
    this.degradationThreshold = config.degradationThreshold || 3; // failures before degradation
    this.recoveryTimeout = config.recoveryTimeout || 300000; // 5 minutes
    
    this.serviceHealthStatus = {
      aiDispatch: { healthy: true, failureCount: 0, lastCheck: null },
      geoLocation: { healthy: true, failureCount: 0, lastCheck: null },
      analyticsDB: { healthy: true, failureCount: 0, lastCheck: null },
      realTimeTracking: { healthy: true, failureCount: 0, lastCheck: null },
      notificationService: { healthy: true, failureCount: 0, lastCheck: null }
    };

    this.degradationFeatures = {
      aiDispatch: {
        enabled: true,
        fallback: 'manualDispatch',
        criticalityLevel: 'high',
        gracefulFallback: this.switchToManualDispatch.bind(this)
      },
      geoLocation: {
        enabled: true,
        fallback: 'lastKnownLocation',
        criticalityLevel: 'critical',
        gracefulFallback: this.switchToLastKnownLocation.bind(this)
      },
      analyticsDB: {
        enabled: true,
        fallback: 'inMemoryCache',
        criticalityLevel: 'low',
        gracefulFallback: this.switchToInMemoryCache.bind(this)
      },
      realTimeTracking: {
        enabled: true,
        fallback: 'cachedData',
        criticalityLevel: 'medium',
        gracefulFallback: this.switchToCachedTracking.bind(this)
      },
      notificationService: {
        enabled: true,
        fallback: 'queuedNotifications',
        criticalityLevel: 'medium',
        gracefulFallback: this.switchToQueuedNotifications.bind(this)
      }
    };

    this.cache = {
      lastKnownAmbulanceLocations: new Map(),
      dispatchHistory: [],
      pendingNotifications: []
    };

    this.degradationMetrics = {
      totalFailovers: 0,
      averageRecoveryTime: 0,
      failoverEvents: []
    };

    this.recoveryAttempts = new Map();
  }

  /**
   * Register a service health status
   */
  registerService(serviceName, healthChecker) {
    if (!this.serviceHealthStatus[serviceName]) {
      this.serviceHealthStatus[serviceName] = {
        healthy: true,
        failureCount: 0,
        lastCheck: null
      };
    }
    this.emit('serviceRegistered', { serviceName, timestamp: new Date() });
  }

  /**
   * Report service failure
   */
  reportServiceFailure(serviceName, error) {
    const status = this.serviceHealthStatus[serviceName];
    
    if (!status) {
      logger.warn(`Unknown service reported failure: ${serviceName}`);
      return;
    }

    status.failureCount++;
    status.lastCheck = new Date();
    status.healthy = false;

    logger.error(`Service failure reported: ${serviceName}`, {
      failureCount: status.failureCount,
      error: error.message
    });

    // Check if we should enter degraded mode for this service
    if (status.failureCount >= this.degradationThreshold) {
      this.activateFallback(serviceName);
    }

    this.emit('serviceFailed', {
      serviceName,
      failureCount: status.failureCount,
      timestamp: new Date()
    });

    // Schedule recovery attempt
    this.scheduleRecoveryAttempt(serviceName);
  }

  /**
   * Activate fallback for a failing service
   */
  activateFallback(serviceName) {
    const feature = this.degradationFeatures[serviceName];
    
    if (!feature) {
      logger.warn(`No fallback configured for service: ${serviceName}`);
      return;
    }

    if (this.failedServices.has(serviceName)) {
      logger.info(`Fallback already active for: ${serviceName}`);
      return;
    }

    logger.warn(`Activating fallback for service: ${serviceName}`, {
      fallbackMode: feature.fallback,
      criticalityLevel: feature.criticalityLevel
    });

    this.failedServices.set(serviceName, {
      activatedAt: new Date(),
      fallbackMode: feature.fallback,
      criticalityLevel: feature.criticalityLevel
    });

    // Execute graceful fallback
    if (typeof feature.gracefulFallback === 'function') {
      try {
        feature.gracefulFallback();
      } catch (err) {
        logger.error(`Fallback activation failed for ${serviceName}:`, err);
      }
    }

    // Update degraded mode status
    this.updateDegradedModeStatus();

    this.emit('fallbackActivated', {
      serviceName,
      fallbackMode: feature.fallback,
      timestamp: new Date()
    });

    this.degradationMetrics.totalFailovers++;
    this.degradationMetrics.failoverEvents.push({
      service: serviceName,
      timestamp: new Date(),
      fallbackMode: feature.fallback
    });
  }

  /**
   * Update degraded mode status based on failed services
   */
  updateDegradedModeStatus() {
    const criticalServicesDown = Array.from(this.failedServices.values())
      .filter(f => f.criticalityLevel === 'critical').length > 0;

    const highPriorityServicesDown = Array.from(this.failedServices.values())
      .filter(f => f.criticalityLevel === 'high').length >= 2;

    this.isDegradedMode = criticalServicesDown || highPriorityServicesDown;

    if (this.isDegradedMode) {
      logger.warn('System entering DEGRADED MODE', {
        failedServices: Array.from(this.failedServices.keys()),
        timestamp: new Date()
      });
      this.emit('degradedModeActivated');
    }
  }

  /**
   * Schedule recovery attempt for a service
   */
  scheduleRecoveryAttempt(serviceName) {
    if (this.recoveryAttempts.has(serviceName)) {
      return; // Already scheduled
    }

    const attemptId = setTimeout(() => {
      this.attemptServiceRecovery(serviceName);
      this.recoveryAttempts.delete(serviceName);
    }, this.recoveryTimeout);

    this.recoveryAttempts.set(serviceName, attemptId);
  }

  /**
   * Attempt to recover a failed service
   */
  async attemptServiceRecovery(serviceName) {
    logger.info(`Attempting recovery for service: ${serviceName}`);

    const status = this.serviceHealthStatus[serviceName];
    
    try {
      // This would typically call a health check endpoint
      const isHealthy = await this.healthCheckService(serviceName);

      if (isHealthy) {
        this.recoverService(serviceName);
      } else {
        logger.warn(`Recovery check failed for ${serviceName}, retrying...`);
        this.scheduleRecoveryAttempt(serviceName);
      }
    } catch (err) {
      logger.error(`Recovery attempt failed for ${serviceName}:`, err);
      this.scheduleRecoveryAttempt(serviceName);
    }
  }

  /**
   * Health check for a service (to be overridden with actual checks)
   */
  async healthCheckService(serviceName) {
    // Placeholder - implement actual health checks
    return Math.random() > 0.7; // 30% success rate for demo
  }

  /**
   * Recover a service from degraded state
   */
  recoverService(serviceName) {
    const status = this.serviceHealthStatus[serviceName];
    
    if (!status) return;

    logger.info(`Service recovered: ${serviceName}`);
    
    status.healthy = true;
    status.failureCount = 0;

    // Remove from failed services if it was there
    if (this.failedServices.has(serviceName)) {
      const failoverData = this.failedServices.get(serviceName);
      const recoveryTime = Date.now() - failoverData.activatedAt.getTime();

      // Update average recovery time
      const metrics = this.degradationMetrics;
      metrics.averageRecoveryTime = 
        (metrics.averageRecoveryTime * (metrics.totalFailovers - 1) + recoveryTime) / 
        metrics.totalFailovers;

      this.failedServices.delete(serviceName);
    }

    this.updateDegradedModeStatus();

    this.emit('serviceRecovered', {
      serviceName,
      timestamp: new Date()
    });
  }

  /**
   * Fallback: Switch to manual dispatch
   */
  switchToManualDispatch() {
    logger.warn('Switching to MANUAL DISPATCH mode');
    this.activeFeatures.add('manualDispatch');
    this.activeFeatures.delete('aiDispatch');
  }

  /**
   * Fallback: Use last known location
   */
  switchToLastKnownLocation() {
    logger.warn('Switching to LAST KNOWN LOCATION mode');
    this.activeFeatures.add('lastKnownLocation');
    this.activeFeatures.delete('liveGeolocation');
  }

  /**
   * Fallback: Use in-memory cache instead of database
   */
  switchToInMemoryCache() {
    logger.warn('Switching to IN-MEMORY CACHE mode');
    this.activeFeatures.add('inMemoryCache');
    this.activeFeatures.delete('analyticsDB');
  }

  /**
   * Fallback: Use cached tracking data
   */
  switchToCachedTracking() {
    logger.warn('Switching to CACHED TRACKING mode');
    this.activeFeatures.add('cachedTracking');
    this.activeFeatures.delete('realTimeTracking');
  }

  /**
   * Fallback: Queue notifications for later delivery
   */
  switchToQueuedNotifications() {
    logger.warn('Switching to QUEUED NOTIFICATIONS mode');
    this.activeFeatures.add('queuedNotifications');
    this.activeFeatures.delete('instantNotifications');
  }

  /**
   * Cache last known ambulance location
   */
  cacheAmbulanceLocation(ambulanceId, location) {
    this.cache.lastKnownAmbulanceLocations.set(ambulanceId, {
      location,
      timestamp: new Date()
    });
  }

  /**
   * Retrieve cached ambulance location
   */
  getCachedAmbulanceLocation(ambulanceId) {
    return this.cache.lastKnownAmbulanceLocations.get(ambulanceId);
  }

  /**
   * Get current system health status
   */
  getHealthStatus() {
    return {
      isDegradedMode: this.isDegradedMode,
      failedServices: Array.from(this.failedServices.entries()).map(([name, data]) => ({
        serviceName: name,
        ...data
      })),
      activeFeatures: Array.from(this.activeFeatures),
      serviceHealthStatus: this.serviceHealthStatus,
      metrics: {
        totalFailovers: this.degradationMetrics.totalFailovers,
        averageRecoveryTime: `${Math.round(this.degradationMetrics.averageRecoveryTime)}ms`,
        failoverEventCount: this.degradationMetrics.failoverEvents.length
      }
    };
  }

  /**
   * Get degradation report
   */
  getDegradationReport() {
    return {
      timestamp: new Date(),
      degradedMode: this.isDegradedMode,
      failedServices: Array.from(this.failedServices.keys()),
      activeFallbacks: Array.from(this.activeFeatures),
      metrics: this.degradationMetrics,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate recommendations based on degradation status
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.isDegradedMode) {
      recommendations.push('System in degraded mode - prioritize critical dispatches');
    }

    if (this.failedServices.has('aiDispatch')) {
      recommendations.push('Manual dispatch override: Ensure experienced dispatcher on duty');
    }

    if (this.failedServices.has('geoLocation')) {
      recommendations.push('Location services down: Obtain manual address verification from callers');
    }

    if (this.failedServices.has('realTimeTracking')) {
      recommendations.push('Real-time tracking unavailable: Implement radio-based position reports');
    }

    return recommendations;
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    // Clear all recovery attempts
    this.recoveryAttempts.forEach(attemptId => clearTimeout(attemptId));
    this.recoveryAttempts.clear();

    logger.info('Degraded Mode Service shutdown');
  }
}

module.exports = DegradedModeService;
