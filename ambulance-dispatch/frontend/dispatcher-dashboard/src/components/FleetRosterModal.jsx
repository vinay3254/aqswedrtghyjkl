import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Box, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, Alert, Tabs, Tab, CircularProgress
} from '@mui/material';
import {
  Close, Add, DirectionsCar, Person, Build, CheckCircle,
  Delete, Refresh, Edit
} from '@mui/icons-material';
import supabase from '../services/supabase';

const AMBULANCE_TYPES = ['ALS', 'BLS', 'PTS', 'NEONATAL'];
const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available', color: '#10B981' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: '#94A3B8' },
  { value: 'OFFLINE', label: 'Offline', color: '#64748B' },
];

export default function FleetRosterModal({ open, onClose, onRosterUpdated }) {
  const [activeTab, setActiveTab] = useState(0); // 0: Fleet list, 1: Add Unit
  const [ambulances, setAmbulances] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // New Ambulance Form State
  const [newAmb, setNewAmb] = useState({
    id: '',
    call_sign: '',
    vehicle_number: '',
    type: 'ALS',
    latitude: '12.9716',
    longitude: '77.5946',
    assigned_driver_id: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch all ambulances
      const { data: ambData, error: ambErr } = await supabase
        .from('ambulances')
        .select('*')
        .order('call_sign', { ascending: true });

      if (ambErr) throw ambErr;
      setAmbulances(ambData || []);

      // 2. Fetch all registered drivers
      const { data: drvData, error: drvErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'DRIVER');

      if (drvErr) throw drvErr;
      setDrivers(drvData || []);
    } catch (err) {
      console.error('[FleetRosterModal] Fetch error:', err);
      setErrorMsg(err.message || 'Failed to load fleet roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [open]);

  // ── Handle Assign Driver to Ambulance ──
  const handleAssignDriver = async (ambId, driverId) => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const selectedDriver = driverId === 'NONE' ? null : driverId;

      // If driver is already assigned elsewhere, unassign first
      if (selectedDriver) {
        await supabase
          .from('ambulances')
          .update({ assigned_driver_id: null })
          .eq('assigned_driver_id', selectedDriver);
      }

      const { error } = await supabase
        .from('ambulances')
        .update({ assigned_driver_id: selectedDriver })
        .eq('id', ambId);

      if (error) throw error;

      setSuccessMsg('Driver assignment updated successfully.');
      await fetchData();
      onRosterUpdated?.();
    } catch (err) {
      console.error('[FleetRosterModal] Assign error:', err);
      setErrorMsg(err.message || 'Failed to update driver assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Handle Add New Ambulance ──
  const handleCreateAmbulance = async (e) => {
    e.preventDefault();
    if (!newAmb.call_sign || !newAmb.vehicle_number) {
      setErrorMsg('Call sign and vehicle registration number are required.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      const nextId = newAmb.id.trim() || `AMB-${String(ambulances.length + 1).padStart(3, '0')}`;

      const { error } = await supabase.from('ambulances').insert({
        id: nextId,
        call_sign: newAmb.call_sign.trim(),
        vehicle_number: newAmb.vehicle_number.trim().toUpperCase(),
        type: newAmb.type,
        status: 'AVAILABLE',
        latitude: parseFloat(newAmb.latitude) || 12.9716,
        longitude: parseFloat(newAmb.longitude) || 77.5946,
        assigned_driver_id: newAmb.assigned_driver_id || null,
      });

      if (error) throw error;

      setSuccessMsg(`Ambulance ${newAmb.call_sign} added to active fleet.`);
      setNewAmb({
        id: '',
        call_sign: '',
        vehicle_number: '',
        type: 'ALS',
        latitude: '12.9716',
        longitude: '77.5946',
        assigned_driver_id: '',
      });
      setActiveTab(0);
      await fetchData();
      onRosterUpdated?.();
    } catch (err) {
      console.error('[FleetRosterModal] Create error:', err);
      setErrorMsg(err.message || 'Failed to create ambulance.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Handle Status Toggle (e.g. Maintenance) ──
  const handleToggleStatus = async (ambId, currentStatus) => {
    const nextStatus = currentStatus === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('ambulances')
        .update({ status: nextStatus })
        .eq('id', ambId);

      if (error) throw error;
      await fetchData();
      onRosterUpdated?.();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle status.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0F172A',
          color: 'white',
          borderRadius: '16px',
          border: '1px solid #1E293B',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2.5, bgcolor: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DirectionsCar sx={{ color: '#38BDF8', fontSize: 26 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>
              Fleet & Driver Roster Management
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '11px' }}>
              Real-time vehicle assignment and driver provisioning
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={fetchData} size="small" sx={{ color: '#94A3B8' }} title="Refresh Roster">
            <Refresh />
          </IconButton>
          <IconButton onClick={onClose} size="small" sx={{ color: '#94A3B8' }}>
            <Close />
          </IconButton>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        sx={{
          bgcolor: '#0F172A',
          borderBottom: '1px solid #1E293B',
          px: 2.5,
          '& .MuiTab-root': { color: '#94A3B8', fontWeight: 700, textTransform: 'none', fontSize: '13px' },
          '& .Mui-selected': { color: '#38BDF8' },
          '& .MuiTabs-indicator': { bgcolor: '#38BDF8' }
        }}
      >
        <Tab label={`Active Fleet (${ambulances.length})`} />
        <Tab label="+ Provision New Ambulance" />
      </Tabs>

      <DialogContent sx={{ p: 3, bgcolor: '#0F172A' }}>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid #EF4444', fontSize: '12px' }}>
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2, bgcolor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid #10B981', fontSize: '12px' }}>
            {successMsg}
          </Alert>
        )}

        {/* Tab 0: Active Fleet Table */}
        {activeTab === 0 && (
          loading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={36} sx={{ color: '#38BDF8' }} />
              <Typography sx={{ color: '#94A3B8', mt: 2, fontSize: '12px' }}>Loading fleet roster...</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: '#1E293B', border: '1px solid #334155', borderRadius: '10px' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { color: '#94A3B8', fontWeight: 800, fontSize: '11px', borderColor: '#334155' } }}>
                    <TableCell>CALL SIGN / ID</TableCell>
                    <TableCell>VEHICLE NO</TableCell>
                    <TableCell>TYPE</TableCell>
                    <TableCell>STATUS</TableCell>
                    <TableCell>ASSIGNED DRIVER</TableCell>
                    <TableCell align="right">ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ambulances.map((amb) => {
                    const assignedDriver = drivers.find(d => d.id === amb.assigned_driver_id);
                    return (
                      <TableRow key={amb.id} sx={{ '& td': { color: 'white', borderColor: '#334155', fontSize: '12px' } }}>
                        <TableCell sx={{ fontWeight: 800 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: amb.status === 'AVAILABLE' ? '#10B981' : '#F97316' }} />
                            {amb.call_sign}
                            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '10px' }}>({amb.id})</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', color: '#94A3B8' }}>{amb.vehicle_number}</TableCell>
                        <TableCell>
                          <Chip label={amb.type} size="small" sx={{ height: 20, fontSize: '9.5px', fontWeight: 800, bgcolor: 'rgba(255,255,255,0.08)', color: '#38BDF8' }} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={amb.status}
                            size="small"
                            sx={{
                              height: 20, fontSize: '9px', fontWeight: 800,
                              bgcolor: amb.status === 'AVAILABLE' ? 'rgba(16,185,129,0.15)' : amb.status === 'MAINTENANCE' ? 'rgba(148,163,184,0.15)' : 'rgba(249,115,22,0.15)',
                              color: amb.status === 'AVAILABLE' ? '#10B981' : amb.status === 'MAINTENANCE' ? '#94A3B8' : '#F97316',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            select
                            size="small"
                            value={amb.assigned_driver_id || 'NONE'}
                            onChange={(e) => handleAssignDriver(amb.id, e.target.value)}
                            disabled={actionLoading}
                            sx={{
                              minWidth: 160,
                              '& .MuiSelect-select': { py: '4px', fontSize: '11.5px', color: assignedDriver ? '#38BDF8' : '#64748B', fontWeight: 600 },
                              '& fieldset': { borderColor: '#334155' },
                            }}
                            SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: '#0F172A', color: 'white' } } } }}
                          >
                            <MenuItem value="NONE" sx={{ fontSize: '12px', color: '#94A3B8' }}>-- Unassigned --</MenuItem>
                            {drivers.map(d => (
                              <MenuItem key={d.id} value={d.id} sx={{ fontSize: '12px' }}>
                                👤 {d.full_name}
                              </MenuItem>
                            ))}
                          </TextField>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleToggleStatus(amb.id, amb.status)}
                            disabled={actionLoading || !['AVAILABLE', 'MAINTENANCE'].includes(amb.status)}
                            sx={{
                              fontSize: '10px',
                              py: '2px',
                              px: 1,
                              borderColor: '#334155',
                              color: amb.status === 'MAINTENANCE' ? '#10B981' : '#94A3B8',
                              '&:hover': { borderColor: '#64748B' }
                            }}
                          >
                            {amb.status === 'MAINTENANCE' ? 'Set Ready' : 'Maintenance'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )
        )}

        {/* Tab 1: Provision New Ambulance Form */}
        {activeTab === 1 && (
          <Box component="form" onSubmit={handleCreateAmbulance} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                fullWidth size="small" label="Call Sign (e.g. Foxtrot-6)"
                value={newAmb.call_sign}
                onChange={(e) => setNewAmb({ ...newAmb, call_sign: e.target.value })}
                placeholder="Foxtrot-6"
                InputLabelProps={{ sx: { color: '#94A3B8' } }}
                InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
              />
              <TextField
                fullWidth size="small" label="Vehicle Registration No"
                value={newAmb.vehicle_number}
                onChange={(e) => setNewAmb({ ...newAmb, vehicle_number: e.target.value })}
                placeholder="KA-01-F-0006"
                InputLabelProps={{ sx: { color: '#94A3B8' } }}
                InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                select fullWidth size="small" label="Vehicle Type"
                value={newAmb.type}
                onChange={(e) => setNewAmb({ ...newAmb, type: e.target.value })}
                InputLabelProps={{ sx: { color: '#94A3B8' } }}
                InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: '#1E293B', color: 'white' } } } }}
              >
                {AMBULANCE_TYPES.map(t => (
                  <MenuItem key={t} value={t}>{t} ({t === 'ALS' ? 'Advanced Life Support' : t === 'BLS' ? 'Basic Life Support' : t})</MenuItem>
                ))}
              </TextField>

              <TextField
                select fullWidth size="small" label="Assign Driver (Optional)"
                value={newAmb.assigned_driver_id}
                onChange={(e) => setNewAmb({ ...newAmb, assigned_driver_id: e.target.value })}
                InputLabelProps={{ sx: { color: '#94A3B8' } }}
                InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: '#1E293B', color: 'white' } } } }}
              >
                <MenuItem value="" sx={{ color: '#94A3B8' }}>-- Assign Later --</MenuItem>
                {drivers.map(d => (
                  <MenuItem key={d.id} value={d.id}>👤 {d.full_name} ({d.email})</MenuItem>
                ))}
              </TextField>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                fullWidth size="small" label="Base Latitude"
                value={newAmb.latitude}
                onChange={(e) => setNewAmb({ ...newAmb, latitude: e.target.value })}
                placeholder="12.9716"
                InputLabelProps={{ sx: { color: '#94A3B8' } }}
                InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
              />
              <TextField
                fullWidth size="small" label="Base Longitude"
                value={newAmb.longitude}
                onChange={(e) => setNewAmb({ ...newAmb, longitude: e.target.value })}
                placeholder="77.5946"
                InputLabelProps={{ sx: { color: '#94A3B8' } }}
                InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={actionLoading}
              startIcon={<Add />}
              sx={{
                py: 1.2,
                bgcolor: '#2563EB',
                color: 'white',
                fontWeight: 800,
                fontSize: '13px',
                textTransform: 'none',
                borderRadius: '10px',
                '&:hover': { bgcolor: '#1D4ED8' }
              }}
            >
              {actionLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Provision Ambulance to Database'}
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
