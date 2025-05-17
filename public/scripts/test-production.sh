#!/bin/bash

# Script to test production build locally
# This script builds the application and runs it in production mode with SSL

# Environment variables for testing
export NODE_ENV=production
export PORT=8443
export COMPANY_SECRET="test-company-secret"
export LICENSE_KEY="MP-test-license"  # Will be overridden by generated license
export COOKIE_SECRET="test-cookie-secret"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting production build test...${NC}"

# Check if SSL certificates exist
if [ ! -f "ssl/private.key" ] || [ ! -f "ssl/certificate.crt" ]; then
  echo -e "${YELLOW}Generating SSL certificates...${NC}"
  ./scripts/setup-ssl.sh
fi

# Generate test license
echo -e "${YELLOW}Generating test license...${NC}"
node scripts/generate-license.js "TEST001" "Test Developer" "Tester" --save

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Build the application
echo -e "${YELLOW}Building application...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed! See errors above.${NC}"
  exit 1
fi

# Run the build
echo -e "${YELLOW}Starting server...${NC}"
NODE_ENV=production node dist/server.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test endpoints
echo -e "${YELLOW}Testing endpoints...${NC}"

# Health check
response=$(curl -sk https://localhost:8443/health)
if [[ $response == *"healthy"* ]]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
  kill $SERVER_PID
  exit 1
fi

# Root endpoint
response=$(curl -sk https://localhost:8443/)
if [[ $response == *"operational"* ]]; then
  echo -e "${GREEN}✓ Root endpoint check passed${NC}"
else
  echo -e "${RED}✗ Root endpoint check failed${NC}"
  kill $SERVER_PID
  exit 1
fi

# Security headers check
headers=$(curl -sk -I https://localhost:8443/)
if [[ $headers == *"Strict-Transport-Security"* ]] &&
   [[ $headers == *"X-Content-Type-Options"* ]]; then
  echo -e "${GREEN}✓ Security headers check passed${NC}"
else
  echo -e "${RED}✗ Security headers check failed${NC}"
  kill $SERVER_PID
  exit 1
fi

# Clean up
kill $SERVER_PID

echo -e "${GREEN}All tests passed successfully!${NC}"
echo "You can now deploy the application to production."
