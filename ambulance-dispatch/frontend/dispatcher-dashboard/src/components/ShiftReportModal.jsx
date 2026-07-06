import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
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

const MOCK_REPORT = {
  shiftStart: '08:00',
  shiftEnd:   '20:00',
  date:       new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }),
  totalIncidents: 24,
  resolved:       19,
  active:          3,
  cancelled:       2,
  byType: [
    { type:'Cardiac Arrest', count:4, sev:'CRITICAL' },
    { type:'Road Accident',  count:7, sev:'HIGH' },
    { type:'Medical Emergency', count:8, sev:'MEDIUM' },
    { type:'Fall/Trauma',    count:5, sev:'LOW' },
  ],
  avgResponseMin: 7.4,
  avgTransportMin: 18.2,
  fleetUtilization: 78,
  sosCount: 6,
  ambulancesDeployed: 8,
};

const SEV_COLOR = { CRITICAL:RED, HIGH:AMBER, MEDIUM:G, LOW:G };

export default function ShiftReportModal({ open, onClose, stats, incidents, ambulances }) {
  const [exported, setExported] = useState(false);

  if (!open) return null;

  const report = {
    ...MOCK_REPORT,
    totalIncidents: incidents?.length || MOCK_REPORT.totalIncidents,
    active: incidents?.filter(i=>!['RESOLVED','CANCELLED'].includes(i.status)).length || MOCK_REPORT.active,
    resolved: incidents?.filter(i=>i.status==='RESOLVED').length || MOCK_REPORT.resolved,
    ambulancesDeployed: ambulances?.length || MOCK_REPORT.ambulancesDeployed,
  };

  const handleExport = () => {
    const text = [
      `AMBULANCE DISPATCH SHIFT REPORT`,
      `Date: ${report.date}`,
      `Shift: ${report.shiftStart} — ${report.shiftEnd}`,
      ``,
      `INCIDENT SUMMARY`,
      `  Total Incidents:   ${report.totalIncidents}`,
      `  Resolved:          ${report.resolved}`,
      `  Active:            ${report.active}`,
      `  Cancelled:         ${report.cancelled}`,
      `  SOS Alerts:        ${report.sosCount}`,
      ``,
      `PERFORMANCE METRICS`,
      `  Avg Response Time: ${report.avgResponseMin} min`,
      `  Avg Transport:     ${report.avgTransportMin} min`,
      `  Fleet Utilization: ${report.fleetUtilization}%`,
      `  Units Deployed:    ${report.ambulancesDeployed}`,
      ``,
      `INCIDENTS BY TYPE`,
      ...report.byType.map(b=>`  ${b.type}: ${b.count}`),
    ].join('\n');

    const blob = new Blob([text], { type:'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `shift-report-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(()=>setExported(false), 3000);
  };

  return (
    <Box sx={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', p:'20px',
    }}>
      <Box sx={{
        width:'100%', maxWidth:520, maxHeight:'85vh', overflow:'auto',
        background:SURF, borderRadius:'18px', border:`1px solid ${BRD2}`,
        boxShadow:'0 40px 100px rgba(0,0,0,0.55)',
        animation:'fadeUp 0.25s ease',
      }}>
        {/* Header */}
        <Box sx={{ p:'20px 22px 16px', borderBottom:`1px solid ${BRD}`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:SURF, zIndex:1 }}>
          <Box>
            <Typography sx={{ fontSize:'16px', fontWeight:800, color:TEXT }}>Shift Report</Typography>
            <Typography sx={{ fontSize:'10.5px', color:DIM, mt:'2px' }}>{report.date} · {report.shiftStart} – {report.shiftEnd}</Typography>
          </Box>
          <Box sx={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Button
              onClick={handleExport}
              sx={{ px:'14px', py:'7px', borderRadius:'9px', border:`1px solid ${BRD2}`, color: exported ? G : TEXT, fontSize:'12px', fontWeight:600, '&:hover':{ background:'rgba(142,182,155,0.08)' }, transition:'color 0.2s' }}
            >
              {exported ? '✓ Exported' : 'Export'}
            </Button>
            <Box onClick={onClose} sx={{ width:30, height:30, borderRadius:'8px', background:'rgba(142,182,155,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', '&:hover':{ background:'rgba(142,182,155,0.14)' } }}>
              <Close sx={{ fontSize:15, color:DIM }} />
            </Box>
          </Box>
        </Box>

        <Box sx={{ p:'18px 22px' }}>
          {/* Big metric cards */}
          <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', mb:'20px' }}>
            {[
              { label:'TOTAL INCIDENTS', value:report.totalIncidents, color:TEXT },
              { label:'RESOLVED',        value:report.resolved,       color:G },
              { label:'SOS ALERTS',      value:report.sosCount,       color:RED },
            ].map(m=>(
              <Box key={m.label} sx={{ p:'14px', borderRadius:'12px', background:SURF2, border:`1px solid ${BRD}`, textAlign:'center' }}>
                <Typography sx={{ fontSize:'8.5px', color:FAINT, letterSpacing:'0.06em', mb:'6px', fontWeight:600 }}>{m.label}</Typography>
                <Typography sx={{ fontSize:'24px', fontWeight:900, color:m.color }}>{m.value}</Typography>
              </Box>
            ))}
          </Box>

          {/* Performance row */}
          <Typography sx={{ fontSize:'10px', color:FAINT, letterSpacing:'0.06em', fontWeight:700, mb:'10px' }}>PERFORMANCE METRICS</Typography>
          <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', mb:'20px' }}>
            {[
              { label:'AVG RESPONSE',   value:`${report.avgResponseMin}m` },
              { label:'AVG TRANSPORT',  value:`${report.avgTransportMin}m` },
              { label:'FLEET UTIL.',    value:`${report.fleetUtilization}%` },
            ].map(m=>(
              <Box key={m.label} sx={{ p:'12px', borderRadius:'10px', background:'rgba(142,182,155,0.06)', border:`1px solid ${BRD}`, textAlign:'center' }}>
                <Typography sx={{ fontSize:'8px', color:FAINT, letterSpacing:'0.06em', mb:'5px' }}>{m.label}</Typography>
                <Typography sx={{ fontSize:'18px', fontWeight:800, color:TEXT }}>{m.value}</Typography>
              </Box>
            ))}
          </Box>

          {/* Incidents by type */}
          <Typography sx={{ fontSize:'10px', color:FAINT, letterSpacing:'0.06em', fontWeight:700, mb:'10px' }}>INCIDENTS BY TYPE</Typography>
          {report.byType.map(b=>(
            <Box key={b.type} sx={{ mb:'8px' }}>
              <Box sx={{ display:'flex', justifyContent:'space-between', mb:'4px' }}>
                <Typography sx={{ fontSize:'12px', color:TEXT }}>{b.type}</Typography>
                <Box sx={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <Box sx={{ width:6, height:6, borderRadius:'50%', background:SEV_COLOR[b.sev] }} />
                  <Typography sx={{ fontSize:'12px', fontWeight:700, color:TEXT }}>{b.count}</Typography>
                </Box>
              </Box>
              <Box sx={{ height:3, borderRadius:2, background:'rgba(142,182,155,0.10)' }}>
                <Box sx={{ height:'100%', borderRadius:2, background:SEV_COLOR[b.sev], width:`${(b.count/report.totalIncidents)*100}%`, transition:'width 0.5s ease' }} />
              </Box>
            </Box>
          ))}

          {/* Divider + footer */}
          <Box sx={{ mt:'16px', pt:'16px', borderTop:`1px solid ${BRD}`, display:'flex', justifyContent:'space-between' }}>
            <Typography sx={{ fontSize:'10.5px', color:FAINT }}>Units deployed: {report.ambulancesDeployed}</Typography>
            <Typography sx={{ fontSize:'10.5px', color:FAINT }}>Cancelled: {report.cancelled}</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
