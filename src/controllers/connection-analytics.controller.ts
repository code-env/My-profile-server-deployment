import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ConnectionAnalyticsService } from '../services/connection-analytics.service';
import { CustomError } from '../utils/errors';
import { logger } from '../utils/logger';

export class ConnectionAnalyticsController {
  /**
   * Get connection strength
   * @route GET /api/connections/analytics/strength/:connectionId
   */
  static async getConnectionStrength(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const { connectionId } = req.params;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError('MISSING_TOKEN', 'User not authenticated');
      }

      const strength = await ConnectionAnalyticsService.calculateConnectionStrength(
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(connectionId)
      );

      res.json({
        success: true,
        data: {
          strength,
          summary: {
            score: strength.score,
            level: ConnectionAnalyticsController.getStrengthLevel(strength.score),
            strongPoints: strength.metadata.strongestFactors,
            suggestions: strength.metadata.suggestedActions
          }
        }
      });
    } catch (error) {
      logger.error('Error in getConnectionStrength:', error);
      res.status(error instanceof CustomError ? 400 : 500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get connection strength'
      });
    }
  }

  /**
   * Get connection strength history
   * @route GET /api/connections/analytics/history/:connectionId
   */
  static async getStrengthHistory(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const { connectionId } = req.params;
      const { period = 'month' } = req.query;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError('MISSING_TOKEN', 'User not authenticated');
      }

      const history = await ConnectionAnalyticsService.getConnectionStrengthHistory(
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(connectionId),
        period as 'week' | 'month' | 'year'
      );

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Error in getStrengthHistory:', error);
      res.status(error instanceof CustomError ? 400 : 500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get connection history'
      });
    }
  }

  /**
   * Get strength level label based on score
   */
  private static getStrengthLevel(score: number): string {
    if (score >= 0.8) return 'Very Strong';
    if (score >= 0.6) return 'Strong';
    if (score >= 0.4) return 'Moderate';
    if (score >= 0.2) return 'Weak';
    return 'Very Weak';
  }
}
