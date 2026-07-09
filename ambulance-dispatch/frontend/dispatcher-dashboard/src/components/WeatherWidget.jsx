import React, { useState, useEffect } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

const G     = '#8EB69B';
const TEXT  = '#DAF1DE';
const DIM   = 'rgba(218,241,222,0.50)';
const FAINT = 'rgba(218,241,222,0.28)';
const BRD   = 'rgba(142,182,155,0.10)';
const AMBER = '#E3A94F';
const RED   = '#E25C50';

/* Mock weather — rotates every 30s to simulate updates */
const MOCK_CONDITIONS = [
  { temp:31, feels:34, desc:'Partly Cloudy', icon:'⛅', wind:14, humidity:62, visibility:8,  alert:null },
  { temp:29, feels:32, desc:'Clear',         icon:'☀️', wind:8,  humidity:55, visibility:12, alert:null },
  { temp:26, feels:26, desc:'Light Rain',    icon:'🌧',  wind:22, humidity:84, visibility:4,  alert:'Low visibility — caution on expressways' },
  { temp:33, feels:38, desc:'Hot & Hazy',   icon:'🌫',  wind:5,  humidity:45, visibility:6,  alert:'Heat advisory — check on elderly patients' },
];

/* Impact codes for EMS response */
function responseImpact(w) {
  if (w.visibility < 5) return { label:'⚠ Low Vis', color:AMBER };
  if (w.wind > 20)      return { label:'⚠ High Wind', color:AMBER };
  if (w.temp > 35)      return { label:'⚠ Extreme Heat', color:RED };
  return { label:'✓ Normal Ops', color:G };
}

export default function WeatherWidget({ compact = false }) {
  const [idx, setIdx]       = useState(0);
  const [flipped, setFlip]  = useState(false);

  /* Rotate through mock conditions */
  useEffect(() => {
    const iv = setInterval(() => {
      setFlip(true);
      setTimeout(() => { setIdx(i => (i+1)%MOCK_CONDITIONS.length); setFlip(false); }, 300);
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const w      = MOCK_CONDITIONS[idx];
  const impact = responseImpact(w);

  if (compact) {
    return (
      <Tooltip title={`${w.desc} · ${w.temp}°C · 💨${w.wind}km/h · 👁${w.visibility}km${w.alert ? ' · ⚠ '+w.alert : ''}`} placement="bottom">
        <Box sx={{
          display:'flex', alignItems:'center', gap:'6px',
          px:'8px', py:'4px', borderRadius:'8px',
          background:'rgba(142,182,155,0.06)',
          border:`1px solid ${BRD}`,
          cursor:'default', flexShrink:0,
          opacity: flipped ? 0 : 1, transition:'opacity 0.3s',
        }}>
          <Typography sx={{ fontSize:'16px', lineHeight:1 }}>{w.icon}</Typography>
          <Typography sx={{ fontSize:'12px', fontWeight:800, color:TEXT }}>{w.temp}°</Typography>
          <Box sx={{ fontSize:'9px', fontWeight:700, px:'6px', py:'2px', borderRadius:'5px', color:impact.color, background:`${impact.color}18`, whiteSpace:'nowrap' }}>
            {impact.label}
          </Box>
          {w.alert && <Box sx={{ width:6, height:6, borderRadius:'50%', background:AMBER, flexShrink:0, animation:'blinkDot 1.5s infinite' }}/>}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title="Weather conditions affect EMS response" placement="bottom">
      <Box sx={{
        display:'flex', alignItems:'center', gap:'10px',
        px:'12px', py:'7px', borderRadius:'12px',
        background:'rgba(142,182,155,0.06)',
        border:`1px solid ${BRD}`,
        cursor:'default', flexShrink:0, minWidth:0,
        opacity: flipped ? 0 : 1, transition:'opacity 0.3s',
      }}>
        {/* Icon + temp */}
        <Box sx={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <Typography sx={{ fontSize:'18px', lineHeight:1 }}>{w.icon}</Typography>
          <Box>
            <Typography sx={{ fontSize:'14px', fontWeight:800, color:TEXT, lineHeight:1 }}>{w.temp}°</Typography>
            <Typography sx={{ fontSize:'9px', color:DIM, lineHeight:1 }}>feels {w.feels}°</Typography>
          </Box>
        </Box>

        {/* Divider */}
        <Box sx={{ width:'1px', height:'28px', background:BRD, flexShrink:0 }}/>

        {/* Details */}
        <Box sx={{ minWidth:0 }}>
          <Typography sx={{ fontSize:'10.5px', fontWeight:700, color:TEXT, whiteSpace:'nowrap' }}>{w.desc}</Typography>
          <Typography sx={{ fontSize:'9.5px', color:DIM }}>💨 {w.wind} km/h · 👁 {w.visibility} km</Typography>
        </Box>

        {/* Divider */}
        <Box sx={{ width:'1px', height:'28px', background:BRD, flexShrink:0 }}/>

        {/* EMS impact badge */}
        <Box sx={{ display:'flex', alignItems:'center', gap:'4px', px:'8px', py:'3px', borderRadius:'7px', background:`${impact.color}18`, border:`1px solid ${impact.color}40`, flexShrink:0 }}>
          <Typography sx={{ fontSize:'10px', fontWeight:700, color:impact.color, whiteSpace:'nowrap' }}>{impact.label}</Typography>
        </Box>

        {/* Alert dot */}
        {w.alert && (
          <Tooltip title={w.alert}>
            <Box sx={{ width:8, height:8, borderRadius:'50%', background:AMBER, flexShrink:0, animation:'blinkDot 1.5s infinite', cursor:'pointer' }}/>
          </Tooltip>
        )}
      </Box>
    </Tooltip>
  );
}
