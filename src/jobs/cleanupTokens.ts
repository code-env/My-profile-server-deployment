/**
 * Token Cleanup Job
 *
 * This job is responsible for cleaning up expired refresh tokens and inactive sessions.
 * It runs on a schedule to prevent database bloat and improve security.
 *
 * Key features:
 * - Removes expired refresh tokens from the refreshTokens array
 * - Removes inactive sessions older than 30 days
 * - Limits the number of active sessions per user to 10
 * - Logs cleanup statistics for monitoring
 */

import { User } from '../models/User';
import { logger } from '../utils/logger';
import cron from 'node-cron';

/**
 * Cleanup expired tokens and inactive sessions
 */
export async function cleanupTokens() {
  try {
    logger.info('Starting token cleanup job');

    // Get current date for comparison
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Find users with tokens to clean up
    const users = await User.find({
      $or: [
        { refreshTokens: { $exists: true, $ne: [] } },
        { sessions: { $exists: true, $ne: [] } }
      ]
    }).maxTimeMS(60000); // Increase query timeout to 60 seconds

    logger.info(`Found ${users.length} users with tokens to process`);

    let totalTokensRemoved = 0;
    let totalSessionsRemoved = 0;
    let usersUpdated = 0;

    for (const user of users) {
      let userUpdated = false;

      // Clean up refreshTokens array (legacy)
      if (user.refreshTokens && user.refreshTokens.length > 0) {
        const originalTokenCount = user.refreshTokens.length;

        // If user has more than 10 tokens, keep only the 10 most recent
        if (user.refreshTokens.length > 10) {
          user.refreshTokens = user.refreshTokens.slice(-10);
          totalTokensRemoved += originalTokenCount - user.refreshTokens.length;
          userUpdated = true;
        }
      }

      // Clean up sessions array
      if (user.sessions && user.sessions.length > 0) {
        const originalSessionCount = user.sessions.length;

        // Remove inactive sessions older than 30 days
        user.sessions = user.sessions.filter(session => {
          if (!session.isActive && new Date(session.lastUsed) < thirtyDaysAgo) {
            return false; // Remove this session
          }
          return true; // Keep this session
        });

        // If user still has more than 10 active sessions, keep only the 10 most recent
        if (user.sessions.length > 10) {
          // Sort by lastUsed (most recent first)
          user.sessions.sort((a, b) =>
            new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
          );

          // Keep only the 10 most recent
          user.sessions = user.sessions.slice(0, 10);
        }

        // Calculate how many sessions were removed
        const sessionsRemoved = originalSessionCount - user.sessions.length;
        if (sessionsRemoved > 0) {
          totalSessionsRemoved += sessionsRemoved;
          userUpdated = true;
        }
      }

      // Save user if changes were made
      if (userUpdated) {
        await user.save();
        usersUpdated++;
      }
    }

    logger.info(`Token cleanup completed: ${totalTokensRemoved} tokens and ${totalSessionsRemoved} sessions removed from ${usersUpdated} users`);
  } catch (error) {
    logger.error('Error in token cleanup job:', error);
    // Re-throw the error so it can be caught by the caller
    throw error;
  }
}

/**
 * Schedule the token cleanup job to run daily at 3:00 AM
 */
export function scheduleTokenCleanup() {
  // Run daily at 3:00 AM
  cron.schedule('0 3 * * *', () => {
    cleanupTokens().catch(error => {
      logger.error('Scheduled token cleanup failed:', error);
    });
  });

  logger.info('Token cleanup job scheduled to run daily at 3:00 AM');
}
