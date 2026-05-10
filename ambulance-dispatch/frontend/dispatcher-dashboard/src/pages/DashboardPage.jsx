import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Button, Tab, Tabs, Chip,
  Drawer, IconButton, Divider, AppBar, Toolbar, Badge,
  Avatar, Tooltip, Snackbar, Alert
} from '@mui/material';
import {
  Menu as MenuIcon, Notifications, Refresh, Add,
  FilterList, FullscreenExit, Fullscreen, Warning,
  DirectionsCar, Close, LocalTaxi
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
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState('tracking'); // 'tracking' | null
  const [snackbar, setSnackbar] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) socketService.connect(token);
    return () => socketService.disconnect();
  }, []);

  const handleIncidentSelect = (incident) => {
    setSelectedIncident(incident);
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

  const handleAssignmentCreated = (assignment) => {
    refetchIncidents();
    refetchAmbulances();
    setSelectedIncident(null);
    // Notify driver tab
    if (assignment) {
      dispatchBroadcast.send(DISPATCH_EVENTS.INCIDENT_ASSIGNED, assignment);
    }
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
            <Box sx={{ display: 'flex', gap: 1 }}>
              {selectedIncident.status === 'PENDING' && (
                <Button variant="outlined" size="small" onClick={handleAcknowledge}
                  sx={{ borderColor: '#f59e0b', color: '#f59e0b', flex: 1,
                    '&:hover': { bgcolor: 'rgba(245,158,11,0.1)' } }}>
                  Acknowledge
                </Button>
              )}
              {['PENDING', 'ACKNOWLEDGED'].includes(selectedIncident.status) && (
                <Button variant="contained" size="small" onClick={handleAssign}
                  startIcon={<Add />}
                  sx={{ background: 'linear-gradient(90deg, #16a34a, #15803d)', color: 'white', flex: 1 }}>
                  Assign
                </Button>
              )}
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
              onIncidentClick={handleIncidentSelect}
              onAmbulanceClick={(amb) => console.log('Ambulance clicked:', amb)}
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
              onAmbulanceSelect={(amb) => console.log('Tracking:', amb)}
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
