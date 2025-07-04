import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  testEmailNotification,
  testPushNotification,
  testTelegramNotification,
  testSystemNotification,
  verifyTelegramSetup
} from '../controllers/notification-test.controller';
import { testDirectTelegramTransaction } from '../controllers/telegram-test.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Test notification endpoints
router.post('/email', testEmailNotification);
router.post('/push', testPushNotification);
router.post('/telegram', testTelegramNotification);
router.post('/system', testSystemNotification);

// Verification endpoints
router.get('/verify-telegram', verifyTelegramSetup);

// Direct test endpoints
router.post('/direct-telegram-transaction', testDirectTelegramTransaction);

export default router;
