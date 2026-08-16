import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // 1. Loading Splash while checking session
  if (loading) {
    return (
      <Box sx={{
        height: '100vh',
        width: '100vw',
        bgcolor: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}>
        <CircularProgress size={44} sx={{ color: '#38BDF8' }} />
        <Typography sx={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em' }}>
          VERIFYING EMERGENCY DISPATCH SESSION...
        </Typography>
      </Box>
    );
  }

  // 2. Unauthenticated -> Redirect to Login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role-Based Access Enforcement
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role || 'DRIVER';

    if (!allowedRoles.includes(userRole)) {
      console.warn(`[ProtectedRoute] User role '${userRole}' unauthorized for route '${location.pathname}'`);

      // If a driver attempts to access the Dispatch Center, redirect to Driver terminal
      if (userRole === 'DRIVER') {
        return <Navigate to="/driver" replace />;
      }

      // If a dispatcher accesses another role's route, redirect to main CAD
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
