/**
 * Token Cleanup Routes
 *
 * Provides admin endpoints for managing token cleanup operations.
 * These routes are protected and only accessible to admin users.
 */

import express from 'express';
import { requireRole } from '../../middleware/roleMiddleware';
import { cleanupTokens } from '../../jobs/cleanupTokens';
import { runScalableTokenCleanup } from '../../jobs/scalableTokenCleanup';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route POST /api/admin/token-cleanup/run
 * @description Manually trigger the token cleanup job
 * @access Admin only
 */
router.post('/run', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    logger.info('Manual token cleanup triggered by admin');

    // Run the cleanup job
    await cleanupTokens();

    res.json({
      success: true,
      message: 'Token cleanup job completed successfully'
    });
  } catch (error) {
    logger.error('Error running manual token cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run token cleanup job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/admin/token-cleanup/run-scalable
 * @description Manually trigger the scalable token cleanup job for large user bases
 * @access Admin only
 */
router.post('/run-scalable', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    logger.info('Manual scalable token cleanup triggered by admin');

    // Run the cleanup job
    const metrics = await runScalableTokenCleanup();

    res.json({
      success: true,
      message: 'Scalable token cleanup job completed successfully',
      metrics: {
        batchesProcessed: metrics.batchesProcessed,
        usersProcessed: metrics.usersProcessed,
        usersUpdated: metrics.usersUpdated,
        tokensRemoved: metrics.tokensRemoved,
        sessionsRemoved: metrics.sessionsRemoved,
        durationMs: metrics.durationMs,
        errorCount: metrics.errors.length
      }
    });
  } catch (error) {
    logger.error('Error running manual scalable token cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run scalable token cleanup job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
