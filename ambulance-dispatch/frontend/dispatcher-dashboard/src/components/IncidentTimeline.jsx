import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';

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

const STATUS_META = {
  CREATED:      { label:'Incident Created',    icon:'!',  color:RED,   bg:'rgba(226,92,80,0.16)' },
  ACKNOWLEDGED: { label:'Acknowledged',        icon:'✓',  color:AMBER, bg:'rgba(227,169,79,0.14)' },
  DISPATCHED:   { label:'Unit Dispatched',     icon:'→',  color:G,     bg:'rgba(142,182,155,0.14)' },
  EN_ROUTE:     { label:'En Route to Scene',   icon:'🚑', color:G,     bg:'rgba(142,182,155,0.10)' },
  ON_SCENE:     { label:'Arrived On Scene',    icon:'📍', color:G,     bg:'rgba(142,182,155,0.10)' },
  TRANSPORTING: { label:'Patient Transported', icon:'🏥', color:G,     bg:'rgba(142,182,155,0.10)' },
  RESOLVED:     { label:'Incident Resolved',   icon:'★',  color:G,     bg:'rgba(142,182,155,0.14)' },
  CANCELLED:    { label:'Cancelled',           icon:'✕',  color:FAINT, bg:'rgba(142,182,155,0.06)' },
};

const SEV_COLOR = { CRITICAL:RED, HIGH:AMBER, MEDIUM:G, LOW:G };
const SEV_BG    = { CRITICAL:'rgba(226,92,80,0.14)', HIGH:'rgba(227,169,79,0.14)', MEDIUM:'rgba(142,182,155,0.14)', LOW:'rgba(142,182,155,0.10)' };

function buildTimeline(incident) {
  if (!incident) return [];
  const base = new Date(incident.created_at || Date.now() - 600000).getTime();
  const events = [
    { status:'CREATED',      ts: base,          actor: incident.caller_name || 'System',   note: incident.description || incident.incident_type },
  ];
  if (!['PENDING'].includes(incident.status)) {
    events.push({ status:'ACKNOWLEDGED', ts: base + 45000,  actor:'Dispatch Control', note:'Call verified, unit search started' });
    events.push({ status:'DISPATCHED',   ts: base + 120000, actor:'Auto-dispatch',    note:`${incident.assigned_unit || 'Alpha-1'} assigned` });
  }
  if (['EN_ROUTE','ON_SCENE','TRANSPORTING','RESOLVED'].includes(incident.status)) {
    events.push({ status:'EN_ROUTE',     ts: base + 180000, actor: incident.assigned_unit || 'Alpha-1', note:'Unit en route at 58 km/h' });
  }
  if (['ON_SCENE','TRANSPORTING','RESOLVED'].includes(incident.status)) {
    events.push({ status:'ON_SCENE',     ts: base + 420000, actor: incident.assigned_unit || 'Alpha-1', note:'Patient primary survey underway' });
  }
  if (['TRANSPORTING','RESOLVED'].includes(incident.status)) {
    events.push({ status:'TRANSPORTING', ts: base + 660000, actor: incident.assigned_unit || 'Alpha-1', note:'Transporting to AIIMS Delhi' });
  }
  if (incident.status === 'RESOLVED') {
    events.push({ status:'RESOLVED',     ts: base + 900000, actor:'Dispatch Control', note:'Patient handed over to ER team' });
  }
  if (incident.status === 'CANCELLED') {
    events.push({ status:'CANCELLED',    ts: base + 60000,  actor:'Dispatch Control', note:'Cancelled — duplicate report' });
  }
  return events;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function fmtDelta(from, to) {
  const d = Math.round((to - from) / 1000);
  if (d < 60)  return `+${d}s`;
  return `+${Math.floor(d/60)}m ${d%60}s`;
}

export default function IncidentTimeline({ incident, onClose }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!incident) return;
    setEvents(buildTimeline(incident));
    // Simulate a new event appearing after 5s if pending/acknowledged
    if (['PENDING','ACKNOWLEDGED'].includes(incident.status)) {
      const t = setTimeout(() => {
        setEvents(prev => {
          const last = prev[prev.length-1];
          if (last?.status === 'ACKNOWLEDGED') return prev;
          return [...prev, { status:'ACKNOWLEDGED', ts:Date.now(), actor:'Dispatch Control', note:'Call verified', _new:true }];
        });
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [incident]);

  if (!incident) return null;

  const sev = incident.severity || 'HIGH';
  const meta = STATUS_META;

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <Box sx={{ p:'14px 16px 12px', borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
        <Box sx={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', mb:'8px' }}>
          <Box sx={{ flex:1, minWidth:0, pr:'10px' }}>
            <Typography sx={{ fontSize:'14px', fontWeight:800, color:TEXT, mb:'4px' }}>
              {incident.incident_type}
            </Typography>
            <Typography sx={{ fontSize:'10.5px', color:DIM }}>
              {incident.location_address || 'Location unknown'}
            </Typography>
          </Box>
          <Box sx={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
            <Box sx={{ fontSize:'9.5px', fontWeight:700, px:'8px', py:'2px', borderRadius:'6px', color:SEV_COLOR[sev], background:SEV_BG[sev] }}>
              {sev}
            </Box>
            <Box onClick={onClose} sx={{ width:26, height:26, borderRadius:'7px', background:'rgba(142,182,155,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', '&:hover':{ background:'rgba(142,182,155,0.15)' } }}>
              <Close sx={{ fontSize:13, color:DIM }} />
            </Box>
          </Box>
        </Box>
        <Box sx={{ display:'flex', gap:'8px' }}>
          <Box sx={{ flex:1, p:'7px', borderRadius:'8px', background:SURF2, textAlign:'center' }}>
            <Typography sx={{ fontSize:'8px', color:FAINT, letterSpacing:'0.05em', mb:'2px' }}>ID</Typography>
            <Typography sx={{ fontSize:'10px', fontWeight:700, color:TEXT, fontFamily:'"JetBrains Mono",monospace' }}>
              #{(incident.id||'').slice(-6).toUpperCase()}
            </Typography>
          </Box>
          <Box sx={{ flex:1, p:'7px', borderRadius:'8px', background:SURF2, textAlign:'center' }}>
            <Typography sx={{ fontSize:'8px', color:FAINT, letterSpacing:'0.05em', mb:'2px' }}>UNIT</Typography>
            <Typography sx={{ fontSize:'10px', fontWeight:700, color:G }}>
              {incident.assigned_unit || '—'}
            </Typography>
          </Box>
          <Box sx={{ flex:1, p:'7px', borderRadius:'8px', background:SURF2, textAlign:'center' }}>
            <Typography sx={{ fontSize:'8px', color:FAINT, letterSpacing:'0.05em', mb:'2px' }}>STATUS</Typography>
            <Typography sx={{ fontSize:'10px', fontWeight:700, color:TEXT }}>
              {incident.status?.replace(/_/g,' ')}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Timeline */}
      <Box sx={{ flex:1, overflow:'auto', p:'14px 16px' }}>
        <Typography sx={{ fontSize:'9.5px', color:FAINT, letterSpacing:'0.06em', fontWeight:700, mb:'14px' }}>
          EVENT TIMELINE
        </Typography>
        {events.map((ev, i) => {
          const m    = meta[ev.status] || { label:ev.status, icon:'·', color:DIM, bg:'transparent' };
          const prev = events[i-1];
          const isLast = i === events.length - 1;
          return (
            <Box key={i} sx={{ display:'flex', gap:'12px', animation: ev._new ? 'fadeUp 0.35s ease' : 'none' }}>
              {/* Spine */}
              <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', width:24, flexShrink:0 }}>
                <Box sx={{
                  width:24, height:24, borderRadius:'50%', flexShrink:0,
                  background: isLast ? m.bg : 'rgba(142,182,155,0.08)',
                  border:`1.5px solid ${isLast ? m.color : 'rgba(142,182,155,0.18)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'10px', color: isLast ? m.color : FAINT,
                  transition:'all 0.3s',
                  animation: isLast ? 'stepPulse 2s ease infinite' : 'none',
                }}>
                  {m.icon}
                </Box>
                {!isLast && <Box sx={{ width:1.5, flex:1, background:'rgba(142,182,155,0.12)', my:'3px' }} />}
              </Box>

              {/* Content */}
              <Box sx={{ flex:1, pb: isLast ? 0 : '14px' }}>
                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:'3px' }}>
                  <Typography sx={{ fontSize:'12px', fontWeight:700, color: isLast ? TEXT : DIM }}>{m.label}</Typography>
                  {prev && <Typography sx={{ fontSize:'9px', color:FAINT, fontFamily:'"JetBrains Mono",monospace' }}>{fmtDelta(prev.ts, ev.ts)}</Typography>}
                </Box>
                <Typography sx={{ fontSize:'10.5px', color:FAINT, mb:'3px' }}>{ev.note}</Typography>
                <Box sx={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <Typography sx={{ fontSize:'9.5px', color:FAINT, fontFamily:'"JetBrains Mono",monospace' }}>{fmtTime(ev.ts)}</Typography>
                  <Box sx={{ width:3, height:3, borderRadius:'50%', background:FAINT }} />
                  <Typography sx={{ fontSize:'9.5px', color:FAINT }}>{ev.actor}</Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
