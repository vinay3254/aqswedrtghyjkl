import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

const G     = '#8EB69B';
const TEXT  = '#DAF1DE';
const DIM   = 'rgba(218,241,222,0.50)';
const FAINT = 'rgba(218,241,222,0.28)';
const BRD   = 'rgba(142,182,155,0.10)';
const RED   = '#E25C50';
const AMBER = '#E3A94F';
const BG    = '#051F20';

export default function PanicButton({ driverPos, callSign, onPanic }) {
  const [phase, setPhase]       = useState('idle'); // idle | confirm | sent | cooldown
  const [holdPct, setHoldPct]   = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [holdTimer, setHoldTimer] = useState(null);

  /* Hold-to-confirm — 2s hold activates */
  const startHold = () => {
    if (phase !== 'idle') return;
    setPhase('confirm');
    let pct = 0;
    const iv = setInterval(() => {
      pct += 4;
      setHoldPct(pct);
      if (pct >= 100) {
        clearInterval(iv);
        triggerPanic();
      }
    }, 80);
    setHoldTimer(iv);
  };

  const cancelHold = () => {
    if (phase !== 'confirm') return;
    clearInterval(holdTimer);
    setHoldPct(0);
    setPhase('idle');
  };

  const triggerPanic = () => {
    setPhase('sent');
    setHoldPct(100);
    onPanic?.({
      type:'PANIC',
      callSign: callSign || 'Alpha-1',
      location: driverPos,
      timestamp: new Date().toISOString(),
      message:`MAYDAY: ${callSign||'Alpha-1'} requesting immediate assistance!`,
    });
    let cd = 60;
    setCooldown(cd);
    const iv = setInterval(() => {
      cd--;
      setCooldown(cd);
      if (cd <= 0) { clearInterval(iv); setPhase('idle'); setHoldPct(0); }
    }, 1000);
  };

  useEffect(() => () => clearInterval(holdTimer), [holdTimer]);

  /* Ring circumference for SVG arc */
  const R    = 34;
  const circ = 2 * Math.PI * R;
  const dash = (holdPct / 100) * circ;

  if (phase === 'sent' || phase === 'cooldown') {
    return (
      <Box sx={{ mx:'12px', mb:'12px', p:'14px', borderRadius:'14px', background:'rgba(226,92,80,0.12)', border:`1.5px solid ${RED}`, animation:'fadeUp 0.3s ease' }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Box sx={{ width:44, height:44, borderRadius:'50%', background:'rgba(226,92,80,0.20)', border:`1.5px solid ${RED}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Typography sx={{ fontSize:'18px' }}>🆘</Typography>
          </Box>
          <Box sx={{ flex:1 }}>
            <Typography sx={{ fontSize:'13px', fontWeight:800, color:RED, mb:'2px' }}>MAYDAY Sent</Typography>
            <Typography sx={{ fontSize:'10.5px', color:DIM }}>Backup requested · Dispatch notified · GPS transmitted</Typography>
          </Box>
          {cooldown > 0 && (
            <Typography sx={{ fontSize:'11px', fontWeight:700, color:RED, fontFamily:'"JetBrains Mono",monospace', flexShrink:0 }}>{cooldown}s</Typography>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mx:'12px', mb:'12px', p:'14px', borderRadius:'14px', background:'rgba(226,92,80,0.06)', border:`1px solid rgba(226,92,80,0.20)` }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:'14px' }}>
        {/* Hold button with SVG progress ring */}
        <Box
          onMouseDown={startHold} onTouchStart={startHold}
          onMouseUp={cancelHold}  onTouchEnd={cancelHold}
          onMouseLeave={cancelHold}
          sx={{ position:'relative', width:80, height:80, flexShrink:0, cursor:'pointer', userSelect:'none' }}
        >
          {/* SVG ring */}
          <svg width={80} height={80} style={{ position:'absolute', inset:0, transform:'rotate(-90deg)' }}>
            <circle cx={40} cy={40} r={R} fill="none" stroke="rgba(226,92,80,0.10)" strokeWidth={5}/>
            <circle cx={40} cy={40} r={R} fill="none" stroke={RED} strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition:'stroke-dasharray 0.08s linear' }}
            />
          </svg>
          {/* Inner circle */}
          <Box sx={{
            position:'absolute', inset:'8px',
            borderRadius:'50%',
            background: phase==='confirm' ? 'rgba(226,92,80,0.25)' : 'rgba(226,92,80,0.12)',
            border:`1.5px solid ${RED}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'background 0.15s',
          }}>
            <Typography sx={{ fontSize:'22px', lineHeight:1, userSelect:'none' }}>🆘</Typography>
          </Box>
        </Box>

        {/* Text */}
        <Box sx={{ flex:1 }}>
          <Typography sx={{ fontSize:'13.5px', fontWeight:800, color:RED, mb:'3px' }}>
            {phase === 'confirm' ? 'Hold to Confirm…' : 'Emergency Panic'}
          </Typography>
          <Typography sx={{ fontSize:'10.5px', color:DIM, lineHeight:1.4 }}>
            {phase === 'confirm'
              ? `${Math.round(holdPct)}% · Release to cancel`
              : 'Hold button 2 seconds to request immediate backup from dispatch'
            }
          </Typography>
          {phase === 'idle' && (
            <Box sx={{ display:'flex', gap:'6px', mt:'8px' }}>
              {['GPS Transmit','Backup Alert','Dispatch Notify'].map(t=>(
                <Box key={t} sx={{ fontSize:'8.5px', fontWeight:600, px:'6px', py:'2px', borderRadius:'5px', color:RED, background:'rgba(226,92,80,0.10)' }}>{t}</Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
