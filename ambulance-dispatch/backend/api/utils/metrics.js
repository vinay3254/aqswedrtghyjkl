let requestCount = 0;
let totalResponseTime = 0;
let requestsByEndpoint = {};
let requestsByMethod = {};
let errorCount = 0;
let statusCodeCounts = {};

const incrementRequestCount = () => {
  requestCount++;
};

const recordResponseTime = (time) => {
  totalResponseTime += time;
};

const recordEndpoint = (endpoint) => {
  requestsByEndpoint[endpoint] = (requestsByEndpoint[endpoint] || 0) + 1;
};

const recordMethod = (method) => {
  requestsByMethod[method] = (requestsByMethod[method] || 0) + 1;
};

const incrementErrorCount = () => {
  errorCount++;
};

const recordStatusCode = (code) => {
  statusCodeCounts[code] = (statusCodeCounts[code] || 0) + 1;
};

const getMetrics = () => {
  return {
    requests: {
      total: requestCount,
      byEndpoint: requestsByEndpoint,
      byMethod: requestsByMethod,
    },
    responses: {
      averageTime: requestCount > 0 ? totalResponseTime / requestCount : 0,
      totalTime: totalResponseTime,
      errors: errorCount,
      statusCodes: statusCodeCounts,
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
};

const resetMetrics = () => {
  requestCount = 0;
  totalResponseTime = 0;
  requestsByEndpoint = {};
  requestsByMethod = {};
  errorCount = 0;
  statusCodeCounts = {};
};

module.exports = {
  incrementRequestCount,
  recordResponseTime,
  recordEndpoint,
  recordMethod,
  incrementErrorCount,
  recordStatusCode,
  getMetrics,
  resetMetrics,
};
