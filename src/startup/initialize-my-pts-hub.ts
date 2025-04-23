import { logger } from '../utils/logger';
import { myPtsHubService } from '../services/my-pts-hub.service';

/**
 * Initialize the MyPts Hub service
 * This function should be called during application startup
 */
export async function initializeMyPtsHub(): Promise<void> {
  try {
    logger.info('Initializing MyPts Hub service...');
    await myPtsHubService.initialize();
    logger.info('MyPts Hub service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize MyPts Hub service', { error });
    // Don't throw - we want the application to continue even if the MyPts Hub fails to initialize
  }
}
