import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';

const G     = '#2563EB';
const TEXT  = '#0F172A';
const DIM   = '#475569';
const FAINT = '#94A3B8';
const BRD   = '#E2E8F0';
const BRD2  = '#E2E8F0';
const RED   = '#E25C50';
const BG    = '#F8FAFC';

const CHECKLISTS = {
  PRE_DEPARTURE: {
    label: 'Pre-Departure',
    items: [
      'O₂ tank checked (min 80%)',
      'Defibrillator powered on & charged',
      'IV supplies stocked',
      'Stretcher secured & locked',
      'Radio comms confirmed',
      'GPS route confirmed to destination',
      'Gloves & PPE available',
    ],
  },
  ON_SCENE: {
    label: 'On Scene',
    items: [
      'Scene safety assessed',
      'Patient primary survey (ABCDE)',
      'C-spine precaution considered',
      'IV access established',
      'Vitals recorded & transmitted',
      'Patient ID & consent obtained',
      'Relatives / bystanders briefed',
    ],
  },
  HANDOVER: {
    label: 'Hospital Handover',
    items: [
      'ER team notified via radio',
      'Patient vitals transmitted',
      'Run sheet completed',
      'Medications administered documented',
      'Hospital bed confirmed available',
      'Patient signature (or NOK) obtained',
    ],
  },
};

export default function MedicalChecklist({ phase = 'PRE_DEPARTURE', onComplete }) {
  const [checked, setChecked] = useState(new Set());
  const [submitted, setSubmit] = useState(false);

  const list = CHECKLISTS[phase] || CHECKLISTS.PRE_DEPARTURE;
  const total   = list.items.length;
  const done    = checked.size;
  const pct     = Math.round((done / total) * 100);
  const allDone = done === total;

  const toggle = (i) => setChecked(prev => {
    const n = new Set(prev);
    n.has(i) ? n.delete(i) : n.add(i);
    return n;
  });

  const handleSubmit = () => {
    setSubmit(true);
    onComplete?.({ phase, items: list.items, completedAt: new Date().toISOString() });
  };

  if (submitted) {
    return (
      <Box sx={{ p:'13px', borderRadius:'13px', background:'#E2E8F0', border:`1px solid ${G}`, mb:'14px', animation:'fadeUp 0.3s ease' }}>
        <Typography sx={{ fontSize:'12px', fontWeight:700, color:G }}>✓ Checklist Complete — {list.label}</Typography>
        <Typography sx={{ fontSize:'10px', color:DIM, mt:'3px' }}>
          {total}/{total} items · {new Date().toLocaleTimeString()}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p:'14px', borderRadius:'14px', background:'linear-gradient(160deg,#F1F5F9,rgba(0,0,0,0.2))', border:`1px solid ${BRD2}`, mb:'14px', animation:'fadeUp 0.2s ease' }}>
      {/* Header + progress */}
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'8px' }}>
        <Typography sx={{ fontSize:'13px', fontWeight:800, color:TEXT }}>{list.label} Checklist</Typography>
        <Typography sx={{ fontSize:'10.5px', fontWeight:700, color: allDone ? G : DIM }}>
          {done}/{total}
        </Typography>
      </Box>
      <Box sx={{ height:3, borderRadius:2, background:'#E2E8F0', overflow:'hidden', mb:'12px' }}>
        <Box sx={{ height:'100%', borderRadius:2, background: allDone ? G : 'rgba(142,182,155,0.45)', width:`${pct}%`, transition:'width 0.3s ease' }} />
      </Box>

      {/* Items */}
      {list.items.map((item, i) => {
        const ticked = checked.has(i);
        return (
          <Box
            key={i}
            onClick={() => toggle(i)}
            sx={{
              display:'flex', alignItems:'center', gap:'10px',
              py:'8px', cursor:'pointer',
              borderBottom:`1px solid ${BRD}`,
              '&:last-child':{ borderBottom:'none' },
              transition:'opacity 0.15s',
              opacity: ticked ? 0.65 : 1,
            }}
          >
            {/* Checkbox */}
            <Box sx={{
              width:20, height:20, borderRadius:'6px', flexShrink:0,
              border:`1.5px solid ${ticked ? G : 'rgba(142,182,155,0.30)'}`,
              background: ticked ? G : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.15s',
            }}>
              {ticked && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke={BG} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </Box>
            <Typography sx={{ fontSize:'12px', color: ticked ? FAINT : TEXT, textDecoration: ticked ? 'line-through' : 'none', transition:'all 0.2s', lineHeight:1.4 }}>
              {item}
            </Typography>
          </Box>
        );
      })}

      <Button
        fullWidth
        onClick={handleSubmit}
        disabled={!allDone}
        sx={{
          mt:'12px', py:'10px', borderRadius:'9px', border:'none',
          background: allDone ? G : '#E2E8F0',
          color: allDone ? BG : DIM,
          fontWeight:800, fontSize:'12.5px',
          '&:disabled':{ color:DIM, background:'#E2E8F0' },
          '&:hover':{ background: allDone ? '#7AA887' : '#E2E8F0' },
          transition:'all 0.2s',
        }}
      >
        {allDone ? 'Confirm & Continue' : `${total - done} item(s) remaining`}
      </Button>
    </Box>
  );
}
