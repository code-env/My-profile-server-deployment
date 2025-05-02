import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const notificationService = new NotificationService();

// Create a NotificationController object to export
export const NotificationController = {
  getUserNotifications: asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { isRead, isArchived, page, limit } = req.query;

    const result = await notificationService.getUserNotifications(user._id, {
      isRead: isRead === 'true',
      isArchived: isArchived === 'true',
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    res.json(result);
  }),

  markNotificationAsRead: asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(new mongoose.Types.ObjectId(id), user._id);

    if (!notification) {
      throw createHttpError(404, 'Notification not found');
    }

    res.json(notification);
  }),

  markAllNotificationsAsRead: asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    await notificationService.markAllAsRead(user._id);

    res.json({ message: 'All notifications marked as read' });
  }),

  archiveNotification: asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { id } = req.params;

    const notification = await notificationService.archiveNotification(new mongoose.Types.ObjectId(id), user._id);

    if (!notification) {
      throw createHttpError(404, 'Notification not found');
    }

    res.json(notification);
  }),

  deleteNotification: asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { id } = req.params;

    const notification = await notificationService.deleteNotification(new mongoose.Types.ObjectId(id), user._id);

    if (!notification) {
      throw createHttpError(404, 'Notification not found');
    }

    res.json({ message: 'Notification deleted' });
  }),

  getUnreadNotificationsCount: asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    const count = await notificationService.getUnreadCount(user._id);

    res.json({
      success: true,
      data: {
        count
      }
    });
  })
};
