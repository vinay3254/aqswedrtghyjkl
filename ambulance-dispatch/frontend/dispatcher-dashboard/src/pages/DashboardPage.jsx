import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Snackbar, Alert, Badge } from '@mui/material';
import {
  Notifications, Refresh, Add, FilterList,
  Close, AutoAwesome, CheckCircle, Warning
} from '@mui/icons-material';

import DispatchMap from '../components/DispatchMap';
import IncidentQueue from '../components/IncidentQueue';
import StatsCards from '../components/StatsCards';
import AssignmentWizard from '../components/AssignmentWizard';
import SOSAlertModal from '../components/SOSAlertModal';
import LiveTrackingPanel from '../components/LiveTrackingPanel';
import HospitalStatusPanel from '../components/HospitalStatusPanel';
import ActivityFeed from '../components/ActivityFeed';
import ShiftReportModal from '../components/ShiftReportModal';
import IncidentTimeline from '../components/IncidentTimeline';
import QuickCommsPanel from '../components/QuickCommsPanel';
import WeatherWidget from '../components/WeatherWidget';
import { useIncidents, useAmbulances, useHospitals, useDashboardStats } from '../hooks/useData';
import socketService from '../services/socket';
import { incidentsApi } from '../services/api';
import { dispatchBroadcast, DISPATCH_EVENTS } from '../services/dispatchBroadcast';
import { useNavigate } from 'react-router-dom';
import GreenCorridorModal from '../components/GreenCorridorModal';
import { Traffic } from '@mui/icons-material';

/* ── Evergreen tokens ── */
const BG      = '#F8FAFC';
const SURFACE = '#FFFFFF';
const G       = '#2563EB';
const TEXT    = '#0F172A';
const DIM     = '#475569';
const FAINT   = '#94A3B8';
const BORDER  = '#E2E8F0';
const BORDER2 = '#CBD5E1';
const RED     = '#E25C50';
const SIDEBAR = 260;

/* ── SVG cross icon ── */
function CrossIcon({ size = 14, color = G }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2.5v11M2.5 8h11" stroke={color} strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  );
}

/* ── Tab pill ── */
function TabPill({ label, active, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: 1, textAlign: 'center', py: '6px', borderRadius: '7px',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        color: active ? BG : TEXT,
        background: active ? G : 'transparent',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </Box>
  );
}

export default function DashboardPage({ user, onLogout }) {
  const { incidents: remoteIncidents, loading: incidentsLoading, refetch: refetchIncidents } = useIncidents();
  const { ambulances, loading: ambulancesLoading, refetch: refetchAmbulances } = useAmbulances();
  const { hospitals } = useHospitals();
  const { stats } = useDashboardStats();

  const [sosIncidents, setSosIncidents]         = useState([]);
  const incidents = [...sosIncidents, ...remoteIncidents];

  const [selectedIncident, setSelectedIncident]     = useState(null);
  const [activeAssignment, setActiveAssignment]     = useState(null);
  const [focusAmbulance, setFocusAmbulance]         = useState(null);
  const [tabValue, setTabValue]                     = useState(0);
  const [wizardOpen, setWizardOpen]                 = useState(false);
  const [sosModalOpen, setSosModalOpen]             = useState(false);
  const [shiftReportOpen, setShiftReportOpen]       = useState(false);
  const [fleetOpen, setFleetOpen]                   = useState(false);
  const [hospitalOpen, setHospitalOpen]             = useState(false);
  const [activityOpen, setActivityOpen]             = useState(false);
  const [timelineOpen, setTimelineOpen]             = useState(false);
  const [commsOpen, setCommsOpen]                   = useState(false);
  const [snackbar, setSnackbar]                     = useState(null);
  const [autoDispatchLoading, setAutoDispatchLoading] = useState(false);
  const [autoDispatchResult, setAutoDispatchResult]   = useState(null);
  const [fleetAmbulances, setFleetAmbulances]       = useState([]);
  const [greenCorridorOpen, setGreenCorridorOpen]   = useState(false);
  const navigate = useNavigate();

  // Ensure only one right-panel open at a time
  const openFleet    = () => { setFleetOpen(true);    setHospitalOpen(false); setActivityOpen(false); setTimelineOpen(false); setCommsOpen(false); };
  const openHospital = () => { setHospitalOpen(true); setFleetOpen(false);    setActivityOpen(false); setTimelineOpen(false); setCommsOpen(false); };
  const openActivity = () => { setActivityOpen(true); setFleetOpen(false);    setHospitalOpen(false); setTimelineOpen(false); setCommsOpen(false); };
  const openTimeline = () => { setTimelineOpen(true); setFleetOpen(false);    setHospitalOpen(false); setActivityOpen(false); setCommsOpen(false); };
  const openComms    = () => { setCommsOpen(true);    setFleetOpen(false);    setHospitalOpen(false); setActivityOpen(false); setTimelineOpen(false); };
  const closeAll     = () => { setFleetOpen(false);   setHospitalOpen(false); setActivityOpen(false); setTimelineOpen(false); setCommsOpen(false); };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) socketService.connect(token);
    return () => socketService.disconnect();
  }, []);

  /* ── Incident handlers ── */
  const handleIncidentSelect = (incident) => {
    setSelectedIncident(incident);
    setActiveAssignment(null);
    // Auto-open timeline when an incident is selected
    if (incident) openTimeline();
  };

  const handleAcknowledge = async () => {
    if (!selectedIncident) return;
    if (selectedIncident.is_sos) {
      setSosIncidents(prev => prev.map(i => i.id === selectedIncident.id ? { ...i, status:'ACKNOWLEDGED' } : i));
      setSelectedIncident(prev => prev ? { ...prev, status:'ACKNOWLEDGED' } : prev);
      setSnackbar({ message: 'Incident acknowledged', severity: 'success' });
      return;
    }
    try { await incidentsApi.acknowledge(selectedIncident.id); refetchIncidents(); }
    catch (err) { console.error('Acknowledge failed:', err); }
  };

  /* ── AI Auto-Dispatch ── */
  const handleAutoDispatch = async () => {
    if (!selectedIncident) return;
    setAutoDispatchLoading(true);
    setAutoDispatchResult(null);
    await new Promise(r => setTimeout(r, 800));

    const iLat = selectedIncident.location_lat, iLng = selectedIncident.location_lng;

    function hav(lat1, lon1, lat2, lon2) {
      const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    const avail = ambulances.filter(a => a.latitude && a.longitude && a.status === 'AVAILABLE');
    if (!avail.length) { setSnackbar({ message:'No available ambulances', severity:'error' }); setAutoDispatchLoading(false); return; }

    const bestAmb = avail.reduce((b,a) => { const d=hav(a.latitude,a.longitude,iLat,iLng); return d<b.dist?{amb:a,dist:d}:b; }, { amb:avail[0], dist:Infinity }).amb;
    const availH  = hospitals.filter(h => h.latitude && h.longitude && (h.available_beds||0)>0);
    const bestH   = availH.length ? availH.reduce((b,h) => { const d=hav(iLat,iLng,h.latitude,h.longitude); const sc=(1/(d+0.1))*0.6+((h.available_beds||0)/50)*0.4; return sc>b.score?{hosp:h,score:sc,distKm:d}:b; }, { hosp:availH[0], score:-Infinity, distKm:0 }) : null;

    const ambDist = hav(bestAmb.latitude, bestAmb.longitude, iLat, iLng);
    const eta = Math.ceil(ambDist/40*60);

    const result = {
      ambulance: bestAmb, hospital: bestH?.hosp||null,
      ambDistKm: ambDist.toFixed(1), hospDistKm: bestH?.distKm?.toFixed(1)||'?', eta,
      reasoning: [
        `Nearest unit: ${bestAmb.call_sign||bestAmb.vehicle_number} · ${ambDist.toFixed(1)} km`,
        bestH ? `Best hospital: ${bestH.hosp.name} · ${bestH.hosp.available_beds} beds · ${bestH.distKm.toFixed(1)} km` : 'No hospitals available',
        `Estimated arrival: ~${eta} min`,
        selectedIncident.severity==='CRITICAL' ? 'Green corridor recommended — critical case' : null,
      ].filter(Boolean),
    };

    setAutoDispatchResult(result);
    setAutoDispatchLoading(false);

    setTimeout(() => {
      const ci = selectedIncident;
      const fa = ambulances.find(a=>a.id===result.ambulance?.id)||result.ambulance;
      const fh = hospitals.find(h=>h.id===result.hospital?.id)||result.hospital;
      const enriched = { ambulance:fa, hospital:fh, incident:ci, id:ci.id, incident_type:ci.incident_type, severity:ci.severity, location_address:ci.location_address, location_lat:ci.location_lat, location_lng:ci.location_lng, distance:`${result.ambDistKm} km`, eta:`${result.eta} min`, hospital_name:fh?.name, _isAssignment:true, _autoDispatched:true };
      setActiveAssignment(enriched);
      dispatchBroadcast.send(DISPATCH_EVENTS.INCIDENT_ASSIGNED, enriched);
      setAutoDispatchResult(null);
      setSelectedIncident(null);
      setSnackbar({ message:`Auto-dispatched ${bestAmb.call_sign||bestAmb.vehicle_number}`, severity:'success' });
      refetchIncidents(); refetchAmbulances();
    }, 2200);
  };

  const handleAssignmentCreated = (assignment) => {
    const ci = selectedIncident;
    refetchIncidents(); refetchAmbulances();
    if (assignment && ci) {
      const fa = ambulances.find(a=>a.id===assignment.ambulance?.id)||assignment.ambulance;
      const fh = hospitals.find(h=>h.id===assignment.hospital?.id)||assignment.hospital;
      const enriched = { ambulance:fa, hospital:fh, incident:ci, id:ci.id, incident_type:ci.incident_type, severity:ci.severity, location_address:ci.location_address, location_lat:ci.location_lat, location_lng:ci.location_lng, caller_name:ci.caller_name, caller_phone:ci.caller_phone, patients_count:ci.patients_count||1, description:ci.description, is_sos:ci.is_sos, distance:`${(Math.random()*4+1).toFixed(1)} km`, eta:`${fa?.eta_minutes||6} min`, hospital_name:fh?.name, _isAssignment:true };
      setActiveAssignment(enriched);
      dispatchBroadcast.send(DISPATCH_EVENTS.INCIDENT_ASSIGNED, enriched);
    }
    setSelectedIncident(null);
  };

  const handleSOSCreated = useCallback((inc) => {
    setSosIncidents(prev => [inc, ...prev]);
    setSnackbar({ message:`SOS Alert: ${inc.incident_type}`, severity:'error' });
    setSosModalOpen(false);
    dispatchBroadcast.send(DISPATCH_EVENTS.SOS_CREATED, inc);
  }, []);

  const activeCount  = incidents.filter(i=>!['RESOLVED','CANCELLED'].includes(i.status)).length;
  const pendingCount = incidents.filter(i=>i.status==='PENDING').length;

  const tabs = ['Active','Pending','All'];

  return (
    <Box sx={{ display:'flex', flexDirection:'column', height:'100vh', width:'100vw', background:BG, overflow:'hidden', position:'fixed', top:0, left:0 }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '10px', px: '16px',
        background: SURFACE,
        borderBottom: `1px solid ${BORDER}`,
        zIndex: 200, overflow: 'hidden',
      }}>
        {/* Logo & Main Nav */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Box sx={{ width:32, height:32, borderRadius:'9px', background:'rgba(37,99,235,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <CrossIcon size={14} color={G} />
          </Box>
          <Typography sx={{ fontSize:13, fontWeight:800, color:TEXT, whiteSpace:'nowrap', mr: 1 }}>
            Dispatch Center
          </Typography>
        </Box>

        {/* Global Navigation Tabs */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Button
            size="small"
            sx={{ px: '10px', py: '5px', borderRadius: '8px', bgcolor: 'rgba(37,99,235,0.12)', color: G, fontWeight: 700, fontSize: '11px', textTransform: 'none' }}
          >
            Live Command
          </Button>
          <Button
            size="small" onClick={() => navigate('/insights')}
            sx={{ px: '10px', py: '5px', borderRadius: '8px', color: DIM, fontWeight: 600, fontSize: '11px', textTransform: 'none', '&:hover': { bgcolor: '#F1F5F9', color: TEXT } }}
          >
            AI Insights
          </Button>
          <Button
            size="small" onClick={() => navigate('/analytics')}
            sx={{ px: '10px', py: '5px', borderRadius: '8px', color: DIM, fontWeight: 600, fontSize: '11px', textTransform: 'none', '&:hover': { bgcolor: '#F1F5F9', color: TEXT } }}
          >
            Analytics & SLAs
          </Button>
          <Button
            size="small" onClick={() => navigate('/mobile')}
            sx={{ px: '10px', py: '5px', borderRadius: '8px', color: DIM, fontWeight: 600, fontSize: '11px', textTransform: 'none', '&:hover': { bgcolor: '#F1F5F9', color: TEXT } }}
          >
            Fleet Telemetry
          </Button>
        </Box>

        <Box sx={{ flex:1 }} />
        {/* Weather widget — compact in header */}
        <WeatherWidget compact />
        <Box sx={{ flex:1 }} />

        {/* Green Corridor Trigger */}
        <Button
          onClick={() => setGreenCorridorOpen(true)}
          startIcon={<Traffic sx={{ fontSize: 14 }} />}
          sx={{
            px:'10px', py:'6px', borderRadius:'8px', border:`1px solid ${BORDER2}`, color:TEXT, fontWeight:700, fontSize:'11px', flexShrink:0,
            textTransform: 'none', '&:hover':{ background:'#F1F5F9' }
          }}
        >
          Green Corridor
        </Button>

        {/* SOS button */}
        <Button
          onClick={() => setSosModalOpen(true)}
          sx={{
            display:'flex', alignItems:'center', gap:'6px', flexShrink:0,
            px:'11px', py:'6px', borderRadius:'8px',
            background: RED, color:'white', fontWeight:700, fontSize:'11.5px',
            animation: 'sosPulse 2s infinite',
            '&:hover': { background:'#c94a3f' },
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M12 3.5L22 20H2L12 3.5z" stroke="white" strokeWidth="2.2" strokeLinejoin="round"/>
            <line x1="12" y1="10" x2="12" y2="14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="1.1" fill="white"/>
          </svg>
          SOS Alert
        </Button>

        {/* Shift Report */}
        <Button
          onClick={() => setShiftReportOpen(true)}
          sx={{ px:'10px', py:'6px', borderRadius:'8px', border:`1px solid ${BORDER2}`, color:TEXT, fontWeight:600, fontSize:'11px', flexShrink:0, '&:hover':{ background:'#F1F5F9' } }}
        >
          Shift Report
        </Button>

        {/* Driver view */}
        <Button
          onClick={() => window.open('/#/driver', '_blank')}
          sx={{ px:'10px', py:'6px', borderRadius:'8px', border:`1px solid ${BORDER2}`, color:TEXT, fontWeight:600, fontSize:'11px', flexShrink:0, '&:hover':{ background:'#F1F5F9' } }}
        >
          Driver View
        </Button>

        {/* Comms panel toggle */}
        <Tooltip title="Quick Comms">
          <Box
            onClick={() => commsOpen ? closeAll() : openComms()}
            sx={{ width:34, height:34, borderRadius:'9px', background: commsOpen ? 'rgba(142,182,155,0.18)' : '#F1F5F9', border:`1px solid ${commsOpen ? 'rgba(142,182,155,0.35)' : 'transparent'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={commsOpen ? G : TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </Box>
        </Tooltip>

        {/* Hospital panel toggle */}
        <Tooltip title="Hospital Status">
          <Box
            onClick={() => hospitalOpen ? closeAll() : openHospital()}
            sx={{ width:34, height:34, borderRadius:'9px', background: hospitalOpen ? 'rgba(142,182,155,0.18)' : '#F1F5F9', border:`1px solid ${hospitalOpen ? 'rgba(142,182,155,0.35)' : 'transparent'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.5v11M2.5 8h11" stroke={hospitalOpen ? '#2563EB' : TEXT} strokeWidth="2.3" strokeLinecap="round"/>
            </svg>
          </Box>
        </Tooltip>

        {/* Activity feed toggle */}
        <Tooltip title="Activity Feed">
          <Box
            onClick={() => activityOpen ? closeAll() : openActivity()}
            sx={{ position:'relative', width:34, height:34, borderRadius:'9px', background: activityOpen ? 'rgba(142,182,155,0.18)' : '#F1F5F9', border:`1px solid ${activityOpen ? 'rgba(142,182,155,0.35)' : 'transparent'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}
          >
            <Notifications sx={{ fontSize:16, color: activityOpen ? G : TEXT }} />
            {pendingCount > 0 && (
              <Box sx={{ position:'absolute', top:-4, right:-4, background:RED, color:'white', fontSize:'9px', fontWeight:800, borderRadius:'8px', px:'5px', py:'1px' }}>
                {pendingCount}
              </Box>
            )}
          </Box>
        </Tooltip>

        {/* Live Fleet toggle */}
        <Tooltip title={fleetOpen ? 'Close Fleet' : 'Live Fleet'}>
          <Box
            onClick={() => fleetOpen ? closeAll() : openFleet()}
            sx={{ width:34, height:34, borderRadius:'9px', background: fleetOpen ? 'rgba(142,182,155,0.18)' : '#F1F5F9', border:`1px solid ${fleetOpen ? 'rgba(142,182,155,0.35)' : 'transparent'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={fleetOpen ? G : TEXT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="13" height="9" rx="2"/>
              <path d="M15 10h4l3 3v3h-7"/>
              <circle cx="7" cy="18" r="1.6"/>
              <circle cx="18" cy="18" r="1.6"/>
            </svg>
          </Box>
        </Tooltip>

        {/* Refresh */}
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => { refetchIncidents(); refetchAmbulances(); }} sx={{ color:TEXT, background:'#F1F5F9', borderRadius:'9px' }}>
            <Refresh sx={{ fontSize:16 }} />
          </IconButton>
        </Tooltip>

        {/* Avatar */}
        <Box sx={{ width:34, height:34, borderRadius:'50%', background:'#E2E8F0', color:TEXT, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'12.5px' }}>
          {user?.name?.[0]||'D'}
        </Box>
      </Box>

      {/* ══ BODY ════════════════════════════════════════════════════════════════ */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, overflow: 'hidden' }}>

        {/* ── Left Sidebar ── */}
        <Box sx={{
          width: '260px',
          minWidth: '260px',
          maxWidth: '260px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: SURFACE,
          borderRight: `1px solid ${BORDER}`,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2,
        }}>
          {/* Sidebar header */}
          <Box sx={{ p:'16px 16px 10px' }}>
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'12px' }}>
              <Box sx={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <Typography sx={{ fontSize:14, fontWeight:700, color:TEXT }}>Incidents</Typography>
                <Box sx={{ fontSize:11, fontWeight:700, px:'8px', py:'2px', borderRadius:'6px', color:RED, background:'rgba(226,92,80,0.14)' }}>
                  {activeCount}
                </Box>
              </Box>
              <Box sx={{ display:'flex', gap:'6px' }}>
                <Tooltip title="New SOS">
                  <Box onClick={() => setSosModalOpen(true)} sx={{ width:26, height:26, borderRadius:'7px', background:'rgba(226,92,80,0.12)', color:RED, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16 }}>
                    +
                  </Box>
                </Tooltip>
                <Box sx={{ width:26, height:26, borderRadius:'7px', background:'#F1F5F9', color:DIM, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                  <FilterList sx={{ fontSize:14 }} />
                </Box>
              </Box>
            </Box>

            {/* Tab pills */}
            <Box sx={{ display:'flex', gap:'4px', background:'#F1F5F9', borderRadius:'9px', p:'3px' }}>
              {tabs.map((t,i) => (
                <TabPill key={t} label={t} active={tabValue===i} onClick={() => setTabValue(i)} />
              ))}
            </Box>
          </Box>

          {/* Incident list */}
          <Box sx={{ flex:1, overflow:'auto' }}>
            <IncidentQueue
              incidents={incidents}
              onSelect={handleIncidentSelect}
              selectedId={selectedIncident?.id}
              filter={['active','pending','all'][tabValue]}
            />
          </Box>

          {/* Selected incident action panel */}
          {selectedIncident && (
            <Box sx={{ p:'16px', borderTop:`1px solid ${BORDER}`, background:'rgba(0,0,0,0.03)', animation:'fadeUp 0.2s ease' }}>
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'10px' }}>
                <Typography sx={{ fontSize:13, fontWeight:700, color:TEXT }}>
                  {selectedIncident.incident_type}
                </Typography>
                <IconButton size="small" onClick={() => setSelectedIncident(null)} sx={{ color:FAINT, p:'2px' }}>
                  <Close sx={{ fontSize:16 }} />
                </IconButton>
              </Box>

              {/* AI result preview */}
              {autoDispatchResult && (
                <Box sx={{ mb:'9px', p:'10px 11px', borderRadius:'9px', background:'#F1F5F9', border:`1px solid #E2E8F0` }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:'6px', mb:'7px' }}>
                    <Box sx={{ width:10, height:10, borderRadius:'50%', border:`2px solid rgba(142,182,155,0.3)`, borderTopColor:G, animation:'spin360 0.7s linear infinite' }} />
                    <Typography sx={{ fontSize:'11.5px', color:G, fontWeight:600 }}>AI deciding…</Typography>
                  </Box>
                  {autoDispatchResult.reasoning.map((line,i) => (
                    <Box key={i} sx={{ display:'flex', alignItems:'flex-start', gap:'6px', mb:'3px' }}>
                      <CheckCircle sx={{ fontSize:11, color:G, mt:'2px', flexShrink:0 }} />
                      <Typography sx={{ fontSize:10.5, color:DIM, lineHeight:1.4 }}>{line}</Typography>
                    </Box>
                  ))}
                  <Typography sx={{ fontSize:10, color:FAINT, mt:'6px' }}>Dispatching in 2 seconds…</Typography>
                </Box>
              )}

              {/* Primary: AI Auto-Dispatch */}
              {['PENDING','ACKNOWLEDGED'].includes(selectedIncident.status) && (
                <Button
                  fullWidth onClick={handleAutoDispatch} disabled={autoDispatchLoading}
                  sx={{
                    mb:'8px', py:'11px', borderRadius:'10px', border:'none',
                    background: autoDispatchLoading ? 'rgba(142,182,155,0.3)' : G,
                    color: BG, fontWeight:800, fontSize:'12.5px',
                    '&:disabled': { opacity:0.6 },
                    '&:hover': { background:'#7AA887' },
                  }}
                >
                  {autoDispatchLoading
                    ? <Box sx={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <Box sx={{ width:12, height:12, borderRadius:'50%', border:'2px solid #FFFFFF', borderTopColor:BG, animation:'spin360 0.7s linear infinite' }} />
                        Analysing…
                      </Box>
                    : <>
                        <AutoAwesome sx={{ fontSize:14, mr:'6px' }} />
                        AI Auto-Dispatch
                      </>
                  }
                </Button>
              )}

              {/* Secondary actions */}
              <Box sx={{ display:'flex', gap:'8px', mb: '8px' }}>
                {selectedIncident.status === 'PENDING' && (
                  <Button onClick={handleAcknowledge} sx={{ flex:1, py:'8px', borderRadius:'9px', border:`1px solid ${BORDER2}`, color:DIM, fontSize:'11.5px', fontWeight:600, '&:hover':{ background:'rgba(142,182,155,0.06)' } }}>
                    Acknowledge
                  </Button>
                )}
                {['PENDING','ACKNOWLEDGED'].includes(selectedIncident.status) && (
                  <Button onClick={() => setWizardOpen(true)} sx={{ flex:1, py:'8px', borderRadius:'9px', border:`1px solid ${BORDER2}`, color:DIM, fontSize:'11.5px', fontWeight:600, '&:hover':{ background:'rgba(142,182,155,0.06)' } }}>
                    Assign Manually
                  </Button>
                )}
              </Box>

              {/* Status Transition Lifecycle Controls */}
              {['DISPATCHED','EN_ROUTE','ON_SCENE','TRANSPORTING'].includes(selectedIncident.status) && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {selectedIncident.status === 'DISPATCHED' && (
                    <Button
                      fullWidth size="small" variant="contained"
                      onClick={() => {
                        setSelectedIncident(prev => ({ ...prev, status: 'EN_ROUTE' }));
                        setSnackbar({ message: 'Ambulance marked En Route', severity: 'info' });
                      }}
                      sx={{ bgcolor: G, color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                    >
                      Mark Unit En Route →
                    </Button>
                  )}
                  {selectedIncident.status === 'EN_ROUTE' && (
                    <Button
                      fullWidth size="small" variant="contained"
                      onClick={() => {
                        setSelectedIncident(prev => ({ ...prev, status: 'ON_SCENE' }));
                        setSnackbar({ message: 'Ambulance arrived On Scene', severity: 'warning' });
                      }}
                      sx={{ bgcolor: '#8B5CF6', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                    >
                      Mark Arrived On Scene →
                    </Button>
                  )}
                  {selectedIncident.status === 'ON_SCENE' && (
                    <Button
                      fullWidth size="small" variant="contained"
                      onClick={() => {
                        setSelectedIncident(prev => ({ ...prev, status: 'TRANSPORTING' }));
                        setSnackbar({ message: 'Patient in transit to ER', severity: 'error' });
                      }}
                      sx={{ bgcolor: RED, color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                    >
                      Depart Scene (In Transit to ER) →
                    </Button>
                  )}
                  {selectedIncident.status === 'TRANSPORTING' && (
                    <Button
                      fullWidth size="small" variant="contained"
                      onClick={() => {
                        setSelectedIncident(prev => ({ ...prev, status: 'RESOLVED' }));
                        setSnackbar({ message: 'Emergency Resolved. Hospital Handover Complete.', severity: 'success' });
                      }}
                      sx={{ bgcolor: '#10B981', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                    >
                      Complete Handover & Resolve Incident ✓
                    </Button>
                  )}
                  <Button
                    fullWidth size="small" variant="outlined"
                    onClick={() => setGreenCorridorOpen(true)}
                    startIcon={<Traffic sx={{ fontSize: 14 }} />}
                    sx={{ borderColor: RED, color: RED, fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                  >
                    Activate Green Corridor Preemption
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* ── Map area (flex column: stats row + map) ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', height: '100%' }}>

          {/* ── Stats row — sits above the map in normal flow ── */}
          <Box sx={{
            display:'flex', gap:'8px', alignItems:'center',
            px:'12px', py:'8px', flexShrink:0,
            background: BG,
            borderBottom: `1px solid ${BORDER}`,
            overflow: 'hidden',
          }}>
            <StatsCards stats={stats} incidents={incidents} ambulances={ambulances} hospitals={hospitals} />
          </Box>

          {/* ── Map — fills all remaining height ── */}
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
            <DispatchMap
              incidents={incidents.filter(i=>!['RESOLVED','CANCELLED'].includes(i.status))}
              ambulances={fleetAmbulances.length>0 ? fleetAmbulances : ambulances}
              hospitals={hospitals}
              selectedIncident={selectedIncident}
              activeAssignment={activeAssignment}
              focusAmbulance={focusAmbulance}
              onIncidentClick={handleIncidentSelect}
              onAmbulanceClick={setFocusAmbulance}
              onHospitalClick={(h)=>console.log('Hospital:',h)}
            />

            {/* Map legend — bottom left */}
            <Box sx={{
              position:'absolute', bottom:14, left:14, zIndex:1000,
              display:'flex', gap:'12px',
              background:'#FFFFFF',
              px:'12px', py:'7px', borderRadius:'9px', border:`1px solid ${BORDER}`,
            }}>
              {[{color:RED,label:'Critical'},{color:'#E3A94F',label:'High'},{color:G,label:'Available'}].map(item=>(
                <Box key={item.label} sx={{ display:'flex', alignItems:'center', gap:'5px', fontSize:11, color:DIM }}>
                  <Box sx={{ width:7, height:7, borderRadius:'50%', background:item.color }} />
                  {item.label}
                </Box>
              ))}
            </Box>

            {/* Fleet slide-in panel */}
            <Box sx={{
              position: 'absolute', top:0, right:0, bottom:0, width:290,
              background: '#FFFFFF',
              borderLeft: `1px solid ${BORDER}`,
              display:'flex', flexDirection:'column',
              transform: fleetOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.25s ease',
              zIndex: 1000,
            }}>
              <LiveTrackingPanel
                ambulances={ambulances}
                onFleetUpdate={setFleetAmbulances}
                onAmbulanceSelect={(amb) => setFocusAmbulance({...amb, _ts:Date.now()})}
              />
            </Box>

            {/* Hospital status slide-in panel */}
            <Box sx={{
              position: 'absolute', top:0, right:0, bottom:0, width:290,
              background: '#FFFFFF',
              borderLeft: `1px solid ${BORDER}`,
              display:'flex', flexDirection:'column',
              transform: hospitalOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.25s ease',
              zIndex: 1000,
            }}>
              <HospitalStatusPanel />
            </Box>

            {/* Activity feed slide-in panel */}
            <Box sx={{
              position: 'absolute', top:0, right:0, bottom:0, width:310,
              background: '#FFFFFF',
              borderLeft: `1px solid ${BORDER}`,
              display:'flex', flexDirection:'column',
              transform: activityOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.25s ease',
              zIndex: 1000,
            }}>
              <ActivityFeed />
            </Box>
            {/* Incident Timeline slide-in panel */}
            <Box sx={{
              position: 'absolute', top:0, right:0, bottom:0, width:310,
              background: '#FFFFFF',
              borderLeft: `1px solid ${BORDER}`,
              display:'flex', flexDirection:'column',
              transform: timelineOpen && selectedIncident ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.25s ease',
              zIndex: 1000,
            }}>
              <IncidentTimeline incident={selectedIncident} onClose={closeAll} />
            </Box>

            {/* Quick Comms slide-in panel */}
            <Box sx={{
              position: 'absolute', top:0, right:0, bottom:0, width:320,
              background: '#FFFFFF',
              borderLeft: `1px solid ${BORDER}`,
              display:'flex', flexDirection:'column',
              transform: commsOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.25s ease',
              zIndex: 1000,
            }}>
              <QuickCommsPanel ambulances={ambulances} />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ══ Modals ══ */}
      <SOSAlertModal open={sosModalOpen} onClose={()=>setSosModalOpen(false)} onSOSCreated={handleSOSCreated} />
      <AssignmentWizard open={wizardOpen} onClose={()=>setWizardOpen(false)} incident={selectedIncident} onAssignmentCreated={handleAssignmentCreated} />
      <ShiftReportModal open={shiftReportOpen} onClose={()=>setShiftReportOpen(false)} stats={stats} incidents={incidents} ambulances={ambulances} />
      <GreenCorridorModal open={greenCorridorOpen} onClose={()=>setGreenCorridorOpen(false)} assignment={activeAssignment} />

      {/* ══ Snackbar ══ */}
      <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={()=>setSnackbar(null)} anchorOrigin={{vertical:'bottom',horizontal:'right'}}>
        <Alert
          severity={snackbar?.severity||'info'} onClose={()=>setSnackbar(null)}
          sx={{ background:SURFACE, color:TEXT, border:`1px solid ${BORDER2}` }}
        >
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
