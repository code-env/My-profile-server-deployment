/**
 * Initialize Gradient Updates
 * 
 * This module sets up the scheduled task for updating profile gradients.
 * It's designed to be called during application startup.
 */

import { logger } from '../utils/logger';
import { setupGradientUpdateCron } from '../scripts/setup-gradient-cron';

/**
 * Initialize the gradient update scheduler
 * This function should be called during application startup
 */
export async function initializeGradientUpdates(): Promise<void> {
  try {
    // Only set up the cron job in production environment
    if (process.env.NODE_ENV === 'production') {
      logger.info('Initializing gradient update scheduler...');
      
      // Set up the cron job with the default schedule (3:00 AM every Sunday)
      // This can be overridden by setting the GRADIENT_UPDATE_SCHEDULE environment variable
      setupGradientUpdateCron();
      
      logger.info('Gradient update scheduler initialized successfully');
    } else {
      logger.info('Skipping gradient update scheduler in non-production environment');
    }
  } catch (error) {
    logger.error('Failed to initialize gradient update scheduler', { error });
    // Don't throw - we want the application to continue even if the scheduler fails to initialize
  }
}
