#!/bin/bash

# Script to run the gradient update process on Render
# This script can be executed manually in the Render shell

echo "Starting profile gradient update process..."

# Set NODE_ENV to production to ensure proper configuration
export NODE_ENV=production

# Run the gradient update script
node dist/scripts/update-profiles-with-gradients.js

echo "Gradient update process completed."
