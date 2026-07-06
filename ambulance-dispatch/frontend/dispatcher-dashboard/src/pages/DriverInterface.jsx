import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, LinearProgress, Snackbar, Alert } from '@mui/material';
import { dispatchBroadcast, DISPATCH_EVENTS } from '../services/dispatchBroadcast';
import DriverMap from '../components/DriverMap';
import PatientVitalsForm from '../components/PatientVitalsForm';
import HospitalSelector from '../components/HospitalSelector';
import MedicalChecklist from '../components/MedicalChecklist';

/* ── Evergreen tokens ── */
const BG      = '#051F20';
const SURFACE = '#0B2B26';
const SURF2   = '#163832';
const G       = '#8EB69B';
const TEXT    = '#DAF1DE';
const DIM     = 'rgba(218,241,222,0.50)';
const FAINT   = 'rgba(218,241,222,0.30)';
const BORDER  = 'rgba(142,182,155,0.10)';
const BORDER2 = 'rgba(142,182,155,0.20)';
const RED     = '#E25C50';
const AMBER   = '#E3A94F';

const SEV_COLOR = { CRITICAL:RED, HIGH:AMBER, MEDIUM:G, LOW:G };
const SEV_BG    = { CRITICAL:'rgba(226,92,80,0.16)', HIGH:'rgba(227,169,79,0.16)', MEDIUM:'rgba(142,182,155,0.16)', LOW:'rgba(142,182,155,0.16)' };

const MOCK_DRIVER = {
  id:'DRV-001', name:'Rajesh Kumar', callSign:'Alpha-1',
  vehicle:'KA-01-A-0001', type:'ALS',
  latitude:12.9716, longitude:77.5946,
};

const PENDING_INCIDENTS = [
  { id:'SOS-101', incident_type:'Cardiac Arrest', severity:'CRITICAL', location_address:'Indiranagar, Bangalore', location_lat:12.9784, location_lng:77.6408, caller_name:'Rahul Sharma', caller_phone:'+91 98765 43210', description:'Patient unconscious, not breathing', distance:'3.2 km', eta:'6 min', patients_count:1, created_at:new Date(Date.now()-120000).toISOString(), is_sos:true },
  { id:'SOS-102', incident_type:'Road Accident',  severity:'HIGH',     location_address:'Outer Ring Road, Bellandur', location_lat:12.9263, location_lng:77.6761, caller_name:'Police Control', caller_phone:'+91 100', description:'Multi-vehicle accident, 3 injured', distance:'5.8 km', eta:'11 min', patients_count:3, created_at:new Date(Date.now()-60000).toISOString(), is_sos:false },
];

const STATUS_FLOW   = ['EN_ROUTE','ON_SCENE','TRANSPORTING','AT_HOSPITAL','COMPLETE'];
const STATUS_LABELS = { EN_ROUTE:'En Route', ON_SCENE:'On Scene', TRANSPORTING:'Transport', AT_HOSPITAL:'Hospital', COMPLETE:'Done' };
const STATUS_ACTIONS = {
  EN_ROUTE:    { label:'Arrived On Scene',    next:'ON_SCENE' },
  ON_SCENE:    { label:'Start Transport',     next:'TRANSPORTING' },
  TRANSPORTING:{ label:'Arrived at Hospital', next:'AT_HOSPITAL' },
  AT_HOSPITAL: { label:'Mission Complete',    next:'COMPLETE' },
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
        {incident.location_address} · {incident.distance} · ETA {incident.eta}
      </Typography>
    </Box>
  );
}

/* ══ Active mission card ══ */
function ActiveMission({ incident, status, onStatusUpdate }) {
  const sc  = SEV_COLOR[incident.severity] || AMBER;
  const idx = STATUS_FLOW.indexOf(status);

  return (
    <Box sx={{ padding:'14px', borderRadius:'14px', background:'linear-gradient(160deg, rgba(142,182,155,0.12), rgba(0,0,0,0.3))', border:'1px solid rgba(142,182,155,0.28)', marginBottom:'14px' }}>
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
          { label:'CALLER',   value:incident.caller_name || 'Unknown' },
          { label:'PHONE',    value:incident.caller_phone },
          { label:'PATIENTS', value:`${incident.patients_count||1} person(s)` },
        ].map(f=>(
          <Box key={f.label}>
            <Typography sx={{ fontSize:9, color:DIM, letterSpacing:'0.05em', mb:'2px' }}>{f.label}</Typography>
            <Typography sx={{ fontSize:'11px', fontWeight:600, color:TEXT }}>{f.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Progress stepper */}
      <Box sx={{ display:'flex', alignItems:'flex-start', gap:'4px' }}>
        {STATUS_FLOW.slice(0,-1).map((s,i)=>{
          const done   = i < idx;
          const active = i === idx;
          return (
            <Box key={s} sx={{ flex:1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box sx={{
                width:24, height:24, borderRadius:'50%',
                background: done ? G : active ? 'rgba(142,182,155,0.15)' : 'rgba(142,182,155,0.06)',
                border:`1.5px solid ${done ? G : active ? G : 'rgba(142,182,155,0.25)'}`,
                color: done ? BG : active ? G : FAINT,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'10.5px', fontWeight:700, transition:'all 0.3s',
              }}>
                {done ? '✓' : i+1}
              </Box>
              <Typography sx={{ fontSize:'8.5px', color: done||active?TEXT:DIM, mt:'4px', fontWeight:600 }}>
                {STATUS_LABELS[s]}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {status === 'COMPLETE' && (
        <Box sx={{ textalign:'center', p:'16px', background:'rgba(142,182,155,0.1)', border:`1px solid ${G}`, borderRadius:'11px', mt:'12px' }}>
          <Typography sx={{ fontSize:14, fontWeight:700, color:G, textAlign:'center' }}>Mission Complete</Typography>
          <Typography sx={{ fontSize:'10.5px', color:DIM, mt:'2px', textAlign:'center' }}>Patient successfully transported</Typography>
        </Box>
      )}
    </Box>
  );
}

/* ══ Main ══ */
export default function DriverInterface() {
  const [alertIncident, setAlertIncident]     = useState(null);
  const [activeIncident, setActiveIncident]   = useState(null);
  const [missionStatus, setMissionStatus]     = useState('EN_ROUTE');
  const [speed, setSpeed]                     = useState(0);
  const [time, setTime]                       = useState(new Date());
  const [incidentQueue, setIncidentQueue]     = useState(PENDING_INCIDENTS);
  const [toast, setToast]                     = useState(null);
  const [driverPos, setDriverPos]             = useState({ lat:MOCK_DRIVER.latitude, lng:MOCK_DRIVER.longitude });
  const driverPosRef = useRef({ lat:MOCK_DRIVER.latitude, lng:MOCK_DRIVER.longitude });
  const [activeTab, setActiveTab]             = useState('mission'); // 'mission' | 'checklist'
  const [checklistPhase, setChecklistPhase]   = useState('PRE_DEPARTURE');
  const [vitalsSubmitted, setVitalsSubmitted] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);

  /* Clock */
  useEffect(() => { const t = setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t); }, []);

  /* GPS simulation */
  useEffect(() => {
    if (!activeIncident || !['EN_ROUTE','TRANSPORTING'].includes(missionStatus)) return;
    const target = missionStatus==='EN_ROUTE'
      ? { lat:activeIncident.location_lat||19.0596, lng:activeIncident.location_lng||72.8295 }
      : { lat:19.0728, lng:72.8826 };
    const iv = setInterval(()=>{
      const cur = driverPosRef.current;
      const dlat = (target.lat-cur.lat)*0.06+(Math.random()-0.5)*0.0002;
      const dlng = (target.lng-cur.lng)*0.06+(Math.random()-0.5)*0.0002;
      const next = { lat:cur.lat+dlat, lng:cur.lng+dlng };
      driverPosRef.current = next;
      setDriverPos({...next});
    }, 1500);
    return ()=>clearInterval(iv);
  }, [activeIncident, missionStatus]);

  /* Speed simulation */
  useEffect(() => {
    if (!activeIncident) { setSpeed(0); return; }
    const t = setInterval(()=>{
      setSpeed(['EN_ROUTE','TRANSPORTING'].includes(missionStatus) ? 45+Math.floor(Math.random()*35) : 0);
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

  const handleAccept = () => {
    setActiveIncident(alertIncident);
    setMissionStatus('EN_ROUTE');
    setDriverPos({ lat:MOCK_DRIVER.latitude, lng:MOCK_DRIVER.longitude });
    driverPosRef.current = { lat:MOCK_DRIVER.latitude, lng:MOCK_DRIVER.longitude };
    setIncidentQueue(q=>q.filter(i=>i.id!==alertIncident.id));
    setAlertIncident(null);
    setVitalsSubmitted(false);
    setSelectedHospital(null);
    setChecklistPhase('PRE_DEPARTURE');
    setActiveTab('mission');
  };

  const handleStatusUpdate = (nextStatus) => {
    setMissionStatus(nextStatus);
    // Auto-switch checklist phase
    if (nextStatus === 'ON_SCENE')       setChecklistPhase('ON_SCENE');
    if (nextStatus === 'AT_HOSPITAL')    setChecklistPhase('HANDOVER');
  };

  const isComplete = missionStatus === 'COMPLETE';
  const nextAction = activeIncident ? STATUS_ACTIONS[missionStatus] : null;

  return (
    <Box sx={{
      minHeight: '100vh',
      background: '#04060a',
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
        border: { xs: 'none', sm: '1px solid rgba(142,182,155,0.16)' },
        boxShadow: { xs: 'none', sm: '0 40px 100px rgba(0,0,0,0.55)' },
        background: BG,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>

        {/* ══ HEADER ══ */}
        <Box sx={{
          flexShrink:0, padding:'12px 16px',
          display:'flex', alignItems:'center', gap:'10px',
          background:SURFACE, borderBottom:`1px solid ${BORDER}`,
        }}>
          {/* Cross icon */}
          <Box sx={{ width:28, height:28, borderRadius:'8px', background:'rgba(142,182,155,0.14)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <CrossIcon size={12} color={G} />
          </Box>
          <Box sx={{ flex:1 }}>
            <Typography sx={{ fontSize:'13px', fontWeight:800, color:TEXT, lineHeight:1.2 }}>
              {MOCK_DRIVER.callSign} · {MOCK_DRIVER.name}
            </Typography>
            <Typography sx={{ fontSize:'10px', color:DIM }}>
              {MOCK_DRIVER.vehicle} · {MOCK_DRIVER.type}
            </Typography>
          </Box>
          <Box sx={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <Box sx={{ width:6, height:6, borderRadius:'50%', background:G, animation:'blinkDot 2s infinite' }} />
            <Typography sx={{ fontSize:'9.5px', fontWeight:700, color:G }}>LIVE</Typography>
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
              <ActiveMission
                incident={activeIncident}
                status={missionStatus}
                onStatusUpdate={handleStatusUpdate}
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
                      '&:hover':{ background:'rgba(142,182,155,0.10)' },
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
        </Box>

        {/* ══ FIXED BOTTOM ACTION FOOTER BAR ══ */}
        {alertIncident && (
          <Box sx={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 16px', background:'rgba(5,31,32,0.96)', backdropFilter:'blur(10px)', borderTop:`1px solid ${BORDER2}`, display:'flex', gap:'10px', zIndex:10 }}>
            <Button onClick={() => setAlertIncident(null)} sx={{ flex:1, padding:'13px', borderRadius:'11px', border:`1px solid ${RED}`, background:'rgba(226,92,80,0.12)', color:RED, fontWeight:700, fontSize:'13px', '&:hover':{ background:'rgba(226,92,80,0.20)' } }}>
              Decline
            </Button>
            <Button onClick={handleAccept} sx={{ flex:1.6, padding:'13px', borderRadius:'11px', border:'none', background:G, color:BG, fontWeight:800, fontSize:'13px', '&:hover':{ background:'#7AA887' } }}>
              Accept &amp; Dispatch
            </Button>
          </Box>
        )}

        {activeIncident && !alertIncident && !isComplete && (
          <Box sx={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 16px', background:'rgba(5,31,32,0.96)', backdropFilter:'blur(10px)', borderTop:`1px solid ${BORDER2}`, zIndex:10 }}>
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
      </Box>
    </Box>
  );
}
