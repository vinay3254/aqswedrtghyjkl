import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';

const G     = '#2563EB';
const TEXT  = '#0F172A';
const DIM   = '#475569';
const FAINT = '#94A3B8';
const BRD   = '#E2E8F0';
const RED   = '#E25C50';
const AMBER = '#E3A94F';
const BG    = '#F8FAFC';

const STATUS_DEST = {
  EN_ROUTE:    'Scene',
  ON_SCENE:    'On Scene',
  TRANSPORTING:'Hospital',
  AT_HOSPITAL: 'Hospital',
};

/* SVG ring progress component */
function RingProgress({ value, max, color, size=84 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(1, Math.max(0, value / max));
  const dash  = pct * circ;

  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={5}/>
      {/* Progress */}
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition:'stroke-dasharray 1s linear' }}
      />
    </svg>
  );
}

export default function ETACountdown({ missionStatus, driverPos, incidentPos, speed }) {
  const [etaSec, setEtaSec]     = useState(null);
  const [distKm, setDistKm]     = useState(null);
  const [maxEta, setMaxEta]     = useState(null);
  const initialRef              = useRef(false);

  /* Haversine distance */
  function haversine(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }

  useEffect(() => {
    if (!driverPos || !incidentPos || !['EN_ROUTE','TRANSPORTING'].includes(missionStatus)) {
      setEtaSec(null); setDistKm(null); return;
    }
    const d   = haversine(driverPos, incidentPos);
    const spd = Math.max(speed || 40, 5) / 3600; // km/s
    const eta = d / spd;
    setDistKm(parseFloat(d.toFixed(2)));
    setEtaSec(Math.round(eta));
    if (!initialRef.current) { setMaxEta(Math.round(eta)); initialRef.current = true; }
  }, [driverPos, incidentPos, missionStatus, speed]);

  // Tick down
  useEffect(() => {
    if (etaSec === null || etaSec <= 0) return;
    const t = setTimeout(() => setEtaSec(s => Math.max(0, s-1)), 1000);
    return () => clearTimeout(t);
  }, [etaSec]);

  if (!['EN_ROUTE','TRANSPORTING'].includes(missionStatus) || etaSec === null) return null;

  const mins = Math.floor(etaSec / 60);
  const secs = etaSec % 60;
  const dest = STATUS_DEST[missionStatus] || 'Destination';
  const color = etaSec < 120 ? G : etaSec < 300 ? AMBER : G;
  const urgent = etaSec < 90;

  return (
    <Box sx={{
      mx:'12px', mb:'12px', p:'14px',
      borderRadius:'14px',
      background:'linear-gradient(135deg, #E2E8F0, #FFFFFF)',
      border:`1px solid ${urgent ? 'rgba(142,182,155,0.4)' : BRD}`,
      display:'flex', alignItems:'center', gap:'14px',
      animation: urgent ? 'none' : 'none',
      boxShadow: urgent ? `0 0 20px rgba(37,99,235,0.10)` : 'none',
      transition:'all 0.3s',
    }}>
      {/* Ring */}
      <Box sx={{ position:'relative', flexShrink:0, width:84, height:84, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Box sx={{ position:'absolute', inset:0 }}>
          <RingProgress value={maxEta - etaSec} max={maxEta || 1} color={color} size={84}/>
        </Box>
        <Box sx={{ textAlign:'center' }}>
          <Typography sx={{ fontSize:'18px', fontWeight:900, color:TEXT, lineHeight:1, fontFamily:'"JetBrains Mono",monospace' }}>
            {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </Typography>
          <Typography sx={{ fontSize:'8.5px', color:DIM, mt:'1px' }}>remaining</Typography>
        </Box>
      </Box>

      {/* Details */}
      <Box sx={{ flex:1, minWidth:0 }}>
        <Typography sx={{ fontSize:'9px', color:FAINT, letterSpacing:'0.06em', fontWeight:700, mb:'4px' }}>
          ETA TO {dest.toUpperCase()}
        </Typography>
        <Typography sx={{ fontSize:'13px', fontWeight:800, color:TEXT, mb:'6px' }}>
          {mins > 0 ? `${mins} min ${secs} sec` : `${secs} seconds`}
        </Typography>
        <Box sx={{ display:'flex', gap:'8px' }}>
          <Box sx={{ flex:1, p:'5px 8px', borderRadius:'7px', background:'#F1F5F9', textAlign:'center' }}>
            <Typography sx={{ fontSize:'8px', color:FAINT, mb:'1px' }}>DISTANCE</Typography>
            <Typography sx={{ fontSize:'11px', fontWeight:700, color:TEXT }}>{distKm} km</Typography>
          </Box>
          <Box sx={{ flex:1, p:'5px 8px', borderRadius:'7px', background:'#F1F5F9', textAlign:'center' }}>
            <Typography sx={{ fontSize:'8px', color:FAINT, mb:'1px' }}>SPEED</Typography>
            <Typography sx={{ fontSize:'11px', fontWeight:700, color:TEXT }}>{speed||0} km/h</Typography>
          </Box>
          <Box sx={{ flex:1, p:'5px 8px', borderRadius:'7px', background: urgent ? 'rgba(142,182,155,0.15)' : '#F1F5F9', textAlign:'center' }}>
            <Typography sx={{ fontSize:'8px', color:FAINT, mb:'1px' }}>STATUS</Typography>
            <Typography sx={{ fontSize:'10px', fontWeight:700, color }}>
              {urgent ? 'ARRIVING' : 'EN ROUTE'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
