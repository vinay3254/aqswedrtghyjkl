/**
 * Offline Router
 * Implements A* pathfinding algorithm using cached road network data
 * Optimized for ambulance routing with real-time obstacle avoidance
 */

const EventEmitter = require('events');
const PriorityQueue = require('priorityqueue');

class OfflineRouter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.roadNetwork = new Map(); // nodeId -> { lat, lon, edges: [{ to, distance, type }] }
    this.searchRadius = options.searchRadius || 0.01; // degrees (~1km)
    this.maxPathLength = options.maxPathLength || 50000; // meters
    this.heuristics = options.heuristics || 'haversine'; // haversine, euclidean
    this.avoidanceZones = new Map(); // zone-id -> { boundary, penalty }
    this.roadTypeWeights = options.roadTypeWeights || {
      motorway: 0.5,
      trunk: 0.6,
      primary: 0.8,
      secondary: 1.0,
      tertiary: 1.2,
      residential: 1.5,
      service: 2.0,
      footway: 5.0
    };
    this.logger = options.logger || console;
    this.cache = new Map(); // Cache for frequently searched routes
    this.maxCacheSize = options.maxCacheSize || 1000;
  }

  /**
   * Initialize router with road network data
   * @param {array} nodes - Array of road network nodes: { id, lat, lon, type }
   * @param {array} edges - Array of edges: { from, to, distance, type, restrictions }
   */
  async initialize(nodes, edges) {
    try {
      this.logger.log('[OfflineRouter] Initializing with road network');

      // Build road network graph
      for (const node of nodes) {
        this.roadNetwork.set(node.id, {
          id: node.id,
          lat: node.lat,
          lon: node.lon,
          type: node.type || 'intersection',
          edges: []
        });
      }

      // Add edges
      for (const edge of edges) {
        const fromNode = this.roadNetwork.get(edge.from);
        const toNode = this.roadNetwork.get(edge.to);

        if (fromNode && toNode) {
          fromNode.edges.push({
            to: edge.to,
            distance: edge.distance,
            type: edge.type || 'unknown',
            restrictions: edge.restrictions || {}
          });
        }
      }

      this.logger.log(`[OfflineRouter] Loaded ${nodes.length} nodes and ${edges.length} edges`);
      this.emit('initialized', { nodeCount: nodes.length, edgeCount: edges.length });

      return { success: true, nodeCount: nodes.length, edgeCount: edges.length };
    } catch (error) {
      this.logger.error('[OfflineRouter] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Find optimal route using A* algorithm
   * @param {object} start - { lat, lon }
   * @param {object} end - { lat, lon }
   * @param {object} options - { avoidZones, preferredRoads, ambulancePriority }
   */
  async findRoute(start, end, options = {}) {
    const startTime = Date.now();
    const cacheKey = this._getCacheKey(start, end, options);

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      this.logger.log(`[OfflineRouter] Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      const { avoidZones = [], preferredRoads = [], ambulancePriority = true } = options;

      // Find nearest nodes
      const startNode = this._findNearestNode(start);
      const endNode = this._findNearestNode(end);

      if (!startNode || !endNode) {
        throw new Error('Could not find nearby road network nodes');
      }

      // Run A* algorithm
      const route = await this._aStarSearch(
        startNode.id,
        endNode.id,
        { avoidZones, preferredRoads, ambulancePriority }
      );

      if (!route) {
        throw new Error('No route found between start and end points');
      }

      // Enhance route with waypoint details
      const enhancedRoute = this._enhanceRoute(route, start, end);
      const duration = Date.now() - startTime;

      this.logger.log(`[OfflineRouter] Route found in ${duration}ms, distance: ${enhancedRoute.distance}m`);

      // Cache the result
      this._cacheRoute(cacheKey, enhancedRoute);

      this.emit('routeFound', { distance: enhancedRoute.distance, duration, waypoints: enhancedRoute.waypoints.length });

      return enhancedRoute;
    } catch (error) {
      this.logger.error('[OfflineRouter] Route finding failed:', error);
      this.emit('routeFailed', { error: error.message });
      throw error;
    }
  }

  /**
   * A* pathfinding algorithm
   * @private
   */
  async _aStarSearch(startNodeId, endNodeId, options) {
    const openSet = new PriorityQueue((a, b) => a.fScore - b.fScore);
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const visited = new Set();

    const startNode = this.roadNetwork.get(startNodeId);
    const endNode = this.roadNetwork.get(endNodeId);

    const h = this._heuristic(startNode, endNode);
    gScore.set(startNodeId, 0);
    fScore.set(startNodeId, h);

    openSet.enqueue({ id: startNodeId, fScore: h });

    while (!openSet.isEmpty()) {
      const current = openSet.dequeue();

      if (current.id === endNodeId) {
        return this._reconstructPath(cameFrom, current.id);
      }

      if (visited.has(current.id)) {
        continue;
      }

      visited.add(current.id);
      const currentNode = this.roadNetwork.get(current.id);

      for (const edge of currentNode.edges) {
        if (visited.has(edge.to)) {
          continue;
        }

        const neighbor = this.roadNetwork.get(edge.to);
        const tentativeGScore = gScore.get(current.id) + this._calculateEdgeCost(edge, options);

        if (!gScore.has(edge.to) || tentativeGScore < gScore.get(edge.to)) {
          cameFrom.set(edge.to, current.id);
          gScore.set(edge.to, tentativeGScore);

          const hScore = this._heuristic(neighbor, endNode);
          const fScoreValue = tentativeGScore + hScore;
          fScore.set(edge.to, fScoreValue);

          openSet.enqueue({ id: edge.to, fScore: fScoreValue });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Reconstruct path from A* search
   * @private
   */
  _reconstructPath(cameFrom, endNodeId) {
    const path = [endNodeId];
    let current = endNodeId;

    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }

    return path;
  }

  /**
   * Calculate edge cost considering weight and restrictions
   * @private
   */
  _calculateEdgeCost(edge, options) {
    let cost = edge.distance;
    const weight = this.roadTypeWeights[edge.type] || 1.0;

    // Apply road type weight
    cost *= weight;

    // Apply ambulance priority (prefer main roads for emergency)
    if (options.ambulancePriority && weight < 1.0) {
      cost *= 0.8; // 20% discount on main roads for ambulances
    }

    // Avoid zones penalty
    if (options.avoidZones && options.avoidZones.length > 0) {
      for (const zone of options.avoidZones) {
        // Check if edge intersects with avoidance zone
        if (this._edgeIntersectsZone(edge, zone)) {
          cost *= zone.penalty || 5.0;
        }
      }
    }

    return cost;
  }

  /**
   * Check if edge intersects with avoidance zone
   * @private
   */
  _edgeIntersectsZone(edge, zone) {
    // Simple boundary check (can be enhanced with geometric intersection)
    const fromNode = this.roadNetwork.get(edge.from);
    const toNode = this.roadNetwork.get(edge.to);
    
    const { north, south, east, west } = zone.boundary;
    
    return (
      (fromNode.lat >= south && fromNode.lat <= north && fromNode.lon >= west && fromNode.lon <= east) ||
      (toNode.lat >= south && toNode.lat <= north && toNode.lon >= west && toNode.lon <= east)
    );
  }

  /**
   * Heuristic function for A*
   * @private
   */
  _heuristic(nodeA, nodeB) {
    if (this.heuristics === 'haversine') {
      return this._haversineDistance(nodeA, nodeB);
    } else if (this.heuristics === 'euclidean') {
      return this._euclideanDistance(nodeA, nodeB);
    }
    return 0;
  }

  /**
   * Haversine distance calculation
   * @private
   */
  _haversineDistance(nodeA, nodeB) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (nodeB.lat - nodeA.lat) * Math.PI / 180;
    const dLon = (nodeB.lon - nodeA.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(nodeA.lat * Math.PI / 180) * Math.cos(nodeB.lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Euclidean distance calculation
   * @private
   */
  _euclideanDistance(nodeA, nodeB) {
    const dx = (nodeB.lon - nodeA.lon) * 111000; // Approximate meters per degree
    const dy = (nodeB.lat - nodeA.lat) * 111000;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Find nearest node to coordinates
   * @private
   */
  _findNearestNode(coordinates) {
    let nearest = null;
    let minDistance = Infinity;

    for (const [nodeId, node] of this.roadNetwork) {
      const distance = this._haversineDistance(coordinates, node);
      if (distance < minDistance && distance < this.searchRadius * 111000) {
        minDistance = distance;
        nearest = node;
      }
    }

    return nearest;
  }

  /**
   * Enhance route with detailed waypoint information
   * @private
   */
  _enhanceRoute(nodeIds, startCoords, endCoords) {
    let totalDistance = 0;
    const waypoints = [];

    // Add start point
    waypoints.push({
      type: 'start',
      lat: startCoords.lat,
      lon: startCoords.lon,
      distance: 0,
      instructions: 'Start navigation'
    });

    // Add intermediate waypoints
    for (let i = 0; i < nodeIds.length; i++) {
      const currentNode = this.roadNetwork.get(nodeIds[i]);
      const nextNode = i < nodeIds.length - 1 ? this.roadNetwork.get(nodeIds[i + 1]) : null;

      if (currentNode && i > 0) {
        let instructions = 'Continue';

        if (nextNode) {
          const bearing = this._calculateBearing(currentNode, nextNode);
          const direction = this._bearingToDirection(bearing);
          instructions = `Turn ${direction}`;
        }

        waypoints.push({
          type: 'waypoint',
          nodeId: currentNode.id,
          lat: currentNode.lat,
          lon: currentNode.lon,
          distance: totalDistance,
          instructions,
          roadType: currentNode.type
        });
      }

      // Add edge distance
      if (nextNode) {
        const edge = currentNode.edges.find(e => e.to === nextNode.id);
        if (edge) {
          totalDistance += edge.distance;
        }
      }
    }

    // Add end point
    waypoints.push({
      type: 'end',
      lat: endCoords.lat,
      lon: endCoords.lon,
      distance: totalDistance,
      instructions: 'Destination reached'
    });

    return {
      distance: totalDistance,
      waypoints,
      duration: this._estimateDuration(totalDistance),
      summary: `${(totalDistance / 1000).toFixed(2)}km route`
    };
  }

  /**
   * Calculate bearing between two points
   * @private
   */
  _calculateBearing(from, to) {
    const dLon = to.lon - from.lon;
    const y = Math.sin(dLon * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180);
    const x = Math.cos(from.lat * Math.PI / 180) * Math.sin(to.lat * Math.PI / 180) -
              Math.sin(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.cos(dLon * Math.PI / 180);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Convert bearing to direction
   * @private
   */
  _bearingToDirection(bearing) {
    const directions = ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  /**
   * Estimate duration based on distance
   * @private
   */
  _estimateDuration(distance) {
    // Assume average speed of 40 km/h for ambulance
    const averageSpeed = 40000 / 3600; // m/s
    return Math.round(distance / averageSpeed / 60); // minutes
  }

  /**
   * Register avoidance zone
   */
  registerAvoidanceZone(zoneId, boundary, penalty = 5.0) {
    this.avoidanceZones.set(zoneId, { boundary, penalty });
    this.logger.log(`[OfflineRouter] Registered avoidance zone: ${zoneId}`);
  }

  /**
   * Remove avoidance zone
   */
  removeAvoidanceZone(zoneId) {
    this.avoidanceZones.delete(zoneId);
    this.cache.clear(); // Invalidate cache
  }

  /**
   * Cache route result
   * @private
   */
  _cacheRoute(key, route) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, route);
  }

  /**
   * Get cache key for route
   * @private
   */
  _getCacheKey(start, end, options) {
    const startStr = `${start.lat.toFixed(5)},${start.lon.toFixed(5)}`;
    const endStr = `${end.lat.toFixed(5)},${end.lon.toFixed(5)}`;
    const optionsStr = options.ambulancePriority ? 'ambulance' : 'default';
    return `${startStr}-${endStr}-${optionsStr}`;
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      nodeCount: this.roadNetwork.size,
      edgeCount: Array.from(this.roadNetwork.values()).reduce((sum, n) => sum + n.edges.length, 0),
      avoidanceZones: this.avoidanceZones.size,
      cachedRoutes: this.cache.size,
      maxCache: this.maxCacheSize
    };
  }

  /**
   * Clear route cache
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`[OfflineRouter] Cleared ${size} cached routes`);
  }
}

module.exports = OfflineRouter;
