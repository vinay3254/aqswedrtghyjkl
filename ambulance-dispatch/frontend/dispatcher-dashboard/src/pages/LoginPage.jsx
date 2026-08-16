import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box, Card, Typography, TextField, Button, Alert,
  Divider, Chip, InputAdornment, IconButton, CircularProgress
} from '@mui/material';
import {
  LocalHospital, Visibility, VisibilityOff, Lock,
  Email, Badge, Security, DirectionsCar, Radio
} from '@mui/icons-material';

const DEMO_ACCOUNTS = [
  {
    label: 'Dispatcher / CAD Operator',
    email: 'dispatcher@cad.emergency.in',
    role: 'DISPATCHER',
    desc: 'Full Command Center, AI dispatching, live fleet overview',
    badgeColor: '#38BDF8',
    icon: <Radio sx={{ fontSize: 16 }} />
  },
  {
    label: 'Driver: Alpha-1 (ALS)',
    email: 'driver.alpha1@cad.emergency.in',
    role: 'DRIVER',
    desc: 'Locked to Alpha-1 vehicle · Mission status & turn-by-turn HUD',
    badgeColor: '#10B981',
    icon: <DirectionsCar sx={{ fontSize: 16 }} />
  },
  {
    label: 'Driver: Charlie-3 (ALS)',
    email: 'driver.charlie3@cad.emergency.in',
    role: 'DRIVER',
    desc: 'Locked to Charlie-3 vehicle · Patient vitals & hospital selector',
    badgeColor: '#A855F7',
    icon: <DirectionsCar sx={{ fontSize: 16 }} />
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Emergency@123');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const { signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await signInWithEmail(email.trim(), password);
      console.log('[LoginPage] Sign in successful:', res);

      // Determine appropriate redirect destination
      if (email.includes('driver') || res.user?.user_metadata?.role === 'DRIVER') {
        navigate('/driver', { replace: true });
      } else {
        navigate(from === '/login' ? '/' : from, { replace: true });
      }
    } catch (err) {
      console.error('[LoginPage] Authentication failed:', err);
      setErrorMsg(err.message || 'Invalid email or password. Check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDemo = (demo) => {
    setEmail(demo.email);
    setPassword('Emergency@123');
    setErrorMsg(null);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#0B1329',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2,
      backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(37,99,235,0.15), transparent 70%)',
    }}>
      <Card sx={{
        maxWidth: 480,
        width: '100%',
        bgcolor: '#0F172A',
        border: '1.5px solid #1E293B',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        p: { xs: 3, sm: 4 },
        color: 'white',
      }}>
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{
            width: 52,
            height: 52,
            borderRadius: '14px',
            bgcolor: 'rgba(37,99,235,0.15)',
            border: '1.5px solid rgba(56,189,248,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 1.5,
          }}>
            <LocalHospital sx={{ color: '#38BDF8', fontSize: 32 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'white', fontFamily: 'Inter, sans-serif' }}>
            CAD Emergency System
          </Typography>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '12px' }}>
            Supabase Multi-User Authentication Portal
          </Typography>
        </Box>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, bgcolor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid #EF4444', fontSize: '12px' }}>
            {errorMsg}
          </Alert>
        )}

        {/* Credentials Form */}
        <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operator@cad.emergency.in"
            InputLabelProps={{ sx: { color: '#94A3B8', fontSize: '13px' } }}
            InputProps={{
              sx: { color: 'white', '& fieldset': { borderColor: '#334155' } },
              startAdornment: (
                <InputAdornment position="start">
                  <Email sx={{ color: '#64748B', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            size="small"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputLabelProps={{ sx: { color: '#94A3B8', fontSize: '13px' } }}
            InputProps={{
              sx: { color: 'white', '& fieldset': { borderColor: '#334155' } },
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: '#64748B', fontSize: 18 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#64748B' }}>
                    {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            sx={{
              mt: 1,
              py: 1.2,
              bgcolor: '#2563EB',
              color: 'white',
              fontWeight: 700,
              fontSize: '14px',
              textTransform: 'none',
              borderRadius: '10px',
              '&:hover': { bgcolor: '#1D4ED8' },
            }}
          >
            {isSubmitting ? <CircularProgress size={22} sx={{ color: 'white' }} /> : 'Authenticate & Enter CAD'}
          </Button>
        </Box>

        <Divider sx={{ my: 3, borderColor: '#1E293B', '&::before, &::after': { borderColor: '#1E293B' } }}>
          <Typography variant="caption" sx={{ color: '#64748B', px: 1, fontWeight: 600 }}>
            OR SIGN IN AS DEMO ROLE
          </Typography>
        </Divider>

        {/* Demo Fast Access Role Selector */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
          {DEMO_ACCOUNTS.map((demo) => (
            <Box
              key={demo.email}
              onClick={() => handleSelectDemo(demo)}
              sx={{
                p: 1.4,
                borderRadius: '10px',
                bgcolor: email === demo.email ? 'rgba(37,99,235,0.15)' : '#1E293B',
                border: `1.5px solid ${email === demo.email ? '#38BDF8' : '#334155'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: '#64748B' },
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.2 }}>
                  <Chip
                    icon={demo.icon}
                    label={demo.role}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '9.5px',
                      fontWeight: 800,
                      bgcolor: 'rgba(255,255,255,0.08)',
                      color: demo.badgeColor,
                      '& .MuiChip-icon': { color: demo.badgeColor },
                    }}
                  />
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                    {demo.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '10.5px', color: '#94A3B8' }}>
                  {demo.desc}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11px', color: '#38BDF8', fontWeight: 700 }}>
                Select ➔
              </Typography>
            </Box>
          ))}
        </Box>
      </Card>
    </Box>
  );
}
