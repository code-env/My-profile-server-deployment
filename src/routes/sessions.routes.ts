import express from 'express';
import { SessionsController } from '../controllers/sessions.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get user sessions
router.get('/:userId', SessionsController.getUserSessions);

// Get login activity analytics
router.get('/analytics/login-activity/:profileId', SessionsController.getLoginActivity);

export default router;
