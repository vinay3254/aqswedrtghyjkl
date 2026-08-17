import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, LinearProgress, Snackbar, Alert, Chip, IconButton } from '@mui/material';
import { Logout } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { dispatchBroadcast, DISPATCH_EVENTS } from '../services/dispatchBroadcast';
import DriverMap from '../components/DriverMap';
import PatientVitalsForm from '../components/PatientVitalsForm';
import HospitalSelector from '../components/HospitalSelector';
import MedicalChecklist from '../components/MedicalChecklist';
import ETACountdown from '../components/ETACountdown';
import QuickRadioPanel from '../components/QuickRadioPanel';
import PanicButton from '../components/PanicButton';

/* ── Evergreen tokens ── */
const BG      = '#F8FAFC';
const SURFACE = '#FFFFFF';
const SURF2   = '#F1F5F9';
const G       = '#2563EB';
const TEXT    = '#0F172A';
const DIM     = '#475569';
const FAINT   = '#94A3B8';
const BORDER  = '#E2E8F0';
const BORDER2 = '#E2E8F0';
const RED     = '#E25C50';
const AMBER   = '#E3A94F';

const SEV_COLOR = { CRITICAL:RED, HIGH:AMBER, MEDIUM:G, LOW:G };
const SEV_BG    = { CRITICAL:'rgba(226,92,80,0.16)', HIGH:'rgba(227,169,79,0.16)', MEDIUM:'#E2E8F0', LOW:'#E2E8F0' };

const MOCK_DRIVER = {
  id:'DRV-001', name:'Rajesh Kumar', callSign:'Alpha-1',
  vehicle:'KA-01-A-0001', type:'ALS',
  latitude:12.9716, longitude:77.5946,
};

const PENDING_INCIDENTS = [
  { id:'SOS-101', incident_type:'Cardiac Arrest', severity:'CRITICAL', location_address:'Indiranagar, Bangalore', location_lat:12.9784, location_lng:77.6408, caller_name:'Rahul Sharma', caller_phone:'+91 98765 43210', description:'Patient unconscious, not breathing', distance:'3.2 km', eta:'6 min', patients_count:1, created_at:new Date(Date.now()-120000).toISOString(), is_sos:true },
  { id:'SOS-102', incident_type:'Road Accident',  severity:'HIGH',     location_address:'Outer Ring Road, Bellandur', location_lat:12.9263, location_lng:77.6761, caller_name:'Police Control', caller_phone:'+91 100', description:'Multi-vehicle accident, 3 injured', distance:'5.8 km', eta:'11 min', patients_count:3, created_at:new Date(Date.now()-60000).toISOString(), is_sos:false },
];

/* ── 7-Stage Emergency Lifecycle Flow ── */
const STATUS_FLOW = [
  'ASSIGNED',
  'EN_ROUTE_TO_SCENE',
  'ON_SCENE',
  'TRANSPORTING_TO_HOSPITAL',
  'ARRIVED_AT_HOSPITAL',
  'RETURNING_TO_BASE',
  'AVAILABLE',
];

const STATUS_LABELS = {
  ASSIGNED: 'Assigned',
  EN_ROUTE_TO_SCENE: 'En Route',
  ON_SCENE: 'On Scene',
  TRANSPORTING_TO_HOSPITAL: 'Transport',
  ARRIVED_AT_HOSPITAL: 'At Hospital',
  RETURNING_TO_BASE: 'Returning',
  AVAILABLE: 'Available',
};

const STATUS_ACTIONS = {
  ASSIGNED:                 { label:'🚨 Acknowledge & En Route',          next:'EN_ROUTE_TO_SCENE',        color:'#F97316' },
  EN_ROUTE_TO_SCENE:        { label:'📍 Arrived on Scene',               next:'ON_SCENE',                 color:'#EF4444' },
  ON_SCENE:                 { label:'🏥 Patient Loaded → Start Transport', next:'TRANSPORTING_TO_HOSPITAL', color:'#2563EB' },
  TRANSPORTING_TO_HOSPITAL: { label:'🏁 Arrived at Hospital ER Bay',      next:'ARRIVED_AT_HOSPITAL',      color:'#9333EA' },
  ARRIVED_AT_HOSPITAL:      { label:'🔄 Complete Handover & Return',      next:'RETURNING_TO_BASE',        color:'#64748B' },
  RETURNING_TO_BASE:        { label:'✅ Confirm Ready / Available',       next:'AVAILABLE',                color:'#10B981' },
};

function CrossIcon({ size=12, color=G }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2.5v11M2.5 8h11" stroke={color} strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  );
}

/* ══ Incoming dispatch banner ══ */
function IncomingAlert({ incident, onAccept, onReject }) {
  const [countdown, setCountdown] = useState(30);
  const sc = SEV_COLOR[incident.severity] || AMBER;

  useEffect(() => {
    if (countdown <= 0) { onReject(); return; }
    const t = setTimeout(() => setCountdown(c=>c-1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <Box sx={{ flexShrink:0, margin:'10px 12px 0', padding:'14px', borderRadius:'14px', background:'rgba(226,92,80,0.12)', border:'1.5px solid #E25C50', animation:'fadeUp 0.2s ease' }}>
      <LinearProgress
        variant="determinate" value={(countdown/30)*100}
        sx={{ mb:'10px', height:2, borderRadius:2, bgcolor:'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar':{ bgcolor:RED } }}
      />
      <Box sx={{ display:'flex', alignItems:'center', gap:'8px', mb:'8px' }}>
        <Typography sx={{ fontSize:11, fontWeight:800, color:RED, letterSpacing:'0.06em', flex:1 }}>INCOMING DISPATCH</Typography>
        <Box sx={{ fontSize:'10px', fontWeight:700, px:'8px', py:'2px', borderRadius:'6px', color:sc, background:SEV_BG[incident.severity] }}>
          {incident.severity}
        </Box>
        <Typography sx={{ fontSize:'10.5px', fontWeight:700, color:RED, fontFamily:'"JetBrains Mono",monospace' }}>{countdown}s</Typography>
      </Box>
      <Typography sx={{ fontSize:14, fontWeight:700, color:TEXT, mb:'3px' }}>{incident.incident_type}</Typography>
      <Typography sx={{ fontSize:'11.5px', color:DIM }}>
        {incident.location_address} · {incident.distance || '3.5 km'} · ETA {incident.eta || '6 min'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Button variant="contained" size="small" onClick={onAccept} sx={{ flex: 1, bgcolor: '#2563EB', fontWeight: 800 }}>
          Accept Call
        </Button>
        <Button variant="outlined" size="small" onClick={onReject} sx={{ color: '#94A3B8', borderColor: '#334155' }}>
          Decline
        </Button>
      </Box>
    </Box>
  );
}

/* ══ Active mission card ══ */
function ActiveMission({ incident, status, onStatusUpdate }) {
  const sc  = SEV_COLOR[incident.severity] || AMBER;
  const idx = STATUS_FLOW.indexOf(status);
  const action = STATUS_ACTIONS[status];

  return (
    <Box sx={{ padding:'14px', borderRadius:'14px', background:'#FFFFFF', border:'1px solid #E2E8F0', boxShadow:'0 2px 8px rgba(0,0,0,0.04)', marginBottom:'14px' }}>
      {/* Mission header */}
      <Box sx={{ display:'flex', alignItems:'center', gap:'10px', mb:'12px' }}>
        <Box sx={{ flex:1 }}>
          <Typography sx={{ fontSize:'14px', fontWeight:800, color:TEXT, mb:'4px' }}>
            {incident.incident_type}
          </Typography>
          <Box sx={{ display:'inline-block', fontSize:10, fontWeight:700, px:'8px', py:'2px', borderRadius:'6px', color:sc, background:SEV_BG[incident.severity] }}>
            {incident.severity}
          </Box>
        </Box>
      </Box>

      {/* Details */}
      <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', mb:'14px' }}>
        {[
          { label:'LOCATION', value:incident.location_address },
          { label:'CALLER',   value:incident.caller_name || 'Emergency Dispatch' },
          { label:'PHONE',    value:incident.caller_phone || '+91 108' },
          { label:'PATIENTS', value:`${incident.patients_count||1} person(s)` },
        ].map(f=>(
          <Box key={f.label}>
            <Typography sx={{ fontSize:9, color:DIM, letterSpacing:'0.05em', mb:'2px' }}>{f.label}</Typography>
            <Typography sx={{ fontSize:'11px', fontWeight:600, color:TEXT }}>{f.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Progress stepper */}
      <Box sx={{ display:'flex', alignItems:'flex-start', gap:'3px', mb: 2 }}>
        {STATUS_FLOW.slice(0,-1).map((s,i)=>{
          const done   = i < idx;
          const active = i === idx;
          return (
            <Box key={s} sx={{ flex:1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box sx={{
                width:20, height:20, borderRadius:'50%',
                background: done ? G : active ? 'rgba(37,99,235,0.15)' : 'rgba(142,182,155,0.06)',
                border:`1.5px solid ${done ? G : active ? G : '#CBD5E1'}`,
                color: done ? '#FFFFFF' : active ? G : FAINT,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'9px', fontWeight:800, transition:'all 0.3s',
              }}>
                {done ? '✓' : i+1}
              </Box>
              <Typography sx={{ fontSize:'7.5px', color: done||active?TEXT:DIM, mt:'3px', fontWeight:700, textAlign: 'center', lineHeight: 1.1 }}>
                {STATUS_LABELS[s]}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Active Stage Action Button */}
      {action && (
        <Button
          fullWidth
          variant="contained"
          onClick={() => onStatusUpdate(action.next)}
          sx={{
            py: 1.2,
            bgcolor: action.color,
            color: 'white',
            fontWeight: 800,
            fontSize: '13px',
            textTransform: 'none',
            borderRadius: '10px',
            boxShadow: `0 4px 14px ${action.color}40`,
            '&:hover': { bgcolor: action.color, filter: 'brightness(0.9)' },
          }}
        >
          {action.label} ➔
        </Button>
      )}
    </Box>
  );
}

/* ══ Main ══ */
export default function DriverInterface() {
  const { profile, assignedAmbulance, signOut } = useAuth();
  const driverName = profile?.full_name || MOCK_DRIVER.name;
  const driverCallSign = assignedAmbulance?.call_sign || MOCK_DRIVER.callSign;

  const [alertIncident, setAlertIncident]     = useState(null);
  const [activeIncident, setActiveIncident]   = useState(null);
  const [missionStatus, setMissionStatus]     = useState('EN_ROUTE');
  const [speed, setSpeed]                     = useState(0);
  const [time, setTime]                       = useState(new Date());
  const [incidentQueue, setIncidentQueue]     = useState(PENDING_INCIDENTS);
  const [toast, setToast]                     = useState(null);
  const [driverPos, setDriverPos]             = useState({ lat: assignedAmbulance?.latitude || MOCK_DRIVER.latitude, lng: assignedAmbulance?.longitude || MOCK_DRIVER.longitude });
  const driverPosRef = useRef({ lat: assignedAmbulance?.latitude || MOCK_DRIVER.latitude, lng: assignedAmbulance?.longitude || MOCK_DRIVER.longitude });
  const [activeTab, setActiveTab]             = useState('mission'); // 'mission' | 'checklist'
  const [checklistPhase, setChecklistPhase]   = useState('PRE_DEPARTURE');
  const [vitalsSubmitted, setVitalsSubmitted] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);

  const [gpsMode, setGpsMode]                 = useState('live_device'); // 'live_device' (default) | 'simulated'
  const [isBackgrounded, setIsBackgrounded]   = useState(false);
  const [routeInfo, setRouteInfo]             = useState({ distanceKm: '0.0', etaMins: 0 });

  /* Clock & Visibility */
  useEffect(() => {
    const t = setInterval(()=>setTime(new Date()),1000);
    const handleVis = () => setIsBackgrounded(document.hidden);
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, []);

  /* ── Real Mobile Geolocation watchPosition() ── */
  useEffect(() => {
    if (gpsMode !== 'live_device') return;

    if (!navigator.geolocation) {
      setToast({ msg: '⚠️ Geolocation is not supported by your browser. Falling back to Simulation Mode.', sev: 'warning' });
      setGpsMode('simulated');
      return;
    }

    console.log('[Driver GPS] Requesting live device geolocation watchPosition()...');

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        driverPosRef.current = coords;
        setDriverPos(coords);
        if (pos.coords.speed != null) setSpeed(Math.round(pos.coords.speed * 3.6));

        console.log('[Driver GPS] Live Device GPS ping received:', coords, 'Accuracy:', Math.round(pos.coords.accuracy), 'm');

        // Push live GPS update to backend / broadcast
        dispatchBroadcast.send(DISPATCH_EVENTS.AMBULANCE_LOCATION, {
          ambulance_id: 'AMB-001',
          latitude: coords.lat,
          longitude: coords.lng,
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 45,
          heading: pos.coords.heading || 0,
          last_ping: Date.now(),
          is_device_gps: true,
        });
      },
      (err) => {
        console.warn('[Driver GPS] Geolocation watch error:', err);
        const reason = err.code === 1 ? 'Location permission denied' : err.code === 2 ? 'Location position unavailable' : 'Location request timed out';
        setToast({ msg: `⚠️ ${reason}. Switched to Smooth Simulation Mode. Click badge to retry.`, sev: 'warning' });
        setGpsMode('simulated');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsMode]);

  /* ── Turn-by-Turn Road Route & Live ETA Calculation ── */
  const waypointsRef = useRef([]);
  const waypointIndexRef = useRef(0);

  useEffect(() => {
    if (!activeIncident || !['EN_ROUTE', 'TRANSPORTING'].includes(missionStatus)) {
      waypointsRef.current = [];
      waypointIndexRef.current = 0;
      setRouteInfo({ distanceKm: '0.0', etaMins: 0 });
      return;
    }

    let alive = true;
    const from = [driverPosRef.current.lat, driverPosRef.current.lng];
    const to = missionStatus === 'EN_ROUTE'
      ? [activeIncident.location_lat || 12.9784, activeIncident.location_lng || 77.6408]
      : [selectedHospital?.latitude || 12.9550, selectedHospital?.longitude || 77.6445];

    // Fetch road route coordinates from OSRM
    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        const data = await res.json();
        if (!alive) return;
        if (data.routes?.[0]?.geometry?.coordinates?.length > 1) {
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          waypointsRef.current = coords;
          waypointIndexRef.current = 0;
          const dist = (data.routes[0].distance / 1000).toFixed(1);
          const eta = Math.ceil(data.routes[0].duration / 60);
          setRouteInfo({ distanceKm: dist, etaMins: eta });
        } else {
          // Haversine fallback
          const R = 6371;
          const dLat = (to[0] - from[0]) * Math.PI / 180;
          const dLng = (to[1] - from[1]) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(from[0]*Math.PI/180)*Math.cos(to[0]*Math.PI/180)*Math.sin(dLng/2)**2;
          const dKm = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
          const eta = Math.max(1, Math.ceil(dKm / (40 / 60)));
          setRouteInfo({ distanceKm: dKm, etaMins: eta });
        }
      } catch {
        const R = 6371;
        const dLat = (to[0] - from[0]) * Math.PI / 180;
        const dLng = (to[1] - from[1]) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(from[0]*Math.PI/180)*Math.cos(to[0]*Math.PI/180)*Math.sin(dLng/2)**2;
        const dKm = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
        const eta = Math.max(1, Math.ceil(dKm / (40 / 60)));
        setRouteInfo({ distanceKm: dKm, etaMins: eta });
      }
    })();

    if (gpsMode === 'live_device') return;

    // Advance smoothly along the road waypoints
    const iv = setInterval(() => {
      const wps = waypointsRef.current;
      if (!wps || wps.length === 0) return;

      if (waypointIndexRef.current < wps.length - 1) {
        waypointIndexRef.current += 1;
        const next = wps[waypointIndexRef.current];
        driverPosRef.current = next;
        setDriverPos({ ...next });

        // Update remaining distance/ETA countdown
        const remainingWps = wps.length - 1 - waypointIndexRef.current;
        const fraction = remainingWps / wps.length;
        setRouteInfo(prev => ({
          distanceKm: (parseFloat(prev.distanceKm || 3.0) * fraction).toFixed(1),
          etaMins: Math.max(1, Math.ceil((prev.etaMins || 6) * fraction)),
        }));

        // Broadcast live location to Dispatch Command Center & other responders
        dispatchBroadcast.send(DISPATCH_EVENTS.AMBULANCE_LOCATION, {
          ambulance_id: 'AMB-001',
          latitude: next.lat,
          longitude: next.lng,
          speed: 52,
          last_ping: Date.now(),
        });
      } else {
        // Arrived at destination
        if (missionStatus === 'EN_ROUTE') {
          setMissionStatus('ON_SCENE');
          setChecklistPhase('ON_SCENE');
          setToast({ msg: 'Ambulance arrived On Scene with patient!', sev: 'warning' });
        } else if (missionStatus === 'TRANSPORTING') {
          setMissionStatus('AT_HOSPITAL');
          setChecklistPhase('HANDOVER');
          setToast({ msg: 'Arrived at receiving hospital ER!', sev: 'success' });
        }
      }
    }, 1200);

    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [activeIncident, missionStatus, selectedHospital, gpsMode]);

  /* Speed simulation */
  useEffect(() => {
    if (!activeIncident) { setSpeed(0); return; }
    const t = setInterval(()=>{
      setSpeed(['EN_ROUTE','TRANSPORTING'].includes(missionStatus) ? 48+Math.floor(Math.random()*12) : 0);
    }, 1500);
    return ()=>clearInterval(t);
  }, [activeIncident, missionStatus]);

  /* Broadcast */
  useEffect(() => {
    const handleSOS = (inc) => {
      const e = { ...inc, distance:`${(Math.random()*5+1).toFixed(1)} km`, eta:`${Math.floor(Math.random()*8+3)} min`, patients_count:inc.patients_count||1 };
      setIncidentQueue(q=>q.find(i=>i.id===e.id)?q:[e,...q]);
      setAlertIncident(e);
      setToast({ msg:`New SOS: ${inc.incident_type}`, sev:'error' });
    };
    const handleAssigned = (a) => {
      if (a?._isAssignment && a?.incident_type) {
        const d = { id:a.id||`ASN-${Date.now()}`, incident_type:a.incident_type, severity:a.severity||'HIGH', location_address:a.location_address||'Location pending', caller_name:a.caller_name||'Dispatch Center', caller_phone:a.caller_phone||'+91 100', patients_count:a.patients_count||1, description:a.description||'', distance:a.distance||'? km', eta:a.eta||'? min', is_sos:a.is_sos||false, _isAssignment:true };
        setIncidentQueue(q=>q.find(i=>i.id===d.id)?q:[d,...q]);
        setAlertIncident(d);
        setToast({ msg:`Dispatch: ${d.incident_type}`, sev:'success' });
      }
    };
    dispatchBroadcast.on(DISPATCH_EVENTS.SOS_CREATED, handleSOS);
    dispatchBroadcast.on(DISPATCH_EVENTS.INCIDENT_ASSIGNED, handleAssigned);
    dispatchBroadcast.replayLast(120000);
    return () => {
      dispatchBroadcast.off(DISPATCH_EVENTS.SOS_CREATED, handleSOS);
      dispatchBroadcast.off(DISPATCH_EVENTS.INCIDENT_ASSIGNED, handleAssigned);
    };
  }, []);

  const handleAccept = async () => {
    setActiveIncident(alertIncident);
    setMissionStatus('ASSIGNED');
    setIncidentQueue(q=>q.filter(i=>i.id!==alertIncident.id));
    setAlertIncident(null);
    setVitalsSubmitted(false);
    setSelectedHospital(null);
    setChecklistPhase('PRE_DEPARTURE');
    setActiveTab('mission');

    try {
      const ambId = assignedAmbulance?.id || 'AMB-001';
      await supabase.from('incidents').update({
        status: 'ASSIGNED',
        assigned_ambulance_id: ambId,
        dispatched_at: new Date().toISOString(),
      }).eq('id', alertIncident.id);
      setToast({ msg: '🚨 Mission Accepted! Please proceed to scene.', sev: 'success' });
    } catch (err) {
      console.warn('[DriverInterface] Supabase accept error:', err);
    }
  };

  const handleStatusUpdate = async (nextStatus) => {
    if (!activeIncident) return;
    setMissionStatus(nextStatus);

    // Auto-switch checklist phase
    if (nextStatus === 'ON_SCENE') setChecklistPhase('ON_SCENE');
    if (nextStatus === 'ARRIVED_AT_HOSPITAL') setChecklistPhase('HANDOVER');

    const milestones = {};
    if (nextStatus === 'EN_ROUTE_TO_SCENE') milestones.dispatched_at = new Date().toISOString();
    if (nextStatus === 'ON_SCENE') milestones.arrived_scene_at = new Date().toISOString();
    if (nextStatus === 'TRANSPORTING_TO_HOSPITAL') milestones.transport_started_at = new Date().toISOString();
    if (nextStatus === 'ARRIVED_AT_HOSPITAL') milestones.arrived_hospital_at = new Date().toISOString();
    if (nextStatus === 'RETURNING_TO_BASE' || nextStatus === 'AVAILABLE') milestones.resolved_at = new Date().toISOString();

    try {
      if (nextStatus === 'AVAILABLE') {
        // Resolve incident & free ambulance
        await supabase.from('incidents').update({ status: 'RESOLVED', ...milestones }).eq('id', activeIncident.id);
        const ambId = assignedAmbulance?.id || 'AMB-001';
        await supabase.from('ambulances').update({ status: 'AVAILABLE', assigned_incident_id: null, destination: null }).eq('id', ambId);
        setActiveIncident(null);
        setToast({ msg: '✅ Mission Complete! Unit is now Available for new dispatches.', sev: 'success' });
      } else {
        await supabase.from('incidents').update({ status: nextStatus, ...milestones }).eq('id', activeIncident.id);
        setToast({ msg: `Status updated: ${STATUS_LABELS[nextStatus] || nextStatus}`, sev: 'info' });
      }

      dispatchBroadcast.send(DISPATCH_EVENTS.INCIDENT_UPDATED, {
        id: activeIncident.id,
        status: nextStatus,
        ambulance_id: assignedAmbulance?.id || 'AMB-001',
      });
    } catch (err) {
      console.warn('[DriverInterface] Error updating status in DB:', err);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: '#F1F5F9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: { xs: 0, sm: 2 }
    }}>
      {/* Centered Mobile simulator view frame matching device mock design */}
      <Box sx={{
        width: '100%',
        maxWidth: { xs: '100%', sm: '380px' },
        height: { xs: '100vh', sm: '780px' },
        borderRadius: { xs: 0, sm: '20px' },
        border: { xs: 'none', sm: '1px solid #E2E8F0' },
        boxShadow: { xs: 'none', sm: '0 40px 100px rgba(0,0,0,0.55)' },
        background: BG,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>

        {/* ══ HEADER ══ */}
        <Box sx={{
          flexShrink:0, padding:'10px 14px',
          display:'flex', alignItems:'center', gap:'10px',
          background:SURFACE, borderBottom:`1px solid ${BORDER}`,
        }}>
          {/* Cross icon */}
          <Box sx={{ width:28, height:28, borderRadius:'8px', background:'rgba(37,99,235,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <CrossIcon size={12} color={G} />
          </Box>
          <Box sx={{ flex:1 }}>
            <Typography sx={{ fontSize:'12.5px', fontWeight:800, color:TEXT, lineHeight:1.2 }}>
              {driverCallSign} · {driverName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: '2px' }}>
              <Chip
                label={gpsMode === 'live_device' ? '🛰️ DEVICE GPS' : '🗺️ SIM ROUTE'}
                size="small"
                onClick={() => setGpsMode(gpsMode === 'live_device' ? 'simulated' : 'live_device')}
                sx={{ height: 18, fontSize: '9px', fontWeight: 800, cursor: 'pointer', bgcolor: gpsMode === 'live_device' ? 'rgba(16,185,129,0.15)' : '#F1F5F9', color: gpsMode === 'live_device' ? '#10B981' : DIM }}
              />
              {activeIncident && (
                <Typography sx={{ fontSize:'10px', color:G, fontWeight: 700 }}>
                  ETA: {routeInfo.etaMins}m ({routeInfo.distanceKm} km)
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <Box sx={{ width:6, height:6, borderRadius:'50%', background:G, animation:'blinkDot 2s infinite' }} />
              <Typography sx={{ fontSize:'9.5px', fontWeight:700, color:G }}>
                {isBackgrounded ? 'BG' : 'LIVE'}
              </Typography>
            </Box>
            <IconButton onClick={signOut} size="small" title="Sign out" sx={{ color: DIM, p: '4px', '&:hover': { color: RED, bgcolor: 'rgba(239,68,68,0.1)' } }}>
              <Logout sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        {/* ══ INCOMING DISPATCH BANNER ══ */}
        {alertIncident && (
          <IncomingAlert
            incident={alertIncident}
            onAccept={handleAccept}
            onReject={() => setAlertIncident(null)}
          />
        )}

        {/* ══ TAB STRIP (only when mission active) ══ */}
        {activeIncident && (
          <Box sx={{ flexShrink:0, display:'flex', gap:'6px', px:'12px', py:'8px', background:'rgba(11,43,38,0.6)', borderBottom:`1px solid ${BORDER}` }}>
            {[['mission','Mission'],['checklist','Checklist']].map(([val,lbl])=>(
              <Box
                key={val}
                onClick={()=>setActiveTab(val)}
                sx={{
                  flex:1, textAlign:'center', py:'6px', borderRadius:'8px',
                  fontSize:'12px', fontWeight:700, cursor:'pointer',
                  color: activeTab===val ? BG : DIM,
                  background: activeTab===val ? G : 'rgba(142,182,155,0.06)',
                  transition:'all 0.15s',
                }}
              >
                {lbl}
              </Box>
            ))}
          </Box>
        )}

        {/* ══ SCROLLABLE MAIN LAYOUT AREA ══ */}
        <Box sx={{ flex:1, overflow:'auto', padding:'12px 12px 110px' }}>

          {/* Map box */}
          <Box sx={{ height:'170px', borderRadius:'14px', overflow:'hidden', position:'relative', border:`1px solid ${BORDER}`, marginBottom:'12px' }}>
            <DriverMap
              driverPos={driverPos}
              incident={activeIncident}
              missionStatus={activeIncident ? missionStatus : null}
              hospital={activeIncident?.hospital}
            />
          </Box>

          {/* Status cards strip */}
          <Box sx={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
            {[
              { label:'SPEED',  value:`${speed} km/h` },
              { label:'STATUS', value: activeIncident ? STATUS_LABELS[missionStatus] || missionStatus : 'Standby' },
              { label:'QUEUE',  value: incidentQueue.length },
            ].map(item => (
              <Box key={item.label} sx={{ flex:1, background:SURF2, border:`1px solid ${BORDER}`, borderRadius:'11px', padding:'9px', textAlign:'center' }}>
                <Typography sx={{ fontSize:'9px', color:DIM, marginBottom:'3px', letterSpacing:'0.05em' }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontSize:'12.5px', fontWeight:700, color:TEXT }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Active mission workflow card */}
          {activeIncident && activeTab === 'mission' && (
            <>
              {/* ETA Countdown ring indicator */}
              <ETACountdown
                missionStatus={missionStatus}
                driverPos={driverPos}
                incidentPos={
                  missionStatus === 'EN_ROUTE'
                    ? { lat: activeIncident.location_lat || 12.9784, lng: activeIncident.location_lng || 77.6408 }
                    : selectedHospital || { lat: 12.9550, lng: 77.6445 }
                }
                speed={speed}
              />

              <ActiveMission
                incident={activeIncident}
                status={missionStatus}
                onStatusUpdate={handleStatusUpdate}
              />

              {/* Quick Radio Preset buttons grid */}
              <QuickRadioPanel
                onMessage={(msg) => {
                  setToast({ msg: `Radio: "${msg.label}" transmitted`, sev: 'success' });
                  dispatchBroadcast.emit(DISPATCH_EVENTS.INCIDENT_UPDATED, {
                    id: activeIncident.id,
                    status: missionStatus,
                    notes: `Radio: ${msg.text}`
                  });
                }}
              />

              {/* Patient Vitals — shown on scene */}
              {missionStatus === 'ON_SCENE' && (
                <PatientVitalsForm
                  key={activeIncident.id}
                  onSubmit={(data) => { setVitalsSubmitted(true); setToast({ msg:'Vitals transmitted to dispatch', sev:'success' }); }}
                />
              )}

              {/* Hospital Selector — shown when transporting */}
              {missionStatus === 'TRANSPORTING' && (
                <HospitalSelector
                  incidentType={activeIncident.incident_type}
                  onSelect={(h) => { setSelectedHospital(h); setToast({ msg:`Destination: ${h.name}`, sev:'success' }); }}
                />
              )}
            </>
          )}

          {/* Checklist tab content */}
          {activeIncident && activeTab === 'checklist' && (
            <MedicalChecklist
              phase={checklistPhase}
              key={checklistPhase}
              onComplete={() => setToast({ msg:`${checklistPhase.replace(/_/g,' ')} checklist complete`, sev:'success' })}
            />
          )}

          {/* Pending incidents list */}
          {!activeIncident && (
            <Box>
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <Typography sx={{ fontSize:'12.5px', fontWeight:700, color:DIM }}>Pending Incidents</Typography>
                <Typography component="span" sx={{ fontSize:'11px', fontWeight:700, color:RED, background:'rgba(226,92,80,0.12)', borderRadius:'6px', padding:'2px 8px;' }}>
                  {incidentQueue.length}
                </Typography>
              </Box>

              {incidentQueue.map(inc => {
                const sc = SEV_COLOR[inc.severity] || AMBER;
                return (
                  <Box
                    key={inc.id}
                    onClick={() => setAlertIncident(inc)}
                    sx={{
                      padding:'13px', borderRadius:'13px', marginBottom:'10px', cursor:'pointer',
                      background:'rgba(142,182,155,0.055)', border:`1px solid ${BORDER}`,
                      transition:'all 0.15s',
                      '&:hover':{ background:'#E2E8F0' },
                    }}
                  >
                    <Box sx={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px' }}>
                      <Box sx={{ width:8, height:8, borderRadius:'50%', background:sc }} />
                      <Typography sx={{ fontSize:13, fontWeight:700, color:TEXT, flex:1 }}>
                        {inc.incident_type}
                      </Typography>
                      <Box sx={{ fontSize:'10px', fontWeight:700, color:sc, background:SEV_BG[inc.severity], padding:'2px 7px', borderRadius:'6px' }}>
                        {inc.severity}
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize:'11px', color:DIM, paddingLeft:'16px', marginBottom:'3px' }}>
                      {inc.location_address}
                    </Typography>
                    <Typography sx={{ fontSize:'11px', color:sc, paddingLeft:'16px', fontWeight:600 }}>
                      {inc.distance} away · ETA {inc.eta}
                    </Typography>
                  </Box>
                );
              })}

              {incidentQueue.length === 0 && (
                <Box sx={{ textAlign:'center', py:5 }}>
                  <Typography sx={{ fontSize:13, color:DIM }}>No pending incidents.</Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Panic Emergency Backup Alert trigger */}
          <Box sx={{ mt: '20px' }}>
            <PanicButton
              driverPos={driverPos}
              callSign={MOCK_DRIVER.callSign}
              onPanic={(panicData) => {
                setToast({ msg: 'MAYDAY Alert Transmitted!', sev: 'error' });
                dispatchBroadcast.emit(DISPATCH_EVENTS.SOS_CREATED, {
                  id: `PANIC-${Date.now()}`,
                  incident_type: 'Officer Emergency',
                  severity: 'CRITICAL',
                  location_address: 'Officer Panic Button Activated',
                  location_lat: driverPos.lat,
                  location_lng: driverPos.lng,
                  caller_name: MOCK_DRIVER.name,
                  caller_phone: MOCK_DRIVER.vehicle,
                  patients_count: 1,
                  description: panicData.message,
                  created_at: panicData.timestamp,
                  is_sos: true,
                });
              }}
            />
          </Box>
        </Box>

        {/* ══ FIXED BOTTOM ACTION FOOTER BAR ══ */}
        {alertIncident && (
          <Box sx={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 16px', background:'#FFFFFF', backdropFilter:'blur(10px)', borderTop:`1px solid ${BORDER2}`, display:'flex', gap:'10px', zIndex:10 }}>
            <Button onClick={() => setAlertIncident(null)} sx={{ flex:1, padding:'13px', borderRadius:'11px', border:`1px solid ${RED}`, background:'rgba(226,92,80,0.12)', color:RED, fontWeight:700, fontSize:'13px', '&:hover':{ background:'rgba(226,92,80,0.20)' } }}>
              Decline
            </Button>
            <Button onClick={handleAccept} sx={{ flex:1.6, padding:'13px', borderRadius:'11px', border:'none', background:G, color:BG, fontWeight:800, fontSize:'13px', '&:hover':{ background:'#7AA887' } }}>
              Accept &amp; Dispatch
            </Button>
          </Box>
        )}

        {activeIncident && !alertIncident && !isComplete && (
          <Box sx={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 16px', background:'#FFFFFF', backdropFilter:'blur(10px)', borderTop:`1px solid ${BORDER2}`, zIndex:10 }}>
            {nextAction && (
              <Button fullWidth onClick={() => handleStatusUpdate(nextAction.next)} sx={{ width:'100%', padding:'14px', borderRadius:'11px', border:'none', background:G, color:BG, fontWeight:800, fontSize:'13.5px', marginBottom:'8px', '&:hover':{ background:'#7AA887' } }}>
                {nextAction.label}
              </Button>
            )}
            <Box sx={{ display:'flex', gap:'8px' }}>
              <Button href={`tel:${activeIncident.caller_phone}`} sx={{ flex:1, padding:'9px', borderRadius:'9px', border:`1px solid ${BORDER2}`, color:TEXT, fontSize:'11.5px', '&:hover':{ background:'rgba(142,182,155,0.06)' } }}>
                Call Dispatch
              </Button>
              <Button
                onClick={()=>setActiveTab(t=>t==='checklist'?'mission':'checklist')}
                sx={{ flex:1, padding:'9px', borderRadius:'9px', border:`1px solid ${activeTab==='checklist' ? G : BORDER2}`, color: activeTab==='checklist' ? G : TEXT, fontSize:'11.5px', '&:hover':{ background:'rgba(142,182,155,0.06)' } }}
              >
                {activeTab==='checklist' ? '← Mission' : 'Checklist'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Global Toast snackbar alerts */}
        <Snackbar open={!!toast} autoHideDuration={4000} onClose={()=>setToast(null)} anchorOrigin={{vertical:'bottom',horizontal:'center'}}>
          <Alert severity={toast?.sev||'info'} onClose={()=>setToast(null)} sx={{ background:SURFACE, color:TEXT, border:`1px solid ${BORDER2}` }}>
            {toast?.msg}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}
