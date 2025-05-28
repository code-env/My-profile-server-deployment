import cron from 'node-cron';
import { LeaderboardService } from '../services/leaderboard.service';
import { logger } from '../utils/logger';

/**
 * Schedule a job to update the leaderboard daily
 * Runs at 00:00 every day
 */
export const scheduleLeaderboardUpdate = (): void => {
  const leaderboardService = new LeaderboardService();

  // Schedule job to run at midnight every day
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Starting scheduled leaderboard update');
      await leaderboardService.updateLeaderboard();
      logger.info('Scheduled leaderboard update completed successfully');
    } catch (error) {
      logger.error('Error in scheduled leaderboard update:', error);
    }
  }, {
    timezone: 'UTC'
  });

  logger.info('Leaderboard update job scheduled to run at midnight UTC daily');
};

/**
 * Run an immediate update of the leaderboard
 * This can be called during application startup to ensure the leaderboard is up-to-date
 */
export const runImmediateLeaderboardUpdate = async (): Promise<void> => {
  try {
    const leaderboardService = new LeaderboardService();

    logger.info('Running immediate leaderboard update');
    await leaderboardService.updateLeaderboard();
    logger.info('Immediate leaderboard update completed successfully');
  } catch (error) {
    logger.error('Error in immediate leaderboard update:', error);
  }
};
