import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

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

const PRESETS = [
  { label:'All units: Stand by',        category:'ops',    text:'All units: Stand by for further instructions.' },
  { label:'Avoid NH44 — heavy traffic', category:'route',  text:'All units: Avoid NH44 due to heavy traffic. Use alternate route via Ring Road.' },
  { label:'Code 3 — lights & sirens',   category:'ops',    text:'Alpha-1: Proceed Code 3, lights and sirens authorised.' },
  { label:'Return to base',             category:'ops',    text:'Unit: Mission complete — return to base when available.' },
  { label:'Confirm ETA',               category:'info',   text:'Unit: Please confirm your ETA to scene.' },
  { label:'Scene secured',             category:'info',   text:'All units: Scene secured by police. Safe to approach.' },
  { label:'Hospital on standby',       category:'hospital',text:'Alpha-1: AIIMS ER on standby — trauma team activated.' },
  { label:'Request backup',            category:'critical',text:'URGENT: Requesting backup at current location. Additional unit needed immediately.' },
];

const CAT_COLORS = {
  ops:      { color:G,     bg:'rgba(142,182,155,0.12)' },
  route:    { color:AMBER, bg:'rgba(227,169,79,0.12)' },
  info:     { color:TEXT,  bg:'rgba(142,182,155,0.07)' },
  hospital: { color:G,     bg:'rgba(142,182,155,0.10)' },
  critical: { color:RED,   bg:'rgba(226,92,80,0.14)' },
};

const UNITS = ['All Units','Alpha-1','Bravo-2','Charlie-3','Delta-4'];

export default function QuickCommsPanel({ ambulances }) {
  const [selected, setSelected]   = useState(null);
  const [unit, setUnit]           = useState('All Units');
  const [custom, setCustom]       = useState('');
  const [log, setLog]             = useState([
    { id:1, from:'Control', to:'All', text:'Morning briefing: 8 units on shift', ts:Date.now()-3600000 },
    { id:2, from:'Alpha-1', to:'Control', text:'Alpha-1 ready for dispatch', ts:Date.now()-1800000 },
  ]);
  const [sending, setSending]     = useState(false);
  const bottomRef                 = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [log]);

  const send = (text) => {
    if (!text.trim()) return;
    setSending(true);
    setTimeout(() => {
      setLog(prev => [...prev, {
        id: Date.now(), from:'Control', to: unit,
        text: text.trim().replace('Unit:', `${unit}:`).replace('Alpha-1:', `${unit}:`),
        ts: Date.now(), _sent:true,
      }]);
      setSelected(null);
      setCustom('');
      setSending(false);
      // Simulate unit reply after 3–8s
      setTimeout(() => {
        const replies = ['Roger that. Acknowledged.', 'Copy. Wilco.', 'Understood. Proceeding.', 'Received. On it.'];
        setLog(prev => [...prev, {
          id: Date.now()+1,
          from: unit === 'All Units' ? 'Alpha-1' : unit,
          to:'Control',
          text: replies[Math.floor(Math.random()*replies.length)],
          ts:Date.now(), _reply:true,
        }]);
      }, 3000 + Math.random()*5000);
    }, 600);
  };

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <Box sx={{ p:'14px 16px 10px', borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'10px' }}>
          <Typography sx={{ fontSize:'13.5px', fontWeight:800, color:TEXT }}>Quick Comms</Typography>
          <Box sx={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <Box sx={{ width:6, height:6, borderRadius:'50%', background:G, animation:'blinkDot 2s infinite' }} />
            <Typography sx={{ fontSize:'9.5px', fontWeight:700, color:G }}>RADIO LIVE</Typography>
          </Box>
        </Box>
        {/* Unit selector */}
        <Box sx={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
          {UNITS.map(u=>(
            <Box key={u} onClick={()=>setUnit(u)} sx={{
              px:'9px', py:'4px', borderRadius:'7px', cursor:'pointer', fontSize:'10.5px', fontWeight:700,
              color: unit===u ? BG : DIM,
              background: unit===u ? G : 'rgba(142,182,155,0.07)',
              border:`1px solid ${unit===u ? G : BRD}`,
              transition:'all 0.15s',
            }}>
              {u}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Message log */}
      <Box sx={{ flex:1, overflow:'auto', px:'12px', py:'8px' }}>
        {log.map(msg => {
          const fromControl = msg.from === 'Control';
          return (
            <Box key={msg.id} sx={{ mb:'10px', display:'flex', flexDirection:'column', alignItems: fromControl ? 'flex-end' : 'flex-start', animation: msg._sent||msg._reply ? 'fadeUp 0.3s ease' : 'none' }}>
              <Box sx={{ maxWidth:'82%', p:'8px 11px', borderRadius: fromControl ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                background: fromControl ? 'rgba(142,182,155,0.14)' : SURF2,
                border:`1px solid ${fromControl ? BRD2 : BRD}`,
              }}>
                <Typography sx={{ fontSize:'11.5px', color:TEXT, lineHeight:1.4 }}>{msg.text}</Typography>
              </Box>
              <Box sx={{ display:'flex', gap:'5px', mt:'3px', alignItems:'center' }}>
                <Typography sx={{ fontSize:'9px', color:FAINT }}>{msg.from} → {msg.to}</Typography>
                <Box sx={{ width:2, height:2, borderRadius:'50%', background:FAINT }}/>
                <Typography sx={{ fontSize:'9px', color:FAINT, fontFamily:'"JetBrains Mono",monospace' }}>{fmtTime(msg.ts)}</Typography>
              </Box>
            </Box>
          );
        })}
        <div ref={bottomRef}/>
      </Box>

      {/* Presets */}
      <Box sx={{ px:'12px', pb:'10px', borderTop:`1px solid ${BRD}`, pt:'10px', flexShrink:0 }}>
        <Typography sx={{ fontSize:'9px', color:FAINT, letterSpacing:'0.06em', fontWeight:700, mb:'7px' }}>QUICK MESSAGES</Typography>
        <Box sx={{ display:'flex', flexWrap:'wrap', gap:'5px', mb:'10px' }}>
          {PRESETS.map((p,i) => {
            const cc = CAT_COLORS[p.category] || CAT_COLORS.info;
            const isSel = selected === i;
            return (
              <Box key={i} onClick={()=>setSelected(isSel?null:i)} sx={{
                px:'9px', py:'4px', borderRadius:'7px', cursor:'pointer', fontSize:'10.5px', fontWeight:600,
                color: isSel ? BG : cc.color,
                background: isSel ? cc.color.replace(')', ',1)') : cc.bg,
                border:`1px solid ${isSel ? cc.color : 'transparent'}`,
                transition:'all 0.15s',
              }}>
                {p.label}
              </Box>
            );
          })}
        </Box>

        {/* Custom or preview */}
        {selected !== null ? (
          <Box sx={{ mb:'8px', p:'9px 11px', borderRadius:'10px', background:SURF2, border:`1px solid ${BRD2}`, fontSize:'11.5px', color:DIM, lineHeight:1.4 }}>
            {PRESETS[selected].text.replace('Unit:', `${unit}:`).replace('Alpha-1:', `${unit}:`)}
          </Box>
        ) : (
          <textarea
            value={custom}
            onChange={e=>setCustom(e.target.value)}
            placeholder="Or type a custom message…"
            rows={2}
            style={{ width:'100%', background:SURF2, border:`1px solid ${BRD}`, borderRadius:'9px', color:TEXT, fontSize:'11.5px', padding:'8px 10px', fontFamily:'"Inter",sans-serif', resize:'none', outline:'none', lineHeight:'1.5', marginBottom:'8px', boxSizing:'border-box' }}
          />
        )}

        <Button
          fullWidth
          disabled={sending || (selected===null && !custom.trim())}
          onClick={() => send(selected!==null ? PRESETS[selected].text : custom)}
          sx={{
            py:'10px', borderRadius:'9px', border:'none',
            background: sending ? 'rgba(142,182,155,0.12)' : G,
            color: sending ? DIM : BG,
            fontWeight:800, fontSize:'12.5px',
            '&:disabled':{ color:DIM, background:'rgba(142,182,155,0.10)' },
            '&:hover':{ background:'#7AA887' },
            transition:'all 0.2s',
          }}
        >
          {sending ? 'Sending…' : `Send to ${unit}`}
        </Button>
      </Box>
    </Box>
  );
}
