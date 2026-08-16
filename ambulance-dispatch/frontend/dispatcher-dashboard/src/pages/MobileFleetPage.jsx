import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button,
  LinearProgress, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Alert, IconButton
} from '@mui/material';
import {
  PhoneAndroid, BatteryChargingFull, SignalCellularAlt, Speed,
  LocalGasStation, CheckCircle, Warning, Refresh, Person,
  DirectionsCar, Sync, CloudDone, ErrorOutline
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';

const G = '#2563EB';
const RED = '#EF4444';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const TEXT = '#0F172A';
const DIM = '#475569';
const BRD = '#E2E8F0';

export default function MobileFleetPage() {
  const navigate = useNavigate();
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  const FLEET_UNITS = [
    {
      id: 'Alpha-1',
      vehicle: 'KA-01-EA-1081',
      type: 'ALS (Advanced Life Support)',
      driver: 'Rajesh Kumar',
      paramedic: 'Dr. Priya Sharma',
      status: 'EN_ROUTE',
      speed: 48,
      battery: 84,
      fuel: 72,
      gpsQuality: 'EXCELLENT (14 Sats)',
      device: 'Samsung Galaxy Tab Active4 Pro',
      appVersion: 'v3.8.4 (Latest)',
      lastPing: '2s ago',
      alert: null
    },
    {
      id: 'Alpha-2',
      vehicle: 'KA-01-EA-1082',
      type: 'ALS (Advanced Life Support)',
      driver: 'Suresh Patil',
      paramedic: 'Vikas Gowda',
      status: 'AVAILABLE',
      speed: 0,
      battery: 95,
      fuel: 88,
      gpsQuality: 'EXCELLENT (16 Sats)',
      device: 'Samsung Galaxy Tab Active4 Pro',
      appVersion: 'v3.8.4 (Latest)',
      lastPing: '1s ago',
      alert: null
    },
    {
      id: 'Bravo-1',
      vehicle: 'KA-01-EA-2041',
      type: 'BLS (Basic Life Support)',
      driver: 'Mohammed Arif',
      paramedic: 'Ananya Rao',
      status: 'ON_SCENE',
      speed: 0,
      battery: 18,
      fuel: 65,
      gpsQuality: 'GOOD (11 Sats)',
      device: 'iPad Mini 6 Cellular',
      appVersion: 'v3.8.4 (Latest)',
      lastPing: '3s ago',
      alert: 'LOW TABLET BATTERY (18%) — Connect Vehicle DC Inverter'
    },
    {
      id: 'Bravo-2',
      vehicle: 'KA-01-EA-2042',
      type: 'BLS (Basic Life Support)',
      driver: 'Kiran Reddy',
      paramedic: 'Deepak Nair',
      status: 'AVAILABLE',
      speed: 0,
      battery: 91,
      fuel: 54,
      gpsQuality: 'FAIR (8 Sats - Underpass)',
      device: 'Samsung Galaxy Tab Active3',
      appVersion: 'v3.8.3 (Update Avail)',
      lastPing: '5s ago',
      alert: 'WEAK GPS SIGNAL DENSITY'
    },
    {
      id: 'Delta-1',
      vehicle: 'KA-01-EA-3091',
      type: 'ICU Critical Care Mobile',
      driver: 'Manjunath B',
      paramedic: 'Dr. Sandeep Mehta',
      status: 'TRANSPORTING',
      speed: 56,
      battery: 79,
      fuel: 80,
      gpsQuality: 'EXCELLENT (15 Sats)',
      device: 'Panasonic Toughbook A3',
      appVersion: 'v3.8.4 (Latest)',
      lastPing: '1s ago',
      alert: null
    }
  ];

  return (
    <Box sx={{ bgcolor: '#F8FAFC', minHeight: '100vh', color: TEXT }}>
      <TopNav />
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneAndroid sx={{ color: G, fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: TEXT }}>
              Mobile Fleet Telemetry & Device Diagnostics
            </Typography>
          </Box>
          <Typography sx={{ color: DIM, fontSize: 13, mt: 0.5 }}>
            Live vehicle vitals, mobile MDT battery status, GPS constellation signal, and paramedic crew telemetry.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<Refresh />} variant="outlined" size="small" onClick={() => setLastRefreshed(Date.now())}
            sx={{ borderColor: BRD, color: TEXT, fontWeight: 700, textTransform: 'none', borderRadius: '10px' }}
          >
            Refreshed Just Now
          </Button>
          <Button
            variant="outlined" onClick={() => navigate('/')}
            sx={{ borderColor: BRD, color: TEXT, fontWeight: 700, textTransform: 'none', borderRadius: '10px' }}
          >
            ← Back to Live Command
          </Button>
        </Box>
      </Box>

      {/* Fleet Telemetry Status Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Active MDT Devices</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: G }}>5 / 5 Online</Typography>
                <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>100% Heartbeat</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: DIM, mt: 0.5 }}>Zero socket latency</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Average Fleet Battery</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: GREEN }}>73.4%</Typography>
                <Typography sx={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>1 Low Warning</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: DIM, mt: 0.5 }}>DC Vehicle charging enabled</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Average Fleet Fuel / Range</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: TEXT }}>69.8%</Typography>
                <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>&gt; 240 km Range</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: DIM, mt: 0.5 }}>All units dispatch ready</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Telemetry Ping Rate</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: TEXT }}>1.2s Interval</Typography>
                <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>High Accuracy</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: DIM, mt: 0.5 }}>GPS + GLONASS sync</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Telemetry Diagnostics Table */}
      <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15, color: TEXT, mb: 0.5 }}>Live Ambulance Telemetry & Device Health</Typography>
          <Typography sx={{ fontSize: 12, color: DIM, mb: 2.5 }}>Continuous hardware heartbeat, battery monitoring, and driver crew status</Typography>

          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>UNIT & CAPABILITY</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>ASSIGNED CREW</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>STATUS & SPEED</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>MDT BATTERY & FUEL</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>GPS SIGNAL</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>DIAGNOSTICS & ALERTS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {FLEET_UNITS.map((unit) => (
                  <TableRow key={unit.id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 800, fontSize: 13, color: TEXT }}>{unit.id}</Typography>
                      <Typography sx={{ fontSize: 11, color: DIM }}>{unit.vehicle}</Typography>
                      <Chip label={unit.type.split(' ')[0]} size="small" sx={{ fontSize: 9, height: 18, bgcolor: 'rgba(37,99,235,0.1)', color: G, fontWeight: 700, mt: 0.5 }} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: TEXT }}>Driver: {unit.driver}</Typography>
                      <Typography sx={{ fontSize: 11, color: DIM }}>Medic: {unit.paramedic}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={unit.status}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: 10,
                          bgcolor: unit.status === 'AVAILABLE' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: unit.status === 'AVAILABLE' ? GREEN : RED
                        }}
                      />
                      <Typography sx={{ fontSize: 11, color: TEXT, fontWeight: 600, mt: 0.5 }}>
                        Speed: {unit.speed} km/h
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ minWidth: 120 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, mb: 0.2 }}>
                          <span style={{ color: unit.battery < 20 ? RED : TEXT, fontWeight: 700 }}>⚡ {unit.battery}%</span>
                          <span style={{ color: DIM }}>⛽ {unit.fuel}%</span>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={unit.battery}
                          sx={{
                            height: 5, borderRadius: 2.5, bgcolor: '#E2E8F0',
                            '& .MuiLinearProgress-bar': { bgcolor: unit.battery < 20 ? RED : GREEN }
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: TEXT }}>{unit.gpsQuality}</Typography>
                      <Typography sx={{ fontSize: 10, color: DIM }}>Heartbeat: {unit.lastPing}</Typography>
                    </TableCell>
                    <TableCell>
                      {unit.alert ? (
                        <Chip
                          icon={<Warning sx={{ fontSize: '14px !important' }} />}
                          label={unit.alert}
                          size="small"
                          sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: RED, fontWeight: 700, fontSize: 9.5 }}
                        />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CheckCircle sx={{ color: GREEN, fontSize: 14 }} />
                          <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>All Systems Nominal</Typography>
                        </Box>
                      )}
                      <Typography sx={{ fontSize: 10, color: DIM, mt: 0.5 }}>{unit.device} · {unit.appVersion}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      </Box>
    </Box>
  );
}
