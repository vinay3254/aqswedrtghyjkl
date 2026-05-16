import React, { useState, useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import DashboardPage from './pages/DashboardPage';
import DriverInterface from './pages/DriverInterface';

const makeTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary:    { main: '#dc2626' },
      secondary:  { main: '#3b82f6' },
      success:    { main: '#22c55e' },
      warning:    { main: '#f59e0b' },
      error:      { main: '#dc2626' },
      info:       { main: '#06b6d4' },
      background: mode === 'dark'
        ? { default: '#0d1117', paper: '#161b22' }
        : { default: '#f1f5f9', paper: '#ffffff' },
      text: mode === 'dark'
        ? { primary: '#f1f5f9', secondary: 'rgba(241,245,249,0.55)' }
        : { primary: '#0f172a', secondary: '#64748b' },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiButton:  { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
      MuiPaper:   { styleOverrides: { root: { borderRadius: 12 } } },
    },
  });

const DEFAULT_USER = {
  id: 'dispatcher-1', name: 'Dispatcher',
  role: 'DISPATCHER', email: 'dispatcher@medicluster.com',
};

export default function App() {
  const [mode, setMode] = useState('dark');
  const theme = useMemo(() => makeTheme(mode), [mode]);
  const toggleTheme = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <Routes>
          <Route path="/driver" element={<DriverInterface />} />
          <Route
            path="*"
            element={
              <DashboardPage
                user={DEFAULT_USER}
                onLogout={() => {}}
                onToggleTheme={toggleTheme}
                themeMode={mode}
              />
            }
          />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
