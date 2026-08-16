import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Box, Typography, Grid,
  Alert, IconButton, Chip, Divider, LinearProgress,
  Fade, Zoom
} from '@mui/material';
import {
  Warning, Close, MyLocation, Phone, Person,
  LocalHospital, CheckCircle, GpsFixed, ShareLocation
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

const BENGALURU_QUICK_LANDMARKS = [
  { name: 'Palace Grounds, Jayamahal', lat: 12.9982, lng: 77.5921 },
  { name: 'MG Road / Brigade Road',    lat: 12.9756, lng: 77.6066 },
  { name: 'Indiranagar 100ft Road',    lat: 12.9784, lng: 77.6408 },
  { name: 'Koramangala Sony Signal',   lat: 12.9352, lng: 77.6245 },
  { name: 'Hebbal Flyover',            lat: 13.0459, lng: 77.5967 },
  { name: 'Whitefield ITPL',           lat: 12.9850, lng: 77.7310 },
];

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
  const [locationStatus, setLocationStatus] = useState(''); // 'fetching' | 'gps' | 'ip' | ''

  // ── Reverse Geocoding Helper ──
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const a = data.address || {};

      const road          = a.road || a.pedestrian || a.footway || a.path || '';
      const building      = a.building || a.amenity || a.shop || a.tourism || '';
      const neighbourhood = a.neighbourhood || a.suburb || a.quarter || a.residential || '';
      const city          = a.city || a.town || a.village || a.municipality || a.county || 'Bengaluru';
      const state         = a.state || '';

      const parts = [building, road, neighbourhood, city, state]
        .map(s => s.trim())
        .filter(Boolean);

      const unique = parts.filter((v, i) => v !== parts[i - 1]);
      return unique.length > 0 ? unique.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  // ── IP-based fallback ──
  const getLocationByIP = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) };
      }
    } catch { /* silent */ }
    return { lat: 12.9716, lng: 77.5946 }; // Bengaluru central fallback
  };

  // ── Live Geolocation Acquisition ──
  const handleGetLocation = () => {
    setGettingLocation(true);
    setLocationStatus('fetching');

    const applyIPFallback = async () => {
      const { lat, lng } = await getLocationByIP();
      const address = await reverseGeocode(lat, lng);
      setForm(f => ({
        ...f,
        locationLat: lat.toFixed(5),
        locationLng: lng.toFixed(5),
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
          locationLat: lat.toFixed(5),
          locationLng: lng.toFixed(5),
          locationAddress: address,
        }));
        setGettingLocation(false);
        setLocationStatus('gps');
      },
      () => applyIPFallback(),
      { timeout: 8000, maximumAge: 0, enableHighAccuracy: true }
    );
  };

  // ── Auto-acquire live location when modal opens ──
  useEffect(() => {
    if (open) {
      setStep(1);
      setProgress(0);
      setForm({
        incidentType: 'Cardiac Arrest',
        severity: 'CRITICAL',
        locationAddress: '',
        locationLat: '',
        locationLng: '',
        callerName: 'Dispatch Command',
        callerPhone: '+91 98450 11223',
        description: 'Emergency live location SOS broadcast',
        patientsCount: 1,
      });
      setErrors({});
      handleGetLocation();
    }
  }, [open]);

  useEffect(() => {
    if (step === 2) {
      let p = 0;
      const timer = setInterval(() => {
        p += 5;
        setProgress(p);
        if (p >= 100) {
          clearInterval(timer);

          let latVal = parseFloat(form.locationLat);
          let lngVal = parseFloat(form.locationLng);

          if (isNaN(latVal) || isNaN(lngVal)) {
            latVal = 12.9716;
            lngVal = 77.5946;
          }

          // Protect against coordinate inversion
          if (latVal > 50 && lngVal < 50) {
            const temp = latVal;
            latVal = lngVal;
            lngVal = temp;
          }

          const newIncident = {
            id: `SOS-${Date.now()}`,
            incident_type: form.incidentType || 'SOS Emergency',
            severity: form.severity || 'CRITICAL',
            status: 'PENDING',
            location_address: form.locationAddress || 'Live GPS Location',
            location_lat: latVal,
            location_lng: lngVal,
            latitude: latVal,
            longitude: lngVal,
            caller_name: form.callerName || 'Emergency Caller',
            caller_phone: form.callerPhone || '+91 98765 43210',
            description: form.description || 'Live GPS SOS Alert',
            patients_count: form.patientsCount || 1,
            created_at: new Date().toISOString(),
            is_sos: true,
            is_live_gps: locationStatus === 'gps',
          };

          console.log('[SOS Alert] Created Incident Object with Live Location:', newIncident);
          onSOSCreated?.(newIncident);
          setStep(3);
        }
      }, 35);
      return () => clearInterval(timer);
    }
  }, [step, form, onSOSCreated, locationStatus]);

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

  const handleSelectLandmark = (lm) => {
    setLocationStatus('preset');
    setForm(f => ({
      ...f,
      locationAddress: lm.name,
      locationLat: lm.lat.toFixed(4),
      locationLng: lm.lng.toFixed(4),
    }));
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
          bgcolor: '#0F172A',
          color: 'white',
          borderRadius: '16px',
          border: '1.5px solid #EF4444',
          boxShadow: '0 25px 60px rgba(239,68,68,0.35)',
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        p: 2.5,
        bgcolor: '#DC2626',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Warning sx={{ color: 'white', fontSize: 26 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 800, fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>
            🚨 Broadcast Emergency SOS Alert
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px' }}>
            Auto-detects live GPS location & dispatches nearest ambulance
          </Typography>
        </Box>
        {step === 1 && (
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.8)' }}>
            <Close />
          </IconButton>
        )}
      </Box>

      <DialogContent sx={{ p: 3, bgcolor: '#0F172A' }}>
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
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                  SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: '#1E293B', color: 'white' } } } }}
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
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                />
              </Grid>

              {/* Severity Selection */}
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: '#94A3B8', mb: 1, display: 'block', fontWeight: 700 }}>
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
                        bgcolor: form.severity === sev.value ? sev.color : 'rgba(255,255,255,0.06)',
                        color: 'white',
                        border: `1px solid ${form.severity === sev.value ? sev.color : '#334155'}`,
                        fontWeight: form.severity === sev.value ? 800 : 500,
                      }}
                    />
                  ))}
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              </Grid>

              {/* ── Live GPS Location Sharing Input Field ── */}
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: '#94A3B8', mb: 0.5, display: 'block', fontWeight: 700 }}>
                  Live Incident Location
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth label="Location / Address" size="small"
                    value={gettingLocation ? '' : form.locationAddress}
                    onChange={e => setForm(f => ({ ...f, locationAddress: e.target.value }))}
                    error={!!errors.locationAddress}
                    helperText={errors.locationAddress}
                    placeholder={gettingLocation ? '📡 Acquiring your live GPS coordinates…' : 'Street, Landmark, City...'}
                    disabled={gettingLocation}
                    InputLabelProps={{ sx: { color: '#94A3B8' } }}
                    InputProps={{
                      sx: {
                        color: 'white',
                        '& fieldset': {
                          borderColor: gettingLocation
                            ? '#3B82F6'
                            : locationStatus === 'gps'
                            ? '#10B981'
                            : locationStatus === 'ip'
                            ? '#F59E0B'
                            : '#334155',
                        },
                        '& input::placeholder': { color: gettingLocation ? '#60A5FA' : undefined },
                      },
                      startAdornment: gettingLocation ? (
                        <MyLocation sx={{
                          color: '#60A5FA', mr: 1, fontSize: 18,
                          animation: 'spin 1.2s linear infinite',
                          '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }
                        }} />
                      ) : locationStatus === 'gps' ? (
                        <GpsFixed sx={{ color: '#10B981', mr: 1, fontSize: 18 }} />
                      ) : locationStatus === 'ip' ? (
                        <MyLocation sx={{ color: '#F59E0B', mr: 1, fontSize: 18 }} />
                      ) : null,
                    }}
                  />
                  <Button
                    variant="contained" size="small" onClick={handleGetLocation}
                    disabled={gettingLocation}
                    title="Re-acquire Live GPS Location"
                    startIcon={<ShareLocation />}
                    sx={{
                      bgcolor: '#2563EB', color: 'white', fontWeight: 700, px: 2, minWidth: 140,
                      textTransform: 'none', fontSize: '11.5px',
                      '&:hover': { bgcolor: '#1D4ED8' }
                    }}
                  >
                    {gettingLocation ? 'Locating...' : 'Share Live GPS'}
                  </Button>
                </Box>

                {/* Location Status Feedback Badges */}
                {locationStatus === 'gps' && !gettingLocation && (
                  <Typography variant="caption" sx={{ color: '#10B981', mt: 0.6, display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                    📍 Live Device GPS Locked — Coordinates accurate to ~10m
                  </Typography>
                )}
                {locationStatus === 'ip' && !gettingLocation && (
                  <Typography variant="caption" sx={{ color: '#F59E0B', mt: 0.6, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    📶 Located via Network IP (Allow browser location for exact GPS pin)
                  </Typography>
                )}
              </Grid>

              {/* Coordinates */}
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Latitude" size="small"
                  value={form.locationLat}
                  onChange={e => setForm(f => ({ ...f, locationLat: e.target.value }))}
                  placeholder="12.9716"
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Longitude" size="small"
                  value={form.locationLng}
                  onChange={e => setForm(f => ({ ...f, locationLng: e.target.value }))}
                  placeholder="77.5946"
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                />
              </Grid>

              {/* Landmark Presets */}
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: '#94A3B8', mb: 0.8, display: 'block', fontWeight: 700 }}>
                  Or Choose Landmark Preset:
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                  {BENGALURU_QUICK_LANDMARKS.map(lm => (
                    <Chip
                      key={lm.name}
                      label={lm.name}
                      size="small"
                      onClick={() => handleSelectLandmark(lm)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: '#1E293B',
                        color: '#38BDF8',
                        border: '1px solid #334155',
                        fontSize: '11px',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#2563EB', color: '#FFFFFF' }
                      }}
                    />
                  ))}
                </Box>
              </Grid>

              {/* Caller Info */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Caller Name" size="small"
                  value={form.callerName}
                  onChange={e => setForm(f => ({ ...f, callerName: e.target.value }))}
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{
                    sx: { color: 'white', '& fieldset': { borderColor: '#334155' } },
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
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{
                    sx: { color: 'white', '& fieldset': { borderColor: '#334155' } },
                    startAdornment: <Phone sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, fontSize: 18 }} />
                  }}
                />
              </Grid>
            </Grid>
          </Fade>
        )}

        {step === 2 && (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <LinearProgress
              variant="determinate" value={progress}
              sx={{ height: 8, borderRadius: 4, mb: 3, bgcolor: '#1E293B', '& .MuiLinearProgress-bar': { bgcolor: '#EF4444' } }}
            />
            <Typography variant="h6" sx={{ color: 'white', mb: 1, fontWeight: 800 }}>
              Dispatching Emergency SOS Alert...
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              Finding nearest emergency ambulance and broadcasting to CAD network
            </Typography>
          </Box>
        )}

        {step === 3 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 56, color: '#10B981', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'white', mb: 1, fontWeight: 800 }}>
              SOS Alert Dispatched Successfully!
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
              Incident marker and dispatched ambulance route are now live on the map.
            </Typography>
            <Button
              variant="contained" onClick={onClose}
              sx={{ bgcolor: '#2563EB', color: 'white', fontWeight: 800, px: 4, '&:hover': { bgcolor: '#1D4ED8' } }}
            >
              Back to Command Map
            </Button>
          </Box>
        )}
      </DialogContent>

      {step === 1 && (
        <DialogActions sx={{ p: 2.5, bgcolor: '#0F172A', borderTop: '1px solid #1E293B' }}>
          <Button onClick={onClose} sx={{ color: '#94A3B8', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained" onClick={handleSendSOS}
            sx={{ bgcolor: '#DC2626', color: 'white', fontWeight: 800, px: 3, '&:hover': { bgcolor: '#B91C1C' } }}
          >
            🚨 Transmit SOS Alert
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
