// Example server integration with authentication system

const express = require('express');
const createAuthRoutes = require('./auth/routes');
const { requireAuth, requireRole, requirePermission } = require('./auth/middleware');
const { ROLES, PERMISSIONS } = require('./auth/config/roles');

// Your database connection
const db = require('./db'); // Replace with your actual DB setup

const app = express();
app.use(express.json());

// ===== MOUNT AUTH ROUTES =====
app.use('/api/auth', createAuthRoutes(db));

// ===== EXAMPLE PROTECTED ROUTES =====

// Public endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Authenticated endpoint (any logged-in user)
app.get('/api/profile', requireAuth, (req, res) => {
  res.json({ 
    message: 'Your profile',
    user: req.user // { userId, email, role, type }
  });
});

// Role-based endpoint (only DISPATCHER or ADMIN)
app.post('/api/ambulances/assign',
  requireAuth,
  requireRole([ROLES.DISPATCHER, ROLES.ADMIN]),
  (req, res) => {
    res.json({ message: 'Ambulance assigned' });
  }
);

// Permission-based endpoint
app.get('/api/analytics',
  requireAuth,
  requirePermission(PERMISSIONS.VIEW_ANALYTICS),
  (req, res) => {
    res.json({ message: 'Analytics data' });
  }
);

// Multiple roles example
app.get('/api/incidents',
  requireAuth,
  (req, res) => {
    // Citizens see only their own, dispatchers see all
    if (req.user.role === ROLES.CITIZEN) {
      res.json({ message: 'Your incidents only' });
    } else {
      res.json({ message: 'All incidents' });
    }
  }
);

// DRIVER endpoints
app.get('/api/driver/assignments',
  requireAuth,
  requireRole([ROLES.DRIVER, ROLES.ADMIN]),
  (req, res) => {
    res.json({ message: 'Driver assignments' });
  }
);

app.put('/api/driver/location',
  requireAuth,
  requirePermission(PERMISSIONS.UPDATE_LOCATION),
  (req, res) => {
    res.json({ message: 'Location updated' });
  }
);

// HOSPITAL_STAFF endpoints
app.get('/api/hospital/incoming',
  requireAuth,
  requireRole([ROLES.HOSPITAL_STAFF, ROLES.DISPATCHER, ROLES.ADMIN]),
  (req, res) => {
    res.json({ message: 'Incoming patients' });
  }
);

app.put('/api/hospital/beds',
  requireAuth,
  requirePermission(PERMISSIONS.UPDATE_BED_AVAILABILITY),
  (req, res) => {
    res.json({ message: 'Bed availability updated' });
  }
);

// ADMIN only
app.get('/api/admin/users',
  requireAuth,
  requireRole(ROLES.ADMIN),
  (req, res) => {
    res.json({ message: 'All users' });
  }
);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Auth endpoints available at http://localhost:${PORT}/api/auth`);
});

module.exports = app;
