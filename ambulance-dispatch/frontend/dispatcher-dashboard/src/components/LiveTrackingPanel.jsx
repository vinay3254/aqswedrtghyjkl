import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { DEMO_AMBULANCES } from '../data/demoAmbulances';

/* ── Evergreen tokens ── */
const G     = '#2563EB';
const TEXT  = '#0F172A';
const DIM = '#64748B';
const SURF  = 'rgba(142,182,155,0.06)';
const BRD   = 'rgba(142,182,155,0.09)';
const RED   = '#E25C50';
const AMBER = '#E3A94F';

const STATUS_COLORS = {
  AVAILABLE:    G,
  EN_ROUTE:     '#5BB8F5',
  ON_SCENE:     AMBER,
  TRANSPORTING: '#a78bfa',
  AT_HOSPITAL:  '#06b6d4',
  OFF_DUTY:     'rgba(218,241,222,0.25)',
};
const STATUS_LABELS = {
  AVAILABLE: 'Available', EN_ROUTE: 'En Route', ON_SCENE: 'On Scene',
  TRANSPORTING: 'Transport', AT_HOSPITAL: 'Hospital', OFF_DUTY: 'Off Duty',
};

// DEMO_AMBULANCES imported from ../data/demoAmbulances

function etaLabel(sec) {
  if (sec == null) return null;
  if (sec <= 0) return 'Arrived';
  if (sec < 60) return `${sec}s`;
  return `${Math.ceil(sec/60)} min`;
}

function AmbulanceCard({ amb, onSelect, selected, livePos }) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_COLORS[amb.status] || DIM;
  const isMoving = ['EN_ROUTE','TRANSPORTING'].includes(amb.status);
  const lat = livePos?.lat ?? amb.latitude;
  const lng = livePos?.lng ?? amb.longitude;
  const etaDisplay = etaLabel(livePos?.etaSeconds) ?? amb.eta;

  return (
    <Box
      onClick={() => onSelect(amb)}
      sx={{
        p: '11px', borderRadius: '11px', mb: '8px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
        background: selected ? 'rgba(142,182,155,0.11)' : SURF,
        border: `1px solid ${selected ? 'rgba(142,182,155,0.35)' : BRD}`,
        transition: 'all 0.15s',
        '&:hover': { background: 'rgba(142,182,155,0.09)', borderColor: '#E2E8F0' },
      }}
    >
      {/* Moving pulse dot */}
      {isMoving && (
        <Box sx={{
          position: 'absolute', right: 10, top: 10,
          width: 8, height: 8, borderRadius: '50%', background: sc,
          '&::after': { content:'""', position:'absolute', inset:-4, borderRadius:'50%', border:`2px solid ${sc}`, animation:'ripple 1.5s infinite' },
        }} />
      )}

      {/* Header row */}
      <Box sx={{ display:'flex', alignItems:'center', gap:'8px', mb:'5px' }}>
        {/* Cross icon */}
        <Box sx={{ width:28, height:28, borderRadius:'8px', background:'#E2E8F0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke={G} strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </Box>
        <Box sx={{ flex:1, minWidth:0 }}>
          <Typography sx={{ fontSize:12, fontWeight:700, color:TEXT, lineHeight:1.2 }}>{amb.call_sign}</Typography>
          <Typography sx={{ fontSize:10, color:DIM }}>{amb.driver}</Typography>
        </Box>
        <Box sx={{ fontSize:'9.5px', fontWeight:700, px:'7px', py:'2px', borderRadius:'6px', color:sc, background:`${sc}22`, flexShrink:0 }}>
          {STATUS_LABELS[amb.status] || amb.status}
        </Box>
        <Box
          onClick={e => { e.stopPropagation(); setExpanded(x=>!x); }}
          sx={{ color:DIM, cursor:'pointer', display:'flex', ml:'2px' }}
        >
          {expanded ? <KeyboardArrowUp sx={{fontSize:16}}/> : <KeyboardArrowDown sx={{fontSize:16}}/>}
        </Box>
      </Box>

      {/* Sub-row */}
      <Typography sx={{ fontSize:'10.5px', color:DIM, pl:'36px' }}>
        {amb.vehicle_number} · {amb.type}
        {isMoving && etaDisplay && (
          <Box component="span" sx={{ color:sc, fontWeight:600, ml:'8px' }}>· ETA {etaDisplay}</Box>
        )}
      </Typography>

      {/* Expanded detail */}
      <Collapse in={expanded}>
        <Box sx={{ mt:'10px', pt:'10px', borderTop:`1px solid ${BRD}` }}>
          <Typography sx={{ fontSize:'10px', color:DIM }}>
            GPS: <Box component="span" sx={{ fontFamily:'monospace', color:TEXT }}>{lat.toFixed(5)}, {lng.toFixed(5)}</Box>
          </Typography>
          {amb.destination && (
            <Typography sx={{ fontSize:'10px', color:DIM, mt:'4px' }}>
              Dest: <Box component="span" sx={{ color:TEXT }}>{amb.destination}</Box>
            </Typography>
          )}
          <Box sx={{ display:'flex', alignItems:'center', gap:'6px', mt:'6px' }}>
            <Box sx={{ width:6, height:6, borderRadius:'50%', background:G, animation:'blinkDot 2s infinite' }} />
            <Typography sx={{ fontSize:'10px', color:DIM }}>Battery {amb.battery}% · Signal {amb.signal}/5</Typography>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

export default function LiveTrackingPanel({ ambulances: ext = [], onAmbulanceSelect, onFleetUpdate }) {
  const display = ext.length > 0 ? ext : DEMO_AMBULANCES;
  const [selectedId, setSelectedId] = useState(null);
  const [livePos, setLivePos] = useState(() => {
    const init = {};
    DEMO_AMBULANCES.forEach(a => { init[a.id] = { lat:a.latitude, lng:a.longitude, etaSeconds:a.etaSeconds??0 }; });
    return init;
  });

  const displayRef = useRef(display);
  const fleetRef   = useRef(onFleetUpdate);
  useEffect(() => { displayRef.current = display; }, [display]);
  useEffect(() => { fleetRef.current = onFleetUpdate; }, [onFleetUpdate]);

  useEffect(() => {
    setLivePos(prev => {
      let changed = false; const next = {...prev};
      display.forEach(a => { if (a.latitude && a.longitude && !next[a.id]) { next[a.id]={lat:a.latitude,lng:a.longitude,etaSeconds:a.etaSeconds??0}; changed=true; } });
      return changed ? next : prev;
    });
  }, [display]);

  useEffect(() => {
    if (ext.length === 0) return;
    fleetRef.current?.(displayRef.current.map(a=>({...a})));
  }, [ext]);

  useEffect(() => {
    const iv = setInterval(() => {
      setLivePos(prev => {
        const next = {...prev};
        displayRef.current.forEach(amb => {
          if (!['EN_ROUTE','TRANSPORTING'].includes(amb.status)) return;
          const cur = prev[amb.id] || { lat:amb.latitude, lng:amb.longitude, etaSeconds:0 };
          const tlat = amb.targetLat??amb.latitude, tlng = amb.targetLng??amb.longitude;
          const dlat = tlat-cur.lat, dlng = tlng-cur.lng;
          const dist = Math.sqrt(dlat*dlat+dlng*dlng);
          if (dist < 0.0001) { next[amb.id]={lat:tlat,lng:tlng,etaSeconds:0}; }
          else {
            const step=0.0006, frac=Math.min(step/dist,1);
            next[amb.id]={lat:cur.lat+dlat*frac,lng:cur.lng+dlng*frac,etaSeconds:Math.max(0,(cur.etaSeconds??0)-2)};
          }
        });
        // Push fleet update AFTER the state update finishes to avoid calling
        // setState on DashboardPage while LiveTrackingPanel is still rendering.
        const withLive = displayRef.current.map(a=>{const p=next[a.id];return p?{...a,latitude:p.lat,longitude:p.lng}:a;});
        setTimeout(() => fleetRef.current?.(withLive), 0);
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const handleSelect = useCallback((amb) => {
    setSelectedId(amb.id);
    const p = livePos[amb.id];
    onAmbulanceSelect?.(p ? {...amb,latitude:p.lat,longitude:p.lng} : amb);
  }, [livePos, onAmbulanceSelect]);

  const available = display.filter(a=>a.status==='AVAILABLE').length;
  const active    = display.filter(a=>!['AVAILABLE','OFF_DUTY'].includes(a.status)).length;

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Panel header */}
      <Box sx={{ p:'16px', borderBottom:`1px solid #E2E8F0` }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'12px' }}>
          <Typography sx={{ fontSize:'13.5px', fontWeight:700, color:TEXT }}>Live Fleet</Typography>
          <Box sx={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <Box sx={{ width:6, height:6, borderRadius:'50%', background:G, animation:'blinkDot 2s infinite' }} />
            <Typography sx={{ fontSize:'9.5px', fontWeight:700, color:G }}>LIVE</Typography>
          </Box>
        </Box>
        {/* Fleet mini stats */}
        <Box sx={{ display:'flex', gap:'8px' }}>
          {[{label:'Total',value:display.length,color:TEXT},{label:'Available',value:available,color:G},{label:'Active',value:active,color:'#5BB8F5'}].map(item=>(
            <Box key={item.label} sx={{ flex:1, background:'rgba(0,0,0,0.03)', borderRadius:'9px', p:'8px', textAlign:'center' }}>
              <Typography sx={{ fontSize:17, fontWeight:800, color:item.color, lineHeight:1 }}>{item.value}</Typography>
              <Typography sx={{ fontSize:'10px', color:DIM }}>{item.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Scrollable cards */}
      <Box sx={{ flex:1, overflow:'auto', p:'12px' }}>
        {display.map(amb => (
          <AmbulanceCard
            key={amb.id} amb={amb}
            livePos={livePos[amb.id]}
            onSelect={handleSelect}
            selected={selectedId === amb.id}
          />
        ))}
      </Box>
    </Box>
  );
}
