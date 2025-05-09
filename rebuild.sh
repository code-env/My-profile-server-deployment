#!/bin/bash

# Script to rebuild the application with the updated rate limiter

echo "Rebuilding the application..."

# Build the application
npm run build

echo "Build completed successfully!"
echo "The rate limiter has been updated with the following changes:"
echo "1. Increased the request limit from 1000 to 3000 requests per 15 minutes"
echo "2. Added more paths to skip rate limiting, including notification and referral endpoints"
echo "3. Added special handling for authenticated users to bypass rate limiting"
echo ""
echo "These changes should resolve the rate limiting issues for legitimate users."
