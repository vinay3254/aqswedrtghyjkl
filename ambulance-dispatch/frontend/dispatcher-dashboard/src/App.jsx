import React, { useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import DashboardPage from './pages/DashboardPage';
import DriverInterface from './pages/DriverInterface';

/* ── Evergreen dark theme ── */
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#8EB69B' },
    secondary:  { main: '#8EB69B' },
    success:    { main: '#8EB69B' },
    warning:    { main: '#E3A94F' },
    error:      { main: '#E25C50' },
    info:       { main: '#8EB69B' },
    background: { default: '#051F20', paper: '#0B2B26' },
    text:       { primary: '#DAF1DE', secondary: 'rgba(218,241,222,0.55)' },
    divider:    'rgba(142,182,155,0.10)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton:  { styleOverrides: { root: { textTransform: 'none', borderRadius: 9, fontWeight: 700 } } },
    MuiPaper:   { styleOverrides: { root: { borderRadius: 12, backgroundImage: 'none' } } },
    MuiDrawer:  { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiTab:     { styleOverrides: { root: { textTransform: 'none', minHeight: 36, fontWeight: 600 } } },
    MuiChip:    { styleOverrides: { root: { fontWeight: 700 } } },
  },
});

const DEFAULT_USER = {
  id: 'dispatcher-1', name: 'Dispatcher',
  role: 'DISPATCHER', email: 'dispatcher@medicluster.com',
};

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <Routes>
          <Route path="/driver" element={<DriverInterface />} />
          <Route path="*" element={<DashboardPage user={DEFAULT_USER} onLogout={() => {}} />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
