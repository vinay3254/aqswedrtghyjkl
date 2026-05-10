import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => setUser(userData);
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <Routes>
          {/* Driver interface – always accessible */}
          <Route path="/driver" element={<DriverInterface />} />

          {/* Main dispatcher dashboard */}
          <Route
            path="*"
            element={
              user
                ? <DashboardPage user={user} onLogout={handleLogout} />
                : <LoginPage onLogin={handleLogin} />
            }
          />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
