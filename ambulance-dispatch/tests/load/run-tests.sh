#!/bin/bash

###############################################################################
# Load Testing Suite Runner
# Runs all k6 load testing scenarios for the ambulance dispatch system
#
# Usage:
#   ./run-tests.sh                    # Run all tests
#   ./run-tests.sh dispatch           # Run only dispatch load test
#   ./run-tests.sh websocket          # Run only WebSocket stress test
#   ./run-tests.sh concurrent         # Run only concurrent users test
#   ./run-tests.sh all --vus 100     # Run all with 100 VUs
#   ./run-tests.sh --environment staging  # Run against staging environment
###############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="${API_URL:-http://localhost:3000/api}"
WS_URL="${WS_URL:-ws://localhost:3000}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token}"
RESULTS_DIR="${SCRIPT_DIR}/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${RESULTS_DIR}/load-test-${TIMESTAMP}.html"

# Ensure k6 is installed
check_k6_installed() {
  if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Please install k6 from: https://k6.io/docs/getting-started/installation/"
    exit 1
  fi
}

# Create results directory
setup_results_dir() {
  mkdir -p "${RESULTS_DIR}"
  echo -e "${BLUE}Results will be saved to: ${RESULTS_DIR}${NC}"
}

# Print header
print_header() {
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║   Ambulance Dispatch System - Load Testing Suite          ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo "Environment: ${ENVIRONMENT}"
  echo "API URL: ${API_URL}"
  echo "WebSocket URL: ${WS_URL}"
  echo "Timestamp: ${TIMESTAMP}"
  echo ""
}

# Run dispatch endpoint load test
run_dispatch_test() {
  echo -e "${YELLOW}Running Dispatch Endpoint Load Test...${NC}"
  
  k6 run \
    -e API_URL="${API_URL}" \
    -e WS_URL="${WS_URL}" \
    -e ENVIRONMENT="${ENVIRONMENT}" \
    -e AUTH_TOKEN="${AUTH_TOKEN}" \
    -e VERBOSE="true" \
    --out json="${RESULTS_DIR}/dispatch-${TIMESTAMP}.json" \
    "${SCRIPT_DIR}/scenarios/dispatch-load.js"
  
  echo -e "${GREEN}✓ Dispatch test completed${NC}"
}

# Run WebSocket stress test
run_websocket_test() {
  echo -e "${YELLOW}Running WebSocket Stress Test...${NC}"
  
  k6 run \
    -e API_URL="${API_URL}" \
    -e WS_URL="${WS_URL}" \
    -e ENVIRONMENT="${ENVIRONMENT}" \
    -e AUTH_TOKEN="${AUTH_TOKEN}" \
    -e VERBOSE="true" \
    --out json="${RESULTS_DIR}/websocket-${TIMESTAMP}.json" \
    "${SCRIPT_DIR}/scenarios/websocket-stress.js"
  
  echo -e "${GREEN}✓ WebSocket test completed${NC}"
}

# Run concurrent users simulation
run_concurrent_test() {
  echo -e "${YELLOW}Running Concurrent Users Simulation (1000+ users)...${NC}"
  
  k6 run \
    -e API_URL="${API_URL}" \
    -e WS_URL="${WS_URL}" \
    -e ENVIRONMENT="${ENVIRONMENT}" \
    -e AUTH_TOKEN="${AUTH_TOKEN}" \
    -e VERBOSE="true" \
    --out json="${RESULTS_DIR}/concurrent-${TIMESTAMP}.json" \
    "${SCRIPT_DIR}/scenarios/concurrent-users.js"
  
  echo -e "${GREEN}✓ Concurrent users test completed${NC}"
}

# Run all tests
run_all_tests() {
  echo -e "${YELLOW}Running all load tests...${NC}"
  echo ""
  
  run_dispatch_test
  echo ""
  
  run_websocket_test
  echo ""
  
  run_concurrent_test
  echo ""
}

# Print usage information
print_usage() {
  cat << EOF
${BLUE}Usage:${NC}
  $0 [COMMAND] [OPTIONS]

${BLUE}Commands:${NC}
  dispatch      Run dispatch endpoint load test only
  websocket     Run WebSocket stress test only
  concurrent    Run concurrent users simulation only
  all          Run all tests (default)

${BLUE}Options:${NC}
  --environment ENV      Set environment (dev, staging, production) [default: dev]
  --api-url URL         Set API base URL [default: http://localhost:3000/api]
  --ws-url URL          Set WebSocket URL [default: ws://localhost:3000]
  --token TOKEN         Set authentication token [default: test-token]
  --vus NUM             Set virtual users (overrides scenario VU settings)
  --duration DURATION   Set test duration (e.g., 5m, 60s)
  --help                Show this help message

${BLUE}Examples:${NC}
  # Run all tests against local environment
  $0 all

  # Run dispatch test against staging
  $0 dispatch --environment staging

  # Run with custom API URL
  $0 all --api-url https://api.example.com

  # Run concurrent users test with 500 VUs
  $0 concurrent --vus 500

${BLUE}Environment Variables:${NC}
  API_URL         API base URL
  WS_URL          WebSocket URL
  ENVIRONMENT     Environment name (dev, staging, production)
  AUTH_TOKEN      Authentication token
  VERBOSE         Enable verbose logging (true/false)

EOF
}

# Parse command line arguments
parse_args() {
  COMMAND="${1:-all}"
  
  case "${COMMAND}" in
    --help|-h)
      print_usage
      exit 0
      ;;
    dispatch|websocket|concurrent|all)
      shift
      ;;
    *)
      echo -e "${RED}Unknown command: ${COMMAND}${NC}"
      print_usage
      exit 1
      ;;
  esac
  
  # Parse options
  while [[ $# -gt 0 ]]; do
    case $1 in
      --environment)
        ENVIRONMENT="$2"
        shift 2
        ;;
      --api-url)
        API_URL="$2"
        shift 2
        ;;
      --ws-url)
        WS_URL="$2"
        shift 2
        ;;
      --token)
        AUTH_TOKEN="$2"
        shift 2
        ;;
      --vus)
        # This would need to be passed to k6 with -e VUS_COUNT
        export VUS_COUNT="$2"
        shift 2
        ;;
      --duration)
        export TEST_DURATION="$2"
        shift 2
        ;;
      --help|-h)
        print_usage
        exit 0
        ;;
      *)
        echo -e "${RED}Unknown option: $1${NC}"
        print_usage
        exit 1
        ;;
    esac
  done
}

# Print results summary
print_summary() {
  echo -e "${GREEN}"
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║              Load Tests Completed Successfully             ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo "Results saved to: ${RESULTS_DIR}"
  echo "Check results files for detailed metrics"
  echo ""
  echo "To analyze results:"
  echo "  1. Review JSON output files in ${RESULTS_DIR}"
  echo "  2. Use k6 cloud integration: k6 run --cloud scenarios/dispatch-load.js"
  echo "  3. Import results to Grafana for visualization"
}

# Main execution
main() {
  print_header
  check_k6_installed
  setup_results_dir
  parse_args "$@"
  
  case "${COMMAND}" in
    dispatch)
      run_dispatch_test
      ;;
    websocket)
      run_websocket_test
      ;;
    concurrent)
      run_concurrent_test
      ;;
    all)
      run_all_tests
      ;;
  esac
  
  print_summary
}

# Run main function
main "$@"
