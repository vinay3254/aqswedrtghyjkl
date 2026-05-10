/**
 * Hospital Rating Service
 * Handles ratings and feedback for hospital response quality
 * Tracks hospital performance metrics
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { validateToken } = require('../../middleware/auth');

// Create hospital performance tracking table
const createHospitalPerformanceTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS hospital_performance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hospital_id INT NOT NULL,
      evaluation_date DATE,
      total_admissions INT DEFAULT 0,
      rated_admissions INT DEFAULT 0,
      average_rating DECIMAL(3, 2),
      staff_courtesy_rating DECIMAL(3, 2),
      treatment_quality_rating DECIMAL(3, 2),
      facility_cleanliness_rating DECIMAL(3, 2),
      wait_time_rating DECIMAL(3, 2),
      complaint_count INT DEFAULT 0,
      compliment_count INT DEFAULT 0,
      performance_score DECIMAL(5, 2),
      performance_level ENUM('excellent', 'good', 'average', 'below_average', 'poor') DEFAULT 'average',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
      UNIQUE KEY unique_hospital_date (hospital_id, evaluation_date),
      INDEX idx_hospital (hospital_id),
      INDEX idx_date (evaluation_date),
      INDEX idx_score (performance_score)
    )
  `;
  
  try {
    await db.query(query);
    console.log('Hospital performance table created or already exists');
  } catch (error) {
    console.error('Error creating hospital performance table:', error);
  }
};

// Submit hospital rating
router.post('/hospital/:hospital_id/rate', validateToken, async (req, res) => {
  try {
    const { hospital_id } = req.params;
    const { dispatch_id, rating, staff_courtesy, treatment_quality, facility_cleanliness, wait_time, comments } = req.body;
    const patient_id = req.user.id;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Overall rating must be between 1 and 5'
      });
    }

    if (!dispatch_id) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch ID is required'
      });
    }

    // Check if hospital rating already exists for this dispatch
    const existingQuery = `
      SELECT id FROM ratings 
      WHERE patient_id = ? AND dispatch_id = ? AND hospital_id = ? AND service_type = 'hospital_care'
    `;
    
    const [existing] = await db.query(existingQuery, [patient_id, dispatch_id, hospital_id]);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Hospital rating already submitted for this dispatch'
      });
    }

    // Insert main rating
    const insertRatingQuery = `
      INSERT INTO ratings (patient_id, dispatch_id, hospital_id, rating, service_type, source)
      VALUES (?, ?, ?, ?, 'hospital_care', 'mobile_app')
    `;

    const result = await db.query(insertRatingQuery, [patient_id, dispatch_id, hospital_id, rating]);

    // Insert detailed hospital ratings if provided
    if (staff_courtesy || treatment_quality || facility_cleanliness || wait_time) {
      const detailQuery = `
        INSERT INTO hospital_ratings_detail (
          rating_id, hospital_id, staff_courtesy, treatment_quality, 
          facility_cleanliness, wait_time, comments
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await db.query(detailQuery, [
        result.insertId,
        hospital_id,
        staff_courtesy || null,
        treatment_quality || null,
        facility_cleanliness || null,
        wait_time || null,
        comments || null
      ]);
    }

    res.status(201).json({
      success: true,
      message: 'Hospital rating submitted successfully',
      rating_id: result.insertId,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error submitting hospital rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit hospital rating',
      error: error.message
    });
  }
});

// Get hospital overall rating
router.get('/hospital/:hospital_id/rating', async (req, res) => {
  try {
    const { hospital_id } = req.params;

    const query = `
      SELECT 
        h.id,
        h.hospital_name,
        h.address,
        h.phone,
        h.email,
        COUNT(DISTINCT r.id) as total_ratings,
        ROUND(AVG(r.rating), 2) as average_rating,
        COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN r.rating = 4 THEN 1 END) as four_star_count,
        COUNT(CASE WHEN r.rating = 3 THEN 1 END) as three_star_count,
        COUNT(CASE WHEN r.rating = 2 THEN 1 END) as two_star_count,
        COUNT(CASE WHEN r.rating = 1 THEN 1 END) as one_star_count,
        MIN(r.timestamp) as first_rating_date,
        MAX(r.timestamp) as last_rating_date
      FROM hospitals h
      LEFT JOIN ratings r ON h.id = r.hospital_id AND r.service_type = 'hospital_care'
      WHERE h.id = ?
      GROUP BY h.id
    `;

    const [hospital] = await db.query(query, [hospital_id]);

    if (hospital.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      hospital: hospital[0]
    });
  } catch (error) {
    console.error('Error fetching hospital rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hospital rating',
      error: error.message
    });
  }
});

// Get detailed hospital ratings
router.get('/hospital/:hospital_id/details', async (req, res) => {
  try {
    const { hospital_id, period = '30' } = req.query;
    const days = parseInt(period);

    const query = `
      SELECT 
        ROUND(AVG(hrd.staff_courtesy), 2) as avg_staff_courtesy,
        ROUND(AVG(hrd.treatment_quality), 2) as avg_treatment_quality,
        ROUND(AVG(hrd.facility_cleanliness), 2) as avg_facility_cleanliness,
        ROUND(AVG(hrd.wait_time), 2) as avg_wait_time,
        COUNT(*) as total_detailed_ratings
      FROM hospital_ratings_detail hrd
      JOIN ratings r ON hrd.rating_id = r.id
      WHERE hrd.hospital_id = ?
      AND r.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const [details] = await db.query(query, [hospital_id, days]);

    // Get recent comments
    const commentsQuery = `
      SELECT 
        r.rating,
        hrd.comments,
        r.timestamp
      FROM hospital_ratings_detail hrd
      JOIN ratings r ON hrd.rating_id = r.id
      WHERE hrd.hospital_id = ?
      AND hrd.comments IS NOT NULL
      AND r.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY r.timestamp DESC
      LIMIT 10
    `;

    const [comments] = await db.query(commentsQuery, [hospital_id, days]);

    res.json({
      success: true,
      hospital_id,
      period: `${days} days`,
      category_ratings: details[0],
      recent_comments: comments
    });
  } catch (error) {
    console.error('Error fetching hospital details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hospital details',
      error: error.message
    });
  }
});

// Get top rated hospitals
router.get('/top-hospitals', async (req, res) => {
  try {
    const { limit = 10, min_ratings = 5, period = '30' } = req.query;
    const topLimit = parseInt(limit);
    const minRatings = parseInt(min_ratings);
    const days = parseInt(period);

    const query = `
      SELECT 
        h.id,
        h.hospital_name,
        h.address,
        COUNT(DISTINCT r.id) as total_ratings,
        ROUND(AVG(r.rating), 2) as average_rating,
        MIN(r.timestamp) as first_rating,
        MAX(r.timestamp) as last_rating
      FROM hospitals h
      LEFT JOIN ratings r ON h.id = r.hospital_id AND r.service_type = 'hospital_care'
      WHERE r.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY h.id, h.hospital_name, h.address
      HAVING COUNT(DISTINCT r.id) >= ?
      ORDER BY average_rating DESC
      LIMIT ?
    `;

    const [topHospitals] = await db.query(query, [days, minRatings, topLimit]);

    res.json({
      success: true,
      period: `${days} days`,
      minimum_ratings: minRatings,
      top_hospitals: topHospitals
    });
  } catch (error) {
    console.error('Error fetching top hospitals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top hospitals',
      error: error.message
    });
  }
});

// Get hospitals needing attention
router.get('/needs-attention', async (req, res) => {
  try {
    const { limit = 10, max_rating = 3 } = req.query;
    const topLimit = parseInt(limit);
    const maxRating = parseInt(max_rating);

    const query = `
      SELECT 
        h.id,
        h.hospital_name,
        h.address,
        h.phone,
        COUNT(DISTINCT r.id) as total_ratings,
        ROUND(AVG(r.rating), 2) as average_rating,
        COUNT(CASE WHEN f.feedback_type = 'complaint' THEN 1 END) as complaints,
        GROUP_CONCAT(DISTINCT f.category SEPARATOR ', ') as issue_areas
      FROM hospitals h
      LEFT JOIN ratings r ON h.id = r.hospital_id AND r.service_type = 'hospital_care'
      LEFT JOIN feedback f ON h.id = f.hospital_id AND f.feedback_type = 'complaint'
      GROUP BY h.id, h.hospital_name
      HAVING COUNT(DISTINCT r.id) > 0 AND AVG(r.rating) <= ?
      ORDER BY average_rating ASC, complaints DESC
      LIMIT ?
    `;

    const [hospitals] = await db.query(query, [maxRating, topLimit]);

    res.json({
      success: true,
      hospitals_needing_attention: hospitals
    });
  } catch (error) {
    console.error('Error fetching hospitals needing attention:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hospitals needing attention',
      error: error.message
    });
  }
});

// Get hospital performance trend
router.get('/hospital/:hospital_id/trend', async (req, res) => {
  try {
    const { hospital_id } = req.params;

    const query = `
      SELECT 
        DATE_FORMAT(r.timestamp, '%Y-%m-%d') as date,
        COUNT(*) as rating_count,
        ROUND(AVG(r.rating), 2) as daily_average
      FROM ratings r
      WHERE r.hospital_id = ?
      AND r.service_type = 'hospital_care'
      AND r.timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY DATE(r.timestamp)
      ORDER BY date ASC
    `;

    const [trend] = await db.query(query, [hospital_id]);

    res.json({
      success: true,
      hospital_id,
      period: 'Last 90 days',
      trend_data: trend
    });
  } catch (error) {
    console.error('Error fetching hospital trend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hospital trend',
      error: error.message
    });
  }
});

// Calculate hospital performance score
router.post('/hospital/:hospital_id/calculate-score', async (req, res) => {
  try {
    const { hospital_id } = req.params;

    // Get ratings data
    const ratingQuery = `
      SELECT 
        ROUND(AVG(r.rating), 2) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN r.rating <= 2 THEN 1 END) as negative_ratings
      FROM ratings r
      WHERE r.hospital_id = ?
      AND r.service_type = 'hospital_care'
      AND r.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    const [ratingData] = await db.query(ratingQuery, [hospital_id]);

    // Get feedback data
    const feedbackQuery = `
      SELECT 
        COUNT(CASE WHEN feedback_type = 'compliment' THEN 1 END) as compliments,
        COUNT(CASE WHEN feedback_type = 'complaint' THEN 1 END) as complaints,
        COUNT(*) as total_feedback
      FROM feedback
      WHERE hospital_id = ?
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    const [feedbackData] = await db.query(feedbackQuery, [hospital_id]);

    if (ratingData[0].total_ratings === 0) {
      return res.json({
        success: true,
        message: 'Insufficient data for performance calculation',
        hospital_id,
        score: 0
      });
    }

    // Calculate score (0-100)
    const ratings = ratingData[0];
    const feedback = feedbackData[0];

    const ratingScore = (ratings.avg_rating / 5) * 60;
    
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
      INSERT INTO hospital_performance (
        hospital_id, evaluation_date, average_rating, complaint_count, compliment_count,
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
      hospital_id,
      today,
      ratings.avg_rating,
      feedback.complaints,
      feedback.compliments,
      totalScore.toFixed(2),
      performanceLevel
    ]);

    res.json({
      success: true,
      hospital_id,
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
    console.error('Error calculating hospital score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate hospital score',
      error: error.message
    });
  }
});

// Compare hospitals
router.get('/comparison', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    const query = `
      SELECT 
        h.id,
        h.hospital_name,
        h.address,
        COUNT(DISTINCT r.id) as total_ratings,
        ROUND(AVG(r.rating), 2) as average_rating,
        COUNT(CASE WHEN f.feedback_type = 'complaint' THEN 1 END) as complaints,
        COUNT(CASE WHEN f.feedback_type = 'compliment' THEN 1 END) as compliments
      FROM hospitals h
      LEFT JOIN ratings r ON h.id = r.hospital_id AND r.service_type = 'hospital_care'
      LEFT JOIN feedback f ON h.id = f.hospital_id
      WHERE r.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      OR f.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY h.id, h.hospital_name, h.address
      ORDER BY average_rating DESC
    `;

    const [hospitals] = await db.query(query, [days, days]);

    // Calculate statistics
    const ratings = hospitals.map(h => h.average_rating || 0);
    const avgRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);

    res.json({
      success: true,
      period: `${days} days`,
      hospitals: hospitals,
      statistics: {
        average_rating_across_all: avgRating,
        highest_rating: Math.max(...ratings),
        lowest_rating: Math.min(...ratings),
        total_hospitals: hospitals.length
      }
    });
  } catch (error) {
    console.error('Error fetching hospital comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hospital comparison',
      error: error.message
    });
  }
});

module.exports = {
  router,
  createHospitalPerformanceTable
};
