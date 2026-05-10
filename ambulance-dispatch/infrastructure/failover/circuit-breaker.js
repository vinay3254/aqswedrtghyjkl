/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by monitoring service health
 * and stopping requests to failing services
 */

class CircuitBreakerState {
  constructor(name) {
    this.name = name;
  }

  async handle(request) {
    throw new Error('handle method must be implemented');
  }
}

/**
 * CLOSED state: Circuit is working normally
 * Requests pass through, failures are tracked
 */
class ClosedState extends CircuitBreakerState {
  async handle(request) {
    try {
      const result = await request();
      return result;
    } catch (error) {
      throw error; // Let caller handle it
    }
  }
}

/**
 * OPEN state: Circuit is broken
 * Requests fail immediately without calling the service
 * Prevents cascading failures
 */
class OpenState extends CircuitBreakerState {
  handle(request) {
    const error = new Error(
      `Circuit breaker is OPEN for ${this.name}. Service is unavailable.`
    );
    error.code = 'CIRCUIT_BREAKER_OPEN';
    error.isCircuitBreakerError = true;
    throw error;
  }
}

/**
 * HALF_OPEN state: Testing if service recovered
 * Allows limited requests to test if service is healthy
 * If successful, transitions to CLOSED
 * If failures occur, returns to OPEN
 */
class HalfOpenState extends CircuitBreakerState {
  async handle(request) {
    try {
      const result = await request();
      return result;
    } catch (error) {
      throw error; // Failure in half-open will trigger re-open
    }
  }
}

class CircuitBreaker {
  /**
   * Initialize Circuit Breaker
   * @param {Object} options Configuration options
   * @param {string} options.name - Service name
   * @param {number} options.failureThreshold - Failures before opening (default: 5)
   * @param {number} options.successThreshold - Successes before closing (default: 2)
   * @param {number} options.timeout - Timeout for each request in ms (default: 5000)
   * @param {number} options.resetTimeout - Time before attempting recovery in ms (default: 60000)
   * @param {Function} options.onStateChange - Callback on state transitions
   * @param {Function} options.onRequest - Callback for each request
   */
  constructor(options = {}) {
    this.name = options.name || 'Unknown';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 5000;
    this.resetTimeout = options.resetTimeout || 60000;
    this.onStateChange = options.onStateChange || (() => {});
    this.onRequest = options.onRequest || (() => {});

    // State tracking
    this.state = new ClosedState(this.name);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    // Metrics
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.stateChangeHistory = [];

    // Reset timer
    this.resetTimer = null;
  }

  /**
   * Execute a request through the circuit breaker
   * @param {Function} fn - Async function to execute
   * @param {*} args - Arguments to pass to function
   * @returns {Promise} Result of the function
   */
  async call(fn, ...args) {
    this.totalRequests++;
    this.onRequest({
      name: this.name,
      state: this.getState(),
      totalRequests: this.totalRequests,
    });

    // Check if we should attempt recovery in OPEN state
    if (this.state instanceof OpenState && this.shouldAttemptReset()) {
      this.transitionTo(new HalfOpenState(this.name));
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        this.state.handle(() => fn(...args)),
        this.createTimeout(),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful request
   * @private
   */
  onSuccess() {
    this.totalSuccesses++;
    this.failureCount = 0; // Reset failure count

    if (this.state instanceof HalfOpenState) {
      this.successCount++;

      // If enough successes in half-open, close the circuit
      if (this.successCount >= this.successThreshold) {
        this.transitionTo(new ClosedState(this.name));
      }
    }
  }

  /**
   * Handle failed request
   * @private
   */
  onFailure(error) {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state instanceof HalfOpenState) {
      // Failure in half-open returns to open
      this.transitionTo(new OpenState(this.name));
    } else if (this.state instanceof ClosedState) {
      // Check if threshold reached
      if (this.failureCount >= this.failureThreshold) {
        this.transitionTo(new OpenState(this.name));
      }
    }
  }

  /**
   * Transition to a new state
   * @private
   */
  transitionTo(newState) {
    const oldState = this.getState();
    this.state = newState;
    this.successCount = 0;
    this.failureCount = 0;

    const timestamp = new Date().toISOString();
    this.stateChangeHistory.push({ from: oldState, to: this.getState(), timestamp });

    console.log(
      `[${timestamp}] CircuitBreaker '${this.name}': ${oldState} -> ${this.getState()}`
    );

    this.onStateChange({
      name: this.name,
      from: oldState,
      to: this.getState(),
      timestamp,
    });

    // Schedule reset attempt if entering OPEN state
    if (newState instanceof OpenState) {
      this.scheduleReset();
    } else {
      this.clearResetTimer();
    }
  }

  /**
   * Schedule reset attempt when in OPEN state
   * @private
   */
  scheduleReset() {
    this.clearResetTimer();
    this.nextAttemptTime = Date.now() + this.resetTimeout;

    this.resetTimer = setTimeout(() => {
      console.log(
        `[${new Date().toISOString()}] CircuitBreaker '${this.name}': Attempting recovery`
      );
    }, this.resetTimeout);
  }

  /**
   * Clear reset timer
   * @private
   */
  clearResetTimer() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Check if should attempt reset from OPEN state
   * @private
   */
  shouldAttemptReset() {
    return (
      this.nextAttemptTime &&
      Date.now() >= this.nextAttemptTime
    );
  }

  /**
   * Create timeout promise
   * @private
   */
  createTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`Request timeout after ${this.timeout}ms`);
        error.code = 'REQUEST_TIMEOUT';
        reject(error);
      }, this.timeout);
    });
  }

  /**
   * Get current state name
   */
  getState() {
    if (this.state instanceof ClosedState) return 'CLOSED';
    if (this.state instanceof OpenState) return 'OPEN';
    if (this.state instanceof HalfOpenState) return 'HALF_OPEN';
    return 'UNKNOWN';
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    const successRate =
      this.totalRequests > 0
        ? ((this.totalSuccesses / this.totalRequests) * 100).toFixed(2)
        : 0;

    return {
      name: this.name,
      state: this.getState(),
      totalRequests: this.totalRequests,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      successRate: `${successRate}%`,
      currentFailureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
      nextAttemptTime: this.nextAttemptTime
        ? new Date(this.nextAttemptTime).toISOString()
        : null,
      stateChangeHistory: this.stateChangeHistory.slice(-10), // Last 10 changes
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset() {
    console.log(`[${new Date().toISOString()}] CircuitBreaker '${this.name}': Manual reset`);
    this.transitionTo(new ClosedState(this.name));
    this.failureCount = 0;
    this.successCount = 0;
    this.clearResetTimer();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.clearResetTimer();
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({ ...options, name });
      this.breakers.set(name, breaker);
      return breaker;
    }
    return this.breakers.get(name);
  }

  /**
   * Get existing circuit breaker
   */
  get(name) {
    return this.breakers.get(name);
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const metrics = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * Reset all breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

// Example usage
const cbRegistry = new CircuitBreakerRegistry();

// Create circuit breaker for API service
const apiBreaker = cbRegistry.getOrCreate('api-service', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 5000,
  resetTimeout: 30000,
  onStateChange: (event) => {
    console.log(`State change: ${event.from} -> ${event.to} for ${event.name}`);
  },
});

module.exports = {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitBreakerState,
  ClosedState,
  OpenState,
  HalfOpenState,
};
