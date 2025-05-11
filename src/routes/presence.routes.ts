import express from 'express';
import { PresenceController } from '../controllers/presence.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();
const presenceController = new PresenceController();

/**
 * @route GET /api/presence/status/:userId
 * @desc Get user online status
 * @access Private
 */
router.get('/status/:userId', protect, presenceController.getUserStatus);

/**
 * @route GET /api/presence/profile/:profileId
 * @desc Get profile online status
 * @access Private
 */
router.get('/profile/:profileId', protect, presenceController.getProfileStatus);

/**
 * @route POST /api/presence/batch
 * @desc Get status for multiple users
 * @access Private
 */
router.post('/batch', protect, presenceController.getBatchStatus);

export default router;
