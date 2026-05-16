import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Chip, Avatar,
  Tooltip, IconButton, Collapse
} from '@mui/material';
import {
  Speed, Battery90, SignalCellularAlt,
  Navigation, KeyboardArrowDown, KeyboardArrowUp,
  FiberManualRecord
} from '@mui/icons-material';

const STATUS_COLORS = {
  AVAILABLE: '#22c55e',
  EN_ROUTE: '#3b82f6',
  ON_SCENE: '#f97316',
  TRANSPORTING: '#8b5cf6',
  AT_HOSPITAL: '#06b6d4',
  OFF_DUTY: '#6b7280',
};

const STATUS_LABELS = {
  AVAILABLE: 'Available',
  EN_ROUTE: 'En Route',
  ON_SCENE: 'On Scene',
  TRANSPORTING: 'Transporting',
  AT_HOSPITAL: 'At Hospital',
  OFF_DUTY: 'Off Duty',
};

// Exported so DashboardPage can use them as initial map markers
export const DEMO_AMBULANCES = [
  {
    id: 'AMB-001', call_sign: 'Alpha-1', vehicle_number: 'KA-01-A-0001',
    type: 'ALS', status: 'EN_ROUTE', battery: 87, signal: 4,
    latitude: 12.9540, longitude: 77.6010, speed: 58,
    destination: 'Incident #SOS-001', driver: 'Rajesh Kumar',
    targetLat: 13.0100, targetLng: 77.6450, etaSeconds: 300,
  },
  {
    id: 'AMB-002', call_sign: 'Bravo-2', vehicle_number: 'KA-01-B-0002',
    type: 'BLS', status: 'AVAILABLE', battery: 100, signal: 5,
    latitude: 12.9716, longitude: 77.5946, speed: 0,
    destination: null, driver: 'Suresh Patel',
  },
  {
    id: 'AMB-003', call_sign: 'Charlie-3', vehicle_number: 'KA-01-C-0003',
    type: 'ALS', status: 'TRANSPORTING', battery: 62, signal: 3,
    latitude: 12.9900, longitude: 77.5650, speed: 42,
    destination: 'Manipal Hospital', driver: 'Priya Singh',
    targetLat: 12.9250, targetLng: 77.6100, etaSeconds: 420,
  },
  {
    id: 'AMB-004', call_sign: 'Delta-4', vehicle_number: 'KA-01-D-0004',
    type: 'BLS', status: 'ON_SCENE', battery: 45, signal: 4,
    latitude: 13.0050, longitude: 77.6200, speed: 0,
    destination: 'Incident #2', driver: 'Amit Sharma',
  },
  {
    id: 'AMB-005', call_sign: 'Echo-5', vehicle_number: 'KA-01-E-0005',
    type: 'ALS', status: 'AVAILABLE', battery: 95, signal: 5,
    latitude: 12.9380, longitude: 77.6140, speed: 0,
    destination: null, driver: 'Neha Verma',
  },
];

function etaLabel(sec) {
  if (sec == null) return null;
  if (sec <= 0) return 'Arrived';
  if (sec < 60) return `${sec}s`;
  return `${Math.ceil(sec / 60)} min`;
}

function AmbulanceCard({ amb, onSelect, selected, livePos }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[amb.status] || '#6b7280';
  const isMoving = ['EN_ROUTE', 'TRANSPORTING'].includes(amb.status);
  const lat = livePos?.lat ?? amb.latitude;
  const lng = livePos?.lng ?? amb.longitude;
  const etaDisplay = etaLabel(livePos?.etaSeconds) ?? amb.eta;

  return (
    <Paper
      onClick={() => onSelect(amb)}
      sx={{
        mb: 1.5, p: 2, cursor: 'pointer',
        bgcolor: selected ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
        border: selected ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 2,
        transition: 'all 0.2s',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateX(2px)' },
        position: 'relative', overflow: 'hidden',
      }}
    >
      {isMoving && (
        <Box sx={{
          position: 'absolute', right: 12, top: 12,
          width: 8, height: 8, borderRadius: '50%',
          bgcolor: statusColor,
          '&::after': {
            content: '""', position: 'absolute', inset: -4,
            borderRadius: '50%', border: `2px solid ${statusColor}`,
            animation: 'ripple 1.5s infinite',
          },
          '@keyframes ripple': {
            '0%': { opacity: 1, transform: 'scale(1)' },
            '100%': { opacity: 0, transform: 'scale(2.5)' },
          },
        }} />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{
          width: 40, height: 40, fontSize: 18,
          bgcolor: statusColor + '22', border: `2px solid ${statusColor}`,
        }}>
          🚑
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>
              {amb.call_sign}
            </Typography>
            <Chip
              label={STATUS_LABELS[amb.status] || amb.status}
              size="small"
              sx={{
                height: 18, fontSize: '0.65rem',
                bgcolor: statusColor + '33', color: statusColor,
                border: `1px solid ${statusColor}55`,
              }}
            />
            {amb.type === 'ALS' && (
              <Chip label="ALS" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(139,92,246,0.2)', color: '#a78bfa' }} />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {amb.driver} · {amb.vehicle_number}
          </Typography>
        </Box>

        <IconButton
          size="small"
          onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
          sx={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, alignItems: 'center' }}>
        <Tooltip title={`Speed: ${amb.speed} km/h`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Speed sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {isMoving ? `${amb.speed} km/h` : 'Stationary'}
            </Typography>
          </Box>
        </Tooltip>

        <Tooltip title={`Battery: ${amb.battery}%`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Battery90 sx={{ fontSize: 14, color: amb.battery > 50 ? '#22c55e' : amb.battery > 20 ? '#f97316' : '#ef4444' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {amb.battery}%
            </Typography>
          </Box>
        </Tooltip>

        {isMoving && etaDisplay && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, justifyContent: 'flex-end' }}>
            <Navigation sx={{ fontSize: 14, color: '#3b82f6' }} />
            <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>
              ETA: {etaDisplay}
            </Typography>
          </Box>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                GPS Coordinates
              </Typography>
              <Typography variant="caption" sx={{ color: 'white', fontFamily: 'monospace' }}>
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </Typography>
            </Box>
            {amb.destination && (
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                  Destination
                </Typography>
                <Typography variant="caption" sx={{ color: 'white' }}>
                  {amb.destination}
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            <SignalCellularAlt sx={{ fontSize: 14, color: '#22c55e' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Signal: {amb.signal}/5 — GPS Active
            </Typography>
            <FiberManualRecord sx={{ fontSize: 8, color: '#22c55e', ml: 0.5, animation: 'blink 2s infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function LiveTrackingPanel({ ambulances: externalAmbulances = [], onAmbulanceSelect, onFleetUpdate }) {
  const displayAmbs = externalAmbulances.length > 0 ? externalAmbulances : DEMO_AMBULANCES;
  const [selectedId, setSelectedId] = useState(null);

  // livePositions: { [ambId]: { lat, lng, etaSeconds } }
  const [livePositions, setLivePositions] = useState(() => {
    const init = {};
    DEMO_AMBULANCES.forEach(a => {
      init[a.id] = { lat: a.latitude, lng: a.longitude, etaSeconds: a.etaSeconds ?? 0 };
    });
    return init;
  });

  // Stable refs to avoid stale closures inside setInterval
  const displayAmbsRef = useRef(displayAmbs);
  const onFleetUpdateRef = useRef(onFleetUpdate);
  useEffect(() => { displayAmbsRef.current = displayAmbs; }, [displayAmbs]);
  useEffect(() => { onFleetUpdateRef.current = onFleetUpdate; }, [onFleetUpdate]);

  // Initialize positions for externally-provided ambulances
  useEffect(() => {
    setLivePositions(prev => {
      let changed = false;
      const next = { ...prev };
      displayAmbs.forEach(a => {
        if (a.latitude && a.longitude && !next[a.id]) {
          next[a.id] = { lat: a.latitude, lng: a.longitude, etaSeconds: a.etaSeconds ?? 0 };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [displayAmbs]);

  // Emit initial fleet positions on mount so map shows markers immediately
  useEffect(() => {
    onFleetUpdateRef.current?.(displayAmbsRef.current.map(a => ({ ...a })));
  }, []);

  // Directional GPS movement: move each EN_ROUTE/TRANSPORTING unit toward its target
  useEffect(() => {
    const interval = setInterval(() => {
      setLivePositions(prev => {
        const next = { ...prev };
        const ambs = displayAmbsRef.current;

        ambs.forEach(amb => {
          if (!['EN_ROUTE', 'TRANSPORTING'].includes(amb.status)) return;
          const cur = prev[amb.id] || { lat: amb.latitude, lng: amb.longitude, etaSeconds: amb.etaSeconds ?? 0 };
          const targetLat = amb.targetLat ?? amb.latitude;
          const targetLng = amb.targetLng ?? amb.longitude;
          const dlat = targetLat - cur.lat;
          const dlng = targetLng - cur.lng;
          const dist = Math.sqrt(dlat * dlat + dlng * dlng);

          if (dist < 0.0001) {
            next[amb.id] = { lat: targetLat, lng: targetLng, etaSeconds: 0 };
          } else {
            // Move a fixed step (~67m per 2s tick, simulating ~120km/h) toward target
            const step = 0.0006;
            const frac = Math.min(step / dist, 1);
            next[amb.id] = {
              lat: cur.lat + dlat * frac,
              lng: cur.lng + dlng * frac,
              etaSeconds: Math.max(0, (cur.etaSeconds ?? 0) - 2),
            };
          }
        });

        // Push merged fleet to dashboard so map markers update in sync
        const ambulancesWithLive = ambs.map(a => {
          const p = next[a.id];
          return p ? { ...a, latitude: p.lat, longitude: p.lng } : a;
        });
        onFleetUpdateRef.current?.(ambulancesWithLive);

        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSelect = useCallback((amb) => {
    setSelectedId(amb.id);
    const live = livePositions[amb.id];
    onAmbulanceSelect?.(live ? { ...amb, latitude: live.lat, longitude: live.lng } : amb);
  }, [livePositions, onAmbulanceSelect]);

  const available = displayAmbs.filter(a => a.status === 'AVAILABLE').length;
  const active = displayAmbs.filter(a => !['AVAILABLE', 'OFF_DUTY'].includes(a.status)).length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{
        p: 2, pb: 1.5,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1))',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700 }}>
            🛰️ Live Fleet Tracking
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FiberManualRecord sx={{ fontSize: 8, color: '#22c55e', animation: 'blink 2s infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
            <Typography variant="caption" sx={{ color: '#22c55e', fontSize: '0.7rem' }}>LIVE</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {[
            { label: 'Total', value: displayAmbs.length, color: 'rgba(255,255,255,0.7)' },
            { label: 'Available', value: available, color: '#22c55e' },
            { label: 'Active', value: active, color: '#3b82f6' },
          ].map(item => (
            <Box key={item.label} sx={{
              flex: 1, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1.5,
              p: 1, textAlign: 'center',
            }}>
              <Typography variant="h6" sx={{ color: item.color, lineHeight: 1, fontWeight: 800 }}>
                {item.value}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {displayAmbs.map(amb => (
          <AmbulanceCard
            key={amb.id}
            amb={amb}
            livePos={livePositions[amb.id]}
            onSelect={handleSelect}
            selected={selectedId === amb.id}
          />
        ))}
      </Box>
    </Box>
  );
}
