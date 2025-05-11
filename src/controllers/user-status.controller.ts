import { Request, Response } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export class UserStatusController {
  /**
   * Get user online status
   * @route GET /api/users/:userId/status
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

      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // For now, we'll use a simple algorithm to determine status:
      // If the user has logged in within the last 15 minutes, they're online
      // Otherwise, they're offline
      const now = new Date();
      const lastActive = user.lastLogin || user.updatedAt || user.createdAt;
      const diffMinutes = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60));
      
      let status = 'offline';
      
      if (diffMinutes < 15) {
        status = 'online';
      }

      res.status(200).json({
        success: true,
        userId,
        status,
        lastActive
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
}
