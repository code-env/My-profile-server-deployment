import { Request, Response } from 'express';
import { getPresenceService } from '../utils/websocket';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export class PresenceController {
  /**
   * Get user online status
   * @route GET /api/presence/status/:userId
   */
  async getUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const presenceService = getPresenceService();
      const status = await presenceService.getUserStatus(userId);

      res.status(200).json({
        success: true,
        data: {
          userId,
          status,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error getting user status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get profile online status
   * @route GET /api/presence/profile/:profileId
   */
  async getProfileStatus(req: Request, res: Response): Promise<void> {
    try {
      const { profileId } = req.params;
      
      if (!profileId) {
        res.status(400).json({
          success: false,
          message: 'Profile ID is required'
        });
        return;
      }

      const presenceService = getPresenceService();
      const status = await presenceService.getProfileStatus(profileId);

      res.status(200).json({
        success: true,
        data: {
          profileId,
          status,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error getting profile status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get status for multiple users
   * @route POST /api/presence/batch
   */
  async getBatchStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userIds } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
        return;
      }

      const presenceService = getPresenceService();
      const statusMap = await presenceService.getBatchUserStatus(userIds);

      // Convert Map to object for JSON response
      const statusObject: Record<string, string> = {};
      statusMap.forEach((status, userId) => {
        statusObject[userId] = status;
      });

      res.status(200).json({
        success: true,
        data: {
          statuses: statusObject,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error getting batch status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get batch status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
