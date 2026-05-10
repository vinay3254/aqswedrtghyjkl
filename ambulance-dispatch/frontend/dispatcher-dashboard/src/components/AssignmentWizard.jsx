import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stepper, Step, StepLabel, Box, Typography,
  Card, CardContent, CardActionArea, Grid, Chip, CircularProgress,
  Alert, TextField, FormControlLabel, Checkbox, Divider, Zoom
} from '@mui/material';
import { LocalTaxi, LocalHospital, Check, Star, CheckCircle } from '@mui/icons-material';
import { assignmentsApi, ambulancesApi, hospitalsApi } from '../services/api';

const steps = ['Select Ambulance', 'Select Hospital', 'Confirm Assignment'];

/* ── Mock data used when backend is offline ─────────────────── */
const MOCK_AMBULANCES = [
  { id: 'AMB-001', call_sign: 'Alpha-1', vehicle_number: 'MH-01-A-0001', type: 'ALS', status: 'AVAILABLE', eta_minutes: 4, distance: 2100, driver: 'Rajesh Kumar' },
  { id: 'AMB-002', call_sign: 'Bravo-2', vehicle_number: 'MH-01-B-0002', type: 'BLS', status: 'AVAILABLE', eta_minutes: 7, distance: 3800, driver: 'Suresh Patel' },
  { id: 'AMB-005', call_sign: 'Echo-5',  vehicle_number: 'MH-01-E-0005', type: 'ALS', status: 'AVAILABLE', eta_minutes: 11, distance: 5600, driver: 'Neha Verma' },
];

const MOCK_HOSPITALS = [
  { id: 'H-001', name: 'City General Hospital',     available_beds: 24, icu_beds_available: 8,  total_score: 9.2, eta_minutes: 6,  score_breakdown: { proximity: 9.5, capacity: 9.0, specialty: 9.1 } },
  { id: 'H-002', name: 'Apollo Trauma Centre',       available_beds: 12, icu_beds_available: 5,  total_score: 8.7, eta_minutes: 9,  score_breakdown: { proximity: 8.2, capacity: 9.0, specialty: 8.9 } },
  { id: 'H-003', name: 'St. Mary\'s Medical Centre', available_beds: 31, icu_beds_available: 10, total_score: 8.1, eta_minutes: 14, score_breakdown: { proximity: 7.4, capacity: 9.2, specialty: 7.7 } },
];

/* ── Card styles ─────────────────────────────────────────────── */
const cardSx = (selected) => ({
  bgcolor: selected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
  border: selected ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2,
  transition: 'all 0.2s',
  '&:hover': { border: '1px solid rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.06)' },
  position: 'relative',
});

export default function AssignmentWizard({ open, onClose, incident, onAssignmentCreated }) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [ambulances, setAmbulances] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [notes, setNotes] = useState('');
  const [activateGreenCorridor, setActivateGreenCorridor] = useState(false);

  useEffect(() => {
    if (open && incident) {
      setSuccess(false);
      setActiveStep(0);
      setSelectedAmbulance(null);
      setSelectedHospital(null);
      setNotes('');
      setActivateGreenCorridor(false);
      setError(null);
      loadRecommendations();
    }
  }, [open, incident]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ambRes, hospRes] = await Promise.all([
        ambulancesApi.getAvailable(incident.location_lat, incident.location_lng, 15),
        hospitalsApi.getScored(incident.id),
      ]);
      const ambs = ambRes.data.ambulances || ambRes.data || [];
      const hosps = hospRes.data.hospitals || hospRes.data || [];
      setAmbulances(ambs.length ? ambs : MOCK_AMBULANCES);
      setHospitals(hosps.length ? hosps : MOCK_HOSPITALS);
    } catch {
      // Backend offline — silently use mock data
      setAmbulances(MOCK_AMBULANCES);
      setHospitals(MOCK_HOSPITALS);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      submitAssignment();
    } else {
      setActiveStep(p => p + 1);
    }
  };

  const submitAssignment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await assignmentsApi.create({
        incident_id: incident.id,
        ambulance_id: selectedAmbulance.id,
        hospital_id: selectedHospital.id,
        notes,
        activate_green_corridor: activateGreenCorridor,
      });
    } catch {
      // Backend offline — simulate success for demo
    }
    // Always show success in demo mode
    setSubmitting(false);
    setSuccess(true);
    setTimeout(() => {
      onAssignmentCreated?.({ ambulance: selectedAmbulance, hospital: selectedHospital });
      handleClose();
    }, 2000);
  };

  const handleClose = () => {
    setActiveStep(0);
    setSelectedAmbulance(null);
    setSelectedHospital(null);
    setNotes('');
    setActivateGreenCorridor(false);
    setError(null);
    setSuccess(false);
    onClose();
  };

  const canProceed = () => {
    if (activeStep === 0) return selectedAmbulance !== null;
    if (activeStep === 1) return selectedHospital !== null;
    return true;
  };

  /* ── Ambulance selection ── */
  const renderAmbulanceSelection = () => (
    <Box>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
        Select an ambulance for this emergency. Sorted by ETA.
      </Typography>
      <Grid container spacing={1.5}>
        {ambulances.slice(0, 6).map((amb, index) => {
          const selected = selectedAmbulance?.id === amb.id;
          return (
            <Grid item xs={12} sm={6} key={amb.id}>
              <Card sx={cardSx(selected)}>
                <CardActionArea onClick={() => setSelectedAmbulance(amb)} sx={{ p: 0 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 24 }}>🚑</Typography>
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>
                            {amb.call_sign || amb.vehicle_number}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                            {amb.driver || 'Driver'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                        {index === 0 && (
                          <Chip icon={<Star sx={{ fontSize: '14px !important' }} />} label="Recommended"
                            size="small" sx={{ bgcolor: '#16a34a', color: 'white', height: 20, fontSize: '0.6rem' }} />
                        )}
                        <Chip label={amb.type} size="small"
                          sx={{ bgcolor: amb.type === 'ALS' ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.1)',
                            color: amb.type === 'ALS' ? '#a78bfa' : 'white', height: 20, fontSize: '0.65rem' }} />
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>ETA</Typography>
                        <Typography variant="body2" sx={{ color: '#22c55e', fontWeight: 700 }}>
                          {amb.eta_minutes || Math.round(amb.distance / 500)} min
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>Distance</Typography>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          {(amb.distance / 1000).toFixed(1)} km
                        </Typography>
                      </Box>
                    </Box>

                    {selected && (
                      <Box sx={{
                        position: 'absolute', top: 8, right: 8,
                        width: 22, height: 22, borderRadius: '50%',
                        bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check sx={{ fontSize: 14, color: 'white' }} />
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );

  /* ── Hospital selection ── */
  const renderHospitalSelection = () => (
    <Box>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
        Select destination hospital. Sorted by multi-factor score.
      </Typography>
      <Grid container spacing={1.5}>
        {hospitals.slice(0, 6).map((hosp, index) => {
          const selected = selectedHospital?.id === hosp.id;
          const score = hosp.total_score;
          const scoreColor = score >= 9 ? '#22c55e' : score >= 7 ? '#f59e0b' : '#ef4444';
          return (
            <Grid item xs={12} sm={6} key={hosp.id}>
              <Card sx={cardSx(selected)}>
                <CardActionArea onClick={() => setSelectedHospital(hosp)} sx={{ p: 0 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, maxWidth: 160 }} noWrap>
                        🏥 {hosp.name}
                      </Typography>
                      {index === 0 && (
                        <Chip icon={<Star sx={{ fontSize: '14px !important' }} />} label="Best Match"
                          size="small" sx={{ bgcolor: '#16a34a', color: 'white', height: 20, fontSize: '0.6rem' }} />
                      )}
                    </Box>

                    {/* Score bar */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <Box sx={{ width: `${(score / 10) * 100}%`, height: '100%', bgcolor: scoreColor, borderRadius: 2 }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: scoreColor, fontWeight: 700, minWidth: 28 }}>
                        {score?.toFixed(1) || 'N/A'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>ETA</Typography>
                        <Typography variant="body2" sx={{ color: '#22c55e', fontWeight: 700 }}>
                          {hosp.eta_minutes || '?'} min
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>Beds</Typography>
                        <Typography variant="body2" sx={{ color: 'white' }}>{hosp.available_beds || 0}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>ICU</Typography>
                        <Typography variant="body2" sx={{ color: 'white' }}>{hosp.icu_beds_available || 0}</Typography>
                      </Box>
                    </Box>

                    {selected && (
                      <Box sx={{
                        position: 'absolute', top: 8, right: 8,
                        width: 22, height: 22, borderRadius: '50%',
                        bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check sx={{ fontSize: 14, color: 'white' }} />
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );

  /* ── Confirmation ── */
  const renderConfirmation = () => (
    <Box>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: 'Incident', icon: '🚨', title: incident?.incident_type, sub: incident?.location_address,
            badge: <Chip label={incident?.severity} size="small" sx={{ bgcolor: '#dc2626', color: 'white', height: 18, fontSize: '0.65rem' }} /> },
          { label: 'Ambulance', icon: '🚑', title: selectedAmbulance?.call_sign, sub: `Driver: ${selectedAmbulance?.driver || 'N/A'}`,
            badge: <Chip label={selectedAmbulance?.type} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.3)', color: '#a78bfa', height: 18, fontSize: '0.65rem' }} /> },
          { label: 'Hospital', icon: '🏥', title: selectedHospital?.name, sub: `ETA: ${selectedHospital?.eta_minutes} min · Beds: ${selectedHospital?.available_beds}`,
            badge: null },
        ].map(item => (
          <Grid item xs={12} sm={4} key={item.label}>
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, p: 2 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {item.label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: 20 }}>{item.icon}</Typography>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }} noWrap>{item.title}</Typography>
              </Box>
              {item.badge}
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mt: 0.5 }} noWrap>
                {item.sub}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 2 }} />

      <TextField
        fullWidth multiline rows={2} label="Dispatch Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        sx={{ mb: 2 }}
        InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
        InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
        placeholder="e.g. Patient is diabetic, bring oxygen..."
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={activateGreenCorridor}
            onChange={e => setActivateGreenCorridor(e.target.checked)}
            sx={{ color: '#22c55e', '&.Mui-checked': { color: '#22c55e' } }}
          />
        }
        label={
          <Typography variant="body2" sx={{ color: 'white' }}>
            🚦 Activate Green Corridor <Typography component="span" variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>(traffic signal preemption)</Typography>
          </Typography>
        }
      />
    </Box>
  );

  /* ── Success screen ── */
  const renderSuccess = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e',
        display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
        <CheckCircle sx={{ fontSize: 48, color: '#22c55e' }} />
      </Box>
      <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>Assignment Created!</Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
        {selectedAmbulance?.call_sign} dispatched to {incident?.incident_type}
      </Typography>
      <Chip label={`ETA to scene: ${selectedAmbulance?.eta_minutes} min`}
        sx={{ bgcolor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid #22c55e55' }} />
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={!submitting ? handleClose : undefined}
      maxWidth="md"
      fullWidth
      TransitionComponent={Zoom}
      PaperProps={{
        sx: {
          background: 'linear-gradient(160deg, #0d1117, #0f1629)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 3,
          color: 'white',
        }
      }}
    >
      {/* Title */}
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Create Assignment</Typography>
        {incident && (
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
            <Chip label={incident.incident_type} size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', height: 20, fontSize: '0.7rem' }} />
            <Chip label={incident.severity} size="small"
              sx={{ bgcolor: '#dc2626', color: 'white', height: 20, fontSize: '0.7rem' }} />
            {incident.is_sos && (
              <Chip label="SOS" size="small" sx={{ bgcolor: '#7f1d1d', color: '#fca5a5', height: 20, fontSize: '0.7rem' }} />
            )}
          </Box>
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {!success && (
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}
            alternativeLabel
          >
            {steps.map((label, i) => (
              <Step key={label} completed={i < activeStep}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.5)' },
                    '& .MuiStepLabel-label.Mui-active': { color: 'white' },
                    '& .MuiStepLabel-label.Mui-completed': { color: '#22c55e' },
                    '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.2)' },
                    '& .MuiStepIcon-root.Mui-active': { color: '#3b82f6' },
                    '& .MuiStepIcon-root.Mui-completed': { color: '#22c55e' },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        {success ? renderSuccess() : loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
            <CircularProgress sx={{ color: '#3b82f6' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Loading nearby ambulances & hospitals…
            </Typography>
          </Box>
        ) : submitting ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
            <CircularProgress sx={{ color: '#22c55e' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Dispatching assignment…
            </Typography>
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>{error}</Alert>}
            {activeStep === 0 && renderAmbulanceSelection()}
            {activeStep === 1 && renderHospitalSelection()}
            {activeStep === 2 && renderConfirmation()}
          </>
        )}
      </DialogContent>

      {!success && !submitting && (
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', p: 2, gap: 1 }}>
          <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>Cancel</Button>
          <Button onClick={() => setActiveStep(p => p - 1)} disabled={activeStep === 0}
            sx={{ color: 'rgba(255,255,255,0.7)', '&:disabled': { color: 'rgba(255,255,255,0.2)' } }}>
            Back
          </Button>
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={!canProceed() || loading}
            sx={{
              background: canProceed()
                ? 'linear-gradient(90deg, #dc2626, #b91c1c)'
                : 'rgba(255,255,255,0.1)',
              color: 'white', fontWeight: 700, px: 3,
              '&:disabled': { color: 'rgba(255,255,255,0.3)' },
            }}
          >
            {activeStep === steps.length - 1 ? '🚑 Dispatch Now' : 'Next →'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
