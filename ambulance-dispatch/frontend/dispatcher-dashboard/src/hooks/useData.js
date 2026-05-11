import { useState, useEffect, useCallback } from 'react';
import { incidentsApi, ambulancesApi, hospitalsApi, analyticsApi } from '../services/api';
import socketService from '../services/socket';

/* ── Mock fallback data (used when backend is offline) ───────── */
const MOCK_AMBULANCES = [
  { id: 'AMB-001', call_sign: 'Alpha-1',   vehicle_number: 'MH-01-A-0001', type: 'ALS', status: 'EN_ROUTE',     latitude: 19.0820, longitude: 72.8777, driver: 'Rajesh Kumar', speed: 62,  battery: 87, signal: 4, destination: 'Bandra West', eta: '4 min' },
  { id: 'AMB-002', call_sign: 'Bravo-2',   vehicle_number: 'MH-01-B-0002', type: 'BLS', status: 'AVAILABLE',    latitude: 19.0700, longitude: 72.8900, driver: 'Suresh Patel',  speed: 0,   battery: 100,signal: 5, destination: null, eta: null },
  { id: 'AMB-003', call_sign: 'Charlie-3', vehicle_number: 'MH-01-C-0003', type: 'ALS', status: 'TRANSPORTING', latitude: 19.0660, longitude: 72.8650, driver: 'Priya Singh',   speed: 45,  battery: 62, signal: 3, destination: 'City Hospital', eta: '8 min' },
  { id: 'AMB-004', call_sign: 'Delta-4',   vehicle_number: 'MH-01-D-0004', type: 'BLS', status: 'ON_SCENE',     latitude: 19.0790, longitude: 72.8950, driver: 'Amit Sharma',   speed: 0,   battery: 45, signal: 4, destination: 'Andheri East', eta: 'On scene' },
  { id: 'AMB-005', call_sign: 'Echo-5',    vehicle_number: 'MH-01-E-0005', type: 'ALS', status: 'AVAILABLE',    latitude: 19.0850, longitude: 72.8600, driver: 'Neha Verma',    speed: 0,   battery: 95, signal: 5, destination: null, eta: null },
];

const MOCK_HOSPITALS = [
  { id: 'H-001', name: 'City General Hospital',  latitude: 19.0728, longitude: 72.8826, available_beds: 24, icu_beds_available: 8,  total_beds: 200, icu_beds_total: 40 },
  { id: 'H-002', name: 'Apollo Trauma Centre',    latitude: 19.0596, longitude: 72.8295, available_beds: 12, icu_beds_available: 5,  total_beds: 150, icu_beds_total: 30 },
  { id: 'H-003', name: "St. Mary's Medical",      latitude: 19.1136, longitude: 72.8697, available_beds: 31, icu_beds_available: 10, total_beds: 300, icu_beds_total: 60 },
];

const MOCK_INCIDENTS = [
  {
    id: 'INC-001', incident_type: 'Cardiac Arrest', severity: 'CRITICAL', status: 'REPORTED',
    location_address: 'Bandra West, Mumbai', location_lat: 19.0596, location_lng: 72.8295,
    caller_name: 'Rahul Shah', caller_phone: '+91 98765 43210',
    description: 'Patient unconscious, not breathing. CPR in progress.', patients_count: 1,
    is_sos: false, created_at: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: 'INC-002', incident_type: 'Road Accident', severity: 'HIGH', status: 'REPORTED',
    location_address: 'Western Express Hwy, Andheri', location_lat: 19.1136, location_lng: 72.8697,
    caller_name: 'Police Control', caller_phone: '+91 100',
    description: 'Multi-vehicle collision, 3 injured, one trapped.', patients_count: 3,
    is_sos: false, created_at: new Date(Date.now() - 7 * 60000).toISOString(),
  },
  {
    id: 'INC-003', incident_type: 'Fire Emergency', severity: 'HIGH', status: 'REPORTED',
    location_address: 'Dharavi, Mumbai', location_lat: 19.0411, location_lng: 72.8544,
    caller_name: 'Fire Brigade', caller_phone: '+91 101',
    description: 'Building fire, 2 persons with smoke inhalation.', patients_count: 2,
    is_sos: false, created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
];

const MOCK_STATS = {
  active_incidents: 3,
  available_ambulances: 2,
  total_ambulances: 5,
  hospitals_in_network: 3,
  avg_response_time_minutes: 8.5,
  incidents_today: 3,
  response_time_improvement: 23,
};

/* ── Live GPS simulation for mock ambulances ─────────────────── */
// Each moving ambulance gets a fixed heading so it moves in a clear direction
const HEADINGS = {
  'AMB-001': { dlat: -0.0008, dlng: -0.0010 }, // heading SW toward Bandra
  'AMB-003': { dlat:  0.0006, dlng:  0.0009 }, // heading NE toward hospital
};

let livePositions = {};
MOCK_AMBULANCES.forEach(a => {
  livePositions[a.id] = { lat: a.latitude, lng: a.longitude };
});

setInterval(() => {
  MOCK_AMBULANCES.forEach(a => {
    if (['EN_ROUTE', 'TRANSPORTING'].includes(a.status)) {
      const h = HEADINGS[a.id] || { dlat: 0.0005, dlng: 0.0005 };
      // Add small random jitter on top of directional movement
      livePositions[a.id] = {
        lat: livePositions[a.id].lat + h.dlat + (Math.random() - 0.5) * 0.0002,
        lng: livePositions[a.id].lng + h.dlng + (Math.random() - 0.5) * 0.0002,
      };
    }
  });
}, 1500);

/* ── Hooks ───────────────────────────────────────────────────── */

export function useIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIncidents = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const response = await incidentsApi.getAll({ ...filters, limit: 100 });
      const data = response.data.incidents || response.data;
      setIncidents(Array.isArray(data) && data.length > 0 ? data : []);
      setError(null);
    } catch {
      // Backend offline — show mock incidents so dispatcher has something to dispatch
      setIncidents(MOCK_INCIDENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents({ status: 'active' });

    const handleNewIncident = (incident) => setIncidents(prev => [incident, ...prev]);
    const handleIncidentUpdated = (updated) =>
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));

    socketService.on('incident:created', handleNewIncident);
    socketService.on('incident:updated', handleIncidentUpdated);
    return () => {
      socketService.off('incident:created', handleNewIncident);
      socketService.off('incident:updated', handleIncidentUpdated);
    };
  }, [fetchIncidents]);

  return { incidents, setIncidents, loading, error, refetch: fetchIncidents };
}

export function useAmbulances() {
  const [ambulances, setAmbulances] = useState(MOCK_AMBULANCES); // start with mock immediately
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAmbulances = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ambulancesApi.getAll({ limit: 200 });
      const data = response.data.ambulances || response.data;
      if (Array.isArray(data) && data.length > 0) {
        setAmbulances(data);
      }
      // else keep mock data
      setError(null);
    } catch {
      // Keep mock data silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAmbulances();

    // Animate live mock positions (sync with module-level GPS simulation)
    const liveInterval = setInterval(() => {
      setAmbulances(prev => prev.map(a => {
        const pos = livePositions[a.id];
        if (pos && ['EN_ROUTE', 'TRANSPORTING'].includes(a.status)) {
          return { ...a, latitude: pos.lat, longitude: pos.lng };
        }
        return a;
      }));
    }, 1500);

    const handleLocationUpdate = (data) =>
      setAmbulances(prev => prev.map(a =>
        a.id === data.ambulance_id
          ? { ...a, latitude: data.latitude, longitude: data.longitude }
          : a
      ));

    const handleStatusUpdate = (data) =>
      setAmbulances(prev => prev.map(a =>
        a.id === data.ambulance_id ? { ...a, status: data.status } : a
      ));

    socketService.on('ambulance:location', handleLocationUpdate);
    socketService.on('ambulance:status', handleStatusUpdate);
    return () => {
      clearInterval(liveInterval);
      socketService.off('ambulance:location', handleLocationUpdate);
      socketService.off('ambulance:status', handleStatusUpdate);
    };
  }, [fetchAmbulances]);

  return { ambulances, loading, error, refetch: fetchAmbulances };
}

export function useHospitals() {
  const [hospitals, setHospitals] = useState(MOCK_HOSPITALS); // start with mock immediately
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const response = await hospitalsApi.getAll({ limit: 100 });
      const data = response.data.hospitals || response.data;
      if (Array.isArray(data) && data.length > 0) {
        setHospitals(data);
      }
      setError(null);
    } catch {
      // Keep mock data silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHospitals();

    const handleCapacityUpdate = (data) =>
      setHospitals(prev => prev.map(h => h.id === data.hospital_id ? { ...h, ...data } : h));

    socketService.on('hospital:capacity', handleCapacityUpdate);
    return () => socketService.off('hospital:capacity', handleCapacityUpdate);
  }, [fetchHospitals]);

  return { hospitals, loading, error, refetch: fetchHospitals };
}

export function useDashboardStats() {
  const [stats, setStats] = useState(MOCK_STATS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await analyticsApi.getDashboardStats();
        setStats(response.data);
      } catch {
        // Keep mock stats silently
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return { stats, loading };
}
