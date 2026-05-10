# Load Testing Suite - Ambulance Dispatch System

This directory contains comprehensive load testing scenarios using **k6** to validate the performance and reliability of the ambulance dispatch system under various load conditions.

## Overview

The load testing suite includes:

1. **Dispatch Endpoint Load Test** - Tests HTTP endpoints under increasing load
2. **WebSocket Stress Test** - Validates real-time WebSocket connections
3. **Concurrent Users Simulation** - Simulates 1000+ concurrent users with realistic workflows

## Prerequisites

### Install k6

K6 is a modern load testing framework. Install it for your platform:

**Windows (using Chocolatey):**
```powershell
choco install k6
```

**Windows (manual):**
1. Download from https://k6.io/docs/getting-started/installation/
2. Add to PATH

**macOS:**
```bash
brew install k6
```

**Linux (Ubuntu/Debian):**
```bash
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
sudo apt-get update
sudo apt-get install k6
```

**Linux (CentOS/RedHat):**
```bash
sudo yum install https://dl.k6.io/rpm/repo.rpm
sudo yum install k6
```

### Verify Installation

```bash
k6 version
```

## Project Structure

```
tests/load/
├── k6-config.js                 # Shared configuration and utilities
├── scenarios/
│   ├── dispatch-load.js        # HTTP endpoint load test
│   ├── websocket-stress.js     # WebSocket stress test
│   └── concurrent-users.js     # 1000+ concurrent users simulation
├── run-tests.sh                # Test runner script
├── README.md                   # This file
└── results/                    # Test results (auto-created)
    ├── dispatch-*.json
    ├── websocket-*.json
    └── concurrent-*.json
```

## Quick Start

### Run All Tests

```bash
./run-tests.sh
```

### Run Specific Test

```bash
# Dispatch endpoint test
./run-tests.sh dispatch

# WebSocket stress test
./run-tests.sh websocket

# Concurrent users simulation
./run-tests.sh concurrent
```

### Run with Custom Options

```bash
# Target staging environment
./run-tests.sh all --environment staging

# Custom API URL
./run-tests.sh dispatch --api-url https://api.example.com

# Custom WebSocket URL
./run-tests.sh websocket --ws-url wss://api.example.com

# Set authentication token
./run-tests.sh all --token "your-auth-token"
```

## Configuration

### Environment Variables

Set environment variables before running tests:

```bash
# Linux/macOS
export API_URL="http://localhost:3000/api"
export WS_URL="ws://localhost:3000"
export ENVIRONMENT="dev"
export AUTH_TOKEN="your-token"
export VERBOSE="true"

./run-tests.sh all
```

```powershell
# Windows PowerShell
$env:API_URL = "http://localhost:3000/api"
$env:WS_URL = "ws://localhost:3000"
$env:ENVIRONMENT = "dev"
$env:AUTH_TOKEN = "your-token"
$env:VERBOSE = "true"

.\run-tests.ps1 all
```

### k6-config.js

Central configuration file containing:
- API/WebSocket URLs
- Request timeouts
- Performance thresholds
- Common headers
- Utility functions for generating test data

**Key settings:**

```javascript
{
  apiBaseUrl: 'http://localhost:3000/api',
  wsBaseUrl: 'ws://localhost:3000',
  timeout: 30000,  // 30 seconds
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.1'],
  }
}
```

## Test Scenarios

### 1. Dispatch Endpoint Load Test

**File:** `scenarios/dispatch-load.js`

Tests the HTTP API under increasing load:

- **VU Ramp-up:** 50 → 100 → 200 users over 6 minutes
- **Test Duration:** ~14 minutes total
- **Endpoints Tested:**
  - POST /dispatches - Create dispatch
  - GET /dispatches - List dispatches
  - GET /dispatches/{id} - Get dispatch details
  - PUT /dispatches/{id} - Update dispatch
  - DELETE /dispatches/{id} - Cancel dispatch

**Run:**
```bash
k6 run scenarios/dispatch-load.js
```

**Expected Results:**
- 95th percentile response time: < 500ms
- 99th percentile response time: < 1000ms
- Error rate: < 5%

### 2. WebSocket Stress Test

**File:** `scenarios/websocket-stress.js`

Tests WebSocket real-time connections:

- **Connection Ramp-up:** 50 → 100 → 200 → 500 connections
- **Peak Load:** 500 concurrent WebSocket connections
- **Test Duration:** ~18 minutes total
- **Actions:**
  - Establish WebSocket connection
  - Subscribe to dispatch channel
  - Receive real-time updates
  - Send periodic status updates
  - Handle graceful disconnection

**Run:**
```bash
k6 run scenarios/websocket-stress.js
```

**Expected Results:**
- Connection success rate: > 90%
- Message latency p95: < 200ms
- Message latency p99: < 500ms

### 3. Concurrent Users Simulation

**File:** `scenarios/concurrent-users.js`

Simulates realistic user workflows with 1000+ concurrent users:

- **VU Ramp-up:** 100 → 250 → 500 → 1000 users over 10 minutes
- **Steady State:** 1000 concurrent users for 10 minutes
- **User Types:**
  - **Dispatchers (30%):** Create and manage dispatches
  - **Responders (40%):** Accept dispatches and update status
  - **Administrators (30%):** View analytics and reports

**Run:**
```bash
k6 run scenarios/concurrent-users.js
```

**Expected Results:**
- Request success rate: > 95%
- P90 response time: < 500ms
- P95 response time: < 1000ms
- P99 response time: < 2000ms
- Total dispatches created: 10,000+

## Performance Thresholds

Default SLOs (Service Level Objectives):

| Metric | Threshold | Severity |
|--------|-----------|----------|
| P95 Response Time | < 500ms | Critical |
| P99 Response Time | < 1000ms | Critical |
| Error Rate | < 5% | Critical |
| HTTP 5xx Rate | < 1% | Critical |
| WebSocket Connection Success | > 90% | Warning |
| WebSocket Message Latency P95 | < 200ms | Warning |

## Analyzing Results

### View Results in Terminal

```bash
k6 run scenarios/dispatch-load.js --summary
```

### Export Results to JSON

```bash
k6 run scenarios/dispatch-load.js --out json=results/dispatch.json
```

### Import to Grafana Cloud

```bash
k6 run scenarios/dispatch-load.js --out cloud
```

### Parse Results

Results are saved as JSON files in the `results/` directory:

```bash
# View results summary
cat results/dispatch-*.json | jq '.data.result | group_by(.metric) | .[] | {metric: .[0].metric, samples: length}'

# Extract response times
cat results/dispatch-*.json | jq '.data.result[] | select(.metric == "http_req_duration") | .value'

# Extract error rates
cat results/dispatch-*.json | jq '.data.result[] | select(.metric == "http_req_failed") | .value'
```

## Advanced Usage

### Custom VU Configuration

```bash
# Run with specific number of virtual users
k6 run --vus 200 --duration 5m scenarios/dispatch-load.js
```

### Ramp-up Testing

```bash
# Custom ramp-up pattern
k6 run --stage 2m:10 --stage 2m:50 --stage 5m:100 --stage 2m:0 scenarios/dispatch-load.js
```

### Rate Limiting Tests

```bash
# Limit to specific request rate
k6 run --rps 1000 scenarios/dispatch-load.js
```

### Custom Thresholds

Modify `k6-config.js` to change SLOs:

```javascript
thresholds: {
  'http_req_duration': ['p(95)<300', 'p(99)<500'],  // Stricter
  'http_req_failed': ['rate<0.01'],                 // Stricter
}
```

## Continuous Integration

### GitHub Actions

Add to `.github/workflows/load-test.yml`:

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM
  workflow_dispatch:

jobs:
  load-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: grafana/setup-k6-action@v1
      - run: |
          cd ambulance-dispatch-system/tests/load
          chmod +x run-tests.sh
          ./run-tests.sh all
        env:
          API_URL: ${{ secrets.STAGING_API_URL }}
          WS_URL: ${{ secrets.STAGING_WS_URL }}
          AUTH_TOKEN: ${{ secrets.TEST_TOKEN }}
```

## Troubleshooting

### K6 Connection Refused

**Error:** `Connection refused`

**Solution:**
- Ensure API server is running
- Check API_URL and WS_URL environment variables
- Verify firewall allows connections

```bash
# Test connectivity
curl -v http://localhost:3000/api/health

# Test WebSocket
wscat -c ws://localhost:3000/ws
```

### High Error Rate

**Error:** `Error rate > 5%`

**Solution:**
1. Check API server logs for errors
2. Reduce load (--vus parameter)
3. Increase timeout in k6-config.js
4. Verify test data and endpoints

### Memory Issues

**Error:** `Out of memory`

**Solution:**
- Reduce VU count
- Reduce test duration
- Enable streaming results: `k6 run --out json=results/stream.json`

### WebSocket Timeouts

**Error:** `WebSocket: connection timeout`

**Solution:**
1. Increase timeout in k6-config.js
2. Check WebSocket server capacity
3. Reduce concurrent WebSocket connections

## Best Practices

1. **Test against staging first** - Never load test production without approval
2. **Gradual ramp-up** - Start slow to avoid overwhelming the system
3. **Monitor during tests** - Watch server metrics and logs
4. **Baseline testing** - Establish baseline before system changes
5. **Regular testing** - Schedule weekly or monthly load tests
6. **Document results** - Keep historical results for trend analysis
7. **Vary test scenarios** - Different user patterns reveal different issues
8. **Test error handling** - Include failure scenarios and retries

## Performance Benchmarks

Expected performance benchmarks for ambulance dispatch system:

| Scenario | VUs | Requests/sec | Avg Response | P95 Response | Error Rate |
|----------|-----|--------------|--------------|--------------|-----------|
| Dispatch Load | 200 | 400 | 150ms | 400ms | 1% |
| WebSocket Stress | 500 conn | 5000 msgs/sec | 50ms | 150ms | <1% |
| Concurrent Users | 1000 | 1500 | 200ms | 800ms | 2% |

## Resources

- **K6 Documentation:** https://k6.io/docs/
- **K6 API Reference:** https://k6.io/docs/javascript-api/
- **K6 Cloud:** https://cloud.k6.io/
- **Grafana Integration:** https://grafana.com/grafana/dashboards/
- **Load Testing Guide:** https://k6.io/docs/testing-guides/

## Support

For issues or questions:

1. Check K6 documentation: https://k6.io/docs/
2. Review test logs in `results/` directory
3. Check API server logs
4. Verify environment configuration
5. Enable verbose logging: `VERBOSE=true`

## License

These load tests are part of the Ambulance Dispatch System project.
