/**
 * Feedback Form Service
 * Handles detailed feedback collection from patients
 * Captures comments, suggestions, and issue reporting
 * Provides API endpoints for mobile app
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { validateToken } = require('../../middleware/auth');
const { sanitizeInput } = require('../../middleware/validation');

// Database schema for detailed feedback
const createFeedbackTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      dispatch_id INT NOT NULL,
      driver_id INT,
      hospital_id INT,
      feedback_type ENUM('compliment', 'complaint', 'suggestion', 'other') NOT NULL,
      category VARCHAR(100),
      title VARCHAR(255) NOT NULL,
      message LONGTEXT NOT NULL,
      priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
      status ENUM('pending', 'under_review', 'acknowledged', 'resolved', 'closed') DEFAULT 'pending',
      attachments JSON,
      contact_preference VARCHAR(50),
      contact_info VARCHAR(255),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolution_notes LONGTEXT,
      assigned_to INT,
      source VARCHAR(50) DEFAULT 'mobile_app',
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (dispatch_id) REFERENCES dispatches(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY (assigned_to) REFERENCES admin_users(id),
      INDEX idx_patient (patient_id),
      INDEX idx_dispatch (dispatch_id),
      INDEX idx_status (status),
      INDEX idx_feedback_type (feedback_type),
      INDEX idx_timestamp (timestamp),
      FULLTEXT INDEX ft_search (title, message)
    )
  `;
  
  try {
    await db.query(query);
    console.log('Feedback table created or already exists');
  } catch (error) {
    console.error('Error creating feedback table:', error);
  }
};

// Submit detailed feedback
router.post('/submit', validateToken, async (req, res) => {
  try {
    const {
      dispatch_id,
      driver_id,
      hospital_id,
      feedback_type,
      category,
      title,
      message,
      priority,
      contact_preference,
      contact_info
    } = req.body;

    const patient_id = req.user.id;

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (!feedback_type || !['compliment', 'complaint', 'suggestion', 'other'].includes(feedback_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback type'
      });
    }

    if (!dispatch_id) {
      return res.status(400).json({
        success: false,
        message: 'Dispatch ID is required'
      });
    }

    // Sanitize inputs
    const sanitizedTitle = sanitizeInput(title.substring(0, 255));
    const sanitizedMessage = sanitizeInput(message.substring(0, 5000));
    const sanitizedCategory = category ? sanitizeInput(category.substring(0, 100)) : null;

    // Insert feedback
    const insertQuery = `
      INSERT INTO feedback (
        patient_id, dispatch_id, driver_id, hospital_id,
        feedback_type, category, title, message, priority,
        contact_preference, contact_info, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'mobile_app')
    `;

    const result = await db.query(insertQuery, [
      patient_id,
      dispatch_id,
      driver_id || null,
      hospital_id || null,
      feedback_type,
      sanitizedCategory,
      sanitizedTitle,
      sanitizedMessage,
      priority || 'medium',
      contact_preference || null,
      contact_info || null
    ]);

    // Log feedback submission
    await logFeedbackActivity(result.insertId, 'submitted', `Feedback submitted by patient ${patient_id}`);

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback_id: result.insertId,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
});

// Get patient's feedback history
router.get('/my-feedback', validateToken, async (req, res) => {
  try {
    const patient_id = req.user.id;
    const { limit = 20, offset = 0, status, feedback_type } = req.query;

    let whereClause = 'WHERE f.patient_id = ?';
    const params = [patient_id];

    if (status) {
      whereClause += ' AND f.status = ?';
      params.push(status);
    }

    if (feedback_type) {
      whereClause += ' AND f.feedback_type = ?';
      params.push(feedback_type);
    }

    const query = `
      SELECT 
        f.id,
        f.dispatch_id,
        f.feedback_type,
        f.category,
        f.title,
        f.message,
        f.priority,
        f.status,
        f.timestamp,
        f.resolved_at,
        f.resolution_notes,
        d.driver_name,
        h.hospital_name
      FROM feedback f
      LEFT JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN hospitals h ON f.hospital_id = h.id
      ${whereClause}
      ORDER BY f.timestamp DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));
    const [feedbackList] = await db.query(query, params);

    // Count total feedback
    const countQuery = `SELECT COUNT(*) as total FROM feedback ${whereClause}`;
    const [countResult] = await db.query(countQuery, [patient_id]);

    res.json({
      success: true,
      feedback: feedbackList,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: countResult[0].total
      }
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
      error: error.message
    });
  }
});

// Get detailed feedback by ID
router.get('/:feedback_id', validateToken, async (req, res) => {
  try {
    const { feedback_id } = req.params;
    const patient_id = req.user.id;

    const query = `
      SELECT 
        f.*,
        d.driver_name,
        d.phone as driver_phone,
        h.hospital_name,
        h.phone as hospital_phone
      FROM feedback f
      LEFT JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN hospitals h ON f.hospital_id = h.id
      WHERE f.id = ? AND f.patient_id = ?
    `;

    const [feedback] = await db.query(query, [feedback_id, patient_id]);

    if (feedback.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    res.json({
      success: true,
      feedback: feedback[0]
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
      error: error.message
    });
  }
});

// Update feedback (patient can update pending feedback)
router.put('/:feedback_id', validateToken, async (req, res) => {
  try {
    const { feedback_id } = req.params;
    const { title, message, priority, contact_preference, contact_info } = req.body;
    const patient_id = req.user.id;

    // Verify ownership and status
    const verifyQuery = 'SELECT id, status FROM feedback WHERE id = ? AND patient_id = ?';
    const [verify] = await db.query(verifyQuery, [feedback_id, patient_id]);

    if (verify.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this feedback'
      });
    }

    if (verify[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only update feedback with pending status'
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (title) {
      updates.push('title = ?');
      values.push(sanitizeInput(title.substring(0, 255)));
    }
    if (message) {
      updates.push('message = ?');
      values.push(sanitizeInput(message.substring(0, 5000)));
    }
    if (priority) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (contact_preference) {
      updates.push('contact_preference = ?');
      values.push(contact_preference);
    }
    if (contact_info) {
      updates.push('contact_info = ?');
      values.push(contact_info);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(feedback_id);

    const updateQuery = `UPDATE feedback SET ${updates.join(', ')} WHERE id = ?`;
    await db.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Feedback updated successfully',
      feedback_id
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback',
      error: error.message
    });
  }
});

// Add response to feedback (admin only)
router.post('/:feedback_id/respond', async (req, res) => {
  try {
    const { feedback_id } = req.params;
    const { resolution_notes, status } = req.body;
    const admin_id = req.user.id; // Assuming admin authentication

    if (!resolution_notes) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes are required'
      });
    }

    const validStatuses = ['under_review', 'acknowledged', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const updateQuery = `
      UPDATE feedback 
      SET resolution_notes = ?, status = ?, assigned_to = ?, resolved_at = ?
      WHERE id = ?
    `;

    await db.query(updateQuery, [
      sanitizeInput(resolution_notes),
      status || 'acknowledged',
      admin_id,
      status === 'resolved' ? new Date() : null,
      feedback_id
    ]);

    // Log activity
    await logFeedbackActivity(feedback_id, 'responded', `Admin ${admin_id} responded to feedback`);

    res.json({
      success: true,
      message: 'Response added successfully',
      feedback_id
    });
  } catch (error) {
    console.error('Error responding to feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to feedback',
      error: error.message
    });
  }
});

// Get feedback statistics
router.get('/stats/dashboard', async (req, res) => {
  try {
    // Count by type
    const typeQuery = `
      SELECT feedback_type, COUNT(*) as count 
      FROM feedback 
      GROUP BY feedback_type
    `;
    const [typeStats] = await db.query(typeQuery);

    // Count by status
    const statusQuery = `
      SELECT status, COUNT(*) as count 
      FROM feedback 
      GROUP BY status
    `;
    const [statusStats] = await db.query(statusQuery);

    // Count by priority
    const priorityQuery = `
      SELECT priority, COUNT(*) as count 
      FROM feedback 
      WHERE status != 'closed'
      GROUP BY priority
    `;
    const [priorityStats] = await db.query(priorityQuery);

    // Average resolution time (in hours)
    const resolutionQuery = `
      SELECT 
        ROUND(AVG(TIMESTAMPDIFF(HOUR, timestamp, resolved_at)), 2) as avg_resolution_hours,
        MIN(TIMESTAMPDIFF(HOUR, timestamp, resolved_at)) as min_hours,
        MAX(TIMESTAMPDIFF(HOUR, timestamp, resolved_at)) as max_hours
      FROM feedback
      WHERE resolved_at IS NOT NULL
    `;
    const [resolutionStats] = await db.query(resolutionQuery);

    res.json({
      success: true,
      statistics: {
        by_type: typeStats,
        by_status: statusStats,
        by_priority: priorityStats,
        resolution_metrics: resolutionStats[0]
      }
    });
  } catch (error) {
    console.error('Error fetching feedback statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// Search feedback
router.get('/search', async (req, res) => {
  try {
    const { query, limit = 20, offset = 0 } = req.query;

    if (!query || query.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 3 characters'
      });
    }

    const searchQuery = `
      SELECT 
        f.id,
        f.feedback_type,
        f.title,
        f.message,
        f.status,
        f.timestamp,
        MATCH(f.title, f.message) AGAINST(? IN BOOLEAN MODE) as relevance
      FROM feedback f
      WHERE MATCH(f.title, f.message) AGAINST(? IN BOOLEAN MODE)
      ORDER BY relevance DESC
      LIMIT ? OFFSET ?
    `;

    const [results] = await db.query(searchQuery, [
      query,
      query,
      parseInt(limit),
      parseInt(offset)
    ]);

    res.json({
      success: true,
      results,
      query
    });
  } catch (error) {
    console.error('Error searching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search feedback',
      error: error.message
    });
  }
});

// Helper function to log feedback activity
async function logFeedbackActivity(feedback_id, action, details) {
  try {
    const logQuery = `
      INSERT INTO feedback_activity_log (feedback_id, action, details, timestamp)
      VALUES (?, ?, ?, NOW())
    `;
    await db.query(logQuery, [feedback_id, action, details]);
  } catch (error) {
    console.error('Error logging feedback activity:', error);
  }
}

// Export router and init function
module.exports = {
  router,
  createFeedbackTable,
  logFeedbackActivity
};
