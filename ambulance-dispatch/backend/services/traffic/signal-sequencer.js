const logger = require('../../api/utils/logger');

const PREEMPTION_ADVANCE_TIME_SEC = 120; // Request preemption 2 minutes before arrival
const SIGNAL_RELEASE_DELAY_SEC = 30; // Release signal 30 seconds after passing
const AVERAGE_SIGNAL_DISTANCE_M = 700; // Average distance between signals in urban areas

class SignalSequencer {
  constructor() {
    this.signalDatabase = this._loadSignalDatabase();
  }

  calculateSignalTimings(route, ambulanceSpeed = 60) {
    try {
      const signals = this._identifySignalsAlongRoute(route);
      const timings = signals.map(signal => this._calculateSignalTiming(signal, route, ambulanceSpeed));
      
      logger.info('Calculated signal timings', {
        route_id: route.id,
        total_signals: timings.length,
        total_distance_km: route.distance / 1000
      });

      return timings;
    } catch (error) {
      logger.error('Failed to calculate signal timings', { error: error.message });
      return [];
    }
  }

  _identifySignalsAlongRoute(route) {
    const signals = [];
    const routeCoordinates = route.coordinates || route.geometry?.coordinates || [];

    if (!routeCoordinates.length) {
      logger.warn('No route coordinates provided for signal identification');
      return this._estimateSignalsFromDistance(route);
    }

    // Check each signal in database against route corridor
    for (const signal of this.signalDatabase) {
      if (this._isSignalNearRoute(signal, routeCoordinates)) {
        const distanceFromStart = this._calculateDistanceAlongRoute(signal, routeCoordinates);
        signals.push({
          ...signal,
          distance_from_start_m: distanceFromStart
        });
      }
    }

    // Sort by distance from start
    signals.sort((a, b) => a.distance_from_start_m - b.distance_from_start_m);

    // If no signals found in database, estimate based on route length
    if (signals.length === 0) {
      return this._estimateSignalsFromDistance(route);
    }

    return signals;
  }

  _isSignalNearRoute(signal, routeCoordinates, corridorWidthM = 50) {
    // Check if signal is within corridor width of any route segment
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const segmentStart = routeCoordinates[i];
      const segmentEnd = routeCoordinates[i + 1];
      const distance = this._pointToSegmentDistance(signal.location, segmentStart, segmentEnd);
      
      if (distance <= corridorWidthM) {
        return true;
      }
    }
    return false;
  }

  _pointToSegmentDistance(point, segmentStart, segmentEnd) {
    // Haversine-based distance calculation (simplified for short distances)
    const lat = point.lat;
    const lng = point.lng;
    const lat1 = segmentStart[1];
    const lng1 = segmentStart[0];
    const lat2 = segmentEnd[1];
    const lng2 = segmentEnd[0];

    // Project point onto line segment
    const A = lat - lat1;
    const B = lng - lng1;
    const C = lat2 - lat1;
    const D = lng2 - lng1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const param = lenSq !== 0 ? dot / lenSq : -1;

    let closestLat, closestLng;

    if (param < 0) {
      closestLat = lat1;
      closestLng = lng1;
    } else if (param > 1) {
      closestLat = lat2;
      closestLng = lng2;
    } else {
      closestLat = lat1 + param * C;
      closestLng = lng1 + param * D;
    }

    return this._haversineDistance(lat, lng, closestLat, closestLng);
  }

  _haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = this._toRadians(lat2 - lat1);
    const dLng = this._toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this._toRadians(lat1)) * Math.cos(this._toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  _toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  _calculateDistanceAlongRoute(signal, routeCoordinates) {
    let totalDistance = 0;
    let minDistance = Infinity;
    let distanceAtClosest = 0;

    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const segmentStart = routeCoordinates[i];
      const segmentEnd = routeCoordinates[i + 1];
      const segmentLength = this._haversineDistance(
        segmentStart[1], segmentStart[0],
        segmentEnd[1], segmentEnd[0]
      );

      const distanceToSegment = this._pointToSegmentDistance(signal.location, segmentStart, segmentEnd);

      if (distanceToSegment < minDistance) {
        minDistance = distanceToSegment;
        distanceAtClosest = totalDistance + segmentLength / 2; // Approximate midpoint
      }

      totalDistance += segmentLength;
    }

    return distanceAtClosest;
  }

  _estimateSignalsFromDistance(route) {
    const routeDistanceM = route.distance || 0;
    const estimatedSignalCount = Math.ceil(routeDistanceM / AVERAGE_SIGNAL_DISTANCE_M);
    const signals = [];

    for (let i = 0; i < estimatedSignalCount; i++) {
      const distanceFromStart = (i + 1) * AVERAGE_SIGNAL_DISTANCE_M;
      
      signals.push({
        signal_id: `EST-SIG-${String(i + 1).padStart(3, '0')}`,
        location: {
          lat: null,
          lng: null
        },
        distance_from_start_m: distanceFromStart,
        type: 'ESTIMATED',
        intersection_name: `Estimated Signal ${i + 1}`
      });
    }

    logger.info('Estimated signals from route distance', {
      route_distance_m: routeDistanceM,
      estimated_signals: estimatedSignalCount
    });

    return signals;
  }

  _calculateSignalTiming(signal, route, ambulanceSpeedKmh) {
    const distanceM = signal.distance_from_start_m;
    const speedMs = (ambulanceSpeedKmh * 1000) / 3600; // Convert km/h to m/s
    const etaSeconds = Math.round(distanceM / speedMs);
    
    const preemptAtSec = Math.max(0, etaSeconds - PREEMPTION_ADVANCE_TIME_SEC);
    const releaseAtSec = etaSeconds + SIGNAL_RELEASE_DELAY_SEC;

    return {
      signal_id: signal.signal_id,
      location: signal.location,
      intersection_name: signal.intersection_name || `Signal ${signal.signal_id}`,
      distance_from_start_m: distanceM,
      eta_seconds: etaSeconds,
      eta_timestamp: new Date(Date.now() + etaSeconds * 1000).toISOString(),
      preempt_at_seconds: preemptAtSec,
      preempt_at_timestamp: new Date(Date.now() + preemptAtSec * 1000).toISOString(),
      release_at_seconds: releaseAtSec,
      release_at_timestamp: new Date(Date.now() + releaseAtSec * 1000).toISOString(),
      status: 'PENDING'
    };
  }

  updateSignalStatus(signalTimings, ambulancePosition, currentTime = new Date()) {
    const currentTimestamp = currentTime.getTime();

    return signalTimings.map(signal => {
      const preemptTime = new Date(signal.preempt_at_timestamp).getTime();
      const etaTime = new Date(signal.eta_timestamp).getTime();
      const releaseTime = new Date(signal.release_at_timestamp).getTime();

      let status = 'PENDING';
      
      if (currentTimestamp >= releaseTime) {
        status = 'RELEASED';
      } else if (currentTimestamp >= etaTime) {
        status = 'PASSED';
      } else if (currentTimestamp >= preemptTime) {
        status = 'PREEMPTED';
      }

      return {
        ...signal,
        status
      };
    });
  }

  _loadSignalDatabase() {
    // Mock signal database (in production, load from actual traffic signal database)
    // This would typically be loaded from a city traffic management database
    return [
      {
        signal_id: 'SIG-001',
        location: { lat: 40.7580, lng: -73.9855 },
        intersection_name: 'Times Square',
        type: 'MAJOR_INTERSECTION'
      },
      {
        signal_id: 'SIG-002',
        location: { lat: 40.7489, lng: -73.9680 },
        intersection_name: 'Grand Central',
        type: 'MAJOR_INTERSECTION'
      },
      {
        signal_id: 'SIG-003',
        location: { lat: 40.7614, lng: -73.9776 },
        intersection_name: 'Central Park South',
        type: 'STANDARD'
      },
      // Add more signals as needed
    ];
  }

  addSignalToDatabase(signal) {
    this.signalDatabase.push(signal);
    logger.info('Signal added to database', { signal_id: signal.signal_id });
  }

  removeSignalFromDatabase(signal_id) {
    const index = this.signalDatabase.findIndex(s => s.signal_id === signal_id);
    if (index !== -1) {
      this.signalDatabase.splice(index, 1);
      logger.info('Signal removed from database', { signal_id });
      return true;
    }
    return false;
  }
}

module.exports = new SignalSequencer();
