/**
 * Script to set up a cron job for updating profile gradients
 * 
 * This script sets up a scheduled task that runs the gradient update process
 * at regular intervals to ensure all profiles have gradient backgrounds.
 * 
 * It can be used in both development and production environments.
 * 
 * Run with: npx ts-node src/scripts/setup-gradient-cron.ts
 */

import cron from 'node-cron';
import { updateProfilesWithGradients } from './update-profiles-with-gradients';
import { logger } from '../utils/logger';

// Default schedule: Run at 3:00 AM every Sunday
// This can be overridden by setting the GRADIENT_UPDATE_SCHEDULE environment variable
const DEFAULT_SCHEDULE = '0 3 * * 0';

/**
 * Sets up a cron job to update profile gradients
 * @param schedule Cron schedule expression (default: '0 3 * * 0' - 3:00 AM every Sunday)
 */
export function setupGradientUpdateCron(schedule = process.env.GRADIENT_UPDATE_SCHEDULE || DEFAULT_SCHEDULE) {
  // Validate the cron schedule
  if (!cron.validate(schedule)) {
    logger.error(`Invalid cron schedule: ${schedule}`);
    throw new Error(`Invalid cron schedule: ${schedule}`);
  }

  logger.info(`Setting up gradient update cron job with schedule: ${schedule}`);

  // Schedule the task
  cron.schedule(schedule, async () => {
    logger.info('Running scheduled gradient update task');
    try {
      const result = await updateProfilesWithGradients();
      logger.info('Scheduled gradient update completed successfully', result);
    } catch (error) {
      logger.error('Scheduled gradient update failed:', error);
    }
  });

  logger.info('Gradient update cron job has been set up successfully');
}

// If this script is run directly, set up the cron job
if (require.main === module) {
  setupGradientUpdateCron();
  logger.info('Gradient update cron job is now running. Keep this process alive to maintain the schedule.');
  
  // Keep the process alive
  process.stdin.resume();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Gradient update cron job is shutting down');
    process.exit(0);
  });
}
