/**
 * Migrate Refresh Tokens Script
 * 
 * This script migrates refresh tokens from the legacy refreshTokens array
 * to the new sessions array with proper device information.
 * 
 * Usage:
 * ```
 * npm run migrate-tokens
 * ```
 */

import mongoose from 'mongoose';
import { User } from '../models/User';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * Migrate refresh tokens to sessions
 */
async function migrateRefreshTokens() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Find users with refresh tokens
    const users = await User.find({
      refreshTokens: { $exists: true, $ne: [] }
    });

    logger.info(`Found ${users.length} users with refresh tokens to migrate`);

    let totalTokensMigrated = 0;
    let usersUpdated = 0;

    for (const user of users) {
      if (!user.refreshTokens || user.refreshTokens.length === 0) {
        continue;
      }

      // Initialize sessions array if it doesn't exist
      if (!user.sessions) {
        user.sessions = [];
      }

      const now = new Date();
      let userUpdated = false;

      // Migrate each token to a session
      for (const token of user.refreshTokens) {
        // Check if token already exists in sessions
        const tokenExists = user.sessions.some(
          (session: any) => session.refreshToken === token
        );

        if (!tokenExists) {
          // Add token to sessions with default device info
          user.sessions.push({
            refreshToken: token,
            deviceInfo: {
              userAgent: 'Unknown (migrated)',
              ip: 'Unknown',
              deviceType: 'Unknown'
            },
            lastUsed: now,
            createdAt: now,
            isActive: true
          });

          totalTokensMigrated++;
          userUpdated = true;
        }
      }

      // Limit sessions to 10 if needed
      if (user.sessions.length > 10) {
        user.sessions = user.sessions.slice(-10);
      }

      // Clear refreshTokens array after migration
      if (userUpdated) {
        user.refreshTokens = [];
        await user.save();
        usersUpdated++;
      }
    }

    logger.info(`Migration completed: ${totalTokensMigrated} tokens migrated for ${usersUpdated} users`);
    process.exit(0);
  } catch (error) {
    logger.error('Error migrating refresh tokens:', error);
    process.exit(1);
  }
}

// Run the migration
migrateRefreshTokens();
