#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting server in test mode...${NC}"

# Start the server in the background with TEST environment
TEST=true npm run dev &
SERVER_PID=$!

# Wait a bit for the server to start
sleep 5

echo -e "${YELLOW}Server started with PID: $SERVER_PID${NC}"
echo -e "${YELLOW}Running tests...${NC}"

# Run the tests
npm test

# Store the test result
TEST_RESULT=$?

# Kill the server
echo -e "${YELLOW}Shutting down test server...${NC}"
kill $SERVER_PID

# Wait for server to shut down
sleep 2

# Return the test result
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed.${NC}"
  exit $TEST_RESULT
fi 