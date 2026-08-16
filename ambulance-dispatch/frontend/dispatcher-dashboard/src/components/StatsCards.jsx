import React from 'react';
import { Box, Typography } from '@mui/material';

const G = '#2563EB';
const TEXT = '#0F172A';
const DIM = '#64748B';
const RED  = '#E25C50';
const AMB  = '#E3A94F';
const GLASS_BG = '#FFFFFF';
const GLASS_BRD = '#E2E8F0';

function StatCard({ label, value, sub, subColor }) {
  return (
    <Box sx={{
      flex: 1,
      background: GLASS_BG,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${GLASS_BRD}`,
      borderRadius: '12px',
      p: '10px 14px',
    }}>
      <Typography sx={{ fontSize: 10, color: DIM, letterSpacing: '0.06em', mb: '3px', fontWeight: 600 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT, lineHeight: 1 }}>
          {value}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: subColor || DIM, lineHeight: 1 }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function StatsCards({ stats, incidents, ambulances, hospitals }) {
  const activeCount    = incidents?.filter(i => !['RESOLVED','CANCELLED'].includes(i.status)).length ?? 0;
  const criticalCount  = incidents?.filter(i => i.severity === 'CRITICAL' && !['RESOLVED','CANCELLED'].includes(i.status)).length ?? 0;
  const availableCount = ambulances?.filter(a => a.status === 'AVAILABLE').length ?? 0;
  const totalAmbs      = ambulances?.length ?? 0;
  const avgResp        = stats?.avgResponseTime ?? '8.5';
  const resolved       = stats?.todayResolved ?? 12;
  const improvement    = stats?.improvement ?? 23;

  return (
    <Box sx={{ display: 'flex', gap: '10px', alignItems: 'stretch', width: '100%' }}>
      <StatCard
        label="ACTIVE"
        value={activeCount}
        sub={criticalCount > 0 ? `· ${criticalCount} critical` : undefined}
        subColor={RED}
      />
      <StatCard
        label="AVAILABLE"
        value={availableCount}
        sub={`of ${totalAmbs}`}
        subColor={DIM}
      />
      <StatCard
        label="AVG RESPONSE"
        value={`${avgResp}m`}
      />
      <StatCard
        label="RESOLVED TODAY"
        value={resolved}
        sub={`▲${improvement}%`}
        subColor={G}
      />
    </Box>
  );
}
