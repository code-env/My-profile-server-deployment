import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const notificationService = new NotificationService();

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { isRead, isArchived, page, limit } = req.query;

  const result = await notificationService.getUserNotifications(user._id, {
    isRead: isRead === 'true',
    isArchived: isArchived === 'true',
    page: Number(page) || 1,
    limit: Number(limit) || 10,
  });

  res.json(result);
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { id } = req.params;

  const notification = await notificationService.markAsRead(    new mongoose.Types.ObjectId(id), user._id);
  
  if (!notification) {
    throw createHttpError(404, 'Notification not found');
  }

  res.json(notification);
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;

  await notificationService.markAllAsRead(user._id);
  
  res.json({ message: 'All notifications marked as read' });
});

// @desc    Archive notification
// @route   PUT /api/notifications/:id/archive
// @access  Private
export const archiveNotification = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { id } = req.params;

  const notification = await notificationService.archiveNotification(new mongoose.Types.ObjectId(id), user._id);
  
  if (!notification) {
    throw createHttpError(404, 'Notification not found');
  }

  res.json(notification);
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { id } = req.params;

  const notification = await notificationService.deleteNotification(new mongoose.Types.ObjectId(id), user._id);
  
  if (!notification) {
    throw createHttpError(404, 'Notification not found');
  }

  res.json({ message: 'Notification deleted' });
});
