#!/bin/bash

# Script to fix users with missing country information
# This script runs the TypeScript fix script to handle users without country data

echo "🔧 Starting fix for users with missing country information..."

# Check if we're in the correct directory
if [ ! -f "src/scripts/fix-missing-country-users.ts" ]; then
  echo "❌ Error: fix-missing-country-users.ts not found. Please run this script from the project root directory."
  exit 1
fi

# Check if Node.js and npm are available
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js is not installed or not in PATH."
  exit 1
fi

if ! command -v npx &> /dev/null; then
  echo "❌ Error: npx is not available."
  exit 1
fi

# Run the TypeScript script
echo "🚀 Running fix script..."
npx ts-node src/scripts/fix-missing-country-users.ts

# Check the exit code
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Fix completed successfully!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Run the profile country update script to update all profiles:"
  echo "   npx ts-node src/scripts/update-profile-countries.ts"
  echo ""
  echo "2. Or update profiles for specific users:"
  echo "   ./update-profile-country.sh <userId>"
  echo ""
  echo "3. Monitor the logs to ensure no more users are being skipped"
else
  echo ""
  echo "❌ Fix failed. Check the logs for details."
  exit 1
fi
