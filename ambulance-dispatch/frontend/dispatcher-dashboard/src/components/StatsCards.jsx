import React from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import { 
  Warning, LocalTaxi, LocalHospital, AccessTime, 
  TrendingUp, CheckCircle 
} from '@mui/icons-material';

function StatCard({ title, value, subtitle, icon, color = 'primary' }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ 
          p: 1, 
          borderRadius: 2, 
          bgcolor: `${color}.light`,
          color: `${color}.dark`
        }}>
          {icon}
        </Box>
      </Box>
    </Paper>
  );
}

export default function StatsCards({ stats, incidents, ambulances, hospitals }) {
  const activeIncidents = incidents?.filter(i => !['RESOLVED', 'CANCELLED'].includes(i.status)).length || 0;
  const criticalIncidents = incidents?.filter(i => i.severity === 'CRITICAL' && !['RESOLVED', 'CANCELLED'].includes(i.status)).length || 0;
  const availableAmbulances = ambulances?.filter(a => a.status === 'AVAILABLE').length || 0;
  const totalAmbulances = ambulances?.length || 0;
  const avgResponseTime = stats?.avgResponseTime || '8.5';

  return (
    <Grid container spacing={2}>
      <Grid item xs={6} sm={4} md={2}>
        <StatCard
          title="Active Incidents"
          value={activeIncidents}
          subtitle={`${criticalIncidents} critical`}
          icon={<Warning />}
          color="error"
        />
      </Grid>
      
      <Grid item xs={6} sm={4} md={2}>
        <StatCard
          title="Available Units"
          value={availableAmbulances}
          subtitle={`of ${totalAmbulances} total`}
          icon={<LocalTaxi />}
          color="success"
        />
      </Grid>
      
      <Grid item xs={6} sm={4} md={2}>
        <StatCard
          title="Hospitals"
          value={hospitals?.length || 0}
          subtitle="in network"
          icon={<LocalHospital />}
          color="info"
        />
      </Grid>
      
      <Grid item xs={6} sm={4} md={2}>
        <StatCard
          title="Avg Response"
          value={`${avgResponseTime}m`}
          subtitle="last hour"
          icon={<AccessTime />}
          color="warning"
        />
      </Grid>
      
      <Grid item xs={6} sm={4} md={2}>
        <StatCard
          title="Today"
          value={stats?.todayResolved || 0}
          subtitle="resolved"
          icon={<CheckCircle />}
          color="success"
        />
      </Grid>
      
      <Grid item xs={6} sm={4} md={2}>
        <StatCard
          title="Improvement"
          value={`${stats?.improvement || 23}%`}
          subtitle="vs manual"
          icon={<TrendingUp />}
          color="primary"
        />
      </Grid>
    </Grid>
  );
}
