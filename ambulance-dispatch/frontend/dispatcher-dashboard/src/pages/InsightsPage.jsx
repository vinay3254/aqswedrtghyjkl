import React, { useState } from 'react';
import {
  Box, Typography, Grid, Paper, Card, CardContent, Button,
  LinearProgress, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Alert
} from '@mui/material';
import {
  AutoAwesome, TrendingUp, LocalHospital, Place,
  DirectionsCar, Speed, Warning, CheckCircle, SwapHoriz,
  ElectricCar, AccessTime, LocalFireDepartment, MedicalServices
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

export default function InsightsPage() {
  const navigate = useNavigate();
  const [repositionedUnits, setRepositionedUnits] = useState({});
  const [selectedCondition, setSelectedCondition] = useState('Cardiac');
  const [simulatedCapacity, setSimulatedCapacity] = useState(false);

  const HOTSPOTS = [
    { zone: 'Koramangala 5th Block', riskScore: 88, predictedSurge: '+35%', peakTime: '17:00 - 20:30', primaryType: 'Cardiac & Trauma', recommendedUnits: 2, currentUnits: 1 },
    { zone: 'Indiranagar 100ft Road', riskScore: 82, predictedSurge: '+28%', peakTime: '18:00 - 21:00', primaryType: 'Road Traffic Accidents', recommendedUnits: 2, currentUnits: 2 },
    { zone: 'Whitefield - ITPL Corridor', riskScore: 74, predictedSurge: '+20%', peakTime: '16:30 - 19:30', primaryType: 'Respiratory & Stroke', recommendedUnits: 3, currentUnits: 1 },
    { zone: 'Hebbal - Airport Expressway', riskScore: 79, predictedSurge: '+31%', peakTime: '20:00 - 23:00', primaryType: 'High-Speed Trauma', recommendedUnits: 2, currentUnits: 1 },
    { zone: 'Electronic City Phase 1', riskScore: 68, predictedSurge: '+15%', peakTime: '17:30 - 20:00', primaryType: 'General Emergency', recommendedUnits: 2, currentUnits: 2 },
  ];

  const PRE_POSITIONS = [
    { id: 'pos-1', ambulanceId: 'Alpha-2', currentLoc: 'Jayanagar Base (Idle)', targetZone: 'Koramangala 5th Block', etaGain: '4.2 mins saved', rationale: 'High probability cardiac surge forecasted in next 45 mins due to high traffic density.' },
    { id: 'pos-2', ambulanceId: 'Bravo-3', currentLoc: 'MG Road Standby (Idle)', targetZone: 'Hebbal Flyover Junction', etaGain: '5.8 mins saved', rationale: 'Evening rush-hour bottleneck predicted on Bellary Road. Proximity lowers accident response latency.' },
    { id: 'pos-3', ambulanceId: 'Delta-1', currentLoc: 'Marathahalli Depot (Idle)', targetZone: 'Whitefield Main Hub', etaGain: '3.6 mins saved', rationale: 'Only 1 unit currently patrolling East corridor. Predicted deficit of 2 ALS ambulances.' },
  ];

  const HOSPITALS = [
    {
      name: 'Manipal Hospital - Old Airport Road',
      specialties: ['Cath Lab (24/7)', 'Level 1 Trauma', 'Comprehensive Stroke Center', 'NICU'],
      icuBeds: simulatedCapacity ? 0 : 4,
      erBeds: simulatedCapacity ? 1 : 8,
      ventilators: 3,
      bloodBank: 'A+, O+, B+, AB+',
      travelTime: '7 mins (Live Traffic: Low)',
      score: simulatedCapacity ? 62 : 96,
      status: simulatedCapacity ? 'NEAR CAPACITY (FALLBACK ACTIVE)' : 'OPTIMAL MATCH'
    },
    {
      name: 'Apollo Hospital - Bannerghatta Road',
      specialties: ['Cath Lab (24/7)', 'Stroke Center', 'Emergency ICU', 'Cardiac Surgery'],
      icuBeds: 6,
      erBeds: 12,
      ventilators: 5,
      bloodBank: 'All Groups Available',
      travelTime: '11 mins (Live Traffic: Moderate)',
      score: 91,
      status: 'HIGHLY RECOMMENDED'
    },
    {
      name: 'NIMHANS - Neuro & Emergency Block',
      specialties: ['Advanced Neuro-Trauma', 'CT/MRI (24/7)', 'Stroke Unit', 'Psychiatric ER'],
      icuBeds: 2,
      erBeds: 5,
      ventilators: 2,
      bloodBank: 'O-, A+, B+',
      travelTime: '14 mins (Live Traffic: Moderate)',
      score: 84,
      status: 'SPECIALTY MATCH'
    },
    {
      name: 'Fortis Hospital - Cunningham Road',
      specialties: ['Interventional Cardiology', 'Pediatric ER', 'Acute Stroke'],
      icuBeds: 3,
      erBeds: 7,
      ventilators: 2,
      bloodBank: 'Available',
      travelTime: '16 mins (Live Traffic: High)',
      score: 76,
      status: 'SECONDARY ALTERNATIVE'
    }
  ];

  const handleReposition = (id) => {
    setRepositionedUnits(prev => ({ ...prev, [id]: true }));
  };

  return (
    <Box sx={{ bgcolor: '#F8FAFC', minHeight: '100vh', color: TEXT }}>
      <TopNav />
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AutoAwesome sx={{ color: G, fontSize: 20 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: TEXT }}>
                AI Insights & Predictive Optimization
              </Typography>
            </Box>
            <Typography sx={{ color: DIM, fontSize: 13, mt: 0.5 }}>
              Real-time machine learning models for demand forecasting, dynamic fleet staging, and multi-criteria hospital matching.
            </Typography>
          </Box>
          <Button
            variant="outlined" onClick={() => navigate('/')}
            sx={{ borderColor: BRD, color: TEXT, fontWeight: 700, textTransform: 'none', borderRadius: '10px' }}
          >
            ← Back to Live Command
          </Button>
        </Box>

        {/* Top Banner: Predictive AI Accuracy */}
        <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, mb: 4, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Forecast Model</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: G, mt: 0.5 }}>DeepSpatial-EM 4.2</Typography>
                <Typography sx={{ fontSize: 11, color: DIM }}>Trained on 45,000+ Bengaluru Emergency Runs</Typography>
              </Grid>
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Response Time Reduction</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: GREEN, mt: 0.5 }}>-34.8% Average</Typography>
              <Typography sx={{ fontSize: 11, color: DIM }}>From 12.4 mins down to 8.1 mins</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Capacity Match Precision</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: TEXT, mt: 0.5 }}>99.2% Zero Diversion</Typography>
              <Typography sx={{ fontSize: 11, color: DIM }}>Dynamic mid-route fallback active</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Active Staging Suggestions</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: AMBER, mt: 0.5 }}>3 Units Pre-Positioned</Typography>
              <Typography sx={{ fontSize: 11, color: DIM }}>Ready for peak evening shift</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Section 1 & 2: Hotspot Forecasting & Predictive Pre-Positioning */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Hotspot Demand Forecasting */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%', borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp sx={{ color: RED }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: TEXT }}>Dynamic Demand & Hotspot Forecast</Typography>
                </Box>
                <Chip label="NEXT 4 HOURS" size="small" sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: RED, fontWeight: 700, fontSize: 10 }} />
              </Box>
              <Typography sx={{ fontSize: 12, color: DIM, mb: 2.5 }}>
                High-probability emergency clusters predicted based on time-of-day traffic patterns and historical call density.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {HOTSPOTS.map((spot, i) => (
                  <Box key={i} sx={{ p: 2, borderRadius: '10px', border: `1px solid ${BRD}`, bgcolor: '#F8FAFC' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{spot.zone}</Typography>
                      <Chip
                        label={`Risk ${spot.riskScore}/100 (${spot.predictedSurge})`}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: 10,
                          bgcolor: spot.riskScore > 80 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                          color: spot.riskScore > 80 ? RED : AMBER
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: DIM, mb: 1.5, flexWrap: 'wrap' }}>
                      <span>Peak: <strong>{spot.peakTime}</strong></span>
                      <span>·</span>
                      <span>Primary: <strong>{spot.primaryType}</strong></span>
                      <span>·</span>
                      <span>Fleet Coverage: <strong>{spot.currentUnits}/{spot.recommendedUnits} Units</strong></span>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={spot.riskScore}
                      sx={{
                        height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                        '& .MuiLinearProgress-bar': { bgcolor: spot.riskScore > 80 ? RED : AMBER }
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Predictive Pre-Positioning Engine */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%', borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SwapHoriz sx={{ color: G }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: TEXT }}>Predictive Fleet Pre-Positioning</Typography>
                </Box>
                <Chip label="PROACTIVE STAGING" size="small" sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: G, fontWeight: 700, fontSize: 10 }} />
              </Box>
              <Typography sx={{ fontSize: 12, color: DIM, mb: 2.5 }}>
                AI staging suggestions to reposition idle units closer to forecasted emergency surge locations before calls occur.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {PRE_POSITIONS.map((pos) => {
                  const isDone = repositionedUnits[pos.id];
                  return (
                    <Box key={pos.id} sx={{ p: 2, borderRadius: '10px', border: `1px solid ${BRD}`, bgcolor: isDone ? 'rgba(16,185,129,0.04)' : '#F8FAFC' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DirectionsCar sx={{ color: isDone ? GREEN : G, fontSize: 18 }} />
                          <Typography sx={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{pos.ambulanceId}</Typography>
                        </Box>
                        <Chip
                          label={pos.etaGain}
                          size="small"
                          sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: GREEN, fontWeight: 700, fontSize: 10 }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 11.5, color: TEXT, mb: 0.5 }}>
                        Move from <strong>{pos.currentLoc}</strong> → <strong>{pos.targetZone}</strong>
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: DIM, mb: 1.5, lineHeight: 1.4 }}>
                        {pos.rationale}
                      </Typography>
                      <Button
                        variant={isDone ? 'outlined' : 'contained'}
                        size="small"
                        disabled={isDone}
                        onClick={() => handleReposition(pos.id)}
                        startIcon={isDone ? <CheckCircle sx={{ fontSize: 14 }} /> : <Speed sx={{ fontSize: 14 }} />}
                        sx={{
                          borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: 11,
                          bgcolor: isDone ? 'transparent' : G, color: isDone ? GREEN : '#fff',
                          borderColor: isDone ? GREEN : 'transparent'
                        }}
                      >
                        {isDone ? 'Unit En Route to Staging Point' : 'Approve & Dispatch to Staging Area'}
                      </Button>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Section 3: Smart Hospital Allocation Engine */}
      <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalHospital sx={{ color: GREEN }} />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: TEXT }}>Smart Hospital Allocation Engine</Typography>
                <Typography sx={{ fontSize: 12, color: DIM }}>Multi-criteria capability matching (Cath Lab, CT/MRI, ICU Beds, Trauma Bays, Ventilators)</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                variant={simulatedCapacity ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setSimulatedCapacity(!simulatedCapacity)}
                color={simulatedCapacity ? 'error' : 'primary'}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, borderRadius: '8px' }}
              >
                {simulatedCapacity ? 'Reset Capacity Simulation' : '⚡ Simulate 100% Primary ICU Capacity (Trigger Fallback)'}
              </Button>
            </Box>
          </Box>

          {simulatedCapacity && (
            <Alert severity="warning" sx={{ mb: 2.5, borderRadius: '10px', fontSize: 12 }}>
              <strong>Dynamic Fallback Triggered:</strong> Manipal Hospital ER reached 0 ICU beds mid-route. The allocation engine automatically repointed active Cardiac transports to Apollo Hospital (Score: 91).
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>HOSPITAL FACILITY</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>SPECIALTIES & ASSETS</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>LIVE CAPACITY</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>TRAVEL TIME (TRAFFIC)</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>AI MATCH SCORE</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: DIM }}>STATUS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {HOSPITALS.map((h, idx) => (
                  <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12.5, color: TEXT }}>{h.name}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {h.specialties.map((s, si) => (
                          <Chip key={si} label={s} size="small" sx={{ fontSize: 9.5, height: 20, bgcolor: '#F1F5F9', color: DIM }} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: h.icuBeds === 0 ? RED : GREEN }}>
                        ICU: {h.icuBeds} Beds · ER: {h.erBeds} Beds · Vents: {h.ventilators}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: DIM }}>Blood Bank: {h.bloodBank}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 11.5, color: TEXT, fontWeight: 600 }}>{h.travelTime}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: h.score > 90 ? GREEN : h.score > 75 ? G : RED }}>
                          {h.score}/100
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={h.status}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: 10,
                          bgcolor: h.score > 90 ? 'rgba(16,185,129,0.12)' : h.score > 75 ? 'rgba(37,99,235,0.12)' : 'rgba(239,68,68,0.12)',
                          color: h.score > 90 ? GREEN : h.score > 75 ? G : RED
                        }}
                      />
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
