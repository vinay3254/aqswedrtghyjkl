import React, { useState } from 'react';
import {
  Box, Paper, TextField, Button, Typography, Alert, Container, Divider, Chip
} from '@mui/material';
import { Warning, Shield } from '@mui/icons-material';
import { authApi } from '../services/api';

const DEMO_ACCOUNTS = [
  { role: 'Dispatcher', email: 'dispatcher@demo.com', password: 'demo123', name: 'Control Room A' },
  { role: 'Supervisor', email: 'supervisor@demo.com', password: 'demo123', name: 'Supervisor' },
];

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Demo bypass — works without backend
    const demo = DEMO_ACCOUNTS.find(a => a.email === email && a.password === password);
    if (demo) {
      const user = { id: `DEMO-${demo.role}`, name: demo.name, role: demo.role, email: demo.email };
      localStorage.setItem('authToken', 'demo-token-' + Date.now());
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
      setLoading(false);
      return;
    }

    try {
      const response = await authApi.login(email, password);
      const { token, user } = response.data.data;
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Use demo credentials below.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (account) => {
    setEmail(account.email);
    setPassword(account.password);
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0d0d1a 0%, #0f1629 60%, #0d1117 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <Box sx={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Container maxWidth="xs">
        {/* Logo / header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%', mx: 'auto', mb: 2,
            background: 'linear-gradient(135deg, #dc2626, #991b1b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
            boxShadow: '0 0 32px rgba(220,38,38,0.4)',
          }}>
            🚑
          </Box>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 800, letterSpacing: -0.5 }}>
            Dispatch Command
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>
            Emergency Medical Services Control Center
          </Typography>
        </Box>

        <Paper sx={{
          p: 3, borderRadius: 3,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
        }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.3)', '& .MuiAlert-icon': { color: '#ef4444' } }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Email" type="email"
              value={email} onChange={e => setEmail(e.target.value)}
              margin="normal" required autoFocus
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
              InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' } } }}
            />
            <TextField
              fullWidth label="Password" type="password"
              value={password} onChange={e => setPassword(e.target.value)}
              margin="normal" required
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
              InputProps={{ sx: { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' } } }}
            />
            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={loading}
              sx={{
                mt: 2.5, mb: 1.5, py: 1.5,
                background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
                color: 'white', fontWeight: 700, fontSize: '1rem',
                '&:hover': { background: 'linear-gradient(90deg, #b91c1c, #991b1b)' },
                '&:disabled': { opacity: 0.6 },
              }}
            >
              {loading ? 'Signing in...' : '🔐 Sign In'}
            </Button>
          </form>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
              DEMO ACCESS
            </Typography>
          </Divider>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {DEMO_ACCOUNTS.map(acc => (
              <Button
                key={acc.role}
                fullWidth variant="outlined" size="small"
                onClick={() => handleDemoLogin(acc)}
                startIcon={<Shield fontSize="small" />}
                sx={{
                  borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)',
                  justifyContent: 'flex-start', px: 2,
                  '&:hover': { borderColor: '#3b82f6', color: 'white', bgcolor: 'rgba(59,130,246,0.08)' },
                }}
              >
                {acc.role}: {acc.email}
                <Chip label="demo" size="small"
                  sx={{ ml: 'auto', height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }} />
              </Button>
            ))}
          </Box>

          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2,
            color: 'rgba(255,255,255,0.25)' }}>
            Password for demo accounts: <strong style={{ color: 'rgba(255,255,255,0.4)' }}>demo123</strong>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
