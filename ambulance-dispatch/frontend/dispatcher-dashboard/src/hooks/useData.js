import { useState, useEffect, useCallback } from 'react';
import { incidentsApi, ambulancesApi, hospitalsApi, analyticsApi } from '../services/api';
import socketService from '../services/socket';
import { dispatchBroadcast, DISPATCH_EVENTS } from '../services/dispatchBroadcast';

/* ── Mock fallback data (used when backend is offline) ───────── */
const MOCK_AMBULANCES = [
  { id: 'AMB-001', call_sign: 'Alpha-1',   vehicle_number: 'KA-01-A-0001', type: 'ALS', status: 'AVAILABLE',    latitude: 12.9716, longitude: 77.5946, driver: 'Rajesh Kumar', speed: 0,  battery: 87, signal: 4, destination: null, eta: null },
  { id: 'AMB-002', call_sign: 'Bravo-2',   vehicle_number: 'KA-01-B-0002', type: 'BLS', status: 'AVAILABLE',    latitude: 12.9352, longitude: 77.6245, driver: 'Suresh Patel',  speed: 0,  battery: 100,signal: 5, destination: null, eta: null },
  { id: 'AMB-003', call_sign: 'Charlie-3', vehicle_number: 'KA-01-C-0003', type: 'ALS', status: 'AVAILABLE',    latitude: 13.0359, longitude: 77.5967, driver: 'Priya Singh',   speed: 0,  battery: 62, signal: 3, destination: null, eta: null },
  { id: 'AMB-004', call_sign: 'Delta-4',   vehicle_number: 'KA-01-D-0004', type: 'BLS', status: 'AVAILABLE',    latitude: 12.9698, longitude: 77.7200, driver: 'Amit Sharma',   speed: 0,  battery: 45, signal: 4, destination: null, eta: null },
  { id: 'AMB-005', call_sign: 'Echo-5',    vehicle_number: 'KA-01-E-0005', type: 'ALS', status: 'AVAILABLE',    latitude: 12.9308, longitude: 77.5838, driver: 'Neha Verma',    speed: 0,  battery: 95, signal: 5, destination: null, eta: null },
];

const MOCK_HOSPITALS = [
  { id: 'H-001', name: 'Apollo Hospital',   latitude: 12.8933, longitude: 77.5984, available_beds: 24, icu_beds_available: 8,  total_beds: 500, icu_beds_total: 40 },
  { id: 'H-002', name: 'Manipal Hospital',  latitude: 12.9550, longitude: 77.6445, available_beds: 12, icu_beds_available: 5,  total_beds: 600, icu_beds_total: 60 },
  { id: 'H-003', name: 'Fortis Hospital',   latitude: 12.9975, longitude: 77.5937, available_beds: 31, icu_beds_available: 10, total_beds: 300, icu_beds_total: 30 },
];

const MOCK_INCIDENTS = [
  {
    id: 'INC-001', incident_type: 'Cardiac Arrest', severity: 'CRITICAL', status: 'PENDING',
    location_address: 'Indiranagar, Bangalore', location_lat: 12.9784, location_lng: 77.6408,
    caller_name: 'Rahul Sharma', caller_phone: '+91 98765 43210',
    description: 'Patient unconscious, severe chest pain. Immediate ALS required.', patients_count: 1,
    is_sos: false, created_at: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: 'INC-002', incident_type: 'Road Accident', severity: 'HIGH', status: 'PENDING',
    location_address: 'Outer Ring Road, Bellandur, Bangalore', location_lat: 12.9263, location_lng: 77.6761,
    caller_name: 'Traffic Police Patrol', caller_phone: '+91 100',
    description: 'Multi-vehicle collision, 3 injured, trauma bay needed.', patients_count: 3,
    is_sos: false, created_at: new Date(Date.now() - 7 * 60000).toISOString(),
  },
  {
    id: 'INC-003', incident_type: 'Fire Emergency', severity: 'HIGH', status: 'PENDING',
    location_address: 'Koramangala 5th Block, Bangalore', location_lat: 12.9352, location_lng: 77.6245,
    caller_name: 'Fire Control', caller_phone: '+91 101',
    description: 'Commercial complex fire, smoke inhalation.', patients_count: 2,
    is_sos: false, created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: 'INC-004', incident_type: 'Trauma Incident', severity: 'CRITICAL', status: 'PENDING',
    location_address: 'Palace Grounds, Jayamahal, Bengaluru', location_lat: 12.9982, location_lng: 77.5921,
    caller_name: 'Palace Grounds Control', caller_phone: '+91 99001 22334',
    description: 'Palace Grounds test verification landmark point.', patients_count: 1,
    is_sos: false, created_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
];

const MOCK_STATS = {
  active_incidents: 3,
  available_ambulances: 5,
  total_ambulances: 5,
  hospitals_in_network: 3,
  avg_response_time_minutes: 7.9,
  incidents_today: 3,
  response_time_improvement: 23,
};

let livePositions = {};
MOCK_AMBULANCES.forEach(a => {
  livePositions[a.id] = { lat: a.latitude, lng: a.longitude };
});

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

    const handleBroadcastLocation = (data) => {
      if (!data) return;
      const targetId = data.ambulance_id || data.id;
      setAmbulances(prev => prev.map(a =>
        a.id === targetId || a.call_sign === 'Alpha-1' || a.id === 'AMB-001'
          ? { ...a, latitude: data.latitude, longitude: data.longitude, speed: data.speed || a.speed }
          : a
      ));
    };

    socketService.on('ambulance:location', handleLocationUpdate);
    socketService.on('ambulance:status', handleStatusUpdate);
    dispatchBroadcast.on(DISPATCH_EVENTS.AMBULANCE_LOCATION, handleBroadcastLocation);

    return () => {
      socketService.off('ambulance:location', handleLocationUpdate);
      socketService.off('ambulance:status', handleStatusUpdate);
      dispatchBroadcast.off(DISPATCH_EVENTS.AMBULANCE_LOCATION, handleBroadcastLocation);
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
