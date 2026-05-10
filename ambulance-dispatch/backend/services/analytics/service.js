const db = require('../../api/config/database');
const { calculateHotspots, getIncidentsByGrid } = require('./hotspots');
const { forecastDemand, getHighDemandPeriods, getHighDemandZones } = require('./forecasting');
const { suggestRepositioning, calculateCoverageGaps } = require('./repositioning');
const { exportIncidentsToCSV, exportResponseTimeReport, exportUtilizationReport } = require('./export');

class AnalyticsService {
  async collectIncidentData(startDate, endDate) {
    const query = `
      SELECT 
        i.id,
        i.incident_type,
        i.severity,
        i.location_lat,
        i.location_lng,
        i.location_address,
        i.created_at,
        i.resolved_at,
        i.status,
        i.priority_score,
        EXTRACT(DOW FROM i.created_at) as day_of_week,
        EXTRACT(HOUR FROM i.created_at) as hour_of_day,
        EXTRACT(EPOCH FROM (i.acknowledged_at - i.created_at))::INTEGER as acknowledgment_time_seconds,
        EXTRACT(EPOCH FROM (i.dispatched_at - i.created_at))::INTEGER as dispatch_time_seconds,
        EXTRACT(EPOCH FROM (i.on_scene_at - i.dispatched_at))::INTEGER as response_time_seconds,
        EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))::INTEGER as total_time_seconds,
        a.ambulance_id,
        a.vehicle_number as ambulance_vehicle_number,
        h.id as hospital_id,
        h.name as hospital_name
      FROM incidents i
      LEFT JOIN assignments a ON i.id = a.incident_id
      LEFT JOIN hospitals h ON i.hospital_id = h.id
      WHERE i.created_at BETWEEN $1 AND $2
      ORDER BY i.created_at DESC
    `;

    const result = await db.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getResponseTimesByZone(startDate, endDate) {
    const query = `
      SELECT 
        FLOOR(location_lat * 100) / 100 as zone_lat,
        FLOOR(location_lng * 100) / 100 as zone_lng,
        COUNT(*) as incident_count,
        AVG(EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as avg_response_time_seconds,
        MIN(EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as min_response_time_seconds,
        MAX(EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as max_response_time_seconds,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as median_response_time_seconds
      FROM incidents
      WHERE 
        created_at BETWEEN $1 AND $2
        AND on_scene_at IS NOT NULL
        AND dispatched_at IS NOT NULL
      GROUP BY zone_lat, zone_lng
      HAVING COUNT(*) >= 3
      ORDER BY incident_count DESC
    `;

    const result = await db.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getAmbulanceUtilization(startDate, endDate) {
    const query = `
      WITH ambulance_stats AS (
        SELECT 
          a.id as ambulance_id,
          a.call_sign,
          a.type,
          COUNT(DISTINCT ass.incident_id) as incidents_handled,
          SUM(EXTRACT(EPOCH FROM (
            COALESCE(ass.completed_at, NOW()) - ass.created_at
          ))) as total_active_seconds,
          EXTRACT(EPOCH FROM ($2 - $1)) as period_seconds
        FROM ambulances a
        LEFT JOIN assignments ass ON a.id = ass.ambulance_id 
          AND ass.created_at BETWEEN $1 AND $2
        GROUP BY a.id, a.call_sign, a.type
      )
      SELECT 
        ambulance_id,
        call_sign,
        type,
        incidents_handled,
        ROUND((total_active_seconds / NULLIF(period_seconds, 0)) * 100, 2) as utilization_percentage,
        ROUND(total_active_seconds / 3600, 2) as total_active_hours,
        ROUND(period_seconds / 3600, 2) as period_hours
      FROM ambulance_stats
      ORDER BY utilization_percentage DESC
    `;

    const result = await db.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getIncidentTrends(period = '30d') {
    const interval = period.replace('d', ' days').replace('h', ' hours');
    
    const query = `
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as incident_count,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_count,
        COUNT(*) FILTER (WHERE severity = 'HIGH') as high_count,
        COUNT(*) FILTER (WHERE severity = 'MEDIUM') as medium_count,
        COUNT(*) FILTER (WHERE severity = 'LOW') as low_count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::INTEGER as avg_total_time_seconds
      FROM incidents
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `;

    const result = await db.query(query);
    return result.rows;
  }

  async getIncidentsByTimeOfDay(startDate, endDate) {
    const query = `
      SELECT 
        EXTRACT(HOUR FROM created_at)::INTEGER as hour,
        EXTRACT(DOW FROM created_at)::INTEGER as day_of_week,
        COUNT(*) as incident_count,
        AVG(priority_score) as avg_priority
      FROM incidents
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY hour, day_of_week
      ORDER BY hour, day_of_week
    `;

    const result = await db.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getHospitalLoadDistribution(startDate, endDate) {
    const query = `
      SELECT 
        h.id,
        h.name,
        h.address,
        COUNT(i.id) as patients_received,
        COUNT(i.id) FILTER (WHERE i.severity = 'CRITICAL') as critical_patients,
        AVG(EXTRACT(EPOCH FROM (i.at_hospital_at - i.on_scene_at)))::INTEGER as avg_transport_time_seconds,
        h.capacity_total,
        h.capacity_available
      FROM hospitals h
      LEFT JOIN incidents i ON h.id = i.hospital_id 
        AND i.created_at BETWEEN $1 AND $2
      GROUP BY h.id, h.name, h.address, h.capacity_total, h.capacity_available
      ORDER BY patients_received DESC
    `;

    const result = await db.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getDashboard(startDate, endDate) {
    const [
      incidents,
      responseTimes,
      utilization,
      trends,
      timeOfDay,
      hospitalLoad,
      hotspots,
      demandForecast,
      repositioningSuggestions
    ] = await Promise.all([
      this.collectIncidentData(startDate, endDate),
      this.getResponseTimesByZone(startDate, endDate),
      this.getAmbulanceUtilization(startDate, endDate),
      this.getIncidentTrends('30d'),
      this.getIncidentsByTimeOfDay(startDate, endDate),
      this.getHospitalLoadDistribution(startDate, endDate),
      this.getHotspots(1), // 1km grid
      this.getForecast(new Date()),
      this.getRepositioningSuggestions()
    ]);

    return {
      summary: {
        total_incidents: incidents.length,
        avg_response_time: this._calculateAvgResponseTime(incidents),
        avg_utilization: this._calculateAvgUtilization(utilization),
        active_ambulances: utilization.length
      },
      incidents,
      response_times: responseTimes,
      utilization,
      trends,
      time_of_day: timeOfDay,
      hospital_load: hospitalLoad,
      hotspots,
      demand_forecast: demandForecast,
      repositioning_suggestions: repositioningSuggestions
    };
  }

  async getHotspots(gridSizeKm = 1) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const incidents = await this.collectIncidentData(startDate, endDate);
    const hotspots = calculateHotspots(incidents, gridSizeKm);
    
    return {
      grid_size_km: gridSizeKm,
      analysis_period_days: 30,
      hotspots: hotspots.slice(0, 10),
      total_zones: hotspots.length
    };
  }

  async getForecast(targetDate, timeOfDay = null) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const historicalData = await this.collectIncidentData(startDate, endDate);
    const forecast = forecastDemand(historicalData, targetDate, timeOfDay);

    return forecast;
  }

  async getRepositioningSuggestions() {
    const ambulances = await this._getCurrentAmbulancePositions();
    const hotspots = await this.getHotspots(1);
    const forecast = await this.getForecast(new Date());

    const suggestions = suggestRepositioning(
      ambulances,
      hotspots.hotspots,
      forecast.high_demand_zones
    );

    return suggestions;
  }

  async _getCurrentAmbulancePositions() {
    const query = `
      SELECT 
        id,
        call_sign,
        type,
        status,
        latitude,
        longitude,
        base_station
      FROM ambulances
      WHERE deleted_at IS NULL
      AND status IN ('AVAILABLE', 'DISPATCHED', 'BUSY')
    `;

    const result = await db.query(query);
    return result.rows;
  }

  _calculateAvgResponseTime(incidents) {
    const withResponseTime = incidents.filter(i => i.response_time_seconds);
    if (withResponseTime.length === 0) return null;
    
    const sum = withResponseTime.reduce((acc, i) => acc + i.response_time_seconds, 0);
    return Math.round(sum / withResponseTime.length);
  }

  _calculateAvgUtilization(utilization) {
    if (utilization.length === 0) return 0;
    
    const sum = utilization.reduce((acc, u) => acc + (u.utilization_percentage || 0), 0);
    return Math.round(sum / utilization.length * 100) / 100;
  }

  async exportData(type, startDate, endDate, format = 'csv') {
    switch (type) {
      case 'incidents':
        return await exportIncidentsToCSV(startDate, endDate);
      case 'response-times':
        return await exportResponseTimeReport(startDate, endDate);
      case 'utilization':
        return await exportUtilizationReport(startDate, endDate);
      default:
        throw new Error(`Unknown export type: ${type}`);
    }
  }
}

module.exports = new AnalyticsService();
