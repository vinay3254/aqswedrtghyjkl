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
    locationLat: '12.9716',
    locationLng: '77.5946',
    callerName: '',
    callerPhone: '',
    description: '',
    patientsCount: 1,
  });
  const [errors, setErrors] = useState({});
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');

  useEffect(() => {
    if (open) {
      setStep(1);
      setProgress(0);
      setForm({
        incidentType: 'Cardiac Arrest',
        severity: 'CRITICAL',
        locationAddress: 'Palace Grounds, Jayamahal, Bengaluru',
        locationLat: '12.9982',
        locationLng: '77.5921',
        callerName: 'Security Control',
        callerPhone: '+91 98450 11223',
        description: 'Critical emergency SOS triggered via command portal',
        patientsCount: 1,
      });
      setErrors({});
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

          // Robust check for accidental [lng, lat] coordinate inversion
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
            location_address: form.locationAddress || 'Bengaluru',
            location_lat: latVal,
            location_lng: lngVal,
            latitude: latVal,
            longitude: lngVal,
            caller_name: form.callerName || 'Emergency Caller',
            caller_phone: form.callerPhone || '+91 98765 43210',
            description: form.description || 'Emergency SOS broadcast',
            patients_count: form.patientsCount || 1,
            created_at: new Date().toISOString(),
            is_sos: true,
          };

          console.log('[SOS Alert] Created Incident Object with Validated Coordinates:', newIncident);
          onSOSCreated?.(newIncident);
          setStep(3);
        }
      }, 35);
      return () => clearInterval(timer);
    }
  }, [step, form, onSOSCreated]);

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
            Dispatches nearest ambulance unit & creates high-priority map incident
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

              {/* Bengaluru Quick Landmark Presets */}
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: '#94A3B8', mb: 0.8, display: 'block', fontWeight: 700 }}>
                  Quick Bengaluru Landmarks:
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

              {/* Location Address */}
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Location Address" size="small"
                  value={form.locationAddress}
                  onChange={e => setForm(f => ({ ...f, locationAddress: e.target.value }))}
                  error={!!errors.locationAddress}
                  helperText={errors.locationAddress}
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                />
              </Grid>

              {/* Latitude and Longitude */}
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Latitude (e.g. 12.9716)" size="small"
                  value={form.locationLat}
                  onChange={e => setForm(f => ({ ...f, locationLat: e.target.value }))}
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Longitude (e.g. 77.5946)" size="small"
                  value={form.locationLng}
                  onChange={e => setForm(f => ({ ...f, locationLng: e.target.value }))}
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
                />
              </Grid>

              {/* Caller Info */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Caller Name" size="small"
                  value={form.callerName}
                  onChange={e => setForm(f => ({ ...f, callerName: e.target.value }))}
                  InputLabelProps={{ sx: { color: '#94A3B8' } }}
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
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
                  InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: '#334155' } } }}
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
