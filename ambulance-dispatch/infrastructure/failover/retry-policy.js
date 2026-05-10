/**
 * Retry Policy with Exponential Backoff
 * Implements intelligent retry logic for transient failures
 * with exponential backoff, jitter, and circuit breaker integration
 */

class RetryPolicy {
  /**
   * Initialize Retry Policy
   * @param {Object} options Configuration options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.initialDelayMs - Initial delay in milliseconds (default: 100)
   * @param {number} options.maxDelayMs - Maximum delay in milliseconds (default: 30000)
   * @param {number} options.backoffMultiplier - Exponential backoff multiplier (default: 2)
   * @param {number} options.jitterFactor - Jitter factor 0-1 (default: 0.1)
   * @param {Function} options.shouldRetry - Function to determine if error is retryable
   * @param {Function} options.onRetry - Callback on retry attempt
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.initialDelayMs = options.initialDelayMs || 100;
    this.maxDelayMs = options.maxDelayMs || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitterFactor = options.jitterFactor || 0.1;
    this.shouldRetry = options.shouldRetry || this.defaultShouldRetry;
    this.onRetry = options.onRetry || (() => {});

    // Metrics
    this.totalAttempts = 0;
    this.totalRetries = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Async function to execute
   * @param {*} args - Arguments to pass to function
   * @returns {Promise} Result of the function
   */
  async execute(fn, ...args) {
    let lastError;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        this.totalAttempts++;
        attempt++;

        const result = await fn(...args);
        this.totalSuccesses++;
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.shouldRetry(error, attempt)) {
          this.totalFailures++;
          throw error;
        }

        // Don't retry if we've exceeded max retries
        if (attempt > this.maxRetries) {
          this.totalFailures++;
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        this.totalRetries++;

        this.onRetry({
          attempt,
          maxRetries: this.maxRetries,
          error: error.message,
          nextRetryDelayMs: delay,
          totalAttemptsIncludingThis: this.totalAttempts,
        });

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    this.totalFailures++;
    throw lastError;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * Formula: min(initialDelay * (backoffMultiplier ^ (attempt - 1)) * (1 + random * jitterFactor), maxDelay)
   * @private
   */
  calculateDelay(attempt) {
    // Exponential backoff
    const exponentialDelay = this.initialDelayMs * Math.pow(
      this.backoffMultiplier,
      attempt - 1
    );

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);

    // Add jitter (randomness)
    const jitter = cappedDelay * this.jitterFactor * Math.random();

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Default function to determine if error is retryable
   * @private
   */
  defaultShouldRetry(error, attempt) {
    // Don't retry on 4xx errors (client errors)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      // Except 408 (Request Timeout) and 429 (Too Many Requests)
      if (error.statusCode === 408 || error.statusCode === 429) {
        return true;
      }
      return false;
    }

    // Retry on 5xx errors, timeouts, and network errors
    if (error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'EHOSTUNREACH' ||
        error.statusCode === 408 ||
        error.statusCode === 429 ||
        error.statusCode >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry metrics
   */
  getMetrics() {
    const successRate =
      this.totalAttempts > 0
        ? ((this.totalSuccesses / this.totalAttempts) * 100).toFixed(2)
        : 0;

    const retryRate =
      this.totalAttempts > 0
        ? ((this.totalRetries / this.totalAttempts) * 100).toFixed(2)
        : 0;

    return {
      totalAttempts: this.totalAttempts,
      totalRetries: this.totalRetries,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      successRate: `${successRate}%`,
      retryRate: `${retryRate}%`,
      configuration: {
        maxRetries: this.maxRetries,
        initialDelayMs: this.initialDelayMs,
        maxDelayMs: this.maxDelayMs,
        backoffMultiplier: this.backoffMultiplier,
        jitterFactor: this.jitterFactor,
      },
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.totalAttempts = 0;
    this.totalRetries = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
  }
}

/**
 * Advanced Retry Strategy with multiple configurations
 */
class RetryStrategy {
  constructor() {
    this.strategies = new Map();
  }

  /**
   * Register a retry strategy
   */
  register(name, options = {}) {
    const policy = new RetryPolicy(options);
    this.strategies.set(name, policy);
    return policy;
  }

  /**
   * Get strategy by name
   */
  get(name) {
    if (!this.strategies.has(name)) {
      throw new Error(`Retry strategy '${name}' not found`);
    }
    return this.strategies.get(name);
  }

  /**
   * Execute with specific strategy
   */
  async execute(strategyName, fn, ...args) {
    const strategy = this.get(strategyName);
    return strategy.execute(fn, ...args);
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const metrics = {};
    for (const [name, policy] of this.strategies) {
      metrics[name] = policy.getMetrics();
    }
    return metrics;
  }
}

/**
 * Retry Context - tracks retry state for a specific execution
 */
class RetryContext {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.currentAttempt = 0;
    this.errors = [];
    this.startTime = Date.now();
  }

  /**
   * Record error
   */
  recordError(error) {
    this.errors.push({
      attempt: this.currentAttempt,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if can retry
   */
  canRetry() {
    return this.currentAttempt < this.maxRetries;
  }

  /**
   * Increment attempt
   */
  nextAttempt() {
    this.currentAttempt++;
  }

  /**
   * Get execution duration
   */
  getDuration() {
    return Date.now() - this.startTime;
  }

  /**
   * Get context summary
   */
  getSummary() {
    return {
      totalAttempts: this.currentAttempt,
      maxRetries: this.maxRetries,
      errorCount: this.errors.length,
      durationMs: this.getDuration(),
      errors: this.errors,
    };
  }
}

/**
 * Practical retry configuration presets
 */
const RetryPresets = {
  /**
   * Fast retry - suitable for transient network errors
   */
  FAST: {
    maxRetries: 3,
    initialDelayMs: 50,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },

  /**
   * Standard retry - balanced for typical scenarios
   */
  STANDARD: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },

  /**
   * Aggressive retry - for critical operations
   */
  AGGRESSIVE: {
    maxRetries: 5,
    initialDelayMs: 100,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
  },

  /**
   * Gentle retry - for rate-limited APIs
   */
  GENTLE: {
    maxRetries: 4,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2.5,
    jitterFactor: 0.3,
  },

  /**
   * Minimal retry - only for critical failures
   */
  MINIMAL: {
    maxRetries: 1,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
    jitterFactor: 0.05,
  },
};

// Example usage and integration
const retryStrategy = new RetryStrategy();

// Register common retry strategies
retryStrategy.register('api-calls', RetryPresets.STANDARD);
retryStrategy.register('database-queries', RetryPresets.AGGRESSIVE);
retryStrategy.register('external-services', RetryPresets.GENTLE);

module.exports = {
  RetryPolicy,
  RetryStrategy,
  RetryContext,
  RetryPresets,
};
