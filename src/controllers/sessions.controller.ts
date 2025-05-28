import { Request, Response } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import UAParser from 'ua-parser-js';

/**
 * Sessions Controller
 * Handles user session management and analytics
 */
export class SessionsController {
  /**
   * Get user sessions
   * @route GET /api/users/:userId/sessions
   */
  static async getUserSessions(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { limit } = req.query;

      // Validate user ID
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
      }

      // Verify user is requesting their own data or is an admin
      const requestingUser = req.user as any;
      if (requestingUser._id.toString() !== userId && requestingUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only access your own sessions'
        });
      }

      // Find user and select sessions
      const user = await User.findById(userId).select('sessions lastLogin');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Process sessions data
      let sessions = user.sessions || [];
      
      // Sort sessions by lastUsed date (most recent first)
      sessions.sort((a: any, b: any) => 
        new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
      );

      // Apply limit if specified
      if (limit && !isNaN(Number(limit))) {
        sessions = sessions.slice(0, Number(limit));
      }

      // Format response data
      const responseData = {
        sessions: sessions.map((session: any) => ({
          id: session._id,
          deviceInfo: session.deviceInfo,
          lastUsed: session.lastUsed,
          createdAt: session.createdAt,
          isActive: session.isActive
        })),
        lastLogin: user.lastLogin
      };

      return res.status(200).json({
        success: true,
        data: responseData
      });
    } catch (error) {
      logger.error('Error fetching user sessions:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get login activity analytics
   * @route GET /api/analytics/login-activity/:profileId
   */
  static async getLoginActivity(req: Request, res: Response) {
    try {
      const { profileId } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;

      // Validate profile ID
      if (!mongoose.Types.ObjectId.isValid(profileId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid profile ID format'
        });
      }

      // Find profile to get user ID
      const profile = await mongoose.model('Profile').findById(profileId).select('userId');

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
      }

      // Verify user is requesting their own data or is an admin
      const requestingUser = req.user as any;
      if (requestingUser._id.toString() !== profile.userId.toString() && requestingUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only access your own login activity'
        });
      }

      // Find user and select sessions
      const user = await User.findById(profile.userId).select('sessions lastLogin');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      // Process sessions data to get login activity
      const sessions = user.sessions || [];
      
      // Create a map of dates with login counts
      const loginsByDate = new Map<string, number>();
      
      // Initialize all dates in the range with 0 logins
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(endDate.getDate() - i);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        loginsByDate.set(dateStr, 0);
      }
      
      // Count logins by date
      sessions.forEach((session: any) => {
        const sessionDate = new Date(session.createdAt);
        
        // Only include sessions within the date range
        if (sessionDate >= startDate && sessionDate <= endDate) {
          const dateStr = sessionDate.toISOString().split('T')[0];
          const currentCount = loginsByDate.get(dateStr) || 0;
          loginsByDate.set(dateStr, currentCount + 1);
        }
      });
      
      // Convert to array format for response
      const loginActivity = Array.from(loginsByDate.entries())
        .map(([date, logins]) => ({ date, logins }))
        .sort((a, b) => a.date.localeCompare(b.date)); // Sort by date ascending
      
      // Calculate trend
      const totalLogins = loginActivity.reduce((sum, day) => sum + day.logins, 0);
      const averageLogins = totalLogins / days;
      
      // Calculate trend by comparing recent days to overall average
      const recentDays = 7; // Last week
      const recentActivity = loginActivity.slice(-recentDays);
      const recentLogins = recentActivity.reduce((sum, day) => sum + day.logins, 0);
      const recentAverage = recentLogins / recentDays;
      
      const trendPercentage = averageLogins > 0 
        ? ((recentAverage - averageLogins) / averageLogins) * 100 
        : 0;
      
      const trend = {
        percentage: Math.abs(parseFloat(trendPercentage.toFixed(1))),
        isUp: trendPercentage >= 0
      };

      return res.status(200).json({
        success: true,
        data: {
          loginActivity,
          trend,
          totalLogins,
          averageLogins: parseFloat(averageLogins.toFixed(2))
        }
      });
    } catch (error) {
      logger.error('Error fetching login activity:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }
}
