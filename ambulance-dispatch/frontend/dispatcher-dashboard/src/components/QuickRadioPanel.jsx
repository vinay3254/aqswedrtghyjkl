import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';

const G     = '#2563EB';
const TEXT  = '#0F172A';
const DIM   = '#475569';
const FAINT = '#94A3B8';
const BRD   = '#E2E8F0';
const BRD2  = '#E2E8F0';
const RED   = '#E25C50';
const AMBER = '#E3A94F';
const BG    = '#F8FAFC';
const SURF2 = '#F1F5F9';

const MESSAGES = [
  { label:'En Route',          icon:'🚑', text:'En route to scene. ETA updating.',   color:G,     bg:'rgba(37,99,235,0.10)' },
  { label:'On Scene',          icon:'📍', text:'Arrived on scene. Assessing now.',    color:G,     bg:'rgba(37,99,235,0.10)' },
  { label:'Patient Stable',    icon:'♥',  text:'Patient stable. Vitals recorded.',    color:G,     bg:'rgba(37,99,235,0.10)' },
  { label:'Patient Critical',  icon:'⚠',  text:'Patient critical. Expediting transport.', color:RED,  bg:'rgba(226,92,80,0.14)' },
  { label:'Need Backup',       icon:'🆘', text:'Requesting backup at current location.', color:RED,  bg:'rgba(226,92,80,0.14)' },
  { label:'Transporting',      icon:'🏥', text:'Transporting patient. Notify hospital.', color:G,   bg:'rgba(37,99,235,0.10)' },
  { label:'ETA 5 min',         icon:'⏱',  text:'ETA to destination: 5 minutes.',      color:AMBER, bg:'rgba(227,169,79,0.12)' },
  { label:'Handed Over',       icon:'✓',  text:'Patient handed over to ER team. Clear.', color:G,  bg:'rgba(37,99,235,0.10)' },
  { label:'Road Blocked',      icon:'🚧', text:'Route blocked. Recalculating alternate.', color:AMBER, bg:'rgba(227,169,79,0.12)' },
  { label:'Return to Base',    icon:'🏠', text:'Returning to base. Available for next call.', color:G, bg:'#E2E8F0' },
];

export default function QuickRadioPanel({ onMessage }) {
  const [sent, setSent]     = useState(null);
  const [history, setHist]  = useState([]);

  const sendMsg = (msg) => {
    setSent(msg.label);
    const entry = { ...msg, ts: Date.now() };
    setHist(h => [entry, ...h].slice(0, 5));
    onMessage?.(entry);
    setTimeout(() => setSent(null), 2500);
  };

  return (
    <Box sx={{ p:'14px', borderRadius:'14px', background:'linear-gradient(160deg,#F1F5F9,rgba(0,0,0,0.2))', border:`1px solid ${BRD2}`, mb:'14px', animation:'fadeUp 0.2s ease' }}>
      {/* Header */}
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'12px' }}>
        <Box>
          <Typography sx={{ fontSize:'13px', fontWeight:800, color:TEXT }}>Quick Radio</Typography>
          <Typography sx={{ fontSize:'9.5px', color:DIM, mt:'1px' }}>Tap to transmit to Dispatch Control</Typography>
        </Box>
        <Box sx={{ display:'flex', alignItems:'center', gap:'5px' }}>
          <Box sx={{ width:6, height:6, borderRadius:'50%', background:G, animation:'blinkDot 2s infinite' }}/>
          <Typography sx={{ fontSize:'9.5px', fontWeight:700, color:G }}>LIVE</Typography>
        </Box>
      </Box>

      {/* Grid of message buttons */}
      <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px', mb: history.length ? '12px' : 0 }}>
        {MESSAGES.map((m, i) => {
          const isSent = sent === m.label;
          return (
            <Box
              key={i}
              onClick={() => !sent && sendMsg(m)}
              sx={{
                p:'9px 10px', borderRadius:'10px', cursor: sent ? 'default' : 'pointer',
                background: isSent ? m.bg : 'rgba(142,182,155,0.05)',
                border:`1px solid ${isSent ? m.color : BRD}`,
                display:'flex', alignItems:'center', gap:'7px',
                transition:'all 0.15s',
                opacity: sent && !isSent ? 0.4 : 1,
                '&:hover': !sent ? { background:m.bg, borderColor:m.color } : {},
              }}
            >
              <Typography sx={{ fontSize:'14px', lineHeight:1 }}>{m.icon}</Typography>
              <Box sx={{ minWidth:0 }}>
                <Typography sx={{ fontSize:'11px', fontWeight:700, color: isSent ? m.color : TEXT, lineHeight:1.2 }}>{m.label}</Typography>
                {isSent && <Typography sx={{ fontSize:'8.5px', color:m.color, mt:'1px' }}>Sent ✓</Typography>}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Recent history */}
      {history.length > 0 && (
        <Box sx={{ borderTop:`1px solid ${BRD}`, pt:'10px' }}>
          <Typography sx={{ fontSize:'8.5px', color:FAINT, letterSpacing:'0.06em', fontWeight:700, mb:'7px' }}>RECENT</Typography>
          {history.map((h,i) => (
            <Box key={i} sx={{ display:'flex', alignItems:'center', gap:'7px', mb:'5px' }}>
              <Typography sx={{ fontSize:'11px' }}>{h.icon}</Typography>
              <Typography sx={{ fontSize:'10.5px', color:DIM, flex:1 }}>{h.text}</Typography>
              <Typography sx={{ fontSize:'9px', color:FAINT, flexShrink:0, fontFamily:'"JetBrains Mono",monospace' }}>
                {new Date(h.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
