import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Button, Tab, Tabs, Chip,
  Drawer, IconButton, Divider, AppBar, Toolbar, Badge,
  Avatar, Tooltip, Snackbar, Alert
} from '@mui/material';
import {
  Menu as MenuIcon, Notifications, Refresh, Add,
  FilterList, FullscreenExit, Fullscreen, Warning,
  DirectionsCar, Close, LocalTaxi, AutoAwesome, CheckCircle
} from '@mui/icons-material';

import DispatchMap from '../components/DispatchMap';
import IncidentQueue from '../components/IncidentQueue';
import StatsCards from '../components/StatsCards';
import AssignmentWizard from '../components/AssignmentWizard';
import SOSAlertModal from '../components/SOSAlertModal';
import LiveTrackingPanel from '../components/LiveTrackingPanel';
import { useIncidents, useAmbulances, useHospitals, useDashboardStats } from '../hooks/useData';
import socketService from '../services/socket';
import { incidentsApi } from '../services/api';
import { dispatchBroadcast, DISPATCH_EVENTS } from '../services/dispatchBroadcast';

const DRAWER_WIDTH = 380;

export default function DashboardPage({ user, onLogout }) {
  const { incidents: remoteIncidents, loading: incidentsLoading, refetch: refetchIncidents } = useIncidents();
  const { ambulances, loading: ambulancesLoading, refetch: refetchAmbulances } = useAmbulances();
  const { hospitals, loading: hospitalsLoading } = useHospitals();
  const { stats } = useDashboardStats();

  // Local SOS incidents (created without backend)
  const [sosIncidents, setSosIncidents] = useState([]);
  const incidents = [...sosIncidents, ...remoteIncidents];

  const [selectedIncident, setSelectedIncident] = useState(null);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [focusAmbulance, setFocusAmbulance] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState('tracking');
  const [snackbar, setSnackbar] = useState(null);
  const [autoDispatchLoading, setAutoDispatchLoading] = useState(false);
  const [autoDispatchResult, setAutoDispatchResult] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) socketService.connect(token);
    return () => socketService.disconnect();
  }, []);

  const handleIncidentSelect = (incident) => {
    setSelectedIncident(incident);
    // Clear any previously confirmed assignment route when a new incident is selected
    setActiveAssignment(null);
  };

  const handleAcknowledge = async () => {
    if (!selectedIncident) return;
    // For SOS incidents created locally, update state directly
    if (selectedIncident.is_sos) {
      setSosIncidents(prev =>
        prev.map(i => i.id === selectedIncident.id ? { ...i, status: 'ACKNOWLEDGED' } : i)
      );
      setSelectedIncident(prev => prev ? { ...prev, status: 'ACKNOWLEDGED' } : prev);
      setSnackbar({ message: 'Incident acknowledged', severity: 'success' });
      return;
    }
    try {
      await incidentsApi.acknowledge(selectedIncident.id);
      refetchIncidents();
    } catch (err) {
      console.error('Failed to acknowledge:', err);
    }
  };

  const handleAssign = () => setWizardOpen(true);

  /* ── AI Auto-Dispatch ─────────────────────────────────────────────── */
  const handleAutoDispatch = async () => {
    if (!selectedIncident) return;
    setAutoDispatchLoading(true);
    setAutoDispatchResult(null);

    // Simulate brief AI "thinking" delay (0.8s) for UX feedback
    await new Promise(r => setTimeout(r, 800));

    const iLat = selectedIncident.location_lat;
    const iLng = selectedIncident.location_lng;

    // 1. Pick nearest available ambulance
    const availAmbs = ambulances.filter(a => a.latitude && a.longitude && a.status === 'AVAILABLE');
    if (availAmbs.length === 0) {
      setSnackbar({ message: 'No available ambulances nearby', severity: 'error' });
      setAutoDispatchLoading(false);
      return;
    }

    function haversine(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    const bestAmb = availAmbs.reduce((best, a) => {
      const d = haversine(a.latitude, a.longitude, iLat, iLng);
      return d < best.dist ? { amb: a, dist: d } : best;
    }, { amb: availAmbs[0], dist: Infinity }).amb;

    // 2. Pick best hospital: score = beds weight + proximity weight
    const availHosps = hospitals.filter(h => h.latitude && h.longitude && (h.available_beds || 0) > 0);
    const bestHosp = availHosps.length > 0
      ? availHosps.reduce((best, h) => {
          const distKm = haversine(iLat, iLng, h.latitude, h.longitude);
          // Score: 60% proximity (lower = better), 40% beds (higher = better)
          const score = (1 / (distKm + 0.1)) * 0.6 + ((h.available_beds || 0) / 50) * 0.4;
          return score > best.score ? { hosp: h, score, distKm } : best;
        }, { hosp: availHosps[0], score: -Infinity, distKm: 0 })
      : null;

    const ambDist = haversine(bestAmb.latitude, bestAmb.longitude, iLat, iLng);
    const eta = Math.ceil(ambDist / 40 * 60); // ~40 km/h city speed

    const result = {
      ambulance: bestAmb,
      hospital: bestHosp?.hosp || null,
      ambDistKm: ambDist.toFixed(1),
      hospDistKm: bestHosp?.distKm?.toFixed(1) || '?',
      eta,
      reasoning: [
        `Nearest available unit: ${bestAmb.call_sign || bestAmb.vehicle_number} · ${ambDist.toFixed(1)} km away`,
        bestHosp ? `Best hospital: ${bestHosp.hosp.name} · ${bestHosp.hosp.available_beds} beds · ${bestHosp.distKm.toFixed(1)} km` : 'No hospitals available',
        `Estimated scene arrival: ~${eta} min`,
        selectedIncident.severity === 'CRITICAL' ? 'Green corridor recommended — critical case' : null,
      ].filter(Boolean),
    };

    setAutoDispatchResult(result);
    setAutoDispatchLoading(false);

    // Auto-confirm after showing result
    setTimeout(() => {
      const currentIncident = selectedIncident;
      const fullAmbulance = ambulances.find(a => a.id === result.ambulance?.id) || result.ambulance;
      const fullHospital = hospitals.find(h => h.id === result.hospital?.id) || result.hospital;
      const enriched = {
        ambulance: fullAmbulance,
        hospital: fullHospital,
        incident: currentIncident,
        id: currentIncident.id,
        incident_type: currentIncident.incident_type,
        severity: currentIncident.severity,
        location_address: currentIncident.location_address,
        location_lat: currentIncident.location_lat,
        location_lng: currentIncident.location_lng,
        distance: `${result.ambDistKm} km`,
        eta: `${result.eta} min`,
        hospital_name: fullHospital?.name,
        _isAssignment: true,
        _autoDispatched: true,
      };
      setActiveAssignment(enriched);
      dispatchBroadcast.send(DISPATCH_EVENTS.INCIDENT_ASSIGNED, enriched);
      setAutoDispatchResult(null);
      setSelectedIncident(null);
      setSnackbar({ message: `⚡ Auto-dispatched ${bestAmb.call_sign || bestAmb.vehicle_number} → ${currentIncident.incident_type}`, severity: 'success' });
      refetchIncidents();
      refetchAmbulances();
    }, 2200);
  };

  const handleAssignmentCreated = (assignment) => {
    const currentIncident = selectedIncident; // capture before clearing
    refetchIncidents();
    refetchAmbulances();
    if (assignment && currentIncident) {
      // Enrich ambulance with lat/lng from live ambulances array
      const fullAmbulance = ambulances.find(a => a.id === assignment.ambulance?.id) || assignment.ambulance;
      // Enrich hospital with lat/lng from live hospitals array
      const fullHospital = hospitals.find(h => h.id === assignment.hospital?.id) || assignment.hospital;
      const enriched = {
        ambulance: fullAmbulance,
        hospital: fullHospital,
        incident: currentIncident,
        // flat fields for driver interface
        id: currentIncident.id,
        incident_type: currentIncident.incident_type,
        severity: currentIncident.severity,
        location_address: currentIncident.location_address,
        location_lat: currentIncident.location_lat,
        location_lng: currentIncident.location_lng,
        caller_name: currentIncident.caller_name,
        caller_phone: currentIncident.caller_phone,
        patients_count: currentIncident.patients_count || 1,
        description: currentIncident.description,
        is_sos: currentIncident.is_sos,
        distance: `${(Math.random()*4+1).toFixed(1)} km`,
        eta: `${fullAmbulance?.eta_minutes || 6} min`,
        hospital_name: fullHospital?.name,
        _isAssignment: true,
      };
      setActiveAssignment(enriched);
      dispatchBroadcast.send(DISPATCH_EVENTS.INCIDENT_ASSIGNED, enriched);
    }
    setSelectedIncident(null);
  };

  const handleSOSCreated = useCallback((newIncident) => {
    setSosIncidents(prev => [newIncident, ...prev]);
    setSnackbar({ message: `🚨 SOS Alert dispatched: ${newIncident.incident_type}`, severity: 'error' });
    setSosModalOpen(false);
    // Notify driver tab in real-time
    dispatchBroadcast.send(DISPATCH_EVENTS.SOS_CREATED, newIncident);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const activeCount = incidents.filter(i => !['RESOLVED', 'CANCELLED'].includes(i.status)).length;
  const pendingCount = incidents.filter(i => i.status === 'PENDING').length;

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0d1117' }}>
      {/* ── App Bar ── */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'linear-gradient(90deg, #0d1117, #161b22)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton color="inherit" onClick={() => setDrawerOpen(!drawerOpen)} edge="start" sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 800 }}>
            🚑 Dispatch Command Center
          </Typography>

          {/* SOS Button */}
          <Button
            variant="contained"
            startIcon={<Warning />}
            onClick={() => setSosModalOpen(true)}
            sx={{
              background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
              color: 'white', fontWeight: 800, mr: 1,
              animation: 'sosPulse 2s infinite',
              '@keyframes sosPulse': {
                '0%,100%': { boxShadow: '0 0 0 0 rgba(220,38,38,0.4)' },
                '50%': { boxShadow: '0 0 0 8px rgba(220,38,38,0)' },
              },
              '&:hover': { background: 'linear-gradient(90deg, #b91c1c, #991b1b)' },
            }}
          >
            SOS Alert
          </Button>

          {/* Driver View Button */}
          <Tooltip title="Open Driver Interface">
            <Button
              variant="outlined"
              startIcon={<DirectionsCar />}
              onClick={() => window.open('/#/driver', '_blank')}
              sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white', mr: 1,
                '&:hover': { borderColor: '#3b82f6', bgcolor: 'rgba(59,130,246,0.1)' } }}
            >
              Driver
            </Button>
          </Tooltip>

          {/* Live Tracking Toggle */}
          <Tooltip title="Toggle Live Tracking Panel">
            <IconButton
              color="inherit"
              onClick={() => setRightPanel(p => p === 'tracking' ? null : 'tracking')}
              sx={{ bgcolor: rightPanel === 'tracking' ? 'rgba(59,130,246,0.2)' : 'transparent' }}
            >
              <LocalTaxi />
            </IconButton>
          </Tooltip>

          <IconButton color="inherit" onClick={() => { refetchIncidents(); refetchAmbulances(); }}>
            <Refresh />
          </IconButton>

          <IconButton color="inherit">
            <Badge badgeContent={pendingCount} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <IconButton color="inherit" onClick={toggleFullscreen}>
            {fullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>

          <Avatar sx={{ ml: 1, bgcolor: '#dc2626', width: 34, height: 34, fontSize: 14 }}>
            {user?.name?.[0] || 'D'}
          </Avatar>
        </Toolbar>
      </AppBar>

      {/* ── Left Sidebar: Incident Queue ── */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: 64,
            height: 'calc(100% - 64px)',
            background: 'linear-gradient(180deg, #0d1117, #0f1629)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            color: 'white',
          }
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
              📋 Incidents
              <Chip label={activeCount} size="small" color="error" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Add SOS">
                <IconButton size="small" onClick={() => setSosModalOpen(true)}
                  sx={{ color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' }}>
                  <Add fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                <FilterList fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{
              mb: 1,
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', minHeight: 36, textTransform: 'none' },
              '& .Mui-selected': { color: 'white' },
              '& .MuiTabs-indicator': { bgcolor: '#dc2626' },
            }}
          >
            <Tab label="Active" />
            <Tab label="Pending" />
            <Tab label="All" />
          </Tabs>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

        <Box sx={{ overflow: 'auto', flexGrow: 1, '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 } }}>
          <IncidentQueue
            incidents={incidents}
            onSelect={handleIncidentSelect}
            selectedId={selectedIncident?.id}
            filter={['active', 'pending', 'all'][tabValue]}
          />
        </Box>

        {selectedIncident && (
          <Box sx={{
            p: 2, borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.3)',
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ color: 'white' }}>
                {selectedIncident.incident_type}
              </Typography>
              <IconButton size="small" onClick={() => setSelectedIncident(null)}
                sx={{ color: 'rgba(255,255,255,0.4)' }}>
                <Close fontSize="small" />
              </IconButton>
            </Box>
            {selectedIncident.is_sos && (
              <Chip label="🚨 SOS" size="small" sx={{ mb: 1, bgcolor: '#dc2626', color: 'white', fontWeight: 700 }} />
            )}
            {/* Auto-Dispatch result card */}
            {autoDispatchResult && (
              <Box sx={{
                mb: 1.5, p: 1.5, borderRadius: 1.5,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))',
                border: '1px solid rgba(59,130,246,0.25)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                  <AutoAwesome sx={{ fontSize: 14, color: '#818cf8' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#818cf8' }}>AI DECISION</Typography>
                </Box>
                {autoDispatchResult.reasoning.map((line, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.7, mb: 0.4 }}>
                    <CheckCircle sx={{ fontSize: 11, color: '#22c55e', mt: 0.3, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{line}</Typography>
                  </Box>
                ))}
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', mt: 0.8 }}>
                  Dispatching in 2 seconds…
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
              {/* AI Auto-Dispatch — primary action */}
              {['PENDING', 'ACKNOWLEDGED'].includes(selectedIncident.status) && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAutoDispatch}
                  disabled={autoDispatchLoading}
                  startIcon={autoDispatchLoading
                    ? <Box sx={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
                    : <AutoAwesome sx={{ fontSize: '16px !important' }} />
                  }
                  sx={{
                    background: autoDispatchLoading
                      ? 'rgba(99,102,241,0.4)'
                      : 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                    color: 'white', fontWeight: 700, fontSize: 12,
                    boxShadow: autoDispatchLoading ? 'none' : '0 0 16px rgba(99,102,241,0.4)',
                    '&:hover': { background: 'linear-gradient(90deg, #4338ca, #6d28d9)' },
                    '&:disabled': { opacity: 0.6 },
                  }}
                >
                  {autoDispatchLoading ? 'Analysing…' : '⚡ AI Auto-Dispatch'}
                </Button>
              )}

              <Box sx={{ display: 'flex', gap: 1 }}>
                {selectedIncident.status === 'PENDING' && (
                  <Button variant="outlined" size="small" onClick={handleAcknowledge}
                    sx={{ borderColor: '#f59e0b', color: '#f59e0b', flex: 1,
                      '&:hover': { bgcolor: 'rgba(245,158,11,0.1)' } }}>
                    Acknowledge
                  </Button>
                )}
                {['PENDING', 'ACKNOWLEDGED'].includes(selectedIncident.status) && (
                  <Button variant="outlined" size="small" onClick={handleAssign}
                    startIcon={<Add />}
                    sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', flex: 1,
                      '&:hover': { borderColor: '#22c55e', color: '#22c55e', bgcolor: 'rgba(34,197,94,0.08)' } }}>
                    Manual
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* ── Main Content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1, p: 2, mt: 8,
          display: 'flex', gap: 2,
          overflow: 'hidden',
          transition: 'all 0.2s',
        }}
      >
        {/* Map area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <StatsCards stats={stats} incidents={incidents} ambulances={ambulances} hospitals={hospitals} />

          <Paper sx={{
            mt: 2, flex: 1, overflow: 'hidden',
            bgcolor: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
          }}>
            <DispatchMap
              incidents={incidents.filter(i => !['RESOLVED', 'CANCELLED'].includes(i.status))}
              ambulances={ambulances}
              hospitals={hospitals}
              selectedIncident={selectedIncident}
              activeAssignment={activeAssignment}
              focusAmbulance={focusAmbulance}
              onIncidentClick={handleIncidentSelect}
              onAmbulanceClick={setFocusAmbulance}
              onHospitalClick={(hosp) => console.log('Hospital clicked:', hosp)}
            />
          </Paper>
        </Box>

        {/* Right panel: Live Tracking */}
        {rightPanel === 'tracking' && (
          <Paper sx={{
            width: 320, flexShrink: 0,
            background: 'linear-gradient(180deg, #0d1117, #0f1629)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <LiveTrackingPanel
              ambulances={ambulances}
              onAmbulanceSelect={(amb) => setFocusAmbulance({ ...amb, _ts: Date.now() })}
            />
          </Paper>
        )}
      </Box>

      {/* ── SOS Modal ── */}
      <SOSAlertModal
        open={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        onSOSCreated={handleSOSCreated}
      />

      {/* ── Assignment Wizard ── */}
      <AssignmentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        incident={selectedIncident}
        onAssignmentCreated={handleAssignmentCreated}
      />

      {/* ── Snackbar ── */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar?.severity || 'info'}
          onClose={() => setSnackbar(null)}
          sx={{ bgcolor: '#1e1e2e', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
