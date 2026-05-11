import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import DashboardPage from './pages/DashboardPage';
import DriverInterface from './pages/DriverInterface';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#dc2626' },
    secondary: { main: '#3b82f6' },
    success: { main: '#22c55e' },
    warning: { main: '#f59e0b' },
    error: { main: '#dc2626' },
    info: { main: '#06b6d4' },
    background: { default: '#0d1117', paper: '#161b22' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
  },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } }
    },
    MuiPaper: {
      styleOverrides: { root: { borderRadius: 12 } }
    }
  }
});

const DEFAULT_USER = { id: 'dispatcher-1', name: 'Dispatcher', role: 'DISPATCHER', email: 'dispatcher@medicluster.com' };

function App() {
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

export default App;
