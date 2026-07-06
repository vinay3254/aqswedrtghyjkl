import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

const G     = '#8EB69B';
const TEXT  = '#DAF1DE';
const DIM   = 'rgba(218,241,222,0.50)';
const FAINT = 'rgba(218,241,222,0.28)';
const BRD   = 'rgba(142,182,155,0.10)';
const RED   = '#E25C50';
const AMBER = '#E3A94F';

const MOCK_HOSPITALS = [
  { id:'H1', name:'AIIMS Delhi',             beds_available:12, beds_total:40, icu_available:3,  er_wait_min:8,  lat:28.5672, lng:77.2100 },
  { id:'H2', name:'Safdarjung Hospital',      beds_available:4,  beds_total:30, icu_available:1,  er_wait_min:22, lat:28.5700, lng:77.2063 },
  { id:'H3', name:'Ram Manohar Lohia',        beds_available:18, beds_total:35, icu_available:6,  er_wait_min:5,  lat:28.6238, lng:77.2090 },
  { id:'H4', name:'Lady Hardinge Medical',    beds_available:0,  beds_total:28, icu_available:0,  er_wait_min:35, lat:28.6345, lng:77.2000 },
  { id:'H5', name:'Fortis Escort Heart',      beds_available:7,  beds_total:20, icu_available:2,  er_wait_min:12, lat:28.5512, lng:77.2590 },
];

function StatusDot({ pct }) {
  const color = pct > 60 ? RED : pct > 30 ? AMBER : G;
  return (
    <Box sx={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }} />
  );
}

function HospitalRow({ h, expanded, onToggle }) {
  const occPct = Math.round(((h.beds_total - h.beds_available) / h.beds_total) * 100);
  const full   = h.beds_available === 0;
  const color  = full ? RED : occPct > 70 ? AMBER : G;

  return (
    <Box
      onClick={onToggle}
      sx={{
        p:'11px 12px', borderRadius:'11px', mb:'7px', cursor:'pointer',
        background:'rgba(142,182,155,0.05)',
        border:`1px solid ${expanded ? 'rgba(142,182,155,0.22)' : BRD}`,
        transition:'all 0.15s',
        '&:hover':{ background:'rgba(142,182,155,0.09)' },
      }}
    >
      <Box sx={{ display:'flex', alignItems:'center', gap:'8px', mb: expanded ? '10px' : 0 }}>
        {/* Cross icon */}
        <Box sx={{ width:26, height:26, borderRadius:'7px', background:'rgba(142,182,155,0.10)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 2.5v11M2.5 8h11" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </Box>
        <Box sx={{ flex:1, minWidth:0 }}>
          <Typography sx={{ fontSize:'11.5px', fontWeight:700, color: full ? DIM : TEXT, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {h.name}
          </Typography>
          <Typography sx={{ fontSize:'9.5px', color:DIM }}>
            {full ? 'No beds available' : `${h.beds_available} beds free · ${h.icu_available} ICU`}
          </Typography>
        </Box>
        <Box sx={{ textAlign:'right', flexShrink:0 }}>
          <Typography sx={{ fontSize:'11px', fontWeight:700, color }}>
            {full ? 'FULL' : `${occPct}%`}
          </Typography>
          <Typography sx={{ fontSize:'9px', color:DIM }}>occ.</Typography>
        </Box>
      </Box>

      {/* Occupancy bar */}
      <Box sx={{ height:3, borderRadius:2, background:'rgba(142,182,155,0.10)', overflow:'hidden', mb: expanded ? '10px' : 0 }}>
        <Box sx={{ height:'100%', borderRadius:2, background:color, width:`${occPct}%`, transition:'width 0.4s ease' }} />
      </Box>

      {/* Expanded details */}
      {expanded && (
        <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', mt:'2px' }}>
          {[
            { label:'ER WAIT', value:`${h.er_wait_min}m` },
            { label:'ICU FREE', value: h.icu_available },
            { label:'BEDS FREE', value: h.beds_available },
          ].map(f=>(
            <Box key={f.label} sx={{ background:'rgba(142,182,155,0.07)', borderRadius:'8px', p:'7px', textAlign:'center' }}>
              <Typography sx={{ fontSize:'8.5px', color:FAINT, letterSpacing:'0.05em', mb:'2px' }}>{f.label}</Typography>
              <Typography sx={{ fontSize:'13px', fontWeight:800, color:TEXT }}>{f.value}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function HospitalStatusPanel() {
  const [hospitals, setHospitals] = useState(MOCK_HOSPITALS);
  const [expanded, setExpanded]   = useState(null);

  // Simulate live bed count fluctuations
  useEffect(() => {
    const iv = setInterval(() => {
      setHospitals(prev => prev.map(h => {
        const delta = Math.random() > 0.7 ? (Math.random()>0.5?1:-1) : 0;
        return { ...h, beds_available: Math.max(0, Math.min(h.beds_total, h.beds_available + delta)) };
      }));
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  const available = hospitals.filter(h=>h.beds_available>0).length;

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <Box sx={{ p:'14px 16px', borderBottom:'1px solid rgba(142,182,155,0.10)' }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'8px' }}>
          <Typography sx={{ fontSize:'13.5px', fontWeight:700, color:TEXT }}>Hospitals</Typography>
          <Box sx={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <Box sx={{ width:6, height:6, borderRadius:'50%', background:G, animation:'blinkDot 2s infinite' }} />
            <Typography sx={{ fontSize:'9.5px', fontWeight:700, color:G }}>LIVE</Typography>
          </Box>
        </Box>
        <Box sx={{ display:'flex', gap:'8px' }}>
          <Box sx={{ flex:1, background:'rgba(142,182,155,0.07)', borderRadius:'8px', p:'7px', textAlign:'center' }}>
            <Typography sx={{ fontSize:'8.5px', color:DIM, letterSpacing:'0.05em', mb:'2px' }}>ACCEPTING</Typography>
            <Typography sx={{ fontSize:'15px', fontWeight:800, color:G }}>{available}</Typography>
          </Box>
          <Box sx={{ flex:1, background:'rgba(142,182,155,0.07)', borderRadius:'8px', p:'7px', textAlign:'center' }}>
            <Typography sx={{ fontSize:'8.5px', color:DIM, letterSpacing:'0.05em', mb:'2px' }}>TOTAL BEDS</Typography>
            <Typography sx={{ fontSize:'15px', fontWeight:800, color:TEXT }}>{hospitals.reduce((s,h)=>s+h.beds_available,0)}</Typography>
          </Box>
          <Box sx={{ flex:1, background:'rgba(142,182,155,0.07)', borderRadius:'8px', p:'7px', textAlign:'center' }}>
            <Typography sx={{ fontSize:'8.5px', color:DIM, letterSpacing:'0.05em', mb:'2px' }}>ICU FREE</Typography>
            <Typography sx={{ fontSize:'15px', fontWeight:800, color:TEXT }}>{hospitals.reduce((s,h)=>s+h.icu_available,0)}</Typography>
          </Box>
        </Box>
      </Box>

      {/* Hospital list */}
      <Box sx={{ flex:1, overflow:'auto', p:'10px' }}>
        {hospitals
          .sort((a,b)=>b.beds_available-a.beds_available)
          .map(h=>(
            <HospitalRow
              key={h.id}
              h={h}
              expanded={expanded===h.id}
              onToggle={()=>setExpanded(e=>e===h.id?null:h.id)}
            />
          ))
        }
      </Box>
    </Box>
  );
}
