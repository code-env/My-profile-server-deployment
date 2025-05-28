#!/bin/bash

# Script to update profile country information for a specific user
# Usage: ./update-profile-country.sh <userId>

if [ -z "$1" ]; then
  echo "Error: User ID is required"
  echo "Usage: ./update-profile-country.sh <userId>"
  exit 1
fi

USER_ID=$1

# Execute the TypeScript script with the provided user ID
echo "Updating profile country information for user $USER_ID..."
npx ts-node src/scripts/update-user-profile-country.ts $USER_ID

# Check the exit code
if [ $? -eq 0 ]; then
  echo "Profile country update completed successfully!"
else
  echo "Profile country update failed. Check the logs for details."
  exit 1
fi
