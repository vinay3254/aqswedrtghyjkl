import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, IconButton, LinearProgress, Chip
} from '@mui/material';
import {
  Traffic, LocalHospital, Warning, CheckCircle,
  Close, Navigation, FlashOn, Speed, NotificationsActive
} from '@mui/icons-material';

const G = '#2563EB';
const RED = '#EF4444';
const GREEN = '#10B981';
const TEXT = '#0F172A';
const DIM = '#475569';
const BRD = '#E2E8F0';

export default function GreenCorridorModal({ open, onClose, assignment }) {
  const [activeStep, setActiveStep] = useState(0);
  const [signals, setSignals] = useState([
    { id: 1, name: 'MG Road x Brigade Rd Junction', distance: '450m', status: 'PREEMPTED', timer: 45, state: 'GREEN' },
    { id: 2, name: 'Trinity Circle Intersection', distance: '1.2 km', status: 'PREEMPTED', timer: 38, state: 'GREEN' },
    { id: 3, name: 'Old Airport Rd - Domlur Flyover', distance: '2.4 km', status: 'QUEUED', timer: 20, state: 'YELLOW' },
    { id: 4, name: 'Indiranagar 100ft Rd Crossing', distance: '3.8 km', status: 'QUEUED', timer: 10, state: 'RED' },
    { id: 5, name: 'Manipal Hospital Access Gate', distance: '4.5 km', status: 'STANDBY', timer: 0, state: 'RED' },
  ]);
  const [hospitalAlertSent, setHospitalAlertSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setSignals(prev => prev.map((s, idx) => {
        if (s.state === 'YELLOW') return { ...s, state: 'GREEN', status: 'PREEMPTED' };
        if (s.state === 'RED' && idx === 3) return { ...s, state: 'YELLOW', status: 'SWITCHING' };
        return s;
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, [open]);

  const handleSendPreArrival = () => {
    setHospitalAlertSent(true);
  };

  const amb = assignment?.ambulance || { call_sign: 'Alpha-1', vehicle_number: 'KA-01-EA-1081', type: 'ALS' };
  const hosp = assignment?.hospital || { name: 'Manipal Hospital - Old Airport Road', available_beds: 4, icu_beds_available: 2 };
  const inc = assignment?.incident || { incident_type: 'Cardiac Arrest', severity: 'CRITICAL', location_address: 'Koramangala 5th Block' };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Traffic sx={{ color: RED, fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: TEXT }}>
              Green Corridor & Traffic Signal Preemption
            </Typography>
            <Typography sx={{ fontSize: 12, color: DIM }}>
              Live automated signal override for Priority 1 Critical Emergency
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small"><Close sx={{ fontSize: 18 }} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: BRD }}>
        {/* Status Banner */}
        <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: GREEN, animation: 'pulse 1.5s infinite' }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: GREEN }}>
                ACTIVE GREEN CORRIDOR IN PROGRESS
              </Typography>
              <Typography sx={{ fontSize: 11, color: DIM }}>
                5 Traffic Nodes Preempted · Average ETA reduced by 42% (Estimated Time Saved: ~7.5 mins)
              </Typography>
            </Box>
          </Box>
          <Chip label="TRAFFIC CLEARED" size="small" sx={{ bgcolor: GREEN, color: '#fff', fontWeight: 700, fontSize: 10 }} />
        </Box>

        {/* Units & Destination Info */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          <Box sx={{ p: 1.5, borderRadius: '10px', border: `1px solid ${BRD}`, bgcolor: '#F8FAFC' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Dispatched Unit</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: TEXT, mt: 0.5 }}>{amb.call_sign} ({amb.type})</Typography>
            <Typography sx={{ fontSize: 11, color: DIM }}>{amb.vehicle_number}</Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: '10px', border: `1px solid ${BRD}`, bgcolor: '#F8FAFC' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Patient Condition</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: RED, mt: 0.5 }}>{inc.incident_type}</Typography>
            <Typography sx={{ fontSize: 11, color: DIM }}>Severity: {inc.severity}</Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: '10px', border: `1px solid ${BRD}`, bgcolor: '#F8FAFC' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Receiving ER</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: G, mt: 0.5 }}>{hosp.name}</Typography>
            <Typography sx={{ fontSize: 11, color: DIM }}>ICU Beds: {hosp.icu_beds_available || 2} Avail</Typography>
          </Box>
        </Box>

        {/* Signal Preemption Sequence */}
        <Typography sx={{ fontWeight: 700, fontSize: 13, color: TEXT, mb: 1.5 }}>
          Upcoming Intersections & Traffic Light Sequence
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {signals.map((sig, idx) => (
            <Box key={sig.id} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              p: 1.5, borderRadius: '10px', border: `1px solid ${BRD}`,
              bgcolor: sig.state === 'GREEN' ? 'rgba(16, 185, 129, 0.04)' : '#FFFFFF'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 24, height: 24, borderRadius: '50%',
                  bgcolor: sig.state === 'GREEN' ? GREEN : sig.state === 'YELLOW' ? '#F59E0B' : RED,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800
                }}>
                  {idx + 1}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: TEXT }}>{sig.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: DIM }}>Distance ahead: {sig.distance}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: sig.state === 'GREEN' ? GREEN : sig.state === 'YELLOW' ? '#F59E0B' : RED }}>
                  {sig.status} ({sig.state})
                </Typography>
                <Chip
                  label={sig.state === 'GREEN' ? `GREEN HOLD (${sig.timer}s)` : sig.state === 'YELLOW' ? 'TRANSITIONING' : 'QUEUED'}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: 10,
                    bgcolor: sig.state === 'GREEN' ? 'rgba(16,185,129,0.12)' : sig.state === 'YELLOW' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                    color: sig.state === 'GREEN' ? GREEN : sig.state === 'YELLOW' ? '#D97706' : RED
                  }}
                />
              </Box>
            </Box>
          ))}
        </Box>

        {/* Hospital Pre-Arrival Alert Handoff */}
        <Box sx={{ p: 2, borderRadius: '12px', border: `1px solid ${BRD}`, bgcolor: '#F8FAFC' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsActive sx={{ color: G, fontSize: 18 }} />
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: TEXT }}>
                Hospital ER Pre-Arrival Notification (Handoff)
              </Typography>
            </Box>
            {hospitalAlertSent ? (
              <Chip label="ER ALERT CONFIRMED" color="success" size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
            ) : (
              <Button
                variant="contained" size="small" onClick={handleSendPreArrival}
                startIcon={<FlashOn sx={{ fontSize: 14 }} />}
                sx={{ bgcolor: G, color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
              >
                Transmit Pre-Arrival Alert
              </Button>
            )}
          </Box>
          <Typography sx={{ fontSize: 11.5, color: DIM, lineHeight: 1.5 }}>
            Sends telemetry, estimated countdown ETA (6 mins), requested Trauma/Cath Lab activation, and initial vitals summary directly to {hosp.name} emergency response dashboard.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: DIM, fontWeight: 600 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
