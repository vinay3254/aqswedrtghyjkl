/**
 * Driver Performance Service
 * Tracks driver performance metrics based on ratings and feedback
 * Provides insights for driver management and training
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Create driver performance tracking table
const createDriverPerformanceTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS driver_performance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      driver_id INT NOT NULL,
      evaluation_date DATE,
      total_trips INT DEFAULT 0,
      rated_trips INT DEFAULT 0,
      average_rating DECIMAL(3, 2),
      professionalism_rating DECIMAL(3, 2),
      safety_rating DECIMAL(3, 2),
      punctuality_rating DECIMAL(3, 2),
      vehicle_condition_rating DECIMAL(3, 2),
      complaint_count INT DEFAULT 0,
      compliment_count INT DEFAULT 0,
      suggestion_count INT DEFAULT 0,
      performance_score DECIMAL(5, 2),
      performance_level ENUM('excellent', 'good', 'average', 'below_average', 'poor') DEFAULT 'average',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES drivers(id),
      UNIQUE KEY unique_driver_date (driver_id, evaluation_date),
      INDEX idx_driver (driver_id),
      INDEX idx_date (evaluation_date),
      INDEX idx_score (performance_score)
    )
  `;
  
  try {
    await db.query(query);
    console.log('Driver performance table created or already exists');
  } catch (error) {
    console.error('Error creating driver performance table:', error);
  }
};

// Get driver overall performance
router.get('/driver/:driver_id/overall', async (req, res) => {
  try {
    const { driver_id } = req.params;

    const query = `
      SELECT 
        d.id,
        d.driver_name,
        d.phone,
        d.email,
        d.status,
        dp.total_trips,
        dp.rated_trips,
        dp.average_rating,
        dp.performance_score,
        dp.performance_level,
        dp.complaint_count,
        dp.compliment_count,
        dp.evaluation_date,
        COUNT(DISTINCT r.id) as total_ratings,
        ROUND(AVG(r.rating), 2) as current_rating
      FROM drivers d
      LEFT JOIN driver_performance dp ON d.id = dp.driver_id
      LEFT JOIN ratings r ON d.id = r.driver_id AND r.service_type = 'driver_conduct'
      WHERE d.id = ?
      GROUP BY d.id
    `;

    const [performance] = await db.query(query, [driver_id]);

    if (performance.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      driver: performance[0]
    });
  } catch (error) {
    console.error('Error fetching driver performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver performance',
      error: error.message
    });
  }
});

// Get detailed performance metrics
router.get('/driver/:driver_id/detailed', async (req, res) => {
  try {
    const { driver_id, period = '30' } = req.query;
    const days = parseInt(period);

    // Rating distribution
    const ratingQuery = `
      SELECT 
        r.rating,
        COUNT(*) as count
      FROM ratings r
      WHERE r.driver_id = ?
      AND r.service_type = 'driver_conduct'
      AND r.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY r.rating
      ORDER BY r.rating DESC
    `;
    const [ratingDistribution] = await db.query(ratingQuery, [driver_id, days]);

    // Category ratings
    const categoryQuery = `
      SELECT 
        f.category,
        COUNT(*) as feedback_count,
        COUNT(CASE WHEN f.feedback_type = 'complaint' THEN 1 END) as complaints,
        COUNT(CASE WHEN f.feedback_type = 'compliment' THEN 1 END) as compliments
      FROM feedback f
      WHERE f.driver_id = ?
      AND f.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY f.category
      ORDER BY feedback_count DESC
    `;
    const [categoryFeedback] = await db.query(categoryQuery, [driver_id, days]);

    // Recent feedback
    const feedbackQuery = `
      SELECT 
        f.id,
        f.feedback_type,
        f.category,
        f.title,
        f.message,
        f.timestamp
      FROM feedback f
      WHERE f.driver_id = ?
      AND f.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY f.timestamp DESC
      LIMIT 10
    `;
    const [recentFeedback] = await db.query(feedbackQuery, [driver_id, days]);

    // Trip statistics
    const tripQuery = `
      SELECT 
        COUNT(DISTINCT dp.id) as total_trips,
        COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN dp.id END) as rated_trips,
        ROUND(COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN dp.id END) / COUNT(DISTINCT dp.id) * 100, 2) as rating_percentage
      FROM dispatches dp
      WHERE dp.driver_id = ?
      AND dp.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      LEFT JOIN ratings r ON dp.id = r.dispatch_id
    `;
    const [tripStats] = await db.query(tripQuery, [driver_id, days]);

    res.json({
      success: true,
      period: `${days} days`,
      driver_id,
      rating_distribution: ratingDistribution,
      category_feedback: categoryFeedback,
      recent_feedback: recentFeedback,
      trip_statistics: tripStats[0]
    });
  } catch (error) {
    console.error('Error fetching detailed performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch detailed performance',
      error: error.message
    });
  }
});

// Get top performing drivers
router.get('/top-performers', async (req, res) => {
  try {
    const { limit = 10, period = '30' } = req.query;
    const days = parseInt(period);
    const topLimit = parseInt(limit);

    const query = `
      SELECT 
        d.id,
        d.driver_name,
        COUNT(DISTINCT r.id) as total_ratings,
        ROUND(AVG(r.rating), 2) as average_rating,
        COUNT(CASE WHEN f.feedback_type = 'compliment' THEN 1 END) as compliments,
        COUNT(CASE WHEN f.feedback_type = 'complaint' THEN 1 END) as complaints,
        ROUND(COUNT(DISTINCT f.id) / COUNT(DISTINCT dp.id) * 100, 2) as feedback_rate
      FROM drivers d
      LEFT JOIN ratings r ON d.id = r.driver_id AND r.service_type = 'driver_conduct'
      LEFT JOIN feedback f ON d.id = f.driver_id
      LEFT JOIN dispatches dp ON d.id = dp.driver_id
      WHERE d.status = 'active'
      AND r.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY d.id, d.driver_name
      HAVING COUNT(DISTINCT r.id) >= 5
      ORDER BY average_rating DESC
      LIMIT ?
    `;

    const [topDrivers] = await db.query(query, [days, topLimit]);

    res.json({
      success: true,
      period: `${days} days`,
      top_performers: topDrivers
    });
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top performers',
      error: error.message
    });
  }
});

// Get drivers needing improvement
router.get('/needs-improvement', async (req, res) => {
  try {
    const { limit = 10, min_ratings = 3 } = req.query;
    const topLimit = parseInt(limit);
    const minRatings = parseInt(min_ratings);

    const query = `
      SELECT 
        d.id,
        d.driver_name,
        d.phone,
        COUNT(DISTINCT r.id) as total_ratings,
        ROUND(AVG(r.rating), 2) as average_rating,
        COUNT(CASE WHEN f.feedback_type = 'complaint' THEN 1 END) as complaints,
        COUNT(CASE WHEN f.feedback_type = 'compliment' THEN 1 END) as compliments,
        GROUP_CONCAT(DISTINCT f.category SEPARATOR ', ') as issue_areas
      FROM drivers d
      LEFT JOIN ratings r ON d.id = r.driver_id AND r.service_type = 'driver_conduct'
      LEFT JOIN feedback f ON d.id = f.driver_id AND f.feedback_type = 'complaint'
      WHERE d.status = 'active'
      GROUP BY d.id, d.driver_name
      HAVING COUNT(DISTINCT r.id) >= ?
      ORDER BY average_rating ASC, complaints DESC
      LIMIT ?
    `;

    const [drivers] = await db.query(query, [minRatings, topLimit]);

    res.json({
      success: true,
      minimum_ratings: minRatings,
      drivers_needing_improvement: drivers
    });
  } catch (error) {
    console.error('Error fetching drivers needing improvement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers needing improvement',
      error: error.message
    });
  }
});

// Get performance trend
router.get('/driver/:driver_id/trend', async (req, res) => {
  try {
    const { driver_id } = req.params;

    const query = `
      SELECT 
        DATE_FORMAT(r.timestamp, '%Y-%m-%d') as date,
        COUNT(*) as rating_count,
        ROUND(AVG(r.rating), 2) as daily_average
      FROM ratings r
      WHERE r.driver_id = ?
      AND r.service_type = 'driver_conduct'
      AND r.timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY DATE(r.timestamp)
      ORDER BY date ASC
    `;

    const [trend] = await db.query(query, [driver_id]);

    res.json({
      success: true,
      driver_id,
      period: 'Last 90 days',
      trend_data: trend
    });
  } catch (error) {
    console.error('Error fetching performance trend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance trend',
      error: error.message
    });
  }
});

// Calculate performance score
router.post('/calculate-score/:driver_id', async (req, res) => {
  try {
    const { driver_id } = req.params;

    // Get ratings data
    const ratingQuery = `
      SELECT 
        ROUND(AVG(CASE WHEN rating = 5 THEN 5 ELSE CASE WHEN rating = 4 THEN 4 ELSE CASE WHEN rating = 3 THEN 3 ELSE CASE WHEN rating = 2 THEN 2 ELSE 1 END END END), 2) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_ratings
      FROM ratings
      WHERE driver_id = ?
      AND service_type = 'driver_conduct'
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    const [ratingData] = await db.query(ratingQuery, [driver_id]);

    // Get feedback data
    const feedbackQuery = `
      SELECT 
        COUNT(CASE WHEN feedback_type = 'compliment' THEN 1 END) as compliments,
        COUNT(CASE WHEN feedback_type = 'complaint' THEN 1 END) as complaints,
        COUNT(*) as total_feedback
      FROM feedback
      WHERE driver_id = ?
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    const [feedbackData] = await db.query(feedbackQuery, [driver_id]);

    if (ratingData[0].total_ratings === 0) {
      return res.json({
        success: true,
        message: 'Insufficient data for performance calculation',
        driver_id,
        score: 0
      });
    }

    // Calculate score (0-100)
    const ratings = ratingData[0];
    const feedback = feedbackData[0];

    // Rating score (60% of total)
    const ratingScore = (ratings.avg_rating / 5) * 60;

    // Feedback score (40% of total)
    let feedbackScore = 0;
    if (feedback.total_feedback > 0) {
      const complimentRate = feedback.compliments / feedback.total_feedback;
      const complaintRate = feedback.complaints / feedback.total_feedback;
      feedbackScore = (complimentRate * 40) - (complaintRate * 20);
      feedbackScore = Math.max(0, Math.min(40, feedbackScore));
    }

    const totalScore = ratingScore + feedbackScore;

    // Determine performance level
    let performanceLevel;
    if (totalScore >= 90) performanceLevel = 'excellent';
    else if (totalScore >= 75) performanceLevel = 'good';
    else if (totalScore >= 60) performanceLevel = 'average';
    else if (totalScore >= 45) performanceLevel = 'below_average';
    else performanceLevel = 'poor';

    // Update or insert performance record
    const today = new Date().toISOString().split('T')[0];
    const upsertQuery = `
      INSERT INTO driver_performance (
        driver_id, evaluation_date, average_rating, complaint_count, compliment_count,
        performance_score, performance_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        average_rating = VALUES(average_rating),
        complaint_count = VALUES(complaint_count),
        compliment_count = VALUES(compliment_count),
        performance_score = VALUES(performance_score),
        performance_level = VALUES(performance_level)
    `;

    await db.query(upsertQuery, [
      driver_id,
      today,
      ratings.avg_rating,
      feedback.complaints,
      feedback.compliments,
      totalScore.toFixed(2),
      performanceLevel
    ]);

    res.json({
      success: true,
      driver_id,
      performance_score: totalScore.toFixed(2),
      performance_level: performanceLevel,
      breakdown: {
        rating_score: ratingScore.toFixed(2),
        feedback_score: feedbackScore.toFixed(2),
        average_rating: ratings.avg_rating,
        total_ratings: ratings.total_ratings,
        compliments: feedback.compliments,
        complaints: feedback.complaints
      }
    });
  } catch (error) {
    console.error('Error calculating performance score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate performance score',
      error: error.message
    });
  }
});

// Get performance comparison
router.get('/comparison', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    const query = `
      SELECT 
        d.id,
        d.driver_name,
        COUNT(DISTINCT r.id) as total_ratings,
        ROUND(AVG(r.rating), 2) as average_rating,
        COUNT(CASE WHEN f.feedback_type = 'complaint' THEN 1 END) as complaints,
        COUNT(CASE WHEN f.feedback_type = 'compliment' THEN 1 END) as compliments
      FROM drivers d
      LEFT JOIN ratings r ON d.id = r.driver_id AND r.service_type = 'driver_conduct'
      LEFT JOIN feedback f ON d.id = f.driver_id
      WHERE d.status = 'active'
      AND (r.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY) OR f.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY))
      GROUP BY d.id, d.driver_name
      ORDER BY average_rating DESC
    `;

    const [drivers] = await db.query(query, [days, days]);

    // Calculate statistics
    const ratings = drivers.map(d => d.average_rating || 0);
    const avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
    const maxRating = Math.max(...ratings);
    const minRating = Math.min(...ratings);

    res.json({
      success: true,
      period: `${days} days`,
      drivers: drivers,
      statistics: {
        average_rating_across_all: avgRating,
        highest_rating: maxRating,
        lowest_rating: minRating,
        total_drivers: drivers.length
      }
    });
  } catch (error) {
    console.error('Error fetching performance comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance comparison',
      error: error.message
    });
  }
});

module.exports = {
  router,
  createDriverPerformanceTable
};
