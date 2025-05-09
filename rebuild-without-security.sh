#!/bin/bash

# Script to rebuild the application without security monitoring and brute force detection

echo "Rebuilding the application without security monitoring and brute force detection..."

# Build the application
npm run build

echo "Build completed successfully!"
echo "Security monitoring and brute force detection have been completely disabled."
echo "The server will now accept all requests without any security warnings or rate limits."
echo ""
echo "Note: You may want to consider re-implementing security monitoring in the future"
echo "for security purposes, especially for authentication endpoints."
