import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { dispatchBroadcast, DISPATCH_EVENTS } from '../services/dispatchBroadcast';

const G     = '#8EB69B';
const TEXT  = '#DAF1DE';
const DIM   = 'rgba(218,241,222,0.50)';
const FAINT = 'rgba(218,241,222,0.28)';
const BRD   = 'rgba(142,182,155,0.10)';
const RED   = '#E25C50';
const AMBER = '#E3A94F';
const BG    = '#051F20';

const ICON_MAP = {
  SOS:         { symbol:'!', color:RED,   bg:'rgba(226,92,80,0.15)' },
  DISPATCH:    { symbol:'→', color:G,     bg:'rgba(142,182,155,0.12)' },
  STATUS:      { symbol:'↑', color:AMBER, bg:'rgba(227,169,79,0.12)' },
  RESOLVED:    { symbol:'✓', color:G,     bg:'rgba(142,182,155,0.12)' },
  AMBULANCE:   { symbol:'🚑', color:G,    bg:'rgba(142,182,155,0.08)' },
  SYSTEM:      { symbol:'·', color:FAINT, bg:'rgba(142,182,155,0.06)' },
};

const SEED_EVENTS = [
  { id:'e1', type:'DISPATCH',  time: Date.now()-120000, msg:'Alpha-1 dispatched → Cardiac Arrest, Indiranagar' },
  { id:'e2', type:'STATUS',    time: Date.now()-95000,  msg:'Alpha-1 arrived on scene' },
  { id:'e3', type:'AMBULANCE', time: Date.now()-80000,  msg:'Bravo-2 returned to standby' },
  { id:'e4', type:'RESOLVED',  time: Date.now()-60000,  msg:'Incident #1042 resolved — patient transported' },
  { id:'e5', type:'SYSTEM',    time: Date.now()-30000,  msg:'System: 3 units available' },
];

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function EventRow({ ev, isNew }) {
  const cfg = ICON_MAP[ev.type] || ICON_MAP.SYSTEM;
  return (
    <Box sx={{
      display:'flex', alignItems:'flex-start', gap:'9px', py:'8px',
      borderBottom:`1px solid ${BRD}`,
      animation: isNew ? 'fadeUp 0.3s ease' : 'none',
      '&:last-child':{ borderBottom:'none' },
    }}>
      <Box sx={{
        width:22, height:22, borderRadius:'7px', flexShrink:0,
        background:cfg.bg, color:cfg.color,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'11px', fontWeight:700, mt:'1px',
      }}>
        {cfg.symbol}
      </Box>
      <Box sx={{ flex:1, minWidth:0 }}>
        <Typography sx={{ fontSize:'11.5px', color:TEXT, lineHeight:1.4 }}>{ev.msg}</Typography>
        <Typography sx={{ fontSize:'9.5px', color:FAINT, mt:'2px', fontFamily:'"JetBrains Mono",monospace' }}>
          {timeStr(ev.time)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ActivityFeed() {
  const [events, setEvents]   = useState(SEED_EVENTS);
  const [newIds, setNewIds]   = useState(new Set());
  const bottomRef             = useRef(null);

  const addEvent = (type, msg) => {
    const ev = { id:`e${Date.now()}`, type, time:Date.now(), msg };
    setEvents(prev => [...prev, ev]);
    setNewIds(prev => new Set([...prev, ev.id]));
    setTimeout(()=> setNewIds(prev=>{ const n=new Set(prev); n.delete(ev.id); return n; }), 2000);
  };

  // Wire up to dispatchBroadcast
  useEffect(() => {
    const onSOS = (inc) => addEvent('SOS', `SOS: ${inc.incident_type} at ${inc.location_address||'Unknown'}`);
    const onAssigned = (a) => {
      if (a?._isAssignment) addEvent('DISPATCH', `Dispatched ${a.callSign||'unit'} → ${a.incident_type}`);
    };
    const onUpdate = (inc) => {
      if (inc?.status) addEvent('STATUS', `Incident #${inc.id?.slice(-4)||'???'} → ${inc.status.replace(/_/g,' ')}`);
    };
    dispatchBroadcast.on(DISPATCH_EVENTS.SOS_CREATED, onSOS);
    dispatchBroadcast.on(DISPATCH_EVENTS.INCIDENT_ASSIGNED, onAssigned);
    dispatchBroadcast.on(DISPATCH_EVENTS.INCIDENT_UPDATED, onUpdate);
    return () => {
      dispatchBroadcast.off(DISPATCH_EVENTS.SOS_CREATED, onSOS);
      dispatchBroadcast.off(DISPATCH_EVENTS.INCIDENT_ASSIGNED, onAssigned);
      dispatchBroadcast.off(DISPATCH_EVENTS.INCIDENT_UPDATED, onUpdate);
    };
  }, []);

  // Simulate periodic system messages
  useEffect(() => {
    const msgs = [
      'GPS signal refreshed for all units',
      'Daily shift report generated',
      'Hospital availability updated',
      'Charlie-3 fuel check complete',
    ];
    let i = 0;
    const iv = setInterval(() => {
      addEvent('SYSTEM', msgs[i % msgs.length]);
      i++;
    }, 25000);
    return () => clearInterval(iv);
  }, []);

  // Auto-scroll to bottom on new event
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [events]);

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <Box sx={{ p:'14px 16px', borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Typography sx={{ fontSize:'13.5px', fontWeight:700, color:TEXT }}>Activity Feed</Typography>
          <Box sx={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <Box sx={{ width:6, height:6, borderRadius:'50%', background:G, animation:'blinkDot 2s infinite' }} />
            <Typography sx={{ fontSize:'9.5px', fontWeight:700, color:G }}>LIVE</Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize:'10px', color:FAINT, mt:'3px' }}>{events.length} events this session</Typography>
      </Box>

      {/* Event list */}
      <Box sx={{ flex:1, overflow:'auto', px:'12px', py:'6px' }}>
        {events.map(ev=>(
          <EventRow key={ev.id} ev={ev} isNew={newIds.has(ev.id)} />
        ))}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
