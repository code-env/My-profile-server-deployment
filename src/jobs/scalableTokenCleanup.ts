/**
 * Scalable Token Cleanup Job
 *
 * This module implements a scalable approach to token cleanup for large user bases (1M+ users).
 * It processes users in small batches to minimize memory usage and database load.
 *
 * Key features:
 * - Batch processing to handle large user bases efficiently
 * - Pagination to prevent memory issues
 * - Delay between batches to reduce database load
 * - Detailed logging and metrics
 * - Configurable parameters for fine-tuning
 */

import mongoose from 'mongoose';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import cron from 'node-cron';

// Configuration
const BATCH_SIZE = 1000;
const PROCESSING_DELAY_MS = 100; // Delay between batches to reduce DB load
const MAX_TOKENS_PER_USER = 3;
const INACTIVE_SESSION_RETENTION_DAYS = 30;

// Metrics for monitoring
interface CleanupMetrics {
  batchesProcessed: number;
  usersProcessed: number;
  usersUpdated: number;
  tokensRemoved: number;
  sessionsRemoved: number;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  errors: any[];
}

/**
 * Process a batch of users for token cleanup
 */
async function processUserBatch(lastProcessedId: any = null, metrics: CleanupMetrics): Promise<any> {
  try {
    // Build query for this batch
    let query: any = {
      $or: [
        { refreshTokens: { $exists: true, $ne: [] } },
        { sessions: { $exists: true, $ne: [] } }
      ]
    };

    // Add pagination using _id
    if (lastProcessedId) {
      query._id = { $gt: lastProcessedId };
    }

    // Get a batch of users
    const users = await User.find(query)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .maxTimeMS(30000); // 30 second timeout for this batch

    if (users.length === 0) {
      logger.info('No more users to process');
      return null; // No more users to process
    }

    logger.info(`Processing batch of ${users.length} users`);
    metrics.usersProcessed += users.length;

    // Get current date for comparison
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - INACTIVE_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    let batchTokensRemoved = 0;
    let batchSessionsRemoved = 0;
    let batchUsersUpdated = 0;

    // Process each user in the batch
    for (const user of users) {
      let userUpdated = false;

      // Clean up refreshTokens array (legacy)
      if (user.refreshTokens && user.refreshTokens.length > MAX_TOKENS_PER_USER) {
        const originalCount = user.refreshTokens.length;
        user.refreshTokens = user.refreshTokens.slice(-MAX_TOKENS_PER_USER);
        const removed = originalCount - user.refreshTokens.length;
        batchTokensRemoved += removed;
        userUpdated = true;
      }

      // Clean up sessions array
      if (user.sessions && user.sessions.length > 0) {
        const originalCount = user.sessions.length;

        // Remove inactive sessions older than cutoff date
        user.sessions = user.sessions.filter(session => {
          if (!session.isActive && new Date(session.lastUsed) < cutoffDate) {
            return false; // Remove this session
          }
          return true; // Keep this session
        });

        // If still too many sessions, keep only the most recent ones
        if (user.sessions.length > MAX_TOKENS_PER_USER) {
          user.sessions.sort((a, b) =>
            new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
          );
          user.sessions = user.sessions.slice(0, MAX_TOKENS_PER_USER);
        }

        const removed = originalCount - user.sessions.length;
        if (removed > 0) {
          batchSessionsRemoved += removed;
          userUpdated = true;
        }
      }

      // Save user if changes were made
      if (userUpdated) {
        await user.save();
        batchUsersUpdated++;
      }
    }

    // Update metrics
    metrics.tokensRemoved += batchTokensRemoved;
    metrics.sessionsRemoved += batchSessionsRemoved;
    metrics.usersUpdated += batchUsersUpdated;

    logger.info(`Batch completed: ${batchTokensRemoved} tokens and ${batchSessionsRemoved} sessions removed from ${batchUsersUpdated} users`);

    // Return the ID of the last processed user for the next batch
    return users[users.length - 1]._id;
  } catch (error) {
    logger.error('Error processing user batch:', error);
    metrics.errors.push(error);
    throw error;
  }
}

/**
 * Run the token cleanup process with batching
 */
export async function runScalableTokenCleanup() {
  logger.info('Starting scalable token cleanup job');

  const metrics: CleanupMetrics = {
    batchesProcessed: 0,
    usersProcessed: 0,
    usersUpdated: 0,
    tokensRemoved: 0,
    sessionsRemoved: 0,
    startTime: new Date(),
    errors: []
  };

  let lastProcessedId = null;
  let continueProcessing = true;

  try {
    while (continueProcessing) {
      lastProcessedId = await processUserBatch(lastProcessedId, metrics);
      metrics.batchesProcessed++;

      if (!lastProcessedId) {
        continueProcessing = false;
      } else {
        // Add a small delay between batches to reduce database load
        await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY_MS));
      }
    }

    // Complete metrics
    metrics.endTime = new Date();
    metrics.durationMs = metrics.endTime.getTime() - metrics.startTime.getTime();

    logger.info(`Scalable token cleanup completed in ${metrics.durationMs}ms. Processed ${metrics.batchesProcessed} batches, ${metrics.usersProcessed} users. Removed ${metrics.tokensRemoved} tokens and ${metrics.sessionsRemoved} sessions from ${metrics.usersUpdated} users.`);

    return metrics;
  } catch (error) {
    logger.error('Error in scalable token cleanup:', error);

    // Complete metrics even in case of error
    metrics.endTime = new Date();
    metrics.durationMs = metrics.endTime.getTime() - metrics.startTime.getTime();

    logger.info(`Scalable token cleanup failed after ${metrics.durationMs}ms. Processed ${metrics.batchesProcessed} batches, ${metrics.usersProcessed} users. Removed ${metrics.tokensRemoved} tokens and ${metrics.sessionsRemoved} sessions from ${metrics.usersUpdated} users.`);

    throw error;
  }
}

/**
 * Schedule the scalable token cleanup job
 */
export function scheduleScalableTokenCleanup() {
  // Run daily at 3:00 AM
  cron.schedule('0 3 * * *', () => {
    runScalableTokenCleanup().catch(error => {
      logger.error('Scheduled scalable token cleanup failed:', error);
    });
  });

  logger.info('Scalable token cleanup job scheduled to run daily at 3:00 AM');
}
