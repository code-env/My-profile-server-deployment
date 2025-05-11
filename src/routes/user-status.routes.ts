import express from 'express';
import { UserStatusController } from '../controllers/user-status.controller';

const router = express.Router();
const userStatusController = new UserStatusController();

/**
 * @route GET /api/users/:userId/status
 * @desc Get user online status
 * @access Public
 */
router.get('/:userId/status', userStatusController.getUserStatus);

export default router;
