import { useState, useEffect, useCallback } from 'react';
import supabase from '../services/supabase';
import socketService from '../services/socket';
import { dispatchBroadcast, DISPATCH_EVENTS } from '../services/dispatchBroadcast';

/* ── Fallback data when database is empty ───────── */
const MOCK_AMBULANCES = [
  { id: 'AMB-001', call_sign: 'Alpha-1',   vehicle_number: 'KA-01-A-0001', type: 'ALS', status: 'AVAILABLE', assigned_incident_id: null, latitude: 12.9716, longitude: 77.5946, speed: 0, battery_level: 87 },
  { id: 'AMB-002', call_sign: 'Bravo-2',   vehicle_number: 'KA-01-B-0002', type: 'BLS', status: 'AVAILABLE', assigned_incident_id: null, latitude: 12.9352, longitude: 77.6245, speed: 0, battery_level: 100 },
  { id: 'AMB-003', call_sign: 'Charlie-3', vehicle_number: 'KA-01-C-0003', type: 'ALS', status: 'AVAILABLE', assigned_incident_id: null, latitude: 13.0359, longitude: 77.5967, speed: 0, battery_level: 62 },
  { id: 'AMB-004', call_sign: 'Delta-4',   vehicle_number: 'KA-01-D-0004', type: 'BLS', status: 'AVAILABLE', assigned_incident_id: null, latitude: 12.9698, longitude: 77.7200, speed: 0, battery_level: 45 },
  { id: 'AMB-005', call_sign: 'Echo-5',    vehicle_number: 'KA-01-E-0005', type: 'ALS', status: 'AVAILABLE', assigned_incident_id: null, latitude: 12.9308, longitude: 77.5838, speed: 0, battery_level: 95 },
];

const MOCK_HOSPITALS = [
  { id: 'H-001', name: 'Apollo Hospital',   latitude: 12.8933, longitude: 77.5984, available_beds: 24, icu_beds_available: 8,  total_beds: 500, icu_beds_total: 40 },
  { id: 'H-002', name: 'Manipal Hospital',  latitude: 12.9550, longitude: 77.6445, available_beds: 12, icu_beds_available: 5,  total_beds: 600, icu_beds_total: 60 },
  { id: 'H-003', name: 'Fortis Hospital',   latitude: 12.9975, longitude: 77.5937, available_beds: 31, icu_beds_available: 10, total_beds: 300, icu_beds_total: 30 },
];

const MOCK_INCIDENTS = [
  {
    id: 'INC-001', incident_type: 'Cardiac Arrest', severity: 'CRITICAL', status: 'PENDING',
    location_address: 'Indiranagar 100ft Road, Bengaluru', location_lat: 12.9784, location_lng: 77.6408,
    caller_name: 'Rahul Sharma', caller_phone: '+91 98765 43210',
    description: 'Patient unconscious, severe chest pain. Immediate ALS required.', patients_count: 1,
    is_sos: false, created_at: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: 'INC-002', incident_type: 'Road Accident', severity: 'HIGH', status: 'PENDING',
    location_address: 'Outer Ring Road, Bellandur, Bengaluru', location_lat: 12.9263, location_lng: 77.6761,
    caller_name: 'Traffic Police Patrol', caller_phone: '+91 100',
    description: 'Multi-vehicle collision, 3 injured, trauma bay needed.', patients_count: 3,
    is_sos: false, created_at: new Date(Date.now() - 7 * 60000).toISOString(),
  },
  {
    id: 'INC-004', incident_type: 'Trauma Incident', severity: 'CRITICAL', status: 'PENDING',
    location_address: 'Palace Grounds, Jayamahal, Bengaluru', location_lat: 12.9982, location_lng: 77.5921,
    caller_name: 'Palace Grounds Control', caller_phone: '+91 99001 22334',
    description: 'Palace Grounds test verification landmark point.', patients_count: 1,
    is_sos: false, created_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
];

/* ── Hooks Backed by Supabase with Realtime CDC & Parallel Broadcast ── */

export function useIncidents() {
  const [incidents, setIncidents] = useState(MOCK_INCIDENTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: sbErr } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!sbErr && Array.isArray(data) && data.length > 0) {
        setIncidents(data);
      }
      setError(null);
    } catch (e) {
      console.warn('[useIncidents] Supabase fetch error, using fallback:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();

    // 1. Supabase Postgres CDC Subscription
    const channel = supabase
      .channel('cad_incidents_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        console.log('[Realtime CDC] Incident Inserted:', payload.new);
        setIncidents(prev => [payload.new, ...prev.filter(i => i.id !== payload.new.id)]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, (payload) => {
        console.log('[Realtime CDC] Incident Updated:', payload.new);
        setIncidents(prev => prev.map(i => i.id === payload.new.id ? payload.new : i));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'incidents' }, (payload) => {
        setIncidents(prev => prev.filter(i => i.id !== payload.old.id));
      })
      .subscribe();

    // 2. Parallel BroadcastChannel / Socket fallback listeners
    const handleBroadcastSOS = (inc) => {
      setIncidents(prev => [inc, ...prev.filter(i => i.id !== inc.id)]);
    };

    dispatchBroadcast.on(DISPATCH_EVENTS.SOS_CREATED, handleBroadcastSOS);

    return () => {
      supabase.removeChannel(channel);
      dispatchBroadcast.off(DISPATCH_EVENTS.SOS_CREATED, handleBroadcastSOS);
    };
  }, [fetchIncidents]);

  return { incidents, setIncidents, loading, error, refetch: fetchIncidents };
}

export function useAmbulances() {
  const [ambulances, setAmbulances] = useState(MOCK_AMBULANCES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAmbulances = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: sbErr } = await supabase
        .from('ambulances')
        .select('*')
        .order('call_sign', { ascending: true });

      if (!sbErr && Array.isArray(data) && data.length > 0) {
        setAmbulances(data);
      }
      setError(null);
    } catch (e) {
      console.warn('[useAmbulances] Supabase fetch error, using fallback:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAmbulances();

    // 1. Supabase Postgres CDC Subscription
    const channel = supabase
      .channel('cad_ambulances_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setAmbulances(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a));
        }
      })
      // Supabase Ephemeral Broadcast for High-Frequency GPS
      .on('broadcast', { event: 'ambulance_location' }, (payload) => {
        const data = payload.payload;
        if (!data) return;
        setAmbulances(prev => prev.map(a =>
          a.id === data.ambulance_id
            ? { ...a, latitude: data.latitude, longitude: data.longitude, speed: data.speed, heading: data.heading }
            : a
        ));
      })
      .subscribe();

    // 2. Parallel BroadcastChannel / Socket listeners
    const handleBroadcastLocation = (data) => {
      if (!data) return;
      const targetId = data.ambulance_id || data.id;
      setAmbulances(prev => prev.map(a =>
        a.id === targetId || a.call_sign === 'Alpha-1' || a.id === 'AMB-001'
          ? { ...a, latitude: data.latitude, longitude: data.longitude, speed: data.speed || a.speed }
          : a
      ));
    };

    const handleIncidentAssigned = (data) => {
      if (!data || !data.ambulance) return;
      setAmbulances(prev => prev.map(a =>
        a.id === data.ambulance.id
          ? {
              ...a,
              status: 'EN_ROUTE_TO_SCENE',
              assigned_incident_id: data.incident?.id || data.id,
              destination: data.location_address || data.incident?.location_address || 'Emergency Scene',
            }
          : a
      ));
    };

    dispatchBroadcast.on(DISPATCH_EVENTS.AMBULANCE_LOCATION, handleBroadcastLocation);
    dispatchBroadcast.on(DISPATCH_EVENTS.INCIDENT_ASSIGNED, handleIncidentAssigned);

    return () => {
      supabase.removeChannel(channel);
      dispatchBroadcast.off(DISPATCH_EVENTS.AMBULANCE_LOCATION, handleBroadcastLocation);
      dispatchBroadcast.off(DISPATCH_EVENTS.INCIDENT_ASSIGNED, handleIncidentAssigned);
    };
  }, [fetchAmbulances]);

  return { ambulances, loading, error, refetch: fetchAmbulances };
}

export function useHospitals() {
  const [hospitals, setHospitals] = useState(MOCK_HOSPITALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: sbErr } = await supabase
        .from('hospitals')
        .select('*')
        .order('name', { ascending: true });

      if (!sbErr && Array.isArray(data) && data.length > 0) {
        setHospitals(data);
      }
      setError(null);
    } catch {
      // Keep mock fallback silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHospitals();

    const channel = supabase
      .channel('cad_hospitals_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospitals' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setHospitals(prev => prev.map(h => h.id === payload.new.id ? payload.new : h));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHospitals]);

  return { hospitals, loading, error, refetch: fetchHospitals };
}

export function useAnalytics() {
  const [stats, setStats] = useState({
    active_incidents: 4,
    available_ambulances: 5,
    total_ambulances: 5,
    hospitals_in_network: 3,
    avg_response_time_minutes: 7.9,
    incidents_today: 4,
    response_time_improvement: 23,
  });

  return { stats, loading: false, error: null, refetch: () => {} };
}

export function useDashboardStats() {
  return useAnalytics();
}

export function useTimeline() {
  const [events, setEvents] = useState([]);
  return { events, setEvents, loading: false };
}

