import React, { useState } from 'react';
import { Box, Typography, Button, IconButton, Chip, Tooltip } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { DirectionsCar, Logout, Person, Refresh } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import FleetRosterModal from './FleetRosterModal';

const G = '#2563EB';
const TEXT = '#0F172A';
const DIM = '#475569';
const BORDER = '#E2E8F0';

export default function TopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, profile, signOut, isDispatcher } = useAuth();
  const [rosterOpen, setRosterOpen] = useState(false);

  const navItems = [
    { label: 'Live Command', path: '/' },
    { label: 'Caller Portal 🎙️', path: '/caller' },
    { label: 'AI Insights', path: '/insights' },
    { label: 'Analytics & SLAs', path: '/analytics' },
    { label: 'Fleet Telemetry', path: '/mobile' },
  ];

  return (
    <>
      <Box sx={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '10px', px: '16px',
        background: '#FFFFFF',
        borderBottom: `1px solid ${BORDER}`,
        zIndex: 200, overflow: 'hidden',
      }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <Box sx={{ width:32, height:32, borderRadius:'9px', background:'rgba(37,99,235,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.5v11M2.5 8h11" stroke={G} strokeWidth="2.6" strokeLinecap="round"/>
            </svg>
          </Box>
          <Typography sx={{ fontSize:13, fontWeight:800, color:TEXT, whiteSpace:'nowrap', mr: 1 }}>
            Dispatch Center
          </Typography>
        </Box>

        {/* Global Navigation Tabs */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path === '/' && (pathname === '' || pathname === '/#/' || pathname === '/'));
            return (
              <Button
                key={item.path}
                size="small"
                onClick={() => navigate(item.path)}
                sx={{
                  px: '12px', py: '5px', borderRadius: '8px',
                  bgcolor: isActive ? 'rgba(37,99,235,0.12)' : 'transparent',
                  color: isActive ? G : DIM,
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '11.5px',
                  textTransform: 'none',
                  '&:hover': { bgcolor: isActive ? 'rgba(37,99,235,0.16)' : '#F1F5F9', color: TEXT }
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Fleet & Driver Roster Management Button (Dispatchers Only) */}
        {isDispatcher && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => setRosterOpen(true)}
            startIcon={<DirectionsCar sx={{ fontSize: 16 }} />}
            sx={{
              px: '12px', py: '5px', borderRadius: '8px',
              borderColor: '#38BDF8', color: '#0284C7',
              bgcolor: 'rgba(56,189,248,0.08)',
              fontWeight: 700, fontSize: '11.5px',
              textTransform: 'none',
              '&:hover': { bgcolor: 'rgba(56,189,248,0.15)', borderColor: '#0284C7' }
            }}
          >
            Fleet & Driver Roster
          </Button>
        )}

        {/* Driver view */}
        <Button
          onClick={() => window.open('/#/driver', '_blank')}
          sx={{ px:'10px', py:'6px', borderRadius:'8px', border:`1px solid ${BORDER}`, color:TEXT, fontWeight:600, fontSize:'11px', flexShrink:0, textTransform: 'none', '&:hover':{ background:'#F1F5F9' } }}
        >
          Driver View ↗
        </Button>

        {/* User Session Profile & Logout */}
        {profile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1, borderLeft: `1px solid ${BORDER}` }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 800, color: TEXT, lineHeight: 1.1 }}>
                {profile.full_name || 'CAD Operator'}
              </Typography>
              <Chip
                label={profile.role || 'DISPATCHER'}
                size="small"
                sx={{ height: 16, fontSize: '8.5px', fontWeight: 800, bgcolor: 'rgba(37,99,235,0.1)', color: G }}
              />
            </Box>
            <Tooltip title="Sign Out">
              <IconButton size="small" onClick={signOut} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                <Logout sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Fleet & Driver Roster Management Modal */}
      <FleetRosterModal
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        onRosterUpdated={() => {}}
      />
    </>
  );
}
