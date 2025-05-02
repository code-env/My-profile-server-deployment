import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { NotificationController } from '../controllers/notification.controller';

const router = express.Router();

router.use(protect);

// Get user notifications
router.route('/')
  .get(NotificationController.getUserNotifications);

// Get unread notifications count
router.route('/unread-count')
  .get(NotificationController.getUnreadNotificationsCount);

// Mark all notifications as read
router.route('/read-all')
  .put(NotificationController.markAllNotificationsAsRead);

// Mark notification as read
router.route('/:id/read')
  .put(NotificationController.markNotificationAsRead);

// Archive notification
router.route('/:id/archive')
  .put(NotificationController.archiveNotification);

// Delete notification
router.route('/:id')
  .delete(NotificationController.deleteNotification);

export default router;
