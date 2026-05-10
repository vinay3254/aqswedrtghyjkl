module.exports = {
  // OSRM Client
  OSRMClient: require('./osrm-client'),
  
  // Route Cache
  RouteCache: require('./cache'),
  
  // Traffic Service
  TrafficService: require('./traffic'),
  
  // Fallback Calculations
  fallback: require('./fallback'),
  
  // Core Routing Service
  RoutingService: require('./service'),
  
  // Integration Helpers
  helpers: require('./helpers'),
  
  // Express Routes
  routes: require('./routes')
};
