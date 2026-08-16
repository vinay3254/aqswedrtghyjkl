import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

const G      = '#2563EB';
const TEXT   = '#0F172A';
const DIM    = '#475569';
const FAINT  = '#94A3B8';
const RED    = '#EF4444';
const AMBER  = '#F59E0B';
const GREEN  = '#10B981';
const PURPLE = '#8B5CF6';
const PINK   = '#EC4899';
const SURF   = '#FFFFFF';
const BRD    = '#E2E8F0';

const SEV_DOT = { CRITICAL: RED, HIGH: AMBER, MEDIUM: G, LOW: GREEN };

const STATUS_CFG = {
  PENDING:     { color: AMBER, bg: 'rgba(245,158,11,0.14)',   label: 'Pending' },
  ACKNOWLEDGED:{ color: G,     bg: 'rgba(37,99,235,0.12)', label: 'Acknowledged' },
  DISPATCHED:  { color: G,     bg: 'rgba(37,99,235,0.12)', label: 'Dispatched' },
  EN_ROUTE:    { color: G,     bg: 'rgba(37,99,235,0.12)', label: 'En Route' },
  ON_SCENE:    { color: PURPLE, bg: 'rgba(139,92,246,0.12)', label: 'On Scene' },
  TRANSPORTING:{ color: RED,   bg: 'rgba(239,68,68,0.12)', label: 'In Transit' },
  AT_HOSPITAL: { color: GREEN, bg: 'rgba(16,185,129,0.12)', label: 'Hospital' },
  RESOLVED:    { color: FAINT, bg: '#F1F5F9', label: 'Resolved' },
  CANCELLED:   { color: FAINT, bg: '#F1F5F9', label: 'Cancelled' },
};

function getTriageCategory(type = '') {
  const t = type.toLowerCase();
  if (t.includes('cardiac') || t.includes('heart') || t.includes('chest')) return { name: 'Cardiac', color: RED };
  if (t.includes('accident') || t.includes('trauma') || t.includes('fall') || t.includes('fracture')) return { name: 'Trauma', color: AMBER };
  if (t.includes('breath') || t.includes('respiratory') || t.includes('asthma') || t.includes('choking')) return { name: 'Respiratory', color: G };
  if (t.includes('stroke') || t.includes('paralysis') || t.includes('slur')) return { name: 'Stroke', color: PURPLE };
  if (t.includes('maternity') || t.includes('labor') || t.includes('birth') || t.includes('child')) return { name: 'Maternity', color: PINK };
  return { name: 'General', color: '#64748B' };
}

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
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
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
        const dot = SEV_DOT[inc.severity] || G;
        const st = STATUS_CFG[inc.status] || STATUS_CFG.PENDING;
        const triage = getTriageCategory(inc.incident_type);
        const isSelected = inc.id === selectedId;

        return (
          <Box
            key={inc.id}
            onClick={() => onSelect(inc)}
            sx={{
              p: '12px',
              borderRadius: '12px',
              mb: '8px',
              cursor: 'pointer',
              background: isSelected ? 'rgba(37,99,235,0.06)' : SURF,
              border: `1px solid ${isSelected ? G : BRD}`,
              boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.12)' : 'none',
              transition: 'all 0.15s',
              '&:hover': { background: '#F8FAFC', borderColor: G },
            }}
          >
            {/* Header: Dot + Title + Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '6px' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dot, animation: inc.severity === 'CRITICAL' ? 'blinkDot 1.5s infinite' : 'none' }} />
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: TEXT, flex: 1 }} noWrap>
                {inc.incident_type}
              </Typography>
              <Box sx={{
                fontSize: 9.5, fontWeight: 700, px: '7px', py: '2px', borderRadius: '6px',
                color: st.color, background: st.bg, letterSpacing: '0.04em', textTransform: 'uppercase'
              }}>
                {st.label}
              </Box>
            </Box>

            {/* Triage Badge & Elapsed Time */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', mb: '6px', pl: '16px', flexWrap: 'wrap' }}>
              <Chip
                label={triage.name}
                size="small"
                sx={{
                  height: 18, fontSize: 9, fontWeight: 800,
                  bgcolor: `${triage.color}15`, color: triage.color, border: `1px solid ${triage.color}35`
                }}
              />
              <Chip
                label={inc.severity || 'HIGH'}
                size="small"
                sx={{
                  height: 18, fontSize: 9, fontWeight: 800,
                  bgcolor: `${dot}15`, color: dot
                }}
              />
              <Typography sx={{ fontSize: 10.5, color: inc.severity === 'CRITICAL' ? RED : DIM, fontWeight: 600 }}>
                ⏱ {inc.created_at ? timeAgo(inc.created_at) : '1m ago'}
              </Typography>
            </Box>

            {/* Address */}
            <Typography sx={{ fontSize: 11, color: DIM, pl: '16px' }} noWrap>
              {inc.location_address || `${inc.location_lat?.toFixed(4)}, ${inc.location_lng?.toFixed(4)}`}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
