import React, { useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import DashboardPage from './pages/DashboardPage';
import DriverInterface from './pages/DriverInterface';
import InsightsPage from './pages/InsightsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import MobileFleetPage from './pages/MobileFleetPage';
import CallerVoicePortalPage from './pages/CallerVoicePortalPage';

/* ── Light theme ── */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#2563EB' },
    secondary:  { main: '#2563EB' },
    success:    { main: '#2563EB' },
    warning:    { main: '#E3A94F' },
    error:      { main: '#E25C50' },
    info:       { main: '#2563EB' },
    background: { default: '#F8FAFC', paper: '#FFFFFF' },
    text:       { primary: '#0F172A', secondary: '#475569' },
    divider:    '#E2E8F0',
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
          <Route path="/caller" element={<CallerVoicePortalPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/mobile" element={<MobileFleetPage />} />
          <Route path="*" element={<DashboardPage user={DEFAULT_USER} onLogout={() => {}} />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
