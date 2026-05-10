/**
 * Event Surge Predictor - Predict emergency demand surge from events
 * Analyzes festivals, sports matches, rallies, concerts, and other events
 */

class EventSurgePredictor {
  constructor() {
    this.eventDatabase = [];
    this.eventImpactModels = new Map(); // Impact models per event type
    this.registeredEvents = new Map(); // Upcoming scheduled events
    this.impactRadius = 5; // Default impact radius in km
    this.defaultImpactPatterns = {
      sports_match: {
        startOffset: -120,    // Minutes before event
        peakOffset: 0,        // Minutes at event time
        endOffset: 180,       // Minutes after event
        maxMultiplier: 1.8,   // Max demand multiplier
        affectedZoneCount: 3  // Zones affected
      },
      festival: {
        startOffset: -180,
        peakOffset: 120,
        endOffset: 360,
        maxMultiplier: 2.5,
        affectedZoneCount: 5
      },
      concert: {
        startOffset: -120,
        peakOffset: 180,
        endOffset: 240,
        maxMultiplier: 2.2,
        affectedZoneCount: 4
      },
      rally: {
        startOffset: -90,
        peakOffset: 0,
        endOffset: 150,
        maxMultiplier: 1.9,
        affectedZoneCount: 4
      },
      conference: {
        startOffset: -60,
        peakOffset: 240,
        endOffset: 120,
        maxMultiplier: 1.3,
        affectedZoneCount: 2
      },
      accident_major: {
        startOffset: -30,
        peakOffset: 30,
        endOffset: 240,
        maxMultiplier: 3.0,
        affectedZoneCount: 2
      }
    };
  }

  /**
   * Register an upcoming event
   * @param {Object} event - {id, type, name, startTime, endTime, location, expectedAttendance, zone, category}
   */
  registerEvent(event) {
    const validEvent = this.validateEvent(event);
    if (!validEvent.valid) {
      return { success: false, error: validEvent.error };
    }

    const enrichedEvent = {
      ...event,
      id: event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      registeredAt: new Date(),
      predictedImpact: this.calculateEventImpact(event)
    };

    this.registeredEvents.set(enrichedEvent.id, enrichedEvent);
    return { success: true, eventId: enrichedEvent.id, impact: enrichedEvent.predictedImpact };
  }

  /**
   * Validate event data
   */
  validateEvent(event) {
    if (!event.type) {
      return { valid: false, error: 'Event type is required' };
    }

    if (!this.defaultImpactPatterns[event.type]) {
      return { valid: false, error: `Unknown event type: ${event.type}` };
    }

    if (!event.startTime || !event.location) {
      return { valid: false, error: 'Event startTime and location are required' };
    }

    return { valid: true };
  }

  /**
   * Calculate predicted impact of an event
   */
  calculateEventImpact(event) {
    const pattern = this.defaultImpactPatterns[event.type];
    if (!pattern) {
      return null;
    }

    const impact = {
      eventType: event.type,
      maxMultiplier: pattern.maxMultiplier,
      peakTime: this.addMinutes(new Date(event.startTime), pattern.peakOffset),
      affectedZones: event.zone ? [event.zone] : [],
      affectedZoneCount: pattern.affectedZoneCount,
      durationMinutes: Math.abs(pattern.endOffset - pattern.startOffset),
      expectedSurgePercentage: ((pattern.maxMultiplier - 1) * 100).toFixed(1),
      riskLevel: this.calculateRiskLevel(event, pattern),
      keyStatistics: {
        estimatedAttendance: event.expectedAttendance || 0,
        impactStartTime: this.addMinutes(new Date(event.startTime), pattern.startOffset),
        impactEndTime: this.addMinutes(new Date(event.startTime), pattern.endOffset)
      }
    };

    return impact;
  }

  /**
   * Calculate risk level based on event characteristics
   */
  calculateRiskLevel(event, pattern) {
    let riskScore = 0;

    // Factor 1: Event type inherent risk
    const typeRisks = {
      sports_match: 70,
      festival: 75,
      concert: 65,
      rally: 80,
      conference: 30,
      accident_major: 95
    };

    riskScore += typeRisks[event.type] || 50;

    // Factor 2: Expected attendance
    const attendance = event.expectedAttendance || 0;
    if (attendance > 10000) riskScore += 25;
    else if (attendance > 5000) riskScore += 15;
    else if (attendance > 1000) riskScore += 10;

    // Factor 3: Multiplier effect
    riskScore += (pattern.maxMultiplier - 1) * 20;

    // Normalize to 0-100
    riskScore = Math.min(100, Math.max(0, riskScore));

    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Predict surge for a specific time and zone
   * @returns {Object} Surge prediction with multiplier
   */
  predictSurgeForTime(zone, forecastTime) {
    let totalMultiplier = 1.0;
    const applicableEvents = [];

    // Check all registered events
    for (const event of this.registeredEvents.values()) {
      const isApplicable = this.isEventApplicable(event, zone, forecastTime);
      if (isApplicable) {
        const surge = this.calculateSurgeAtTime(event, forecastTime);
        totalMultiplier += (surge.multiplier - 1);
        applicableEvents.push({
          eventId: event.id,
          eventType: event.type,
          eventName: event.name,
          multiplier: surge.multiplier,
          intensity: surge.intensity
        });
      }
    }

    return {
      zone,
      forecastTime,
      totalMultiplier: Math.min(3.5, totalMultiplier), // Cap at 3.5x
      applicableEvents,
      eventCount: applicableEvents.length,
      hasSurge: applicableEvents.length > 0,
      surgeDescription: this.describeSurge(totalMultiplier)
    };
  }

  /**
   * Check if event is applicable to zone and time
   */
  isEventApplicable(event, zone, forecastTime) {
    const eventStart = new Date(event.startTime);
    const eventEnd = event.endTime ? new Date(event.endTime) : this.addMinutes(eventStart, 240);
    const pattern = this.defaultImpactPatterns[event.type];

    const impactStart = this.addMinutes(eventStart, pattern.startOffset);
    const impactEnd = this.addMinutes(eventStart, pattern.endOffset);

    const timeInWindow = forecastTime >= impactStart && forecastTime <= impactEnd;
    const zoneMatch = !event.zone || event.zone === zone;

    return timeInWindow && zoneMatch;
  }

  /**
   * Calculate surge multiplier at specific time
   */
  calculateSurgeAtTime(event, forecastTime) {
    const pattern = this.defaultImpactPatterns[event.type];
    const eventStart = new Date(event.startTime);
    const peakTime = this.addMinutes(eventStart, pattern.peakOffset);

    const impactStart = this.addMinutes(eventStart, pattern.startOffset);
    const impactEnd = this.addMinutes(eventStart, pattern.endOffset);

    const totalDuration = impactEnd.getTime() - impactStart.getTime();
    const timeOffset = forecastTime.getTime() - impactStart.getTime();

    // Bell curve distribution around peak
    const distanceFromPeak = Math.abs(forecastTime.getTime() - peakTime.getTime());
    const maxDistance = (pattern.endOffset - pattern.startOffset) / 2 * 60000; // in ms

    let multiplier = 1.0;
    if (timeOffset >= 0 && timeOffset <= totalDuration) {
      // Gaussian curve
      const sigma = maxDistance / 2;
      multiplier = pattern.maxMultiplier * Math.exp(-0.5 * Math.pow(distanceFromPeak / sigma, 2));
      multiplier = Math.max(1.0, multiplier);
    }

    const intensity = {
      1: 'low',
      2: 'moderate',
      2.5: 'high',
      3: 'very_high'
    };

    return {
      multiplier: parseFloat(multiplier.toFixed(2)),
      intensity: multiplier < 1.3 ? 'low' : multiplier < 1.8 ? 'moderate' : multiplier < 2.4 ? 'high' : 'very_high',
      percentageIncrease: ((multiplier - 1) * 100).toFixed(1)
    };
  }

  /**
   * Describe surge level
   */
  describeSurge(multiplier) {
    if (multiplier < 1.1) return 'no_surge';
    if (multiplier < 1.3) return 'low_surge';
    if (multiplier < 1.7) return 'moderate_surge';
    if (multiplier < 2.2) return 'high_surge';
    return 'critical_surge';
  }

  /**
   * Get surge forecast for next 24 hours
   */
  getSurgeForecast24Hours(zone, startTime = new Date()) {
    const forecast = [];
    const currentTime = new Date(startTime);

    for (let i = 0; i < 24; i++) {
      forecast.push(this.predictSurgeForTime(zone, currentTime));
      currentTime.setHours(currentTime.getHours() + 1);
    }

    return forecast;
  }

  /**
   * Get all upcoming events
   */
  getUpcomingEvents(hoursFromNow = 168) {
    const now = new Date();
    const future = this.addMinutes(now, hoursFromNow * 60);

    const upcomingEvents = Array.from(this.registeredEvents.values())
      .filter(e => {
        const eventStart = new Date(e.startTime);
        return eventStart >= now && eventStart <= future;
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    return upcomingEvents;
  }

  /**
   * Get high-risk events
   */
  getHighRiskEvents() {
    return Array.from(this.registeredEvents.values())
      .filter(e => {
        const riskLevel = e.predictedImpact?.riskLevel;
        return riskLevel === 'CRITICAL' || riskLevel === 'HIGH';
      })
      .sort((a, b) => {
        const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return riskOrder[a.predictedImpact.riskLevel] - riskOrder[b.predictedImpact.riskLevel];
      });
  }

  /**
   * Get recommended zone surge preparedness
   */
  getSurgePreparedness(zone, hoursAhead = 24) {
    const now = new Date();
    const future = this.addMinutes(now, hoursAhead * 60);
    const maxSurge = { multiplier: 1.0, time: null, event: null };

    for (const event of this.registeredEvents.values()) {
      const eventStart = new Date(event.startTime);
      const pattern = this.defaultImpactPatterns[event.type];
      const impactStart = this.addMinutes(eventStart, pattern.startOffset);
      const impactEnd = this.addMinutes(eventStart, pattern.endOffset);

      if (impactEnd >= now && impactStart <= future && (!event.zone || event.zone === zone)) {
        if (pattern.maxMultiplier > maxSurge.multiplier) {
          maxSurge.multiplier = pattern.maxMultiplier;
          maxSurge.time = this.addMinutes(eventStart, pattern.peakOffset);
          maxSurge.event = event;
        }
      }
    }

    const preparednessLevel = maxSurge.multiplier < 1.3 ? 'NORMAL' : 
                              maxSurge.multiplier < 1.8 ? 'ALERT' : 
                              maxSurge.multiplier < 2.4 ? 'HIGH_ALERT' : 'CRITICAL';

    return {
      zone,
      preparednessLevel,
      maxExpectedMultiplier: parseFloat(maxSurge.multiplier.toFixed(2)),
      peakTime: maxSurge.time,
      triggeringEvent: maxSurge.event ? {
        id: maxSurge.event.id,
        type: maxSurge.event.type,
        name: maxSurge.event.name
      } : null
    };
  }

  /**
   * Learn event impact from historical data
   */
  trainEventImpactModel(historicalEventData) {
    // Aggregate impact by event type
    const impactByType = {};

    historicalEventData.forEach(data => {
      if (!impactByType[data.eventType]) {
        impactByType[data.eventType] = {
          totalEvents: 0,
          totalDemandIncrease: 0,
          maxMultiplier: 1.0,
          avgDuration: 0,
          durations: []
        };
      }

      const impact = impactByType[data.eventType];
      impact.totalEvents++;
      impact.totalDemandIncrease += (data.demandMultiplier - 1);
      impact.maxMultiplier = Math.max(impact.maxMultiplier, data.demandMultiplier);
      impact.durations.push(data.durationMinutes);
    });

    // Update models with learned values
    for (const [type, impact] of Object.entries(impactByType)) {
      const avgMultiplier = impact.totalDemandIncrease / impact.totalEvents + 1;
      const avgDuration = impact.durations.reduce((a, b) => a + b, 0) / impact.durations.length;

      this.eventImpactModels.set(type, {
        averageMultiplier: parseFloat(avgMultiplier.toFixed(2)),
        maxMultiplier: parseFloat(impact.maxMultiplier.toFixed(2)),
        averageDuration: Math.round(avgDuration),
        samplesUsed: impact.totalEvents
      });
    }
  }

  /**
   * Cancel or remove an event
   */
  removeEvent(eventId) {
    return this.registeredEvents.delete(eventId);
  }

  /**
   * Update event details
   */
  updateEvent(eventId, updates) {
    const event = this.registeredEvents.get(eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    const updated = { ...event, ...updates, predictedImpact: this.calculateEventImpact({ ...event, ...updates }) };
    this.registeredEvents.set(eventId, updated);
    return { success: true, event: updated };
  }

  // Utility functions
  addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  getEventStats() {
    return {
      totalRegistered: this.registeredEvents.size,
      byType: this.getEventsByType(),
      critical: this.getHighRiskEvents().length,
      upcoming7days: this.getUpcomingEvents(168).length
    };
  }

  getEventsByType() {
    const stats = {};
    for (const event of this.registeredEvents.values()) {
      stats[event.type] = (stats[event.type] || 0) + 1;
    }
    return stats;
  }
}

module.exports = EventSurgePredictor;
