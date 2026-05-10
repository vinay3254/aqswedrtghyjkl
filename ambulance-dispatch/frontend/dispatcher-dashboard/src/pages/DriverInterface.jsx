import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Chip, Avatar, Divider,
  IconButton, Slide, Fade, LinearProgress, Snackbar, Alert
} from '@mui/material';
import {
  Warning, CheckCircle, Cancel, Navigation, Phone,
  FiberManualRecord, ArrowBack
} from '@mui/icons-material';
import { dispatchBroadcast, DISPATCH_EVENTS } from '../services/dispatchBroadcast';

/* ── Mock data ─────────────────────────────────────── */
const MOCK_DRIVER = {
  id: 'DRV-001',
  name: 'Rajesh Kumar',
  callSign: 'Alpha-1',
  vehicle: 'MH-01-A-0001',
  type: 'ALS',
  latitude: 19.082,
  longitude: 72.8777,
};

const SEV_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' };

const PENDING_INCIDENTS = [
  {
    id: 'SOS-101', incident_type: 'Cardiac Arrest', severity: 'CRITICAL',
    location_address: 'Bandra West, Mumbai', location_lat: 19.0596, location_lng: 72.8295,
    caller_name: 'Rahul Shah', caller_phone: '+91 98765 43210',
    description: 'Patient unconscious, not breathing', distance: '3.2 km', eta: '6 min',
    patients_count: 1, created_at: new Date(Date.now() - 120000).toISOString(), is_sos: true,
  },
  {
    id: 'SOS-102', incident_type: 'Road Accident', severity: 'HIGH',
    location_address: 'Western Express Hwy, Andheri', location_lat: 19.1136, location_lng: 72.8697,
    caller_name: 'Police Control', caller_phone: '+91 100',
    description: 'Multi-vehicle accident, 3 injured', distance: '5.8 km', eta: '11 min',
    patients_count: 3, created_at: new Date(Date.now() - 60000).toISOString(), is_sos: false,
  },
];

/* ── Incoming Alert Banner ─────────────────────────── */
function IncomingAlert({ incident, onAccept, onReject }) {
  const [countdown, setCountdown] = useState(30);
  const color = SEV_COLOR[incident.severity] || '#f97316';

  useEffect(() => {
    if (countdown <= 0) { onReject(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <Slide in direction="down">
      <Paper sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: `linear-gradient(135deg, ${color}22, #0f0c29)`,
        border: `2px solid ${color}`,
        borderTop: 'none', borderRadius: '0 0 16px 16px',
        p: 2, boxShadow: `0 8px 32px ${color}44`,
        animation: 'alertPulse 1s infinite alternate',
        '@keyframes alertPulse': {
          '0%': { boxShadow: `0 8px 32px ${color}44` },
          '100%': { boxShadow: `0 8px 48px ${color}88` },
        }
      }}>
        <LinearProgress
          variant="determinate"
          value={(countdown / 30) * 100}
          sx={{ mb: 1.5, height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: color } }}
        />
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: '50%',
            bgcolor: color + '33', border: `2px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Warning sx={{ color, fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 800 }}>
                🚨 INCOMING DISPATCH
              </Typography>
              <Chip label={incident.severity} size="small"
                sx={{ bgcolor: color, color: 'white', fontWeight: 700, height: 20, fontSize: '0.65rem' }} />
              <Typography variant="caption" sx={{ color, ml: 'auto', fontWeight: 700 }}>
                {countdown}s
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
              {incident.incident_type}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              📍 {incident.location_address} · {incident.distance} · ETA {incident.eta}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
          <Button
            fullWidth variant="contained" startIcon={<Cancel />}
            onClick={onReject}
            sx={{ bgcolor: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444',
              '&:hover': { bgcolor: 'rgba(239,68,68,0.35)' } }}
          >
            Decline
          </Button>
          <Button
            fullWidth variant="contained" startIcon={<CheckCircle />}
            onClick={onAccept}
            sx={{ background: 'linear-gradient(90deg, #16a34a, #15803d)', color: 'white', fontWeight: 700,
              '&:hover': { background: 'linear-gradient(90deg, #15803d, #166534)' } }}
          >
            Accept & Dispatch
          </Button>
        </Box>
      </Paper>
    </Slide>
  );
}

/* ── Active Mission Card ───────────────────────────── */
function ActiveMission({ incident, status, onStatusUpdate }) {
  const color = SEV_COLOR[incident.severity] || '#f97316';
  const STATUS_FLOW = ['EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'COMPLETE'];
  const currentIdx = STATUS_FLOW.indexOf(status);

  const STATUS_ACTIONS = {
    EN_ROUTE: { label: 'Arrived On Scene', next: 'ON_SCENE', color: '#f97316' },
    ON_SCENE: { label: 'Start Transport', next: 'TRANSPORTING', color: '#8b5cf6' },
    TRANSPORTING: { label: 'Arrived at Hospital', next: 'AT_HOSPITAL', color: '#06b6d4' },
    AT_HOSPITAL: { label: 'Mission Complete', next: 'COMPLETE', color: '#22c55e' },
  };

  const nextAction = STATUS_ACTIONS[status];

  return (
    <Box sx={{ p: 2 }}>
      {/* Mission header */}
      <Paper sx={{
        p: 2, mb: 2, borderRadius: 2,
        background: `linear-gradient(135deg, ${color}18, rgba(0,0,0,0.4))`,
        border: `1px solid ${color}44`,
      }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1 }}>
          <Box sx={{ fontSize: 32 }}>🚨</Box>
          <Box>
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 800 }}>
              {incident.incident_type}
            </Typography>
            <Chip label={incident.severity} size="small"
              sx={{ bgcolor: color, color: 'white', height: 18, fontSize: '0.65rem' }} />
          </Box>
          <Chip label={status.replace('_', ' ')} size="small" sx={{ ml: 'auto',
            bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }} />
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {[
            { icon: '📍', label: 'Location', value: incident.location_address },
            { icon: '👤', label: 'Caller', value: incident.caller_name || 'Unknown' },
            { icon: '📞', label: 'Phone', value: incident.caller_phone },
            { icon: '🏥', label: 'Patients', value: `${incident.patients_count} person(s)` },
          ].map(item => (
            <Box key={item.label}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                {item.icon} {item.label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                {item.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {incident.description && (
          <Box sx={{ mt: 1.5, p: 1, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              {incident.description}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Progress tracker */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1.5, display: 'block' }}>
          Mission Progress
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {STATUS_FLOW.slice(0, -1).map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const labels = { EN_ROUTE: 'En Route', ON_SCENE: 'On Scene', TRANSPORTING: 'Transport', AT_HOSPITAL: 'Hospital' };
            return (
              <React.Fragment key={s}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '50%',
                    bgcolor: done ? '#22c55e' : active ? color : 'rgba(255,255,255,0.1)',
                    border: `2px solid ${done ? '#22c55e' : active ? color : 'rgba(255,255,255,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, transition: 'all 0.3s',
                    animation: active ? 'stepPulse 2s infinite' : 'none',
                    '@keyframes stepPulse': {
                      '0%,100%': { boxShadow: `0 0 0 0 ${color}66` },
                      '50%': { boxShadow: `0 0 0 6px ${color}00` },
                    }
                  }}>
                    {done ? '✓' : i + 1}
                  </Box>
                  <Typography variant="caption" sx={{
                    color: done || active ? 'white' : 'rgba(255,255,255,0.3)',
                    fontSize: '0.55rem', mt: 0.5, textAlign: 'center'
                  }}>
                    {labels[s]}
                  </Typography>
                </Box>
                {i < STATUS_FLOW.length - 2 && (
                  <Box sx={{ height: 2, flex: 0.5, bgcolor: done ? '#22c55e' : 'rgba(255,255,255,0.1)', mt: -2 }} />
                )}
              </React.Fragment>
            );
          })}
        </Box>
      </Paper>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1.5, flexDirection: 'column' }}>
        {nextAction && status !== 'COMPLETE' && (
          <Button
            fullWidth variant="contained" size="large"
            onClick={() => onStatusUpdate(nextAction.next)}
            sx={{
              background: `linear-gradient(90deg, ${nextAction.color}, ${nextAction.color}cc)`,
              color: 'white', fontWeight: 700, py: 1.5, borderRadius: 2,
              fontSize: '1rem', letterSpacing: 0.5,
            }}
          >
            ✅ {nextAction.label}
          </Button>
        )}
        {status === 'COMPLETE' && (
          <Box sx={{
            textAlign: 'center', p: 3,
            bgcolor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e',
            borderRadius: 2,
          }}>
            <Typography sx={{ fontSize: 40 }}>🎉</Typography>
            <Typography variant="h6" sx={{ color: '#22c55e', fontWeight: 700 }}>
              Mission Complete
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Patient successfully transported
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            fullWidth variant="outlined" startIcon={<Phone />}
            href={`tel:${incident.caller_phone}`}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white', '&:hover': { borderColor: '#3b82f6' } }}
          >
            Call Dispatch
          </Button>
          <Button
            fullWidth variant="outlined" startIcon={<Navigation />}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white', '&:hover': { borderColor: '#22c55e' } }}
          >
            Navigate
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

/* ── Main Driver Interface ─────────────────────────── */
export default function DriverInterface({ onBack }) {
  const [alertIncident, setAlertIncident] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  const [missionStatus, setMissionStatus] = useState('EN_ROUTE');
  const [speed, setSpeed] = useState(0);
  const [time, setTime] = useState(new Date());
  const [incidentQueue, setIncidentQueue] = useState(PENDING_INCIDENTS);
  const [toast, setToast] = useState(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Listen for real dispatches from the dispatcher tab ──
  useEffect(() => {
    const handleSOS = (incident) => {
      // Enrich with distance/ETA fields for display
      const enriched = {
        ...incident,
        distance: `${(Math.random() * 5 + 1).toFixed(1)} km`,
        eta: `${Math.floor(Math.random() * 8 + 3)} min`,
        patients_count: incident.patients_count || 1,
      };
      setIncidentQueue(q => {
        // avoid duplicates
        if (q.find(i => i.id === enriched.id)) return q;
        return [enriched, ...q];
      });
      // Show incoming alert banner immediately
      setAlertIncident(enriched);
      setToast({ msg: `🚨 New SOS: ${incident.incident_type}`, sev: 'error' });
    };

    const handleAssigned = (assignment) => {
      if (assignment?._isAssignment && assignment?.incident_type) {
        const incidentData = {
          id: assignment.id || `ASN-${Date.now()}`,
          incident_type: assignment.incident_type,
          severity: assignment.severity || 'HIGH',
          location_address: assignment.location_address || 'Location pending',
          caller_name: assignment.caller_name || 'Dispatch Center',
          caller_phone: assignment.caller_phone || '+91 100',
          patients_count: assignment.patients_count || 1,
          description: assignment.description || `Dispatched to ${assignment.hospital_name || 'hospital'}`,
          is_sos: assignment.is_sos || false,
          distance: assignment.distance || '? km',
          eta: assignment.eta || '? min',
          _isAssignment: true,
        };
        setIncidentQueue(q => q.find(i => i.id === incidentData.id) ? q : [incidentData, ...q]);
        setAlertIncident(incidentData);
        setToast({ msg: `🚑 Dispatch: ${incidentData.incident_type} → ${assignment.hospital_name || 'hospital'}`, sev: 'success' });
      } else {
        setToast({ msg: `✅ Assignment: ${assignment?.ambulance?.call_sign || 'Unit'} dispatched`, sev: 'success' });
      }
    };

    dispatchBroadcast.on(DISPATCH_EVENTS.SOS_CREATED, handleSOS);
    dispatchBroadcast.on(DISPATCH_EVENTS.INCIDENT_ASSIGNED, handleAssigned);
    return () => {
      dispatchBroadcast.off(DISPATCH_EVENTS.SOS_CREATED, handleSOS);
      dispatchBroadcast.off(DISPATCH_EVENTS.INCIDENT_ASSIGNED, handleAssigned);
    };
  }, []);

  // Simulate speed when on mission
  useEffect(() => {
    if (!activeIncident) { setSpeed(0); return; }
    const t = setInterval(() => {
      setSpeed(['EN_ROUTE', 'TRANSPORTING'].includes(missionStatus)
        ? 40 + Math.floor(Math.random() * 40) : 0);
    }, 2000);
    return () => clearInterval(t);
  }, [activeIncident, missionStatus]);

  const handleAccept = () => {
    setActiveIncident(alertIncident);
    setMissionStatus('EN_ROUTE');
    setIncidentQueue(q => q.filter(i => i.id !== alertIncident.id));
    setAlertIncident(null);
  };

  const handleReject = () => setAlertIncident(null);
  const handleStatusUpdate = (s) => setMissionStatus(s);

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d0d1a 0%, #0f1629 60%, #0d1117 100%)',
      display: 'flex', flexDirection: 'column',
      maxWidth: 480, mx: 'auto', position: 'relative',
    }}>
      {/* Incoming Alert overlay */}
      {alertIncident && (
        <IncomingAlert
          incident={alertIncident}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      {/* Top Bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, p: 2, pb: 1,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.6), transparent)',
        pt: alertIncident ? 14 : 2,
        transition: 'padding-top 0.3s',
      }}>
        {onBack && (
          <IconButton onClick={onBack} sx={{ color: 'white' }}>
            <ArrowBack />
          </IconButton>
        )}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 800, lineHeight: 1 }}>
            Driver Console
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {MOCK_DRIVER.callSign} · {MOCK_DRIVER.vehicle}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" sx={{ color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>
            {time.toLocaleTimeString()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
            <FiberManualRecord sx={{
              fontSize: 8, color: '#22c55e',
              animation: 'blink 2s infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } }
            }} />
            <Typography variant="caption" sx={{ color: '#22c55e', fontSize: '0.65rem' }}>CONNECTED</Typography>
          </Box>
        </Box>
      </Box>

      {/* Driver status card */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Paper sx={{
          p: 1.5, borderRadius: 2,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: '#dc2626', width: 40, height: 40, fontSize: 20 }}>🚑</Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }}>{MOCK_DRIVER.name}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                {MOCK_DRIVER.type} Unit · {MOCK_DRIVER.callSign}
              </Typography>
            </Box>
            <Chip
              label={activeIncident ? 'ON DUTY' : 'STANDBY'}
              size="small"
              sx={{
                bgcolor: activeIncident ? '#dc262633' : '#22c55e33',
                color: activeIncident ? '#ef4444' : '#22c55e',
                border: `1px solid ${activeIncident ? '#ef4444' : '#22c55e'}`,
                fontWeight: 700, fontSize: '0.65rem'
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { label: 'Speed', value: `${speed} km/h`, icon: '⚡' },
              { label: 'Status', value: activeIncident ? missionStatus.replace(/_/g, ' ') : 'Standby', icon: '📡' },
              { label: 'Queue', value: incidentQueue.length, icon: '📋' },
            ].map(item => (
              <Box key={item.label} sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontSize: '0.6rem' }}>
                  {item.icon} {item.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'white', fontWeight: 700 }}>{item.value}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {activeIncident ? (
          <ActiveMission
            incident={activeIncident}
            status={missionStatus}
            onStatusUpdate={handleStatusUpdate}
          />
        ) : (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                📋 Pending Incidents
              </Typography>
              <Chip label={incidentQueue.length} size="small"
                sx={{ bgcolor: 'rgba(220,38,38,0.2)', color: '#ef4444', height: 18, fontSize: '0.65rem' }} />
            </Box>

            {incidentQueue.map(inc => {
              const color = SEV_COLOR[inc.severity] || '#f97316';
              return (
                <Paper key={inc.id} onClick={() => setAlertIncident(inc)} sx={{
                  mb: 1.5, p: 2, cursor: 'pointer', borderRadius: 2,
                  background: `linear-gradient(135deg, ${color}12, rgba(0,0,0,0.3))`,
                  border: `1px solid ${color}44`,
                  '&:hover': { border: `1px solid ${color}88`, transform: 'translateX(2px)' },
                  transition: 'all 0.2s',
                }}>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <Box sx={{ fontSize: 28 }}>
                      {inc.severity === 'CRITICAL' ? '🔴' : inc.severity === 'HIGH' ? '🟠' : '🟡'}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>
                          {inc.incident_type}
                        </Typography>
                        {inc.is_sos && (
                          <Chip label="SOS" size="small"
                            sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#dc2626', color: 'white' }} />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                        📍 {inc.location_address}
                      </Typography>
                      <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
                        {inc.distance} away · ETA {inc.eta}
                      </Typography>
                    </Box>
                    <Chip label={inc.severity} size="small"
                      sx={{ bgcolor: color + '33', color, border: `1px solid ${color}55`, fontSize: '0.65rem', height: 20 }} />
                  </Box>
                </Paper>
              );
            })}

            {incidentQueue.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography sx={{ fontSize: 48, mb: 2 }}>✅</Typography>
                <Typography variant="h6" sx={{ color: 'white' }}>All Clear</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  No pending incidents. Waiting for dispatch…
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', mt: 1, display: 'block' }}>
                  Keep this tab open — alerts appear automatically
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Toast notification */}
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: alertIncident ? 180 : 16 }}
      >
        <Alert severity={toast?.sev || 'info'} onClose={() => setToast(null)}
          sx={{ bgcolor: '#1e1e2e', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}


