const { getGridCell } = require('./hotspots');

const HIGH_DEMAND_PERIODS = {
  MORNING_RUSH: { start: 7, end: 10, name: 'Morning Rush' },
  MIDDAY: { start: 11, end: 14, name: 'Midday' },
  EVENING_RUSH: { start: 17, end: 20, name: 'Evening Rush' },
  NIGHT: { start: 22, end: 2, name: 'Night/Weekend' }
};

const HIGH_DEMAND_ZONE_TYPES = {
  HIGHWAY: 'Highway Corridor',
  RESIDENTIAL: 'Dense Residential',
  COMMERCIAL: 'Commercial Zone',
  SCHOOL: 'School/College Area',
  HOSPITAL: 'Near Hospital',
  ENTERTAINMENT: 'Entertainment District'
};

function getTimeOfDayPeriod(hour) {
  if (hour >= 7 && hour < 10) return 'MORNING_RUSH';
  if (hour >= 11 && hour < 14) return 'MIDDAY';
  if (hour >= 17 && hour < 20) return 'EVENING_RUSH';
  if (hour >= 22 || hour < 2) return 'NIGHT';
  return 'OTHER';
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHighDemandTime(date) {
  const hour = date.getHours();
  const dayOfWeek = date.getDay();
  
  if ((dayOfWeek === 5 || dayOfWeek === 6) && hour >= 22) return true;
  if (dayOfWeek === 0 && hour < 2) return true;
  
  if (hour >= 7 && hour < 10) return true;
  if (hour >= 17 && hour < 20) return true;
  
  return false;
}

function analyzeHistoricalPatterns(incidents) {
  const patterns = {
    by_hour: {},
    by_day_of_week: {},
    by_hour_and_day: {},
    by_zone: {}
  };
  
  for (let i = 0; i < 24; i++) {
    patterns.by_hour[i] = { count: 0, avg_severity: 0, incidents: [] };
  }
  
  for (let i = 0; i < 7; i++) {
    patterns.by_day_of_week[i] = { count: 0, avg_severity: 0, incidents: [] };
  }
  
  incidents.forEach(incident => {
    const date = new Date(incident.created_at);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const key = `${dayOfWeek}-${hour}`;
    
    patterns.by_hour[hour].count++;
    patterns.by_hour[hour].incidents.push(incident);
    
    patterns.by_day_of_week[dayOfWeek].count++;
    patterns.by_day_of_week[dayOfWeek].incidents.push(incident);
    
    if (!patterns.by_hour_and_day[key]) {
      patterns.by_hour_and_day[key] = { count: 0, incidents: [], hour, dayOfWeek };
    }
    patterns.by_hour_and_day[key].count++;
    patterns.by_hour_and_day[key].incidents.push(incident);
    
    if (incident.location_lat && incident.location_lng) {
      const cell = getGridCell(incident.location_lat, incident.location_lng, 1);
      if (!patterns.by_zone[cell.key]) {
        patterns.by_zone[cell.key] = { 
          count: 0, 
          lat: cell.center_lat, 
          lng: cell.center_lng,
          incidents: [] 
        };
      }
      patterns.by_zone[cell.key].count++;
      patterns.by_zone[cell.key].incidents.push(incident);
    }
  });
  
  return patterns;
}

function forecastDemand(historicalIncidents, targetDate, timeOfDay = null) {
  const patterns = analyzeHistoricalPatterns(historicalIncidents);
  
  const targetDayOfWeek = targetDate.getDay();
  const targetHour = timeOfDay !== null ? timeOfDay : targetDate.getHours();
  const isTargetWeekend = isWeekend(targetDate);
  
  const hourPattern = patterns.by_hour[targetHour];
  const dayPattern = patterns.by_day_of_week[targetDayOfWeek];
  const combinedKey = `${targetDayOfWeek}-${targetHour}`;
  const combinedPattern = patterns.by_hour_and_day[combinedKey] || { count: 0 };
  
  const totalIncidents = historicalIncidents.length;
  const totalDays = Math.max(1, (
    new Date(Math.max(...historicalIncidents.map(i => new Date(i.created_at)))) -
    new Date(Math.min(...historicalIncidents.map(i => new Date(i.created_at))))
  ) / (1000 * 60 * 60 * 24));
  
  const avgIncidentsPerDay = totalIncidents / totalDays;
  const avgIncidentsPerHour = totalIncidents / (totalDays * 24);
  
  let predictedIncidents = combinedPattern.count > 0 
    ? Math.round(combinedPattern.count / (totalDays / 7))
    : Math.round(avgIncidentsPerHour * 1.2);
  
  if (isHighDemandTime(targetDate)) {
    predictedIncidents = Math.round(predictedIncidents * 1.3);
  }
  
  if (isTargetWeekend && targetHour >= 22) {
    predictedIncidents = Math.round(predictedIncidents * 1.5);
  }
  
  const highDemandZones = Object.entries(patterns.by_zone)
    .map(([key, data]) => ({
      zone_key: key,
      lat: data.lat,
      lng: data.lng,
      historical_count: data.count,
      predicted_incidents: Math.round(data.count / totalDays),
      risk_level: data.count / totalDays >= 3 ? 'HIGH' : data.count / totalDays >= 1 ? 'MEDIUM' : 'LOW'
    }))
    .sort((a, b) => b.predicted_incidents - a.predicted_incidents)
    .slice(0, 10);
  
  return {
    target_date: targetDate.toISOString(),
    target_hour: targetHour,
    day_of_week: targetDayOfWeek,
    is_weekend: isTargetWeekend,
    is_high_demand_period: isHighDemandTime(targetDate),
    predicted_incidents,
    confidence: combinedPattern.count > 10 ? 'HIGH' : combinedPattern.count > 5 ? 'MEDIUM' : 'LOW',
    high_demand_zones: highDemandZones,
    period_info: HIGH_DEMAND_PERIODS[getTimeOfDayPeriod(targetHour)],
    recommendations: generateRecommendations(predictedIncidents, highDemandZones, targetDate)
  };
}

function generateRecommendations(predictedIncidents, highDemandZones, targetDate) {
  const recommendations = [];
  
  if (isHighDemandTime(targetDate)) {
    recommendations.push({
      type: 'STAFFING',
      priority: 'HIGH',
      message: `High demand period predicted. Ensure ${Math.ceil(predictedIncidents / 3)} ambulances are available.`
    });
  }
  
  if (isWeekend(targetDate) && targetDate.getHours() >= 22) {
    recommendations.push({
      type: 'SURGE_PREP',
      priority: 'HIGH',
      message: 'Weekend night surge expected. Consider activating mutual aid agreements.'
    });
  }
  
  highDemandZones.slice(0, 3).forEach((zone, idx) => {
    if (zone.risk_level === 'HIGH') {
      recommendations.push({
        type: 'POSITIONING',
        priority: 'MEDIUM',
        message: `Pre-position ambulance near zone (${zone.lat.toFixed(4)}, ${zone.lng.toFixed(4)}). Expected ${zone.predicted_incidents} incidents.`,
        zone: zone
      });
    }
  });
  
  if (predictedIncidents > 15) {
    recommendations.push({
      type: 'RESOURCE',
      priority: 'HIGH',
      message: `Very high demand predicted (${predictedIncidents} incidents). Consider bringing offline units online.`
    });
  }
  
  return recommendations;
}

function getHighDemandPeriods() {
  return HIGH_DEMAND_PERIODS;
}

function getHighDemandZones() {
  return HIGH_DEMAND_ZONE_TYPES;
}

function predictSurge(events = [], forecastData) {
  const surgePredictions = [];
  
  events.forEach(event => {
    const eventDate = new Date(event.date);
    const hoursUntilEvent = (eventDate - new Date()) / (1000 * 60 * 60);
    
    if (hoursUntilEvent > 0 && hoursUntilEvent < 48) {
      const expectedAttendees = event.expected_attendees || 0;
      const surgeMultiplier = Math.min(3, 1 + (expectedAttendees / 10000));
      
      surgePredictions.push({
        event_name: event.name,
        event_date: event.date,
        location: event.location,
        hours_until_event: Math.round(hoursUntilEvent),
        expected_attendees: expectedAttendees,
        surge_multiplier: surgeMultiplier,
        recommended_ambulances: Math.ceil(surgeMultiplier * 2),
        priority: hoursUntilEvent < 24 ? 'HIGH' : 'MEDIUM',
        alert_message: `Event "${event.name}" in ${Math.round(hoursUntilEvent)}h. Deploy ${Math.ceil(surgeMultiplier * 2)} additional units.`
      });
    }
  });
  
  return surgePredictions;
}

module.exports = {
  forecastDemand,
  getHighDemandPeriods,
  getHighDemandZones,
  isHighDemandTime,
  analyzeHistoricalPatterns,
  predictSurge,
  getTimeOfDayPeriod
};
