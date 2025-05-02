import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences
} from '../controllers/user-notification-preferences.controller';
import { verifyTelegramConnection } from '../controllers/telegram-verification.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get and update notification preferences
router.route('/')
  .get(getUserNotificationPreferences)
  .put(updateUserNotificationPreferences);

// Verify Telegram connection
router.route('/verify-telegram')
  .post(verifyTelegramConnection);

export default router;
