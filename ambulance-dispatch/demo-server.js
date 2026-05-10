const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// Demo data
const incidents = [
  {
    id: 'inc-001',
    incident_type: 'CARDIAC',
    severity: 'CRITICAL',
    status: 'PENDING',
    location_lat: 28.6139,
    location_lng: 77.2090,
    location_address: 'Connaught Place, New Delhi',
    caller_phone: '+91-9876543210',
    created_at: new Date().toISOString()
  },
  {
    id: 'inc-002',
    incident_type: 'ACCIDENT',
    severity: 'HIGH',
    status: 'DISPATCHED',
    location_lat: 28.5355,
    location_lng: 77.3910,
    location_address: 'Sector 18, Noida',
    caller_phone: '+91-9876543211',
    created_at: new Date(Date.now() - 600000).toISOString()
  },
  {
    id: 'inc-003',
    incident_type: 'MEDICAL',
    severity: 'MEDIUM',
    status: 'EN_ROUTE',
    location_lat: 28.4595,
    location_lng: 77.0266,
    location_address: 'DLF Cyber City, Gurugram',
    caller_phone: '+91-9876543212',
    created_at: new Date(Date.now() - 1200000).toISOString()
  }
];

const ambulances = [
  {
    id: 'amb-001',
    call_sign: 'DELHI-ALS-01',
    vehicle_number: 'DL01AB1234',
    type: 'ALS',
    status: 'AVAILABLE',
    latitude: 28.6280,
    longitude: 77.2190,
    crew: ['Dr. Sharma', 'Paramedic Raj']
  },
  {
    id: 'amb-002',
    call_sign: 'DELHI-BLS-05',
    vehicle_number: 'DL01CD5678',
    type: 'BLS',
    status: 'ON_CALL',
    latitude: 28.5400,
    longitude: 77.3850,
    crew: ['EMT Singh', 'Driver Kumar']
  },
  {
    id: 'amb-003',
    call_sign: 'NOIDA-ALS-02',
    vehicle_number: 'UP16EF9012',
    type: 'ALS',
    status: 'AVAILABLE',
    latitude: 28.5700,
    longitude: 77.3200,
    crew: ['Dr. Gupta', 'Paramedic Rani']
  },
  {
    id: 'amb-004',
    call_sign: 'GGN-BLS-03',
    vehicle_number: 'HR26GH3456',
    type: 'BLS',
    status: 'AVAILABLE',
    latitude: 28.4700,
    longitude: 77.0400,
    crew: ['EMT Verma', 'Driver Pal']
  }
];

const hospitals = [
  {
    id: 'hosp-001',
    name: 'AIIMS Delhi',
    latitude: 28.5672,
    longitude: 77.2100,
    total_beds: 500,
    available_beds: 45,
    icu_beds_total: 50,
    icu_beds_available: 8,
    specialties: ['CARDIAC', 'TRAUMA', 'NEURO', 'GENERAL'],
    trauma_center: true
  },
  {
    id: 'hosp-002',
    name: 'Fortis Hospital Noida',
    latitude: 28.5685,
    longitude: 77.3262,
    total_beds: 300,
    available_beds: 32,
    icu_beds_total: 30,
    icu_beds_available: 5,
    specialties: ['CARDIAC', 'MATERNITY', 'GENERAL'],
    trauma_center: false
  },
  {
    id: 'hosp-003',
    name: 'Max Super Speciality Saket',
    latitude: 28.5278,
    longitude: 77.2149,
    total_beds: 400,
    available_beds: 28,
    icu_beds_total: 40,
    icu_beds_available: 6,
    specialties: ['CARDIAC', 'TRAUMA', 'NEURO', 'MATERNITY'],
    trauma_center: true
  },
  {
    id: 'hosp-004',
    name: 'Medanta Hospital Gurugram',
    latitude: 28.4400,
    longitude: 77.0420,
    total_beds: 600,
    available_beds: 55,
    icu_beds_total: 60,
    icu_beds_available: 12,
    specialties: ['CARDIAC', 'TRAUMA', 'NEURO', 'GENERAL'],
    trauma_center: true
  }
];

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    res.json({
      token: 'demo-jwt-token-' + Date.now(),
      user: {
        id: 'user-001',
        email,
        name: 'Demo Dispatcher',
        role: 'DISPATCHER'
      }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({
    id: 'user-001',
    email: 'dispatcher@demo.com',
    name: 'Demo Dispatcher',
    role: 'DISPATCHER'
  });
});

// Incidents endpoints
app.get('/api/incidents', (req, res) => {
  res.json({ incidents, total: incidents.length });
});

app.get('/api/incidents/:id', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (incident) {
    res.json(incident);
  } else {
    res.status(404).json({ message: 'Incident not found' });
  }
});

app.post('/api/incidents', (req, res) => {
  const newIncident = {
    id: 'inc-' + Date.now(),
    ...req.body,
    status: 'PENDING',
    created_at: new Date().toISOString()
  };
  incidents.unshift(newIncident);
  io.emit('incident:created', newIncident);
  res.status(201).json({ incident: newIncident });
});

app.post('/api/incidents/:id/acknowledge', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (incident) {
    incident.status = 'ACKNOWLEDGED';
    incident.acknowledged_at = new Date().toISOString();
    io.emit('incident:updated', incident);
    res.json(incident);
  } else {
    res.status(404).json({ message: 'Incident not found' });
  }
});

// Ambulances endpoints
app.get('/api/ambulances', (req, res) => {
  res.json({ ambulances, total: ambulances.length });
});

app.get('/api/ambulances/available', (req, res) => {
  const available = ambulances
    .filter(a => a.status === 'AVAILABLE')
    .map(a => ({
      ...a,
      distance: Math.random() * 5000 + 1000,
      eta_minutes: Math.floor(Math.random() * 10) + 3
    }))
    .sort((a, b) => a.eta_minutes - b.eta_minutes);
  res.json({ ambulances: available });
});

// Hospitals endpoints
app.get('/api/hospitals', (req, res) => {
  res.json({ hospitals, total: hospitals.length });
});

app.get('/api/hospitals/scored/:incidentId', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.incidentId);
  const scored = hospitals.map(h => ({
    ...h,
    total_score: Math.random() * 30 + 70,
    eta_minutes: Math.floor(Math.random() * 15) + 5,
    score_breakdown: {
      travel_time: Math.random() * 25 + 5,
      bed_availability: Math.random() * 20 + 5,
      specialist_match: Math.random() * 15 + 5,
      urgency_match: Math.random() * 10 + 5
    }
  })).sort((a, b) => b.total_score - a.total_score);
  res.json({ hospitals: scored });
});

// Assignments endpoint
app.post('/api/assignments', (req, res) => {
  const { incident_id, ambulance_id, hospital_id } = req.body;
  const incident = incidents.find(i => i.id === incident_id);
  const ambulance = ambulances.find(a => a.id === ambulance_id);
  
  if (incident && ambulance) {
    incident.status = 'DISPATCHED';
    ambulance.status = 'ON_CALL';
    
    const assignment = {
      id: 'asgn-' + Date.now(),
      incident_id,
      ambulance_id,
      hospital_id,
      created_at: new Date().toISOString()
    };
    
    io.emit('incident:updated', incident);
    io.emit('assignment:created', assignment);
    
    res.status(201).json(assignment);
  } else {
    res.status(400).json({ message: 'Invalid incident or ambulance' });
  }
});

app.get('/api/assignments/recommendations/:incidentId', (req, res) => {
  res.json({
    ambulances: ambulances.filter(a => a.status === 'AVAILABLE').slice(0, 3),
    hospitals: hospitals.slice(0, 3)
  });
});

// Analytics endpoint
app.get('/api/analytics/dashboard', (req, res) => {
  res.json({
    activeIncidents: incidents.filter(i => !['RESOLVED', 'CANCELLED'].includes(i.status)).length,
    availableAmbulances: ambulances.filter(a => a.status === 'AVAILABLE').length,
    avgResponseTime: '8.5',
    todayResolved: 12,
    improvement: 23
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ========== SIREN DETECTION / GREEN CORRIDOR ENDPOINTS ==========

// Traffic light state for 4-way intersection
const trafficState = {
  NORTH: { light: 'RED', ambulance_here: false },
  SOUTH: { light: 'GREEN', ambulance_here: false },
  EAST: { light: 'RED', ambulance_here: false },
  WEST: { light: 'RED', ambulance_here: false }
};

let sirenDetected = false;
let greenCorridorActive = false;
let currentGreenLane = 'SOUTH';
const LANES = ['NORTH', 'SOUTH', 'EAST', 'WEST'];

// Siren detection status
app.get('/api/siren-detection/status', (req, res) => {
  res.json({
    intersection_id: 'intersection-delhi-cp-001',
    running: true,
    simulation: true,
    siren_detected: sirenDetected,
    green_corridor_active: greenCorridorActive,
    traffic_state: trafficState
  });
});

// Traffic light state
app.get('/api/siren-detection/traffic', (req, res) => {
  res.json({
    intersection_id: 'intersection-delhi-cp-001',
    timestamp: new Date().toISOString(),
    siren_active: sirenDetected,
    lanes: trafficState,
    emergency_active: greenCorridorActive
  });
});

// Activate green corridor for an ambulance
app.post('/api/green-corridor/activate', (req, res) => {
  const { ambulance_id, lane, incident_id } = req.body;
  
  greenCorridorActive = true;
  sirenDetected = true;
  
  // Set requested lane to GREEN, others to RED
  const targetLane = lane || 'NORTH';
  LANES.forEach(l => {
    trafficState[l].light = l === targetLane ? 'GREEN' : 'RED';
    trafficState[l].ambulance_here = l === targetLane;
  });
  
  io.emit('greenCorridor:activated', {
    ambulance_id,
    incident_id,
    lane: targetLane,
    timestamp: new Date().toISOString()
  });
  
  io.emit('traffic:updated', trafficState);
  
  res.json({
    success: true,
    message: `Green corridor activated on ${targetLane}`,
    traffic_state: trafficState
  });
});

// Deactivate green corridor
app.post('/api/green-corridor/deactivate', (req, res) => {
  greenCorridorActive = false;
  sirenDetected = false;
  
  // Reset to normal operation
  LANES.forEach(l => {
    trafficState[l].ambulance_here = false;
  });
  
  io.emit('greenCorridor:deactivated', {
    timestamp: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Green corridor deactivated',
    traffic_state: trafficState
  });
});

// Simulate siren detection
app.post('/api/siren-detection/simulate', (req, res) => {
  const { detected, lane } = req.body;
  sirenDetected = detected;
  
  if (detected && lane) {
    LANES.forEach(l => {
      trafficState[l].light = l === lane ? 'GREEN' : 'RED';
      trafficState[l].ambulance_here = l === lane;
    });
    greenCorridorActive = true;
  } else {
    greenCorridorActive = false;
    LANES.forEach(l => {
      trafficState[l].ambulance_here = false;
    });
  }
  
  io.emit('siren:detected', { detected, lane });
  io.emit('traffic:updated', trafficState);
  
  res.json({ success: true, siren_detected: sirenDetected, traffic_state: trafficState });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('incident:subscribe', (incidentId) => {
    socket.join(`incident:${incidentId}`);
  });
  
  socket.on('driver:location', (data) => {
    const ambulance = ambulances.find(a => a.id === data.ambulance_id);
    if (ambulance) {
      ambulance.latitude = data.latitude;
      ambulance.longitude = data.longitude;
      io.emit('ambulance:location', data);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Simulate ambulance movement
setInterval(() => {
  ambulances.forEach(amb => {
    if (amb.status === 'ON_CALL') {
      amb.latitude += (Math.random() - 0.5) * 0.002;
      amb.longitude += (Math.random() - 0.5) * 0.002;
      io.emit('ambulance:location', {
        ambulance_id: amb.id,
        latitude: amb.latitude,
        longitude: amb.longitude,
        timestamp: new Date().toISOString()
      });
    }
  });
}, 3000);

// Simulate normal traffic light rotation (when no emergency)
setInterval(() => {
  if (!greenCorridorActive) {
    const currentIdx = LANES.indexOf(currentGreenLane);
    const nextIdx = (currentIdx + 1) % LANES.length;
    currentGreenLane = LANES[nextIdx];
    
    LANES.forEach(l => {
      trafficState[l].light = l === currentGreenLane ? 'GREEN' : 'RED';
    });
    
    io.emit('traffic:updated', trafficState);
  }
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
🚑 ========================================
   AMBULANCE DISPATCH DEMO SERVER
   + SIREN DETECTION INTEGRATION
   ========================================
   
   API Server:     http://localhost:${PORT}
   WebSocket:      ws://localhost:${PORT}
   
   Demo Credentials:
   Email:    dispatcher@demo.com
   Password: password123
   
   Core Endpoints:
   - GET  /api/health
   - POST /api/auth/login
   - GET  /api/incidents
   - GET  /api/ambulances
   - GET  /api/hospitals
   - POST /api/assignments
   
   🚦 Green Corridor (Siren Detection):
   - GET  /api/siren-detection/status
   - GET  /api/siren-detection/traffic
   - POST /api/green-corridor/activate
   - POST /api/green-corridor/deactivate
   - POST /api/siren-detection/simulate
   
   Press Ctrl+C to stop
🚑 ========================================
  `);
});
