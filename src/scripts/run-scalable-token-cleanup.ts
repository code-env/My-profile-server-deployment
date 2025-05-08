/**
 * Run Scalable Token Cleanup Script
 * 
 * This script runs the scalable token cleanup job directly.
 * It can be used to manually trigger the cleanup process for large user bases.
 * 
 * Usage:
 * ```
 * npm run cleanup-tokens:scalable
 * ```
 */

import mongoose from 'mongoose';
import { runScalableTokenCleanup } from '../jobs/scalableTokenCleanup';
import { logger } from '../utils/logger';
import { config } from '../config/config';

async function runCleanup() {
  try {
    logger.info('Starting manual scalable token cleanup...');
    
    // Connect to MongoDB with increased timeouts for large datasets
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 60000, // 60 seconds
      socketTimeoutMS: 90000,
      connectTimeoutMS: 60000,
      maxPoolSize: 20 // Increase connection pool for parallel operations
    });
    logger.info('Connected to MongoDB');
    
    // Run the cleanup
    const metrics = await runScalableTokenCleanup();
    
    // Log summary
    logger.info('Cleanup Summary:');
    logger.info(`- Batches processed: ${metrics.batchesProcessed}`);
    logger.info(`- Users processed: ${metrics.usersProcessed}`);
    logger.info(`- Users updated: ${metrics.usersUpdated}`);
    logger.info(`- Tokens removed: ${metrics.tokensRemoved}`);
    logger.info(`- Sessions removed: ${metrics.sessionsRemoved}`);
    logger.info(`- Duration: ${metrics.durationMs}ms`);
    logger.info(`- Errors: ${metrics.errors.length}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    
    logger.info('Manual scalable token cleanup completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during manual scalable token cleanup:', error);
    
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
