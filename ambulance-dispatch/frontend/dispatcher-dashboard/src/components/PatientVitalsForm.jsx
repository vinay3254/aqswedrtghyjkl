import React, { useState } from 'react';
import { Box, Typography, Button, TextField } from '@mui/material';

const BG    = '#051F20';
const SURF  = '#0B2B26';
const SURF2 = '#163832';
const G     = '#8EB69B';
const TEXT  = '#DAF1DE';
const DIM   = 'rgba(218,241,222,0.50)';
const FAINT = 'rgba(218,241,222,0.28)';
const BRD   = 'rgba(142,182,155,0.10)';
const BRD2  = 'rgba(142,182,155,0.22)';
const RED   = '#E25C50';
const AMBER = '#E3A94F';

const FIELDS = [
  { key:'bp',      label:'Blood Pressure', placeholder:'e.g. 120/80', unit:'mmHg', icon:'♥' },
  { key:'pulse',   label:'Pulse Rate',     placeholder:'e.g. 78',     unit:'bpm',  icon:'~' },
  { key:'spo2',    label:'SpO₂',           placeholder:'e.g. 98',     unit:'%',    icon:'O₂' },
  { key:'gcs',     label:'GCS Score',      placeholder:'3 – 15',      unit:'/15',  icon:'🧠' },
  { key:'temp',    label:'Temperature',    placeholder:'e.g. 37.2',   unit:'°C',   icon:'T' },
  { key:'rr',      label:'Resp. Rate',     placeholder:'e.g. 16',     unit:'/min', icon:'↕' },
];

function getRisk(vitals) {
  const spo2 = parseFloat(vitals.spo2);
  const gcs  = parseInt(vitals.gcs);
  const pulse = parseInt(vitals.pulse);
  if ((spo2 < 90) || (gcs < 9) || (pulse > 130 || pulse < 40)) return { level:'CRITICAL', color:RED };
  if ((spo2 < 94) || (gcs < 13) || (pulse > 110 || pulse < 50)) return { level:'HIGH', color:AMBER };
  return { level:'STABLE', color:G };
}

export default function PatientVitalsForm({ onSubmit }) {
  const [vitals, setVitals]     = useState({});
  const [submitted, setSubmit]  = useState(false);
  const [notes, setNotes]       = useState('');

  const setField = (k, v) => setVitals(p => ({ ...p, [k]: v }));
  const filled   = Object.keys(vitals).filter(k => vitals[k]).length;
  const risk     = filled >= 3 ? getRisk(vitals) : null;

  const handleSubmit = () => {
    setSubmit(true);
    onSubmit?.({ ...vitals, notes, risk: risk?.level, timestamp: new Date().toISOString() });
  };

  if (submitted) {
    return (
      <Box sx={{ p:'14px', borderRadius:'14px', background:'rgba(142,182,155,0.10)', border:`1px solid ${G}`, textAlign:'center', mb:'14px', animation:'fadeUp 0.3s ease' }}>
        <Typography sx={{ fontSize:13, fontWeight:700, color:G, mb:'4px' }}>✓ Vitals Recorded</Typography>
        <Typography sx={{ fontSize:'10.5px', color:DIM }}>Transmitted to dispatch · {new Date().toLocaleTimeString()}</Typography>
        {risk && (
          <Box sx={{ display:'inline-block', mt:'8px', fontSize:'11px', fontWeight:700, px:'10px', py:'3px', borderRadius:'6px', color:risk.color, background:`${risk.color}22` }}>
            Patient Risk: {risk.level}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p:'14px', borderRadius:'14px', background:'linear-gradient(160deg,rgba(142,182,155,0.08),rgba(0,0,0,0.2))', border:`1px solid ${BRD2}`, mb:'14px', animation:'fadeUp 0.2s ease' }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'14px' }}>
        <Typography sx={{ fontSize:'13.5px', fontWeight:800, color:TEXT }}>Patient Vitals</Typography>
        {risk && (
          <Box sx={{ fontSize:'10px', fontWeight:700, px:'9px', py:'3px', borderRadius:'6px', color:risk.color, background:`${risk.color}20` }}>
            {risk.level}
          </Box>
        )}
      </Box>

      {/* Vitals grid */}
      <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', mb:'12px' }}>
        {FIELDS.map(f => (
          <Box key={f.key}>
            <Typography sx={{ fontSize:'8.5px', color:FAINT, letterSpacing:'0.05em', mb:'4px', fontWeight:600 }}>
              {f.icon} {f.label}
            </Typography>
            <Box sx={{ display:'flex', alignItems:'center', gap:'4px', background:SURF2, border:`1px solid ${vitals[f.key] ? BRD2 : BRD}`, borderRadius:'8px', overflow:'hidden', transition:'border-color 0.15s' }}>
              <input
                value={vitals[f.key] || ''}
                onChange={e => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
                style={{
                  flex:1, background:'transparent', border:'none', outline:'none',
                  color:TEXT, fontSize:'12px', fontWeight:600, padding:'7px 8px',
                  fontFamily:'"Inter",sans-serif',
                }}
              />
              <Typography sx={{ fontSize:'9px', color:FAINT, pr:'8px', flexShrink:0 }}>{f.unit}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Notes */}
      <Box sx={{ mb:'12px' }}>
        <Typography sx={{ fontSize:'8.5px', color:FAINT, letterSpacing:'0.05em', mb:'4px', fontWeight:600 }}>
          CLINICAL NOTES
        </Typography>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional observations, allergies, medications…"
          rows={2}
          style={{
            width:'100%', background:SURF2, border:`1px solid ${BRD}`, borderRadius:'8px',
            color:TEXT, fontSize:'11.5px', padding:'8px 10px', fontFamily:'"Inter",sans-serif',
            resize:'none', outline:'none', lineHeight:'1.5',
          }}
        />
      </Box>

      {/* Submit */}
      <Button
        fullWidth
        onClick={handleSubmit}
        disabled={filled < 2}
        sx={{
          py:'10px', borderRadius:'9px', border:'none',
          background: filled >= 2 ? G : 'rgba(142,182,155,0.12)',
          color: filled >= 2 ? BG : DIM,
          fontWeight:800, fontSize:'12.5px',
          '&:hover':{ background: filled >= 2 ? '#7AA887' : 'rgba(142,182,155,0.12)' },
          '&:disabled':{ color:DIM, background:'rgba(142,182,155,0.12)' },
          transition:'all 0.2s',
        }}
      >
        {filled < 2 ? `Fill ${2 - filled} more field(s)` : 'Record & Transmit Vitals'}
      </Button>
    </Box>
  );
}
