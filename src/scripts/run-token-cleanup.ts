/**
 * Run Token Cleanup Script
 *
 * This script runs the token cleanup job directly.
 * It can be used to manually trigger the cleanup process.
 *
 * Usage:
 * ```
 * npm run cleanup-tokens
 * ```
 */

import mongoose from 'mongoose';
import { cleanupTokens } from '../jobs/cleanupTokens';
import { logger } from '../utils/logger';
import { config } from '../config/config';

async function runCleanup() {
  try {
    logger.info('Starting manual token cleanup...');

    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    });
    logger.info('Connected to MongoDB');

    // Run the cleanup
    await cleanupTokens();

    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');

    logger.info('Manual token cleanup completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during manual token cleanup:', error);

    // Make sure to disconnect from MongoDB even if there's an error
    try {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB after error');
    } catch (disconnectError) {
      logger.error('Error disconnecting from MongoDB:', disconnectError);
    }

    process.exit(1);
  }
}

// Run the cleanup
runCleanup();
