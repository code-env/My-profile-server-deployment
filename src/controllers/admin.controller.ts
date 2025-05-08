import { Request, Response } from 'express';
import { User } from '../models/User';
import { getSetting } from '../models/admin-settings.model';
import { logger } from '../utils/logger';

/**
 * Admin controller for handling admin-specific operations
 */
export class AdminController {
  /**
   * Get admin details
   * @route GET /api/admin/details
   */
  static async getAdminDetails(req: Request, res: Response) {
    try {
      // Get the authenticated user from the request
      const user = req.user as any;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
      }

      // Check if user is an admin
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      // Get admin settings from the database
      const systemName = await getSetting<string>('systemName', 'MyPts System');
      
      // Return admin details
      return res.status(200).json({
        success: true,
        data: {
          id: user._id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          department: user.department || 'Administration',
          systemName,
          lastLogin: user.lastLogin || new Date(),
          securityLevel: 'High',
          accountStatus: 'Active'
        }
      });
    } catch (error) {
      logger.error('Error getting admin details:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get admin details',
      });
    }
  }
}
