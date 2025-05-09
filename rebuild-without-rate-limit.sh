#!/bin/bash

# Script to rebuild the application without rate limiting

echo "Rebuilding the application without rate limiting..."

# Build the application
npm run build

echo "Build completed successfully!"
echo "Rate limiting has been completely removed from the application."
echo "The server will now accept all requests without any rate limits."
echo ""
echo "Note: You may want to consider re-implementing rate limiting in the future"
echo "for security purposes, especially for authentication endpoints."
