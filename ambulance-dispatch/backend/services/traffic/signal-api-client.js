const axios = require('axios');
const logger = require('../../api/utils/logger');

class TrafficSignalAPIClient {
  constructor(baseURL = process.env.TRAFFIC_API_URL || 'http://mock-traffic-api:8080') {
    this.baseURL = baseURL;
    this.isMockMode = process.env.TRAFFIC_API_MOCK === 'true' || !process.env.TRAFFIC_API_URL;
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TRAFFIC_API_KEY || 'mock-api-key'
      }
    });
  }

  async activateCorridor(corridorData) {
    const { corridor_id, ambulance_id, route, duration_minutes, priority } = corridorData;

    if (this.isMockMode) {
      return this._mockActivateCorridor(corridorData);
    }

    try {
      const response = await this.client.post('/api/v1/corridor/activate', {
        corridor_id,
        ambulance_id,
        route_coordinates: route.coordinates,
        waypoints: route.waypoints,
        duration_minutes,
        priority,
        timestamp: new Date().toISOString()
      });

      logger.info('Traffic corridor activated', {
        corridor_id,
        ambulance_id,
        signals_affected: response.data.signals_affected
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to activate traffic corridor', {
        corridor_id,
        error: error.message
      });
      
      // Fallback to mock on API failure
      logger.warn('Falling back to mock corridor activation');
      return this._mockActivateCorridor(corridorData);
    }
  }

  async deactivateCorridor(corridor_id, reason = 'COMPLETED') {
    if (this.isMockMode) {
      return this._mockDeactivateCorridor(corridor_id, reason);
    }

    try {
      const response = await this.client.post('/api/v1/corridor/deactivate', {
        corridor_id,
        reason,
        timestamp: new Date().toISOString()
      });

      logger.info('Traffic corridor deactivated', { corridor_id, reason });
      return response.data;
    } catch (error) {
      logger.error('Failed to deactivate traffic corridor', {
        corridor_id,
        error: error.message
      });
      return this._mockDeactivateCorridor(corridor_id, reason);
    }
  }

  async updateSignalPreemption(corridor_id, signals) {
    if (this.isMockMode) {
      return this._mockUpdateSignals(corridor_id, signals);
    }

    try {
      const response = await this.client.post('/api/v1/signals/preempt', {
        corridor_id,
        signals,
        timestamp: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to update signal preemption', {
        corridor_id,
        error: error.message
      });
      return this._mockUpdateSignals(corridor_id, signals);
    }
  }

  async getCorridorStatus(corridor_id) {
    if (this.isMockMode) {
      return this._mockGetStatus(corridor_id);
    }

    try {
      const response = await this.client.get(`/api/v1/corridor/${corridor_id}/status`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get corridor status', {
        corridor_id,
        error: error.message
      });
      return this._mockGetStatus(corridor_id);
    }
  }

  _mockActivateCorridor(corridorData) {
    const { corridor_id, ambulance_id, route, duration_minutes } = corridorData;
    
    // Calculate mock metrics
    const route_length_km = route.distance / 1000;
    const signals_affected = Math.ceil(route_length_km / 0.7); // ~1 signal per 700m
    const base_time_savings = signals_affected * 25; // 25 seconds per signal
    const time_savings_variation = Math.random() * 0.3 - 0.15; // ±15%
    const estimated_time_savings_sec = Math.round(base_time_savings * (1 + time_savings_variation));

    // Simulate occasional failures (5% chance)
    const success = Math.random() > 0.05;

    if (!success) {
      logger.warn('Mock API simulated failure for corridor activation', { corridor_id });
      throw new Error('Traffic management system temporarily unavailable');
    }

    const response = {
      corridor_id,
      ambulance_id,
      status: 'ACTIVATED',
      route_length_km: parseFloat(route_length_km.toFixed(2)),
      signals_affected,
      estimated_time_savings_sec,
      activation_time: new Date().toISOString(),
      expires_at: new Date(Date.now() + duration_minutes * 60 * 1000).toISOString(),
      signal_sequence: this._generateMockSignalSequence(route, signals_affected)
    };

    logger.info('[MOCK] Traffic corridor activated', response);
    return response;
  }

  _mockDeactivateCorridor(corridor_id, reason) {
    const response = {
      corridor_id,
      status: 'DEACTIVATED',
      reason,
      deactivated_at: new Date().toISOString(),
      total_duration_sec: Math.floor(Math.random() * 600) + 300, // 5-15 minutes
      signals_cleared: Math.floor(Math.random() * 15) + 5
    };

    logger.info('[MOCK] Traffic corridor deactivated', response);
    return response;
  }

  _mockUpdateSignals(corridor_id, signals) {
    const response = {
      corridor_id,
      signals_updated: signals.length,
      success_count: signals.length - Math.floor(Math.random() * 2), // Maybe 1-2 failures
      updated_at: new Date().toISOString()
    };

    logger.info('[MOCK] Signal preemption updated', response);
    return response;
  }

  _mockGetStatus(corridor_id) {
    const response = {
      corridor_id,
      status: 'ACTIVE',
      current_position: {
        lat: 40.7128 + Math.random() * 0.01,
        lng: -74.0060 + Math.random() * 0.01
      },
      next_signal_eta_sec: Math.floor(Math.random() * 120) + 30,
      signals_passed: Math.floor(Math.random() * 8),
      signals_remaining: Math.floor(Math.random() * 6) + 2,
      time_saved_so_far_sec: Math.floor(Math.random() * 180) + 60
    };

    return response;
  }

  _generateMockSignalSequence(route, signalCount) {
    const signals = [];
    const segmentLength = route.distance / signalCount;

    for (let i = 0; i < signalCount; i++) {
      const distance_from_start = segmentLength * i;
      const eta_seconds = Math.round((distance_from_start / route.distance) * route.duration);

      signals.push({
        signal_id: `SIG-${String(i + 1).padStart(3, '0')}`,
        location: {
          lat: 40.7128 + (Math.random() * 0.05),
          lng: -74.0060 + (Math.random() * 0.05)
        },
        distance_from_start_m: Math.round(distance_from_start),
        eta_seconds,
        preemption_status: 'PENDING',
        preempt_at: new Date(Date.now() + (eta_seconds - 120) * 1000).toISOString() // 2 min before
      });
    }

    return signals;
  }

  async healthCheck() {
    if (this.isMockMode) {
      return { status: 'healthy', mode: 'mock', timestamp: new Date().toISOString() };
    }

    try {
      const response = await this.client.get('/health');
      return { status: 'healthy', mode: 'live', ...response.data };
    } catch (error) {
      return { status: 'unhealthy', mode: 'live', error: error.message };
    }
  }
}

module.exports = new TrafficSignalAPIClient();
