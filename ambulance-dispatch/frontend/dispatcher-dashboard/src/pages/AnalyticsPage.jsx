import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button,
  LinearProgress, Chip, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Assessment, Timer, LocalShipping, PieChart as PieIcon,
  CheckCircle, Warning, TrendingDown, Speed
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';

const G = '#2563EB';
const RED = '#EF4444';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const PURPLE = '#8B5CF6';
const TEXT = '#0F172A';
const DIM = '#475569';
const BRD = '#E2E8F0';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState('7d');

  const SLA_HOURLY = [
    { hour: '00:00', avgDispatch: 1.2, avgScene: 6.8, targetSLA: 8.0, compliance: 96 },
    { hour: '04:00', avgDispatch: 1.0, avgScene: 5.9, targetSLA: 8.0, compliance: 98 },
    { hour: '08:00', avgDispatch: 2.1, avgScene: 8.4, targetSLA: 8.0, compliance: 88 },
    { hour: '12:00', avgDispatch: 1.8, avgScene: 7.6, targetSLA: 8.0, compliance: 92 },
    { hour: '16:00', avgDispatch: 2.3, avgScene: 9.1, targetSLA: 8.0, compliance: 84 },
    { hour: '18:00', avgDispatch: 2.8, avgScene: 9.8, targetSLA: 8.0, compliance: 81 },
    { hour: '20:00', avgDispatch: 2.2, avgScene: 8.2, targetSLA: 8.0, compliance: 89 },
    { hour: '22:00', avgDispatch: 1.5, avgScene: 7.1, targetSLA: 8.0, compliance: 94 },
  ];

  const CATEGORY_DATA = [
    { name: 'Cardiac Emergencies', value: 34, color: RED },
    { name: 'Trauma & Road Accidents', value: 28, color: AMBER },
    { name: 'Respiratory Distress', value: 16, color: G },
    { name: 'Acute Stroke', value: 12, color: PURPLE },
    { name: 'Maternity & Pediatric', value: 6, color: '#EC4899' },
    { name: 'General Medical', value: 4, color: '#64748B' },
  ];

  const DISTRICT_DATA = [
    { district: 'Bengaluru East (Indiranagar/Whitefield)', calls: 142, avgResponse: '7.4m', critical: 48 },
    { district: 'Bengaluru South (Koramangala/Jayanagar)', calls: 128, avgResponse: '7.8m', critical: 42 },
    { district: 'Bengaluru Central (MG Rd/Shivajinagar)', calls: 98, avgResponse: '8.1m', critical: 31 },
    { district: 'Bengaluru North (Hebbal/Yelahanka)', calls: 86, avgResponse: '8.9m', critical: 26 },
    { district: 'Bengaluru West (Rajajinagar/Malleshwaram)', calls: 74, avgResponse: '8.4m', critical: 22 },
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
              <Assessment sx={{ color: G, fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: TEXT }}>
              Analytics, Response Metrics & SLA Monitoring
            </Typography>
          </Box>
          <Typography sx={{ color: DIM, fontSize: 13, mt: 0.5 }}>
            Golden-Hour SLA benchmarks, fleet turnaround telemetry, and volume distribution across Bengaluru districts.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select
              value={timeframe} onChange={(e) => setTimeframe(e.target.value)}
              sx={{ bgcolor: '#fff', borderRadius: '10px', fontSize: 12, fontWeight: 700 }}
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined" onClick={() => navigate('/')}
            sx={{ borderColor: BRD, color: TEXT, fontWeight: 700, textTransform: 'none', borderRadius: '10px' }}
          >
            ← Back to Live Command
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Avg Dispatch-to-Scene</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: GREEN }}>7.9 mins</Typography>
                <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>▼ 1.2m vs target</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: DIM, mt: 0.5 }}>SLA Target: &lt; 8.0 mins</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Golden Hour Compliance</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: G }}>92.4%</Typography>
                <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>▲ 4.1%</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: DIM, mt: 0.5 }}>Scene-to-ER Target: &lt; 15 mins</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Fleet Utilization Rate</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: TEXT }}>78.6%</Typography>
                <Typography sx={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>Optimal</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: DIM, mt: 0.5 }}>Avg turnaround: 22.4 mins</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase' }}>Total Emergencies Handled</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: TEXT }}>528 Calls</Typography>
                <Typography sx={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>100% Resolved</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: DIM, mt: 0.5 }}>Zero diversion rate</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* SLA & Time Trends Chart */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: TEXT }}>Hourly Response Time vs. SLA Target</Typography>
                  <Typography sx={{ fontSize: 11.5, color: DIM }}>Dispatch-to-Scene performance tracked through 24-hour shift cycle</Typography>
                </Box>
                <Chip label="SLA THRESHOLD: 8.0 MINS" size="small" sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: G, fontWeight: 700, fontSize: 10 }} />
              </Box>
              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={SLA_HOURLY} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} domain={[0, 12]} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="avgScene" name="Actual Response (mins)" stroke={G} strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="targetSLA" name="SLA Benchmark (8m)" stroke={RED} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Emergency Distribution by Category */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%', borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, color: TEXT }}>Emergency Volume Breakdown</Typography>
              <Typography sx={{ fontSize: 11.5, color: DIM, mb: 1.5 }}>Distribution by clinical category</Typography>
              <Box sx={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={CATEGORY_DATA} innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                      {CATEGORY_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1 }}>
                {CATEGORY_DATA.map((c, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color }} />
                    <Typography sx={{ fontSize: 10.5, color: DIM, truncate: true }}>{c.name} ({c.value}%)</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* District Zone Breakdown */}
      <Card sx={{ borderRadius: '14px', border: `1px solid ${BRD}`, bgcolor: '#FFFFFF', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15, color: TEXT, mb: 0.5 }}>Bengaluru District Zone Volume & SLA Performance</Typography>
          <Typography sx={{ fontSize: 12, color: DIM, mb: 2.5 }}>Zonal metrics covering response times, total call volumes, and high-acuity critical dispatches</Typography>
          <Grid container spacing={2}>
            {DISTRICT_DATA.map((d, idx) => (
              <Grid item xs={12} md={4} key={idx}>
                <Box sx={{ p: 2, borderRadius: '10px', border: `1px solid ${BRD}`, bgcolor: '#F8FAFC' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{d.district}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                    <Typography sx={{ fontSize: 11, color: DIM }}>Total Calls: <strong>{d.calls}</strong></Typography>
                    <Typography sx={{ fontSize: 11, color: G, fontWeight: 700 }}>Avg ETA: {d.avgResponse}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography sx={{ fontSize: 11, color: RED }}>Critical Runs: <strong>{d.critical}</strong></Typography>
                    <Chip label="SLA MET" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: GREEN, fontSize: 9.5, height: 18, fontWeight: 700 }} />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
      </Box>
    </Box>
  );
}
