const RoutingService = require('./service');
const logger = require('../../api/middleware/logger');

const routingService = new RoutingService();

/**
 * Calculate route between points
 * POST /api/routing/calculate
 * Body: { coordinates: [[lng, lat], ...], alternatives: boolean, simplify: boolean }
 */
async function calculateRoute(req, res) {
  try {
    const { coordinates, alternatives = false, simplify = false, trafficMultiplier = null } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 coordinates required',
        message: 'Provide coordinates as array: [[lng, lat], [lng, lat]]'
      });
    }

    const result = await routingService.calculateRoute(coordinates, {
      alternatives,
      simplify,
      trafficMultiplier
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Calculate route endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Route calculation failed',
      message: error.message
    });
  }
}

/**
 * Calculate ETA with traffic
 * POST /api/routing/eta
 * Body: { origin: [lng, lat], destination: [lng, lat], datetime: ISO string }
 */
async function calculateETA(req, res) {
  try {
    const { origin, destination, datetime = null, trafficMultiplier = null } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'Origin and destination required'
      });
    }

    const options = {
      trafficMultiplier,
      datetime: datetime ? new Date(datetime) : new Date()
    };

    const result = await routingService.calculateETA(origin, destination, options);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Calculate ETA endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'ETA calculation failed',
      message: error.message
    });
  }
}

/**
 * Get alternative routes
 * POST /api/routing/alternative
 * Body: { origin: [lng, lat], destination: [lng, lat], maxAlternatives: number }
 */
async function getAlternativeRoutes(req, res) {
  try {
    const { origin, destination, maxAlternatives = 3 } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'Origin and destination required'
      });
    }

    const result = await routingService.getAlternativeRoutes(
      origin,
      destination,
      maxAlternatives
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Alternative routes endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Alternative routes calculation failed',
      message: error.message
    });
  }
}

/**
 * Calculate distance only
 * POST /api/routing/distance
 * Body: { origin: [lng, lat], destination: [lng, lat] }
 */
async function calculateDistance(req, res) {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'Origin and destination required'
      });
    }

    const result = await routingService.calculateDistance(origin, destination);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Distance calculation endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Distance calculation failed',
      message: error.message
    });
  }
}

/**
 * Batch routing requests
 * POST /api/routing/batch
 * Body: { requests: [{ origin: [lng, lat], destination: [lng, lat] }, ...] }
 */
async function batchCalculate(req, res) {
  try {
    const { requests } = req.body;

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Requests array required'
      });
    }

    if (requests.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 requests per batch'
      });
    }

    const results = await routingService.batchCalculate(requests);

    res.json({
      success: true,
      data: {
        total: results.length,
        successful: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
        results
      }
    });

  } catch (error) {
    logger.error('Batch calculation endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Batch calculation failed',
      message: error.message
    });
  }
}

/**
 * Health check endpoint
 * GET /api/routing/health
 */
async function getHealth(req, res) {
  try {
    const health = await routingService.getHealthStatus();

    const status = health.osrm.available ? 200 : 503;

    res.status(status).json({
      success: true,
      data: health
    });

  } catch (error) {
    logger.error('Health check endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message
    });
  }
}

/**
 * Get traffic predictions
 * GET /api/routing/traffic/predict?hours=24
 */
async function getTrafficPrediction(req, res) {
  try {
    const hours = parseInt(req.query.hours || '24', 10);
    
    if (hours < 1 || hours > 168) {
      return res.status(400).json({
        success: false,
        error: 'Hours must be between 1 and 168 (1 week)'
      });
    }

    const predictions = routingService.trafficService.predictTraffic(hours);

    res.json({
      success: true,
      data: {
        predictions,
        hours
      }
    });

  } catch (error) {
    logger.error('Traffic prediction endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Traffic prediction failed',
      message: error.message
    });
  }
}

/**
 * Get current traffic status
 * GET /api/routing/traffic/current
 */
async function getCurrentTraffic(req, res) {
  try {
    const multiplier = routingService.trafficService.getCurrentMultiplier();
    const level = routingService.trafficService.getTrafficLevel(multiplier);

    res.json({
      success: true,
      data: {
        multiplier,
        level,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Current traffic endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Traffic status failed',
      message: error.message
    });
  }
}

/**
 * Clear route cache
 * DELETE /api/routing/cache
 */
async function clearCache(req, res) {
  try {
    await routingService.cache.clear();

    res.json({
      success: true,
      message: 'Route cache cleared'
    });

  } catch (error) {
    logger.error('Clear cache endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Cache clear failed',
      message: error.message
    });
  }
}

module.exports = {
  calculateRoute,
  calculateETA,
  getAlternativeRoutes,
  calculateDistance,
  batchCalculate,
  getHealth,
  getTrafficPrediction,
  getCurrentTraffic,
  clearCache
};
