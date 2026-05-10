/**
 * Rating Service
 * Handles 1-5 star ratings from patients for ambulance services
 * Provides API endpoints for mobile app
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { validateToken } = require('../../middleware/auth');
const { validateRating } = require('../../middleware/validation');

// Database schema for ratings
const createRatingsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      dispatch_id INT NOT NULL,
      driver_id INT,
      hospital_id INT,
      rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      service_type ENUM('ambulance_response', 'driver_conduct', 'hospital_care', 'overall') NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      source VARCHAR(50) DEFAULT 'mobile_app',
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (dispatch_id) REFERENCES dispatches(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
      INDEX idx_patient (patient_id),
      INDEX idx_dispatch (dispatch_id),
      INDEX idx_driver (driver_id),
      INDEX idx_hospital (hospital_id),
      INDEX idx_service_type (service_type),
      INDEX idx_timestamp (timestamp)
    )
  `;
  
  try {
    await db.query(query);
    console.log('Ratings table created or already exists');
  } catch (error) {
    console.error('Error creating ratings table:', error);
  }
};

// Submit a rating
router.post('/submit', validateToken, async (req, res) => {
  try {
    const { dispatch_id, driver_id, hospital_id, rating, service_type } = req.body;
    const patient_id = req.user.id;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (!dispatch_id) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch ID is required'
      });
    }

    if (!['ambulance_response', 'driver_conduct', 'hospital_care', 'overall'].includes(service_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service type'
      });
    }

    // Check if rating already exists for this dispatch and service type
    const existingQuery = `
      SELECT id FROM ratings 
      WHERE patient_id = ? AND dispatch_id = ? AND service_type = ?
    `;
    
    const [existing] = await db.query(existingQuery, [patient_id, dispatch_id, service_type]);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Rating already submitted for this service type'
      });
    }

    // Insert rating
    const insertQuery = `
      INSERT INTO ratings (patient_id, dispatch_id, driver_id, hospital_id, rating, service_type, source)
      VALUES (?, ?, ?, ?, ?, ?, 'mobile_app')
    `;

    const result = await db.query(insertQuery, [
      patient_id,
      dispatch_id,
      driver_id || null,
      hospital_id || null,
      rating,
      service_type
    ]);

    // Update dispatch rating status
    await updateDispatchRatingStatus(dispatch_id);

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      rating_id: result.insertId,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message
    });
  }
});

// Get patient's ratings history
router.get('/my-ratings', validateToken, async (req, res) => {
  try {
    const patient_id = req.user.id;
    const { limit = 10, offset = 0 } = req.query;

    const query = `
      SELECT 
        r.id,
        r.dispatch_id,
        r.rating,
        r.service_type,
        r.timestamp,
        d.driver_name,
        h.hospital_name,
        dp.pickup_location,
        dp.dropoff_location
      FROM ratings r
      LEFT JOIN drivers d ON r.driver_id = d.id
      LEFT JOIN hospitals h ON r.hospital_id = h.id
      LEFT JOIN dispatches dp ON r.dispatch_id = dp.id
      WHERE r.patient_id = ?
      ORDER BY r.timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const [ratings] = await db.query(query, [patient_id, parseInt(limit), parseInt(offset)]);

    // Count total ratings
    const countQuery = 'SELECT COUNT(*) as total FROM ratings WHERE patient_id = ?';
    const [countResult] = await db.query(countQuery, [patient_id]);

    res.json({
      success: true,
      ratings,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: countResult[0].total
      }
    });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings',
      error: error.message
    });
  }
});

// Get average rating for a specific dispatch
router.get('/dispatch/:dispatch_id/average', async (req, res) => {
  try {
    const { dispatch_id } = req.params;

    const query = `
      SELECT 
        service_type,
        COUNT(*) as total_ratings,
        ROUND(AVG(rating), 2) as average_rating,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating
      FROM ratings
      WHERE dispatch_id = ?
      GROUP BY service_type
    `;

    const [ratings] = await db.query(query, [dispatch_id]);

    if (ratings.length === 0) {
      return res.json({
        success: true,
        message: 'No ratings found for this dispatch',
        dispatch_id,
        ratings: []
      });
    }

    // Calculate overall average
    const overallQuery = `
      SELECT 
        ROUND(AVG(rating), 2) as overall_average,
        COUNT(*) as total_ratings
      FROM ratings
      WHERE dispatch_id = ?
    `;

    const [overall] = await db.query(overallQuery, [dispatch_id]);

    res.json({
      success: true,
      dispatch_id,
      overall_average: overall[0].overall_average,
      total_ratings: overall[0].total_ratings,
      by_service_type: ratings
    });
  } catch (error) {
    console.error('Error fetching average rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch average rating',
      error: error.message
    });
  }
});

// Get ratings distribution for a driver
router.get('/driver/:driver_id/distribution', async (req, res) => {
  try {
    const { driver_id } = req.params;

    const query = `
      SELECT 
        rating,
        COUNT(*) as count,
        ROUND((COUNT(*) / (SELECT COUNT(*) FROM ratings WHERE driver_id = ?)) * 100, 2) as percentage
      FROM ratings
      WHERE driver_id = ? AND service_type = 'driver_conduct'
      GROUP BY rating
      ORDER BY rating DESC
    `;

    const [distribution] = await db.query(query, [driver_id, driver_id]);

    const avgQuery = `
      SELECT 
        ROUND(AVG(rating), 2) as average_rating,
        COUNT(*) as total_ratings,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating
      FROM ratings
      WHERE driver_id = ? AND service_type = 'driver_conduct'
    `;

    const [avgResult] = await db.query(avgQuery, [driver_id]);

    res.json({
      success: true,
      driver_id,
      statistics: avgResult[0],
      distribution
    });
  } catch (error) {
    console.error('Error fetching driver ratings distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver ratings',
      error: error.message
    });
  }
});

// Get star count summary (how many 5-star, 4-star, etc.)
router.get('/summary/:entity_type/:entity_id', async (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;
    
    let whereClause = '';
    if (entity_type === 'driver') {
      whereClause = `WHERE driver_id = ? AND service_type = 'driver_conduct'`;
    } else if (entity_type === 'hospital') {
      whereClause = `WHERE hospital_id = ? AND service_type = 'hospital_care'`;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Use: driver or hospital'
      });
    }

    const query = `
      SELECT 
        5 as stars, COUNT(CASE WHEN rating = 5 THEN 1 END) as count
      FROM ratings ${whereClause}
      UNION ALL
      SELECT 4, COUNT(CASE WHEN rating = 4 THEN 1 END) FROM ratings ${whereClause}
      UNION ALL
      SELECT 3, COUNT(CASE WHEN rating = 3 THEN 1 END) FROM ratings ${whereClause}
      UNION ALL
      SELECT 2, COUNT(CASE WHEN rating = 2 THEN 1 END) FROM ratings ${whereClause}
      UNION ALL
      SELECT 1, COUNT(CASE WHEN rating = 1 THEN 1 END) FROM ratings ${whereClause}
      ORDER BY stars DESC
    `;

    const [summary] = await db.query(query, [entity_id, entity_id, entity_id, entity_id, entity_id]);

    res.json({
      success: true,
      entity_type,
      entity_id,
      star_summary: summary
    });
  } catch (error) {
    console.error('Error fetching rating summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rating summary',
      error: error.message
    });
  }
});

// Update a rating
router.put('/:rating_id', validateToken, async (req, res) => {
  try {
    const { rating_id } = req.params;
    const { rating } = req.body;
    const patient_id = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Verify ownership
    const verifyQuery = 'SELECT id FROM ratings WHERE id = ? AND patient_id = ?';
    const [verify] = await db.query(verifyQuery, [rating_id, patient_id]);

    if (verify.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this rating'
      });
    }

    const updateQuery = 'UPDATE ratings SET rating = ? WHERE id = ?';
    await db.query(updateQuery, [rating, rating_id]);

    res.json({
      success: true,
      message: 'Rating updated successfully',
      rating_id
    });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rating',
      error: error.message
    });
  }
});

// Delete a rating
router.delete('/:rating_id', validateToken, async (req, res) => {
  try {
    const { rating_id } = req.params;
    const patient_id = req.user.id;

    // Verify ownership
    const verifyQuery = 'SELECT dispatch_id FROM ratings WHERE id = ? AND patient_id = ?';
    const [verify] = await db.query(verifyQuery, [rating_id, patient_id]);

    if (verify.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this rating'
      });
    }

    const dispatch_id = verify[0].dispatch_id;

    const deleteQuery = 'DELETE FROM ratings WHERE id = ?';
    await db.query(deleteQuery, [rating_id]);

    // Update dispatch rating status
    await updateDispatchRatingStatus(dispatch_id);

    res.json({
      success: true,
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rating',
      error: error.message
    });
  }
});

// Helper function to update dispatch rating status
async function updateDispatchRatingStatus(dispatch_id) {
  try {
    const checkQuery = 'SELECT COUNT(*) as count FROM ratings WHERE dispatch_id = ?';
    const [result] = await db.query(checkQuery, [dispatch_id]);
    
    if (result[0].count > 0) {
      const updateQuery = 'UPDATE dispatches SET is_rated = true WHERE id = ?';
      await db.query(updateQuery, [dispatch_id]);
    }
  } catch (error) {
    console.error('Error updating dispatch rating status:', error);
  }
}

// Export router and init function
module.exports = {
  router,
  createRatingsTable,
  updateDispatchRatingStatus
};
