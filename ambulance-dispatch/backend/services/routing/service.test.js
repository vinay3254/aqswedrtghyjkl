const RoutingService = require('./service');

describe('Routing Service', () => {
  let routingService;

  beforeAll(() => {
    routingService = new RoutingService();
  });

  afterAll(async () => {
    await routingService.cache.close();
  });

  describe('Route Calculation', () => {
    test('should calculate route between two points', async () => {
      const origin = [77.2090, 28.6139]; // Delhi
      const destination = [77.1025, 28.7041];

      const result = await routingService.calculateRoute([origin, destination]);

      expect(result).toBeDefined();
      expect(result.routes).toBeDefined();
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.routes[0].distance).toBeGreaterThan(0);
      expect(result.routes[0].duration).toBeGreaterThan(0);
    }, 10000);

    test('should cache route results', async () => {
      const origin = [77.2090, 28.6139];
      const destination = [77.1025, 28.7041];

      // First call
      const result1 = await routingService.calculateRoute([origin, destination]);
      expect(result1.cached).toBeUndefined();

      // Second call should be cached
      const result2 = await routingService.calculateRoute([origin, destination]);
      expect(result2.cached).toBe(true);
    }, 10000);

    test('should simplify geometry when requested', async () => {
      const origin = [77.2090, 28.6139];
      const destination = [77.1025, 28.7041];

      const result = await routingService.calculateRoute(
        [origin, destination],
        { simplify: true }
      );

      const coords = result.routes[0].geometry.coordinates;
      expect(coords.length).toBeLessThan(100); // Simplified should be under 100 points
    }, 10000);
  });

  describe('ETA Calculation', () => {
    test('should calculate ETA with traffic', async () => {
      const origin = [77.2090, 28.6139];
      const destination = [77.1025, 28.7041];

      const result = await routingService.calculateETA(origin, destination);

      expect(result.distance).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.durationMinutes).toBeGreaterThan(0);
      expect(result.eta).toBeDefined();
      expect(result.trafficMultiplier).toBeGreaterThan(0);
      expect(result.trafficLevel).toBeDefined();
    }, 10000);
  });

  describe('Distance Calculation', () => {
    test('should calculate distance only', async () => {
      const origin = [77.2090, 28.6139];
      const destination = [77.1025, 28.7041];

      const result = await routingService.calculateDistance(origin, destination);

      expect(result.distance).toBeGreaterThan(0);
      expect(result.distanceKm).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Alternative Routes', () => {
    test('should return alternative routes', async () => {
      const origin = [77.2090, 28.6139];
      const destination = [77.1025, 28.7041];

      const result = await routingService.getAlternativeRoutes(
        origin,
        destination,
        3
      );

      expect(result.routes).toBeDefined();
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.routes[0].primary).toBe(true);
    }, 10000);
  });

  describe('Batch Calculation', () => {
    test('should handle batch routing requests', async () => {
      const requests = [
        {
          origin: [77.2090, 28.6139],
          destination: [77.1025, 28.7041]
        },
        {
          origin: [77.3000, 28.7000],
          destination: [77.1500, 28.6500]
        }
      ];

      const results = await routingService.batchCalculate(requests);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
    }, 15000);
  });

  describe('Full Route', () => {
    test('should calculate full multi-leg route', async () => {
      const ambulance = [77.2090, 28.6139];
      const incident = [77.1500, 28.6500];
      const hospital = [77.1025, 28.7041];

      const result = await routingService.calculateFullRoute(
        ambulance,
        incident,
        hospital
      );

      expect(result.legs).toBeDefined();
      expect(result.legs.length).toBe(2);
      expect(result.total).toBeDefined();
      expect(result.total.distance).toBeGreaterThan(0);
      expect(result.total.duration).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Fallback Mode', () => {
    test('should use fallback when OSRM unavailable', async () => {
      // Temporarily disable OSRM
      const originalAvailable = routingService.osrmAvailable;
      routingService.osrmAvailable = false;

      const origin = [77.2090, 28.6139];
      const destination = [77.1025, 28.7041];

      const result = await routingService.calculateRoute([origin, destination]);

      expect(result.fallback).toBe(true);
      expect(result.routes[0].distance).toBeGreaterThan(0);

      // Restore OSRM status
      routingService.osrmAvailable = originalAvailable;
    });
  });

  describe('Traffic Service', () => {
    test('should get current traffic multiplier', () => {
      const multiplier = routingService.trafficService.getCurrentMultiplier();
      
      expect(multiplier).toBeGreaterThan(0);
      expect(multiplier).toBeLessThan(3);
    });

    test('should predict traffic', () => {
      const predictions = routingService.trafficService.predictTraffic(24);
      
      expect(predictions).toBeDefined();
      expect(predictions.length).toBe(24);
      expect(predictions[0].multiplier).toBeGreaterThan(0);
      expect(predictions[0].level).toBeDefined();
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const health = await routingService.getHealthStatus();

      expect(health.osrm).toBeDefined();
      expect(health.cache).toBeDefined();
      expect(health.traffic).toBeDefined();
    });
  });
});
