import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
} from '../controllers/notification.controller';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getNotifications);

router.route('/read-all')
  .put(markAllAsRead);

router.route('/:id/read')
  .put(markAsRead);

router.route('/:id/archive')
  .put(archiveNotification);

router.route('/:id')
  .delete(deleteNotification);

export default router;
