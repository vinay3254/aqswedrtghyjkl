const analyticsService = require('./service');
const { successResponse, errorResponse } = require('../../api/utils/response');

class AnalyticsController {
  async getDashboard(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      const dashboard = await analyticsService.getDashboard(start, end);
      
      return successResponse(res, dashboard, 'Dashboard data retrieved successfully');
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      return errorResponse(res, 'Failed to fetch dashboard data', 500);
    }
  }

  async getIncidents(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      const incidents = await analyticsService.collectIncidentData(start, end);
      
      return successResponse(res, {
        incidents,
        count: incidents.length,
        date_range: { start, end }
      }, 'Incidents retrieved successfully');
    } catch (error) {
      console.error('Error fetching incidents:', error);
      return errorResponse(res, 'Failed to fetch incidents', 500);
    }
  }

  async getHotspots(req, res) {
    try {
      const { gridSize = 1 } = req.query;
      
      const hotspots = await analyticsService.getHotspots(parseFloat(gridSize));
      
      return successResponse(res, hotspots, 'Hotspots calculated successfully');
    } catch (error) {
      console.error('Error calculating hotspots:', error);
      return errorResponse(res, 'Failed to calculate hotspots', 500);
    }
  }

  async getDemandForecast(req, res) {
    try {
      const { date, timeOfDay } = req.query;
      
      const targetDate = date ? new Date(date) : new Date();
      const hour = timeOfDay !== undefined ? parseInt(timeOfDay) : null;
      
      const forecast = await analyticsService.getForecast(targetDate, hour);
      
      return successResponse(res, forecast, 'Demand forecast generated successfully');
    } catch (error) {
      console.error('Error generating forecast:', error);
      return errorResponse(res, 'Failed to generate demand forecast', 500);
    }
  }

  async getRepositioning(req, res) {
    try {
      const suggestions = await analyticsService.getRepositioningSuggestions();
      
      return successResponse(res, suggestions, 'Repositioning suggestions generated successfully');
    } catch (error) {
      console.error('Error generating repositioning suggestions:', error);
      return errorResponse(res, 'Failed to generate repositioning suggestions', 500);
    }
  }

  async getResponseTimes(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      const responseTimes = await analyticsService.getResponseTimesByZone(start, end);
      
      return successResponse(res, {
        response_times: responseTimes,
        date_range: { start, end }
      }, 'Response times retrieved successfully');
    } catch (error) {
      console.error('Error fetching response times:', error);
      return errorResponse(res, 'Failed to fetch response times', 500);
    }
  }

  async getUtilization(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      const utilization = await analyticsService.getAmbulanceUtilization(start, end);
      
      return successResponse(res, {
        utilization,
        date_range: { start, end }
      }, 'Utilization data retrieved successfully');
    } catch (error) {
      console.error('Error fetching utilization:', error);
      return errorResponse(res, 'Failed to fetch utilization data', 500);
    }
  }

  async getTrends(req, res) {
    try {
      const { period = '30d' } = req.query;
      
      const trends = await analyticsService.getIncidentTrends(period);
      
      return successResponse(res, {
        trends,
        period
      }, 'Incident trends retrieved successfully');
    } catch (error) {
      console.error('Error fetching trends:', error);
      return errorResponse(res, 'Failed to fetch incident trends', 500);
    }
  }

  async getTimeOfDay(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      const timeOfDay = await analyticsService.getIncidentsByTimeOfDay(start, end);
      
      return successResponse(res, {
        time_of_day: timeOfDay,
        date_range: { start, end }
      }, 'Time of day analysis retrieved successfully');
    } catch (error) {
      console.error('Error fetching time of day analysis:', error);
      return errorResponse(res, 'Failed to fetch time of day analysis', 500);
    }
  }

  async getHospitalLoad(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      const hospitalLoad = await analyticsService.getHospitalLoadDistribution(start, end);
      
      return successResponse(res, {
        hospital_load: hospitalLoad,
        date_range: { start, end }
      }, 'Hospital load distribution retrieved successfully');
    } catch (error) {
      console.error('Error fetching hospital load:', error);
      return errorResponse(res, 'Failed to fetch hospital load distribution', 500);
    }
  }

  async exportData(req, res) {
    try {
      const { type, startDate, endDate, format = 'csv' } = req.query;
      
      if (!type) {
        return errorResponse(res, 'Export type is required', 400);
      }
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      const exportData = await analyticsService.exportData(type, start, end, format);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.send(exportData.content);
    } catch (error) {
      console.error('Error exporting data:', error);
      return errorResponse(res, error.message || 'Failed to export data', 500);
    }
  }
}

module.exports = new AnalyticsController();
