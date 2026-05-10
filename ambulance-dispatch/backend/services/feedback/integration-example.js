/**
 * Feedback System Integration Example
 * Shows how to integrate all feedback services into your main app
 */

const express = require('express');
const app = express();

// Import all feedback services
const { router: ratingRouter, createRatingsTable } = require('./services/feedback/rating-service');
const { router: feedbackRouter, createFeedbackTable } = require('./services/feedback/feedback-form');
const analyticsRouter = require('./services/feedback/analytics');
const { router: driverPerfRouter, createDriverPerformanceTable } = require('./services/feedback/driver-performance');
const { router: hospitalRouter, createHospitalPerformanceTable } = require('./services/feedback/hospital-rating');

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize all feedback tables
 * Call this on app startup
 */
async function initializeFeedbackTables() {
  console.log('Initializing feedback system tables...');
  
  try {
    await createRatingsTable();
    await createFeedbackTable();
    await createDriverPerformanceTable();
    await createHospitalPerformanceTable();
    
    console.log('✓ All feedback tables initialized successfully');
  } catch (error) {
    console.error('✗ Error initializing feedback tables:', error);
    throw error;
  }
}

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS if needed
const cors = require('cors');
app.use(cors());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// ROUTE MOUNTING
// ============================================================================

/**
 * Mount all feedback service routes
 * All routes are prefixed with /api/feedback
 */

// Rating endpoints
app.use('/api/feedback/ratings', ratingRouter);

// Feedback form endpoints
app.use('/api/feedback/form', feedbackRouter);

// Analytics endpoints
app.use('/api/feedback/analytics', analyticsRouter);

// Driver performance endpoints
app.use('/api/feedback/driver-performance', driverPerfRouter);

// Hospital rating endpoints
app.use('/api/feedback/hospital', hospitalRouter);

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

app.get('/api/feedback/health', (req, res) => {
  res.json({
    success: true,
    message: 'Feedback system is operational',
    timestamp: new Date(),
    endpoints: {
      ratings: '/api/feedback/ratings',
      feedback: '/api/feedback/form',
      analytics: '/api/feedback/analytics',
      driver_performance: '/api/feedback/driver-performance',
      hospital: '/api/feedback/hospital'
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ============================================================================
// SCHEDULED JOBS (Optional)
// ============================================================================

/**
 * Optional: Set up scheduled tasks for performance calculations
 * Uncomment to enable
 */

/*
const schedule = require('node-schedule');
const db = require('./config/database');

// Calculate driver performance scores daily
schedule.scheduleJob('0 2 * * *', async () => {
  try {
    console.log('Running daily driver performance calculations...');
    
    // Get all active drivers
    const [drivers] = await db.query('SELECT id FROM drivers WHERE status = "active"');
    
    // Calculate score for each driver
    for (const driver of drivers) {
      // Call driver performance calculation
      const ratingQuery = `
        SELECT 
          ROUND(AVG(rating), 2) as avg_rating,
          COUNT(*) as total_ratings
        FROM ratings
        WHERE driver_id = ?
        AND service_type = 'driver_conduct'
        AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;
      
      const [result] = await db.query(ratingQuery, [driver.id]);
      if (result[0].total_ratings > 0) {
        // Performance calculation logic here
        console.log(`Calculated performance for driver ${driver.id}`);
      }
    }
    
    console.log('✓ Daily driver performance calculations completed');
  } catch (error) {
    console.error('✗ Error in daily performance calculation:', error);
  }
});

// Calculate hospital performance scores daily
schedule.scheduleJob('0 3 * * *', async () => {
  try {
    console.log('Running daily hospital performance calculations...');
    
    // Similar logic for hospitals
    
    console.log('✓ Daily hospital performance calculations completed');
  } catch (error) {
    console.error('✗ Error in hospital performance calculation:', error);
  }
});

// Archive old resolved feedback (monthly)
schedule.scheduleJob('0 4 1 * *', async () => {
  try {
    console.log('Running monthly feedback archival...');
    
    const archiveQuery = `
      UPDATE feedback 
      SET status = 'archived' 
      WHERE status = 'closed' 
      AND resolved_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
    `;
    
    await db.query(archiveQuery);
    console.log('✓ Monthly feedback archival completed');
  } catch (error) {
    console.error('✗ Error in feedback archival:', error);
  }
});
*/

// ============================================================================
// EXAMPLE API USAGE
// ============================================================================

/**
 * Examples of how to use the feedback system API
 * These are for reference only
 */

/*

// 1. SUBMIT A RATING
fetch('/api/feedback/ratings/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your_token_here'
  },
  body: JSON.stringify({
    dispatch_id: 123,
    driver_id: 45,
    rating: 5,
    service_type: 'driver_conduct'
  })
});

// 2. SUBMIT FEEDBACK
fetch('/api/feedback/form/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your_token_here'
  },
  body: JSON.stringify({
    dispatch_id: 123,
    driver_id: 45,
    feedback_type: 'complaint',
    category: 'Safety',
    title: 'Poor driving behavior',
    message: 'Driver was reckless',
    priority: 'high',
    contact_preference: 'email',
    contact_info: 'patient@example.com'
  })
});

// 3. GET DRIVER PERFORMANCE
fetch('/api/feedback/driver-performance/driver/45/overall', {
  headers: {
    'Authorization': 'Bearer your_token_here'
  }
});

// 4. GET ANALYTICS
fetch('/api/feedback/analytics/trends?period=30', {
  headers: {
    'Authorization': 'Bearer your_token_here'
  }
});

// 5. GET HOSPITAL RATING
fetch('/api/feedback/hospital/hospital/67/rating', {
  headers: {
    'Authorization': 'Bearer your_token_here'
  }
});

*/

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize feedback tables
    await initializeFeedbackTables();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`\n✓ Server running on port ${PORT}`);
      console.log(`✓ Feedback system available at /api/feedback/`);
      console.log(`✓ Health check: GET /api/feedback/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all available feedback endpoints
 */
function getFeedbackEndpoints() {
  return {
    ratings: [
      'POST /api/feedback/ratings/submit',
      'GET /api/feedback/ratings/my-ratings',
      'GET /api/feedback/ratings/dispatch/:id/average',
      'GET /api/feedback/ratings/driver/:id/distribution',
      'GET /api/feedback/ratings/summary/:type/:id',
      'PUT /api/feedback/ratings/:id',
      'DELETE /api/feedback/ratings/:id'
    ],
    feedback: [
      'POST /api/feedback/form/submit',
      'GET /api/feedback/form/my-feedback',
      'GET /api/feedback/form/:id',
      'PUT /api/feedback/form/:id',
      'POST /api/feedback/form/:id/respond',
      'GET /api/feedback/form/stats/dashboard',
      'GET /api/feedback/form/search'
    ],
    analytics: [
      'GET /api/feedback/analytics/trends',
      'GET /api/feedback/analytics/issues/recurring',
      'GET /api/feedback/analytics/issues/critical',
      'GET /api/feedback/analytics/sentiment-analysis',
      'GET /api/feedback/analytics/hotspots',
      'GET /api/feedback/analytics/response-metrics',
      'GET /api/feedback/analytics/report/comprehensive',
      'GET /api/feedback/analytics/word-frequency'
    ],
    driver_performance: [
      'GET /api/feedback/driver-performance/driver/:id/overall',
      'GET /api/feedback/driver-performance/driver/:id/detailed',
      'GET /api/feedback/driver-performance/top-performers',
      'GET /api/feedback/driver-performance/needs-improvement',
      'GET /api/feedback/driver-performance/driver/:id/trend',
      'POST /api/feedback/driver-performance/calculate-score/:id',
      'GET /api/feedback/driver-performance/comparison'
    ],
    hospital: [
      'POST /api/feedback/hospital/:id/rate',
      'GET /api/feedback/hospital/hospital/:id/rating',
      'GET /api/feedback/hospital/hospital/:id/details',
      'GET /api/feedback/hospital/top-hospitals',
      'GET /api/feedback/hospital/needs-attention',
      'GET /api/feedback/hospital/hospital/:id/trend',
      'POST /api/feedback/hospital/hospital/:id/calculate-score',
      'GET /api/feedback/hospital/comparison'
    ]
  };
}

module.exports = {
  app,
  initializeFeedbackTables,
  getFeedbackEndpoints
};
