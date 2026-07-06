import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';

const G     = '#8EB69B';
const TEXT  = '#DAF1DE';
const DIM   = 'rgba(218,241,222,0.50)';
const FAINT = 'rgba(218,241,222,0.28)';
const BRD   = 'rgba(142,182,155,0.10)';
const BRD2  = 'rgba(142,182,155,0.22)';
const RED   = '#E25C50';
const AMBER = '#E3A94F';
const BG    = '#051F20';
const SURF2 = '#163832';

const MOCK_HOSPITALS = [
  { id:'H1', name:'AIIMS Delhi',             beds_available:12, icu_available:3,  er_wait_min:8,  distance_km:1.8, lat:28.5672, lng:77.2100 },
  { id:'H2', name:'Safdarjung Hospital',      beds_available:4,  icu_available:1,  er_wait_min:22, distance_km:2.3, lat:28.5700, lng:77.2063 },
  { id:'H3', name:'Ram Manohar Lohia',        beds_available:18, icu_available:6,  er_wait_min:5,  distance_km:3.1, lat:28.6238, lng:77.2090 },
  { id:'H4', name:'Lady Hardinge Medical',    beds_available:0,  icu_available:0,  er_wait_min:35, distance_km:3.7, lat:28.6345, lng:77.2000 },
  { id:'H5', name:'Fortis Escort Heart',      beds_available:7,  icu_available:2,  er_wait_min:12, distance_km:4.2, lat:28.5512, lng:77.2590 },
];

export default function HospitalSelector({ incidentType, onSelect }) {
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  // Rank hospitals: prefer closer + lower ER wait + has beds
  const ranked = [...MOCK_HOSPITALS]
    .filter(h => h.beds_available > 0)
    .sort((a,b) => (a.distance_km * 0.5 + a.er_wait_min * 0.5) - (b.distance_km * 0.5 + b.er_wait_min * 0.5));

  const full = MOCK_HOSPITALS.filter(h => h.beds_available === 0);

  if (confirmed && selected) {
    const h = MOCK_HOSPITALS.find(x => x.id === selected);
    return (
      <Box sx={{ p:'13px', borderRadius:'13px', background:'rgba(142,182,155,0.10)', border:`1px solid ${G}`, mb:'14px', animation:'fadeUp 0.3s ease' }}>
        <Typography sx={{ fontSize:'11.5px', fontWeight:700, color:G, mb:'4px' }}>✓ Destination Set</Typography>
        <Typography sx={{ fontSize:'12.5px', fontWeight:800, color:TEXT }}>{h.name}</Typography>
        <Typography sx={{ fontSize:'10.5px', color:DIM, mt:'3px' }}>{h.distance_km} km · ETA {Math.ceil(h.distance_km * 2.5)} min</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p:'14px', borderRadius:'14px', background:'linear-gradient(160deg,rgba(142,182,155,0.08),rgba(0,0,0,0.2))', border:`1px solid ${BRD2}`, mb:'14px', animation:'fadeUp 0.2s ease' }}>
      <Typography sx={{ fontSize:'13.5px', fontWeight:800, color:TEXT, mb:'4px' }}>Select Hospital</Typography>
      <Typography sx={{ fontSize:'10.5px', color:DIM, mb:'12px' }}>
        {incidentType ? `Optimal for: ${incidentType}` : 'Select destination hospital'}
      </Typography>

      {ranked.map((h, i) => {
        const isSel   = selected === h.id;
        const isBest  = i === 0;
        return (
          <Box
            key={h.id}
            onClick={() => setSelected(isSel ? null : h.id)}
            sx={{
              p:'11px 12px', borderRadius:'11px', mb:'7px', cursor:'pointer',
              background: isSel ? 'rgba(142,182,155,0.14)' : 'rgba(142,182,155,0.05)',
              border:`1px solid ${isSel ? G : BRD}`,
              transition:'all 0.15s',
              '&:hover':{ background:'rgba(142,182,155,0.09)', borderColor:BRD2 },
            }}
          >
            <Box sx={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <Box sx={{ flex:1, minWidth:0 }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:'6px', mb:'3px' }}>
                  <Typography sx={{ fontSize:'12px', fontWeight:700, color:TEXT }}>{h.name}</Typography>
                  {isBest && <Box sx={{ fontSize:'8.5px', fontWeight:700, px:'6px', py:'1px', borderRadius:'4px', color:G, background:'rgba(142,182,155,0.14)' }}>NEAREST</Box>}
                </Box>
                <Typography sx={{ fontSize:'10.5px', color:DIM }}>
                  {h.beds_available} beds · {h.icu_available} ICU · ER wait {h.er_wait_min}m
                </Typography>
              </Box>
              <Box sx={{ textAlign:'right', flexShrink:0 }}>
                <Typography sx={{ fontSize:'13px', fontWeight:800, color:TEXT }}>{h.distance_km}km</Typography>
                <Typography sx={{ fontSize:'9.5px', color:DIM }}>~{Math.ceil(h.distance_km*2.5)} min</Typography>
              </Box>
            </Box>
          </Box>
        );
      })}

      {full.map(h=>(
        <Box key={h.id} sx={{ p:'10px 12px', borderRadius:'11px', mb:'7px', background:'rgba(226,92,80,0.04)', border:`1px solid rgba(226,92,80,0.10)`, opacity:0.5 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Box sx={{ flex:1 }}>
              <Typography sx={{ fontSize:'12px', fontWeight:700, color:DIM }}>{h.name}</Typography>
              <Typography sx={{ fontSize:'10px', color:'rgba(226,92,80,0.7)' }}>No beds available</Typography>
            </Box>
            <Box sx={{ fontSize:'10px', fontWeight:700, color:RED }}>FULL</Box>
          </Box>
        </Box>
      ))}

      <Button
        fullWidth
        disabled={!selected}
        onClick={() => { setConfirmed(true); onSelect?.(MOCK_HOSPITALS.find(h=>h.id===selected)); }}
        sx={{
          mt:'4px', py:'11px', borderRadius:'10px', border:'none',
          background: selected ? G : 'rgba(142,182,155,0.10)',
          color: selected ? BG : DIM,
          fontWeight:800, fontSize:'13px',
          '&:hover':{ background: selected ? '#7AA887' : 'rgba(142,182,155,0.10)' },
          '&:disabled':{ color:DIM, background:'rgba(142,182,155,0.10)' },
        }}
      >
        {selected ? `Confirm: ${MOCK_HOSPITALS.find(h=>h.id===selected)?.name}` : 'Select a hospital'}
      </Button>
    </Box>
  );
}
