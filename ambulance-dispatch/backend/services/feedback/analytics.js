/**
 * Analytics Service
 * Analyzes feedback trends, identifies recurring issues
 * Provides insights for service improvement
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Get feedback trends over time period
router.get('/trends', async (req, res) => {
  try {
    const { period = '30', metric = 'count' } = req.query;
    const days = parseInt(period);

    const query = `
      SELECT 
        DATE(timestamp) as date,
        feedback_type,
        COUNT(*) as total,
        AVG(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolution_rate
      FROM feedback
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(timestamp), feedback_type
      ORDER BY date DESC, feedback_type
    `;

    const [trends] = await db.query(query, [days]);

    // Calculate trend percentage
    const trendData = trends.map(trend => ({
      ...trend,
      resolution_percentage: (trend.resolution_rate * 100).toFixed(2)
    }));

    res.json({
      success: true,
      period: `${days} days`,
      trends: trendData
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends',
      error: error.message
    });
  }
});

// Identify recurring issues and patterns
router.get('/issues/recurring', async (req, res) => {
  try {
    const { period = '90', min_occurrences = 3 } = req.query;
    const days = parseInt(period);
    const minOccurrences = parseInt(min_occurrences);

    const query = `
      SELECT 
        category,
        feedback_type,
        COUNT(*) as occurrences,
        ROUND(COUNT(*) / (SELECT COUNT(*) FROM feedback WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)) * 100, 2) as percentage,
        GROUP_CONCAT(DISTINCT id SEPARATOR ',') as feedback_ids
      FROM feedback
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND category IS NOT NULL
      AND status != 'closed'
      GROUP BY category, feedback_type
      HAVING COUNT(*) >= ?
      ORDER BY occurrences DESC
    `;

    const [issues] = await db.query(query, [days, days, minOccurrences]);

    // Get detailed comments for top issues
    const detailedIssues = await Promise.all(
      issues.slice(0, 10).map(async (issue) => {
        const feedbackIds = issue.feedback_ids.split(',').slice(0, 3);
        const detailQuery = `
          SELECT id, title, message, priority, timestamp
          FROM feedback
          WHERE id IN (${feedbackIds.map(() => '?').join(',')})
          ORDER BY timestamp DESC
        `;
        const [details] = await db.query(detailQuery, feedbackIds);
        return {
          ...issue,
          sample_feedback: details
        };
      })
    );

    res.json({
      success: true,
      period: `${days} days`,
      minimum_occurrences: minOccurrences,
      recurring_issues: detailedIssues,
      total_unique_issues: issues.length
    });
  } catch (error) {
    console.error('Error identifying recurring issues:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to identify recurring issues',
      error: error.message
    });
  }
});

// Get high-priority issues requiring immediate attention
router.get('/issues/critical', async (req, res) => {
  try {
    const query = `
      SELECT 
        f.id,
        f.feedback_type,
        f.category,
        f.title,
        f.message,
        f.priority,
        f.status,
        f.timestamp,
        p.patient_phone,
        p.patient_email,
        d.driver_name,
        h.hospital_name
      FROM feedback f
      LEFT JOIN patients p ON f.patient_id = p.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN hospitals h ON f.hospital_id = h.id
      WHERE f.priority IN ('high', 'urgent')
      AND f.status != 'resolved'
      AND f.status != 'closed'
      ORDER BY 
        CASE WHEN f.priority = 'urgent' THEN 1 ELSE 2 END,
        f.timestamp DESC
      LIMIT 50
    `;

    const [criticalIssues] = await db.query(query);

    // Group by type
    const grouped = {
      urgent: criticalIssues.filter(i => i.priority === 'urgent'),
      high: criticalIssues.filter(i => i.priority === 'high')
    };

    res.json({
      success: true,
      critical_issues: grouped,
      total: criticalIssues.length
    });
  } catch (error) {
    console.error('Error fetching critical issues:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch critical issues',
      error: error.message
    });
  }
});

// Get sentiment analysis (positive, neutral, negative)
router.get('/sentiment-analysis', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    const query = `
      SELECT 
        feedback_type,
        COUNT(*) as total,
        COUNT(CASE WHEN feedback_type = 'compliment' THEN 1 END) as positive,
        COUNT(CASE WHEN feedback_type = 'suggestion' THEN 1 END) as neutral,
        COUNT(CASE WHEN feedback_type = 'complaint' THEN 1 END) as negative,
        ROUND(COUNT(CASE WHEN feedback_type = 'compliment' THEN 1 END) / COUNT(*) * 100, 2) as positive_percentage,
        ROUND(COUNT(CASE WHEN feedback_type = 'complaint' THEN 1 END) / COUNT(*) * 100, 2) as negative_percentage
      FROM feedback
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY feedback_type
    `;

    const [sentiment] = await db.query(query, [days]);

    // Overall sentiment
    const overallQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN feedback_type = 'compliment' THEN 1 END) as positive,
        COUNT(CASE WHEN feedback_type = 'complaint' THEN 1 END) as negative,
        COUNT(CASE WHEN feedback_type = 'suggestion' THEN 1 END) as neutral,
        ROUND(COUNT(CASE WHEN feedback_type = 'compliment' THEN 1 END) / COUNT(*) * 100, 2) as positive_percentage,
        ROUND(COUNT(CASE WHEN feedback_type = 'complaint' THEN 1 END) / COUNT(*) * 100, 2) as negative_percentage
      FROM feedback
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const [overall] = await db.query(overallQuery, [days]);

    res.json({
      success: true,
      period: `${days} days`,
      overall_sentiment: overall[0],
      by_category: sentiment
    });
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze sentiment',
      error: error.message
    });
  }
});

// Identify issue hotspots (drivers, hospitals with most complaints)
router.get('/hotspots', async (req, res) => {
  try {
    const { period = '30', top = 10 } = req.query;
    const days = parseInt(period);
    const topLimit = parseInt(top);

    // Driver hotspots (complaints)
    const driverQuery = `
      SELECT 
        d.id,
        d.driver_name,
        COUNT(*) as complaint_count,
        ROUND(AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating ELSE 0 END), 2) as average_rating,
        COUNT(DISTINCT f.dispatch_id) as affected_dispatches
      FROM feedback f
      JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN ratings r ON r.driver_id = d.id AND r.service_type = 'driver_conduct'
      WHERE f.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND f.feedback_type = 'complaint'
      GROUP BY d.id, d.driver_name
      ORDER BY complaint_count DESC
      LIMIT ?
    `;

    // Hospital hotspots
    const hospitalQuery = `
      SELECT 
        h.id,
        h.hospital_name,
        COUNT(*) as complaint_count,
        ROUND(AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating ELSE 0 END), 2) as average_rating,
        COUNT(DISTINCT f.dispatch_id) as affected_dispatches
      FROM feedback f
      JOIN hospitals h ON f.hospital_id = h.id
      LEFT JOIN ratings r ON r.hospital_id = h.id AND r.service_type = 'hospital_care'
      WHERE f.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND f.feedback_type = 'complaint'
      GROUP BY h.id, h.hospital_name
      ORDER BY complaint_count DESC
      LIMIT ?
    `;

    const [drivers] = await db.query(driverQuery, [days, topLimit]);
    const [hospitals] = await db.query(hospitalQuery, [days, topLimit]);

    res.json({
      success: true,
      period: `${days} days`,
      hotspots: {
        drivers: drivers,
        hospitals: hospitals
      }
    });
  } catch (error) {
    console.error('Error identifying hotspots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to identify hotspots',
      error: error.message
    });
  }
});

// Response time analysis
router.get('/response-metrics', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(AVG(TIMESTAMPDIFF(HOUR, timestamp, resolved_at)), 2) as avg_response_hours,
        MIN(TIMESTAMPDIFF(HOUR, timestamp, resolved_at)) as fastest_hours,
        MAX(TIMESTAMPDIFF(HOUR, timestamp, resolved_at)) as slowest_hours,
        ROUND(AVG(TIMESTAMPDIFF(DAY, timestamp, resolved_at)), 2) as avg_response_days
      FROM feedback
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND resolved_at IS NOT NULL
      GROUP BY status
    `;

    const [metrics] = await db.query(query, [days]);

    // SLA compliance (resolved within 48 hours)
    const slaQuery = `
      SELECT 
        COUNT(*) as total_closed,
        COUNT(CASE WHEN TIMESTAMPDIFF(HOUR, timestamp, resolved_at) <= 48 THEN 1 END) as within_sla,
        ROUND(COUNT(CASE WHEN TIMESTAMPDIFF(HOUR, timestamp, resolved_at) <= 48 THEN 1 END) / COUNT(*) * 100, 2) as sla_compliance_percentage
      FROM feedback
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND (status = 'resolved' OR status = 'closed')
      AND resolved_at IS NOT NULL
    `;

    const [sla] = await db.query(slaQuery, [days]);

    res.json({
      success: true,
      period: `${days} days`,
      response_metrics: metrics,
      sla_compliance: sla[0]
    });
  } catch (error) {
    console.error('Error analyzing response metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze response metrics',
      error: error.message
    });
  }
});

// Generate analytics report
router.get('/report/comprehensive', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE f.timestamp BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else {
      dateFilter = 'WHERE f.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    // Overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_feedback,
        COUNT(CASE WHEN f.feedback_type = 'compliment' THEN 1 END) as compliments,
        COUNT(CASE WHEN f.feedback_type = 'complaint' THEN 1 END) as complaints,
        COUNT(CASE WHEN f.feedback_type = 'suggestion' THEN 1 END) as suggestions,
        COUNT(CASE WHEN f.status IN ('resolved', 'closed') THEN 1 END) as resolved,
        ROUND(COUNT(CASE WHEN f.status IN ('resolved', 'closed') THEN 1 END) / COUNT(*) * 100, 2) as resolution_rate,
        COUNT(CASE WHEN f.priority = 'urgent' THEN 1 END) as urgent_issues
      FROM feedback f
      ${dateFilter}
    `;

    const [stats] = await db.query(statsQuery, params);

    res.json({
      success: true,
      report: {
        generated_at: new Date(),
        period: start_date && end_date ? `${start_date} to ${end_date}` : 'Last 30 days',
        summary: stats[0]
      }
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
});

// Get word frequency analysis (common words in complaints)
router.get('/word-frequency', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // This is a simplified version - in production, use a more sophisticated NLP approach
    const query = `
      SELECT 
        message,
        feedback_type
      FROM feedback
      WHERE feedback_type = 'complaint'
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      LIMIT 100
    `;

    const [feedbacks] = await db.query(query);

    // Extract and count words
    const wordFreq = {};
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'was', 'are', 'were']);

    feedbacks.forEach(f => {
      const words = f.message.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach(word => {
        if (word.length > 3 && !stopWords.has(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    const sorted = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, parseInt(limit))
      .map(([word, count]) => ({ word, count }));

    res.json({
      success: true,
      word_frequency: sorted
    });
  } catch (error) {
    console.error('Error analyzing word frequency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze word frequency',
      error: error.message
    });
  }
});

module.exports = router;
