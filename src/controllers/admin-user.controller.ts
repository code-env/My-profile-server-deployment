import { Request, Response } from 'express';
import adminUserService, { UserFilters } from '../services/admin-user.service';
import { logger } from '../utils/logger';

/**
 * Admin User Management Controller
 * Handles all user management operations for admins and super admins
 */
export class AdminUserController {
  /**
   * Create a new user
   * @route POST /api/admin/users
   */
  static async createUser(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Validate required fields
      const {
        email,
        password,
        fullName,
        username,
        firstName,
        lastName,
        dateOfBirth,
        countryOfResidence,
        phoneNumber,
        accountType,
        accountCategory,
        verificationMethod,
        role,
        isEmailVerified,
        isPhoneVerified
      } = req.body;

      if (!email || !password || !fullName || !username || !accountType || !accountCategory || !verificationMethod) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: email, password, fullName, username, accountType, accountCategory, verificationMethod'
        });
      }

      // Only superadmin can create admin users
      if (user.role === 'admin' && role && ['admin', 'superadmin'].includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Only superadmin can create admin users'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Validate account type and category
      if (!['MYSELF', 'SOMEONE_ELSE'].includes(accountType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid account type. Must be MYSELF or SOMEONE_ELSE'
        });
      }

      if (!['PRIMARY_ACCOUNT', 'SECONDARY_ACCOUNT'].includes(accountCategory)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid account category. Must be PRIMARY_ACCOUNT or SECONDARY_ACCOUNT'
        });
      }

      if (!['PHONE', 'EMAIL'].includes(verificationMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification method. Must be PHONE or EMAIL'
        });
      }

      const userData = {
        email,
        password,
        fullName,
        username,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        countryOfResidence,
        phoneNumber,
        accountType,
        accountCategory,
        verificationMethod,
        role,
        isEmailVerified,
        isPhoneVerified
      };

      const newUser = await adminUserService.createUser(userData);

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: newUser
      });
    } catch (error) {
      logger.error('Error creating user:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create user'
      });
    }
  }

  /**
   * Get all users with pagination and filtering
   * @route GET /api/admin/users
   */
  static async getAllUsers(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page

      // Parse filters
      const filters: UserFilters = {};
      
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.role) filters.role = req.query.role as string;
      if (req.query.accountType) filters.accountType = req.query.accountType as string;
      if (req.query.isEmailVerified !== undefined) {
        filters.isEmailVerified = req.query.isEmailVerified === 'true';
      }
      if (req.query.isPhoneVerified !== undefined) {
        filters.isPhoneVerified = req.query.isPhoneVerified === 'true';
      }
      if (req.query.status) filters.status = req.query.status as 'active' | 'inactive' | 'banned';
      if (req.query.countryOfResidence) filters.countryOfResidence = req.query.countryOfResidence as string;
      
      // Parse date filters
      if (req.query.dateJoinedFrom) {
        filters.dateJoinedFrom = new Date(req.query.dateJoinedFrom as string);
      }
      if (req.query.dateJoinedTo) {
        filters.dateJoinedTo = new Date(req.query.dateJoinedTo as string);
      }
      if (req.query.lastLoginFrom) {
        filters.lastLoginFrom = new Date(req.query.lastLoginFrom as string);
      }
      if (req.query.lastLoginTo) {
        filters.lastLoginTo = new Date(req.query.lastLoginTo as string);
      }

      const result = await adminUserService.getAllUsers(page, limit, filters);

      return res.status(200).json({
        success: true,
        message: 'Users fetched successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error fetching users:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch users'
      });
    }
  }

  /**
   * Get user by ID
   * @route GET /api/admin/users/:userId
   */
  static async getUserById(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { userId } = req.params;
      const foundUser = await adminUserService.getUserById(userId);

      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'User fetched successfully',
        data: foundUser
      });
    } catch (error) {
      logger.error('Error fetching user:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch user'
      });
    }
  }

  /**
   * Update user
   * @route PUT /api/admin/users/:userId
   */
  static async updateUser(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { userId } = req.params;
      const updatedUser = await adminUserService.updateUser(userId, req.body);

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error updating user:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update user'
      });
    }
  }

  /**
   * Delete user
   * @route DELETE /api/admin/users/:userId
   */
  static async deleteUser(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { userId } = req.params;
      
      // Prevent admins from deleting themselves
      if (userId === user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      // Only superadmin can delete other admins
      if (user.role === 'admin') {
        const targetUser = await adminUserService.getUserById(userId);
        if (targetUser && ['admin', 'superadmin'].includes(targetUser.role)) {
          return res.status(403).json({
            success: false,
            message: 'Only superadmin can delete admin accounts'
          });
        }
      }

      await adminUserService.deleteUser(userId);

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting user:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete user'
      });
    }
  }

  /**
   * Ban/unban user
   * @route POST /api/admin/users/:userId/ban
   */
  static async toggleUserBan(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { userId } = req.params;
      const { banned, reason } = req.body;

      if (typeof banned !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'banned field must be a boolean'
        });
      }

      // Prevent admins from banning themselves
      if (userId === user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot ban your own account'
        });
      }

      // Only superadmin can ban other admins
      if (user.role === 'admin') {
        const targetUser = await adminUserService.getUserById(userId);
        if (targetUser && ['admin', 'superadmin'].includes(targetUser.role)) {
          return res.status(403).json({
            success: false,
            message: 'Only superadmin can ban admin accounts'
          });
        }
      }

      const updatedUser = await adminUserService.toggleUserBan(userId, banned, reason);

      return res.status(200).json({
        success: true,
        message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error toggling user ban:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update user ban status'
      });
    }
  }

  /**
   * Lock/unlock user account
   * @route POST /api/admin/users/:userId/lock
   */
  static async toggleUserLock(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { userId } = req.params;
      const { locked, reason } = req.body;

      if (typeof locked !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'locked field must be a boolean'
        });
      }

      // Prevent admins from locking themselves
      if (userId === user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot lock your own account'
        });
      }

      // Only superadmin can lock other admins
      if (user.role === 'admin') {
        const targetUser = await adminUserService.getUserById(userId);
        if (targetUser && ['admin', 'superadmin'].includes(targetUser.role)) {
          return res.status(403).json({
            success: false,
            message: 'Only superadmin can lock admin accounts'
          });
        }
      }

      const updatedUser = await adminUserService.toggleUserLock(userId, locked, reason);

      return res.status(200).json({
        success: true,
        message: `User account ${locked ? 'locked' : 'unlocked'} successfully`,
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error toggling user lock:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update user lock status'
      });
    }
  }

  /**
   * Change user role
   * @route POST /api/admin/users/:userId/role
   */
  static async changeUserRole(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required'
        });
      }

      // Prevent changing own role
      if (userId === user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change your own role'
        });
      }

      // Only superadmin can promote users to admin or superadmin
      if (user.role === 'admin' && ['admin', 'superadmin'].includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Only superadmin can promote users to admin roles'
        });
      }

      // Only superadmin can change admin roles
      if (user.role === 'admin') {
        const targetUser = await adminUserService.getUserById(userId);
        if (targetUser && ['admin', 'superadmin'].includes(targetUser.role)) {
          return res.status(403).json({
            success: false,
            message: 'Only superadmin can change admin roles'
          });
        }
      }

      const updatedUser = await adminUserService.changeUserRole(userId, role);

      return res.status(200).json({
        success: true,
        message: 'User role updated successfully',
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error changing user role:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to change user role'
      });
    }
  }

  /**
   * Force verify user email or phone
   * @route POST /api/admin/users/:userId/verify
   */
  static async forceVerifyUser(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { userId } = req.params;
      const { type } = req.body;

      if (!type || !['email', 'phone'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Type must be either "email" or "phone"'
        });
      }

      const updatedUser = await adminUserService.forceVerifyUser(userId, type);

      return res.status(200).json({
        success: true,
        message: `User ${type} verified successfully`,
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error force verifying user:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to verify user'
      });
    }
  }

  /**
   * Get user statistics
   * @route GET /api/admin/users/stats
   */
  static async getUserStats(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const stats = await adminUserService.getUserStats();

      return res.status(200).json({
        success: true,
        message: 'User statistics fetched successfully',
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching user stats:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch user statistics'
      });
    }
  }

  /**
   * Bulk update users
   * @route POST /api/admin/users/bulk-update
   */
  static async bulkUpdateUsers(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { userIds, updateData } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'userIds must be a non-empty array'
        });
      }

      if (!updateData || typeof updateData !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'updateData is required'
        });
      }

      // Prevent updating own account in bulk operations
      if (userIds.includes(user._id.toString())) {
        return res.status(400).json({
          success: false,
          message: 'Cannot include your own account in bulk operations'
        });
      }

      const result = await adminUserService.bulkUpdateUsers(userIds, updateData);

      return res.status(200).json({
        success: true,
        message: 'Bulk update completed',
        data: result
      });
    } catch (error) {
      logger.error('Error in bulk update:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to perform bulk update'
      });
    }
  }

  /**
   * Search users
   * @route GET /api/admin/users/search
   */
  static async searchUsers(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { q: searchTerm, limit } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          message: 'Search term (q) is required'
        });
      }

      const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Max 50 results
      const users = await adminUserService.searchUsers(searchTerm as string, limitNum);

      return res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: users
      });
    } catch (error) {
      logger.error('Error searching users:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to search users'
      });
    }
  }
} 