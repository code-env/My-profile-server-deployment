import { Request, Response } from 'express';
import { AdminNotificationModel } from '../models/admin-notification.model';
import { logger } from '../utils/logger';

/**
 * Get all admin notifications
 */
export const getAdminNotifications = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get notifications with pagination
    const notifications = await AdminNotificationModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await AdminNotificationModel.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting admin notifications: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get admin notifications'
    });
  }
};

/**
 * Get unread admin notifications count
 */
export const getUnreadNotificationsCount = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    // Count unread notifications
    const count = await AdminNotificationModel.countDocuments({ isRead: false });

    return res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    logger.error(`Error getting unread notifications count: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unread notifications count'
    });
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    const { notificationId } = req.params;

    // Update notification
    const notification = await AdminNotificationModel.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error(`Error marking notification as read: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    // Update all unread notifications
    await AdminNotificationModel.updateMany(
      { isRead: false },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error(`Error marking all notifications as read: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    const { notificationId } = req.params;

    // Delete notification
    const notification = await AdminNotificationModel.findByIdAndDelete(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting notification: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};
