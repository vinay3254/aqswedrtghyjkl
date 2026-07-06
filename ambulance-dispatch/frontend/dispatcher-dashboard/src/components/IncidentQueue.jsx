import React from 'react';
import { Box, Typography } from '@mui/material';

/* ── Evergreen colour tokens ── */
const G      = '#8EB69B';
const TEXT   = '#DAF1DE';
const DIM    = 'rgba(218,241,222,0.50)';
const FAINT  = 'rgba(218,241,222,0.30)';
const RED    = '#E25C50';
const AMBER  = '#E3A94F';
const SURF   = 'rgba(142,182,155,0.055)';
const BRD    = 'rgba(142,182,155,0.09)';

const SEV_DOT = { CRITICAL: RED, HIGH: AMBER, MEDIUM: G, LOW: G };

const STATUS_CFG = {
  PENDING:     { color: AMBER, bg: 'rgba(227,169,79,0.18)',   label: 'Pending' },
  ACKNOWLEDGED:{ color: G,     bg: 'rgba(142,182,155,0.16)', label: 'Acknowledged' },
  DISPATCHED:  { color: G,     bg: 'rgba(142,182,155,0.16)', label: 'Dispatched' },
  EN_ROUTE:    { color: G,     bg: 'rgba(142,182,155,0.16)', label: 'En Route' },
  ON_SCENE:    { color: G,     bg: 'rgba(142,182,155,0.16)', label: 'On Scene' },
  TRANSPORTING:{ color: G,     bg: 'rgba(142,182,155,0.16)', label: 'Transport' },
  AT_HOSPITAL: { color: G,     bg: 'rgba(142,182,155,0.16)', label: 'Hospital' },
  RESOLVED:    { color: FAINT, bg: 'rgba(255,255,255,0.06)', label: 'Resolved' },
  CANCELLED:   { color: FAINT, bg: 'rgba(255,255,255,0.06)', label: 'Cancelled' },
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

export default function IncidentQueue({ incidents, onSelect, selectedId, filter = 'active' }) {
  const filtered = incidents.filter(i => {
    if (filter === 'active')   return !['RESOLVED','CANCELLED'].includes(i.status);
    if (filter === 'pending')  return ['PENDING','ACKNOWLEDGED'].includes(i.status);
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const order = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 };
    const da = order[a.severity] ?? 9, db = order[b.severity] ?? 9;
    if (da !== db) return da - db;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (sorted.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: FAINT, fontSize: 13 }}>No incidents</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: '0 10px 10px' }}>
      {sorted.map(inc => {
        const dot    = SEV_DOT[inc.severity] || G;
        const st     = STATUS_CFG[inc.status] || STATUS_CFG.PENDING;
        const isSelected = inc.id === selectedId;
        return (
          <Box
            key={inc.id}
            onClick={() => onSelect(inc)}
            sx={{
              p: '12px',
              borderRadius: '12px',
              mb: '7px',
              cursor: 'pointer',
              background: isSelected ? 'rgba(142,182,155,0.10)' : SURF,
              border: `1px solid ${isSelected ? 'rgba(142,182,155,0.35)' : BRD}`,
              transition: 'all 0.15s',
              '&:hover': { background: 'rgba(142,182,155,0.08)', borderColor: 'rgba(142,182,155,0.20)' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '6px' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dot }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, flex: 1 }} noWrap>
                {inc.incident_type}
              </Typography>
              <Box sx={{
                fontSize: 10, fontWeight: 700, px: '8px', py: '3px', borderRadius: '6px',
                color: st.color, background: st.bg, letterSpacing: '0.04em',
              }}>
                {st.label}
              </Box>
            </Box>
            <Typography sx={{ fontSize: 11.5, color: DIM, pl: '16px' }} noWrap>
              {inc.location_address || `${inc.location_lat?.toFixed(4)}, ${inc.location_lng?.toFixed(4)}`}
              {' · '}
              {inc.created_at ? timeAgo(inc.created_at) : ''}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
