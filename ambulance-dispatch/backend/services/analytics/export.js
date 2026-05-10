const db = require('../../api/config/database');

async function exportIncidentsToCSV(startDate, endDate) {
  const query = `
    SELECT 
      i.id,
      i.incident_type,
      i.severity,
      i.status,
      i.location_lat,
      i.location_lng,
      i.location_address,
      i.priority_score,
      i.patient_count,
      i.caller_name,
      i.caller_phone,
      i.description,
      i.created_at,
      i.acknowledged_at,
      i.dispatched_at,
      i.on_scene_at,
      i.transporting_at,
      i.at_hospital_at,
      i.resolved_at,
      EXTRACT(EPOCH FROM (i.acknowledged_at - i.created_at))::INTEGER as acknowledgment_seconds,
      EXTRACT(EPOCH FROM (i.dispatched_at - i.created_at))::INTEGER as dispatch_seconds,
      EXTRACT(EPOCH FROM (i.on_scene_at - i.dispatched_at))::INTEGER as response_seconds,
      EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))::INTEGER as total_seconds,
      EXTRACT(DOW FROM i.created_at) as day_of_week,
      EXTRACT(HOUR FROM i.created_at) as hour_of_day,
      a.vehicle_number as ambulance,
      h.name as hospital
    FROM incidents i
    LEFT JOIN assignments a ON i.id = a.incident_id
    LEFT JOIN hospitals h ON i.hospital_id = h.id
    WHERE i.created_at BETWEEN $1 AND $2
    ORDER BY i.created_at DESC
  `;

  const result = await db.query(query, [startDate, endDate]);
  
  if (result.rows.length === 0) {
    return {
      filename: 'incidents_export.csv',
      content: 'No data available for the specified period',
      rows: 0
    };
  }
  
  const headers = [
    'ID', 'Type', 'Severity', 'Status', 'Latitude', 'Longitude', 'Address',
    'Priority', 'Patients', 'Caller Name', 'Caller Phone', 'Description',
    'Created', 'Acknowledged', 'Dispatched', 'On Scene', 'Transporting', 
    'At Hospital', 'Resolved', 'Ack Time (s)', 'Dispatch Time (s)', 
    'Response Time (s)', 'Total Time (s)', 'Day of Week', 'Hour',
    'Ambulance', 'Hospital'
  ];
  
  let csv = headers.join(',') + '\n';
  
  result.rows.forEach(row => {
    const values = [
      row.id,
      row.incident_type,
      row.severity,
      row.status,
      row.location_lat,
      row.location_lng,
      escapeCsvValue(row.location_address),
      row.priority_score,
      row.patient_count,
      escapeCsvValue(row.caller_name),
      row.caller_phone || '',
      escapeCsvValue(row.description),
      row.created_at,
      row.acknowledged_at || '',
      row.dispatched_at || '',
      row.on_scene_at || '',
      row.transporting_at || '',
      row.at_hospital_at || '',
      row.resolved_at || '',
      row.acknowledgment_seconds || '',
      row.dispatch_seconds || '',
      row.response_seconds || '',
      row.total_seconds || '',
      row.day_of_week,
      row.hour_of_day,
      row.ambulance || '',
      escapeCsvValue(row.hospital)
    ];
    
    csv += values.join(',') + '\n';
  });
  
  return {
    filename: `incidents_${startDate}_to_${endDate}.csv`,
    content: csv,
    rows: result.rows.length
  };
}

async function exportResponseTimeReport(startDate, endDate) {
  const query = `
    WITH response_stats AS (
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        FLOOR(location_lat * 100) / 100 as zone_lat,
        FLOOR(location_lng * 100) / 100 as zone_lng,
        severity,
        incident_type,
        COUNT(*) as incident_count,
        AVG(EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as avg_response_seconds,
        MIN(EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as min_response_seconds,
        MAX(EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as max_response_seconds,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as median_response_seconds,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)))::INTEGER as p90_response_seconds,
        COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)) <= 480) as within_8min,
        COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (on_scene_at - dispatched_at)) <= 900) as within_15min
      FROM incidents
      WHERE 
        created_at BETWEEN $1 AND $2
        AND on_scene_at IS NOT NULL
        AND dispatched_at IS NOT NULL
      GROUP BY date, zone_lat, zone_lng, severity, incident_type
      ORDER BY date DESC, incident_count DESC
    )
    SELECT 
      *,
      ROUND((within_8min::DECIMAL / NULLIF(incident_count, 0)) * 100, 2) as percent_within_8min,
      ROUND((within_15min::DECIMAL / NULLIF(incident_count, 0)) * 100, 2) as percent_within_15min
    FROM response_stats
  `;

  const result = await db.query(query, [startDate, endDate]);
  
  const headers = [
    'Date', 'Zone Lat', 'Zone Lng', 'Severity', 'Type', 'Incidents',
    'Avg Response (s)', 'Min Response (s)', 'Max Response (s)',
    'Median Response (s)', 'P90 Response (s)', 'Within 8min',
    'Within 15min', '% Within 8min', '% Within 15min'
  ];
  
  let csv = headers.join(',') + '\n';
  
  result.rows.forEach(row => {
    const values = [
      row.date,
      row.zone_lat,
      row.zone_lng,
      row.severity,
      row.incident_type,
      row.incident_count,
      row.avg_response_seconds || '',
      row.min_response_seconds || '',
      row.max_response_seconds || '',
      row.median_response_seconds || '',
      row.p90_response_seconds || '',
      row.within_8min,
      row.within_15min,
      row.percent_within_8min || '',
      row.percent_within_15min || ''
    ];
    
    csv += values.join(',') + '\n';
  });
  
  return {
    filename: `response_times_${startDate}_to_${endDate}.csv`,
    content: csv,
    rows: result.rows.length
  };
}

async function exportUtilizationReport(startDate, endDate) {
  const query = `
    WITH ambulance_activity AS (
      SELECT 
        a.id,
        a.call_sign,
        a.type,
        a.base_station,
        COUNT(DISTINCT ass.incident_id) as incidents_handled,
        SUM(EXTRACT(EPOCH FROM (
          COALESCE(ass.completed_at, NOW()) - ass.created_at
        ))) as total_active_seconds,
        MIN(ass.created_at) as first_assignment,
        MAX(COALESCE(ass.completed_at, NOW())) as last_activity,
        EXTRACT(EPOCH FROM ($2 - $1)) as period_seconds
      FROM ambulances a
      LEFT JOIN assignments ass ON a.id = ass.ambulance_id 
        AND ass.created_at BETWEEN $1 AND $2
      WHERE a.deleted_at IS NULL
      GROUP BY a.id, a.call_sign, a.type, a.base_station
    ),
    status_changes AS (
      SELECT 
        ambulance_id,
        COUNT(*) FILTER (WHERE new_status = 'AVAILABLE') as times_available,
        COUNT(*) FILTER (WHERE new_status = 'DISPATCHED') as times_dispatched,
        COUNT(*) FILTER (WHERE new_status = 'BUSY') as times_busy,
        COUNT(*) FILTER (WHERE new_status = 'OFFLINE') as times_offline
      FROM ambulance_status_history
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY ambulance_id
    )
    SELECT 
      aa.*,
      ROUND((aa.total_active_seconds / NULLIF(aa.period_seconds, 0)) * 100, 2) as utilization_percentage,
      ROUND(aa.total_active_seconds / 3600, 2) as total_active_hours,
      ROUND(aa.period_seconds / 3600, 2) as period_hours,
      ROUND(aa.total_active_seconds / NULLIF(aa.incidents_handled, 0), 0) as avg_seconds_per_incident,
      sc.times_available,
      sc.times_dispatched,
      sc.times_busy,
      sc.times_offline
    FROM ambulance_activity aa
    LEFT JOIN status_changes sc ON aa.id = sc.ambulance_id
    ORDER BY aa.incidents_handled DESC, aa.utilization_percentage DESC
  `;

  const result = await db.query(query, [startDate, endDate]);
  
  const headers = [
    'Ambulance ID', 'Call Sign', 'Type', 'Base Station', 'Incidents Handled',
    'Utilization %', 'Active Hours', 'Period Hours', 'Avg Seconds/Incident',
    'Times Available', 'Times Dispatched', 'Times Busy', 'Times Offline',
    'First Assignment', 'Last Activity'
  ];
  
  let csv = headers.join(',') + '\n';
  
  result.rows.forEach(row => {
    const values = [
      row.id,
      row.call_sign,
      row.type,
      escapeCsvValue(row.base_station),
      row.incidents_handled || 0,
      row.utilization_percentage || 0,
      row.total_active_hours || 0,
      row.period_hours || 0,
      row.avg_seconds_per_incident || '',
      row.times_available || 0,
      row.times_dispatched || 0,
      row.times_busy || 0,
      row.times_offline || 0,
      row.first_assignment || '',
      row.last_activity || ''
    ];
    
    csv += values.join(',') + '\n';
  });
  
  return {
    filename: `utilization_${startDate}_to_${endDate}.csv`,
    content: csv,
    rows: result.rows.length
  };
}

async function exportHotspotsToCSV(hotspots, gridSizeKm) {
  const headers = [
    'Grid Lat', 'Grid Lng', 'Center Lat', 'Center Lng', 'Incident Count',
    'Incidents/Day', 'Risk Level', 'Critical Count', 'High Count',
    'Primary Type', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
    'MEDICAL', 'ACCIDENT', 'CARDIAC', 'STROKE', 'TRAUMA', 'MATERNITY', 'OTHER'
  ];
  
  let csv = headers.join(',') + '\n';
  
  hotspots.forEach(h => {
    const values = [
      h.grid_lat,
      h.grid_lng,
      h.center_lat,
      h.center_lng,
      h.incident_count,
      h.incidents_per_day,
      h.risk_level,
      h.critical_count,
      h.high_count,
      h.primary_incident_type,
      h.severity_breakdown.CRITICAL,
      h.severity_breakdown.HIGH,
      h.severity_breakdown.MEDIUM,
      h.severity_breakdown.LOW,
      h.type_breakdown.MEDICAL,
      h.type_breakdown.ACCIDENT,
      h.type_breakdown.CARDIAC,
      h.type_breakdown.STROKE,
      h.type_breakdown.TRAUMA,
      h.type_breakdown.MATERNITY,
      h.type_breakdown.OTHER
    ];
    
    csv += values.join(',') + '\n';
  });
  
  return {
    filename: `hotspots_${gridSizeKm}km_grid.csv`,
    content: csv,
    rows: hotspots.length
  };
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function generateReportSummary(data, reportType) {
  const summary = {
    report_type: reportType,
    generated_at: new Date().toISOString(),
    record_count: data.rows || data.length || 0
  };
  
  switch (reportType) {
    case 'incidents':
      summary.metrics = {
        total_incidents: data.rows || 0,
        date_range: data.filename
      };
      break;
    case 'response_times':
      summary.metrics = {
        total_records: data.rows || 0
      };
      break;
    case 'utilization':
      summary.metrics = {
        ambulances_tracked: data.rows || 0
      };
      break;
  }
  
  return summary;
}

module.exports = {
  exportIncidentsToCSV,
  exportResponseTimeReport,
  exportUtilizationReport,
  exportHotspotsToCSV,
  generateReportSummary
};
