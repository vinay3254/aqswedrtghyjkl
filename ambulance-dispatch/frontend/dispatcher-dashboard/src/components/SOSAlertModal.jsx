import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Box, Typography, Grid,
  Alert, IconButton, Chip, Divider, LinearProgress,
  Fade, Zoom
} from '@mui/material';
import {
  Warning, Close, MyLocation, Phone, Person,
  LocalHospital, CheckCircle
} from '@mui/icons-material';

const INCIDENT_TYPES = [
  'Cardiac Arrest', 'Road Accident', 'Stroke', 'Fire Injury',
  'Respiratory Emergency', 'Trauma', 'Drowning', 'Fall Injury',
  'Chest Pain', 'Unconscious Patient', 'Seizure', 'Allergic Reaction'
];

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Critical', color: '#ef4444', desc: 'Life-threatening, immediate response' },
  { value: 'HIGH', label: 'High', color: '#f97316', desc: 'Serious condition, urgent response' },
  { value: 'MEDIUM', label: 'Medium', color: '#eab308', desc: 'Moderate condition, timely response' },
  { value: 'LOW', label: 'Low', color: '#22c55e', desc: 'Non-urgent, routine response' },
];

const INDIA_CITIES = [
  { name: 'Bangalore, Karnataka',  lat: 12.9716, lng: 77.5946 },
  { name: 'Indiranagar, Bangalore',lat: 12.9784, lng: 77.6408 },
  { name: 'Koramangala, Bangalore',lat: 12.9352, lng: 77.6245 },
  { name: 'Whitefield, Bangalore', lat: 12.9698, lng: 77.7500 },
  { name: 'Hebbal, Bangalore',     lat: 13.0459, lng: 77.5967 },
  { name: 'Electronic City',       lat: 12.8399, lng: 77.6770 },
  { name: 'Delhi, NCT',            lat: 28.6139, lng: 77.2090 },
  { name: 'Mumbai, Maharashtra',   lat: 19.0760, lng: 72.8777 },
];

function SirenIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" {...props}>
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm0 4l5 2.18V11c0 3.3-2.26 6.42-5 7.46C9.26 17.42 7 14.3 7 11V7.18L12 5z"/>
    </svg>
  );
}

export default function SOSAlertModal({ open, onClose, onSOSCreated }) {
  const [step, setStep] = useState(1); // 1: form, 2: confirming, 3: success
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState({
    incidentType: '',
    severity: 'CRITICAL',
    locationAddress: '',
    locationLat: '',
    locationLng: '',
    callerName: '',
    callerPhone: '',
    description: '',
    patientsCount: 1,
  });
  const [errors, setErrors] = useState({});
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState(''); // 'fetching' | 'done' | 'denied' | ''

  // ── Auto-fetch location when modal opens ──────────────────────
  useEffect(() => {
    if (open) {
      // Reset form state first
      setStep(1);
      setProgress(0);
      setForm({
        incidentType: '', severity: 'CRITICAL', locationAddress: '',
        locationLat: '', locationLng: '', callerName: '',
        callerPhone: '', description: '', patientsCount: 1,
      });
      setErrors({});
      // Then immediately grab location
      handleGetLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (step === 2) {
      let p = 0;
      const timer = setInterval(() => {
        p += 4;
        setProgress(p);
        if (p >= 100) {
          clearInterval(timer);
          // Create the SOS incident
          const newIncident = {
            id: `SOS-${Date.now()}`,
            incident_type: form.incidentType || 'SOS Emergency',
            severity: form.severity,
            status: 'PENDING',
            location_address: form.locationAddress,
            location_lat: parseFloat(form.locationLat) || 19.0760 + (Math.random() - 0.5) * 0.1,
            location_lng: parseFloat(form.locationLng) || 72.8777 + (Math.random() - 0.5) * 0.1,
            caller_name: form.callerName,
            caller_phone: form.callerPhone,
            description: form.description,
            patients_count: form.patientsCount,
            created_at: new Date().toISOString(),
            is_sos: true,
          };
          onSOSCreated?.(newIncident);
          setStep(3);
        }
      }, 40);
      return () => clearInterval(timer);
    }
  }, [step]);

  const validate = () => {
    const e = {};
    if (!form.incidentType) e.incidentType = 'Select incident type';
    if (!form.locationAddress) e.locationAddress = 'Location is required';
    if (!form.callerPhone) e.callerPhone = 'Phone number required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSendSOS = () => {
    if (validate()) setStep(2);
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const a = data.address || {};

      // Build a clean, prioritised address from structured components
      const road        = a.road || a.pedestrian || a.footway || a.path || '';
      const building    = a.building || a.amenity || a.shop || a.tourism || '';
      const neighbourhood = a.neighbourhood || a.suburb || a.quarter || a.residential || '';
      const city        = a.city || a.town || a.village || a.municipality || a.county || '';
      const state       = a.state || '';

      // Compose: Building/Road › Neighbourhood › City, State
      const parts = [building, road, neighbourhood, city, state]
        .map(s => s.trim())
        .filter(Boolean);

      // Deduplicate adjacent identical parts
      const unique = parts.filter((v, i) => v !== parts[i - 1]);

      return unique.length > 0
        ? unique.join(', ')
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  // IP-based geolocation fallback — more accurate than a hardcoded demo city
  const getLocationByIP = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) };
      }
    } catch { /* silent */ }
    return { lat: 20.5937, lng: 78.9629 }; // centre of India as last resort
  };

  const handleGetLocation = () => {
    setGettingLocation(true);
    setLocationStatus('fetching');

    const applyIPFallback = async () => {
      const { lat, lng } = await getLocationByIP();
      const address = await reverseGeocode(lat, lng);
      setForm(f => ({
        ...f,
        locationLat: lat.toFixed(6),
        locationLng: lng.toFixed(6),
        locationAddress: address,
      }));
      setGettingLocation(false);
      setLocationStatus('ip');
    };

    if (!navigator.geolocation) {
      applyIPFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        setForm(f => ({
          ...f,
          locationLat: lat.toFixed(6),
          locationLng: lng.toFixed(6),
          locationAddress: address,
        }));
        setGettingLocation(false);
        setLocationStatus('gps');
      },
      () => applyIPFallback(),
      { timeout: 6000, maximumAge: 0, enableHighAccuracy: true }
    );
  };

  const selectedSeverity = SEVERITY_OPTIONS.find(s => s.value === form.severity);

  return (
    <Dialog
      open={open}
      onClose={step !== 2 ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Zoom}
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #0f0c29, #1a1a2e)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 3,
          boxShadow: '0 0 40px rgba(239,68,68,0.2)',
          overflow: 'hidden',
        }
      }}
    >
      {/* Animated header */}
      <Box sx={{
        background: 'linear-gradient(90deg, #dc2626, #991b1b)',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px)',
        }
      }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: step === 1 ? 'sosGlow 1.5s infinite alternate' : 'none',
          '@keyframes sosGlow': {
            '0%': { boxShadow: '0 0 0 0 rgba(255,255,255,0.4)' },
            '100%': { boxShadow: '0 0 0 12px rgba(255,255,255,0)' },
          }
        }}>
          <Warning sx={{ color: 'white', fontSize: 28 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
            🚨 SOS Emergency Alert
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Dispatch an emergency alert to the incident queue
          </Typography>
        </Box>
        {step === 1 && (
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <Close />
          </IconButton>
        )}
      </Box>

      <DialogContent sx={{ p: 3, bgcolor: 'transparent' }}>
        {step === 1 && (
          <Fade in>
            <Grid container spacing={2}>
              {/* Incident Type */}
              <Grid item xs={12} sm={7}>
                <TextField
                  select fullWidth label="Incident Type" size="small"
                  value={form.incidentType}
                  onChange={e => setForm(f => ({ ...f, incidentType: e.target.value }))}
                  error={!!errors.incidentType}
                  helperText={errors.incidentType}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: '#1a1a2e', color: 'white' } } } }}
                >
                  {INCIDENT_TYPES.map(t => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Patient Count */}
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth label="Patients" size="small" type="number"
                  value={form.patientsCount}
                  onChange={e => setForm(f => ({ ...f, patientsCount: parseInt(e.target.value) || 1 }))}
                  inputProps={{ min: 1, max: 50 }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
              </Grid>

              {/* Severity */}
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1, display: 'block' }}>
                  Severity Level
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {SEVERITY_OPTIONS.map(sev => (
                    <Chip
                      key={sev.value}
                      label={sev.label}
                      onClick={() => setForm(f => ({ ...f, severity: sev.value }))}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: form.severity === sev.value ? sev.color : 'rgba(255,255,255,0.05)',
                        color: 'white',
                        border: `1px solid ${form.severity === sev.value ? sev.color : 'rgba(255,255,255,0.15)'}`,
                        fontWeight: form.severity === sev.value ? 700 : 400,
                        transform: form.severity === sev.value ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: sev.color + 'aa' },
                      }}
                    />
                  ))}
                </Box>
                {selectedSeverity && (
                  <Typography variant="caption" sx={{ color: selectedSeverity.color, mt: 0.5, display: 'block' }}>
                    {selectedSeverity.desc}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              </Grid>

              {/* Location */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth label="Location / Address" size="small"
                    value={gettingLocation ? '' : form.locationAddress}
                    onChange={e => setForm(f => ({ ...f, locationAddress: e.target.value }))}
                    error={!!errors.locationAddress}
                    helperText={errors.locationAddress}
                    placeholder={gettingLocation ? '📡 Acquiring your location…' : 'Street, City, Landmark...'}
                    disabled={gettingLocation}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                    InputProps={{
                      sx: {
                        color: 'white',
                        '& fieldset': {
                          borderColor: gettingLocation
                            ? '#3b82f6'
                            : locationStatus === 'gps'
                            ? '#22c55e'
                            : locationStatus === 'ip'
                            ? '#f59e0b'
                            : 'rgba(255,255,255,0.2)',
                        },
                        '& input::placeholder': { color: gettingLocation ? '#60a5fa' : undefined },
                      },
                      startAdornment: gettingLocation ? (
                        <MyLocation sx={{ color: '#60a5fa', mr: 1, fontSize: 18,
                          animation: 'spin 1.5s linear infinite',
                          '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }
                        }} />
                      ) : locationStatus === 'gps' ? (
                        <MyLocation sx={{ color: '#22c55e', mr: 1, fontSize: 18 }} />
                      ) : locationStatus === 'ip' ? (
                        <MyLocation sx={{ color: '#f59e0b', mr: 1, fontSize: 18 }} />
                      ) : null,
                    }}
                  />
                  <Button
                    variant="outlined" size="small" onClick={handleGetLocation}
                    disabled={gettingLocation}
                    title="Re-fetch my location"
                    sx={{ minWidth: 48, borderColor: 'rgba(255,255,255,0.2)', color: 'white', px: 1,
                      '&:hover': { borderColor: '#3b82f6', color: '#60a5fa' } }}
                  >
                    <MyLocation fontSize="small" />
                  </Button>
                </Box>
                {locationStatus === 'gps' && !gettingLocation && (
                  <Typography variant="caption" sx={{ color: '#22c55e', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    📍 GPS location detected — accurate to ~10m
                  </Typography>
                )}
                {locationStatus === 'ip' && !gettingLocation && (
                  <Typography variant="caption" sx={{ color: '#f59e0b', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    📶 Located via network IP (GPS blocked — allow browser location for better accuracy)
                  </Typography>
                )}
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth label="Latitude" size="small"
                  value={form.locationLat}
                  onChange={e => setForm(f => ({ ...f, locationLat: e.target.value }))}
                  placeholder="19.0760"
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Longitude" size="small"
                  value={form.locationLng}
                  onChange={e => setForm(f => ({ ...f, locationLng: e.target.value }))}
                  placeholder="72.8777"
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              </Grid>

              {/* Caller info */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Caller Name" size="small"
                  value={form.callerName}
                  onChange={e => setForm(f => ({ ...f, callerName: e.target.value }))}
                  placeholder="Optional"
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                  InputProps={{
                    sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } },
                    startAdornment: <Person sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, fontSize: 18 }} />
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Caller Phone" size="small"
                  value={form.callerPhone}
                  onChange={e => setForm(f => ({ ...f, callerPhone: e.target.value }))}
                  error={!!errors.callerPhone}
                  helperText={errors.callerPhone}
                  placeholder="+91 98765 43210"
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                  InputProps={{
                    sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } },
                    startAdornment: <Phone sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, fontSize: 18 }} />
                  }}
                />
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Description / Additional Info" size="small" multiline rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the emergency..."
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
              </Grid>
            </Grid>
          </Fade>
        )}

        {step === 2 && (
          <Fade in>
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Box sx={{
                width: 80, height: 80, borderRadius: '50%',
                bgcolor: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2,
                animation: 'ping 1s ease-in-out infinite',
                '@keyframes ping': {
                  '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                  '50%': { transform: 'scale(1.1)', opacity: 0.8 },
                }
              }}>
                <Warning sx={{ fontSize: 40, color: '#ef4444' }} />
              </Box>
              <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>Dispatching SOS Alert...</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3 }}>
                Notifying all available units and operators
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6, borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    background: 'linear-gradient(90deg, #dc2626, #f97316)',
                    borderRadius: 3,
                  }
                }}
              />
            </Box>
          </Fade>
        )}

        {step === 3 && (
          <Fade in>
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Box sx={{
                width: 80, height: 80, borderRadius: '50%',
                bgcolor: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2,
              }}>
                <CheckCircle sx={{ fontSize: 48, color: '#22c55e' }} />
              </Box>
              <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>SOS Alert Dispatched!</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
                The emergency has been added to the incident queue.
                All available ambulances have been notified.
              </Typography>
              <Box sx={{
                bgcolor: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 2, p: 2, textAlign: 'left'
              }}>
                <Typography variant="caption" sx={{ color: '#22c55e', display: 'block', mb: 0.5 }}>
                  Incident Created
                </Typography>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  {form.incidentType || 'SOS Emergency'} — {form.severity}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  {form.locationAddress || 'Location set'}
                </Typography>
              </Box>
            </Box>
          </Fade>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {step === 1 && (
          <>
            <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSendSOS}
              startIcon={<Warning />}
              sx={{
                background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
                color: 'white', fontWeight: 700,
                '&:hover': { background: 'linear-gradient(90deg, #b91c1c, #991b1b)' },
                px: 3,
              }}
            >
              🚨 Send SOS Alert
            </Button>
          </>
        )}
        {step === 3 && (
          <Button
            fullWidth variant="contained"
            onClick={onClose}
            sx={{
              background: 'linear-gradient(90deg, #16a34a, #15803d)',
              color: 'white', fontWeight: 700,
            }}
          >
            Close & Monitor Incident
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
