const { AllocationService } = require('./service');
const { TransparencyService } = require('./transparency');
const { ValidationError } = require('../../api/utils/errors');
const logger = require('../../api/utils/logger');
const { successResponse, errorResponse } = require('../../api/utils/response');

class AllocationController {
  /**
   * POST /api/allocation/score-hospitals
   * Score hospitals for an incident
   */
  static async scoreHospitals(req, res) {
    try {
      const { incident_id } = req.body;
      const { max_results = 5 } = req.query;
      
      if (!incident_id) {
        throw new ValidationError('incident_id is required');
      }
      
      const result = await AllocationService.scoreHospitalsForIncident(
        incident_id,
        parseInt(max_results, 10)
      );
      
      const report = TransparencyService.generateAllocationReport(
        result.incident,
        result.recommended_hospitals,
        result.rejected_hospitals
      );
      
      logger.info(`Scored ${result.recommended_hospitals.length} hospitals for incident ${incident_id}`);
      
      return successResponse(res, report, 'Hospitals scored successfully');
    } catch (error) {
      logger.error('Error scoring hospitals:', error);
      return errorResponse(res, error);
    }
  }

  /**
   * POST /api/allocation/recommend
   * Get top N recommended hospitals
   */
  static async getRecommendations(req, res) {
    try {
      const { incident_id } = req.body;
      const { top_n = 3 } = req.query;
      
      if (!incident_id) {
        throw new ValidationError('incident_id is required');
      }
      
      const recommendations = await AllocationService.getRecommendations(
        incident_id,
        parseInt(top_n, 10)
      );
      
      logger.info(`Generated ${recommendations.recommended_hospitals.length} recommendations for incident ${incident_id}`);
      
      return successResponse(res, recommendations, 'Recommendations generated successfully');
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      return errorResponse(res, error);
    }
  }

  /**
   * POST /api/allocation/assign
   * Assign hospital to incident
   */
  static async assignHospital(req, res) {
    try {
      const { incident_id, hospital_id, override_reason } = req.body;
      const userId = req.user?.id || 'system';
      
      if (!incident_id) {
        throw new ValidationError('incident_id is required');
      }
      
      if (!hospital_id) {
        throw new ValidationError('hospital_id is required');
      }
      
      const result = await AllocationService.allocateHospital(
        incident_id,
        hospital_id,
        userId,
        override_reason
      );
      
      const message = result.was_override
        ? `Hospital assigned (manual override)`
        : `Hospital assigned (top recommendation)`;
      
      logger.info(`Hospital ${hospital_id} assigned to incident ${incident_id}. Override: ${result.was_override}`);
      
      return successResponse(res, result, message);
    } catch (error) {
      logger.error('Error assigning hospital:', error);
      return errorResponse(res, error);
    }
  }

  /**
   * GET /api/allocation/:incident_id/reasoning
   * Get allocation reasoning for an incident
   */
  static async getReasonin(req, res) {
    try {
      const { incident_id } = req.params;
      
      if (!incident_id) {
        throw new ValidationError('incident_id is required');
      }
      
      const reasoning = await AllocationService.getAllocationReasoning(incident_id);
      
      return successResponse(res, reasoning, 'Allocation reasoning retrieved successfully');
    } catch (error) {
      logger.error('Error getting allocation reasoning:', error);
      return errorResponse(res, error);
    }
  }

  /**
   * GET /api/allocation/metrics
   * Get allocation metrics and override patterns
   */
  static async getMetrics(req, res) {
    try {
      const { days = 7 } = req.query;
      
      const metrics = await AllocationService.getAllocationMetrics(parseInt(days, 10));
      
      if (!metrics) {
        return successResponse(res, { message: 'Allocation logging not configured' }, 'No metrics available');
      }
      
      return successResponse(res, metrics, 'Allocation metrics retrieved successfully');
    } catch (error) {
      logger.error('Error getting allocation metrics:', error);
      return errorResponse(res, error);
    }
  }

  /**
   * GET /api/allocation/weights
   * Get scoring weights explanation
   */
  static async getWeights(req, res) {
    try {
      const weights = TransparencyService.explainWeights();
      return successResponse(res, weights, 'Scoring weights retrieved successfully');
    } catch (error) {
      logger.error('Error getting weights:', error);
      return errorResponse(res, error);
    }
  }

  /**
   * GET /api/allocation/:incident_id/breakdown
   * Get detailed score breakdown for all hospitals
   */
  static async getScoreBreakdown(req, res) {
    try {
      const { incident_id } = req.params;
      
      if (!incident_id) {
        throw new ValidationError('incident_id is required');
      }
      
      const result = await AllocationService.scoreHospitalsForIncident(incident_id, 10);
      
      const breakdown = result.recommended_hospitals.map(hospital => ({
        hospital_id: hospital.hospital_id,
        hospital_name: hospital.hospital_name,
        total_score: hospital.total_score,
        formatted_breakdown: TransparencyService.formatScoreBreakdown(hospital),
        primary_factors: TransparencyService.findPrimaryFactor(hospital),
      }));
      
      return successResponse(res, {
        incident_id,
        hospitals: breakdown,
        rejected: TransparencyService.formatRejectionReasons(result.rejected_hospitals),
      }, 'Score breakdown retrieved successfully');
    } catch (error) {
      logger.error('Error getting score breakdown:', error);
      return errorResponse(res, error);
    }
  }
}

module.exports = {
  AllocationController,
};
