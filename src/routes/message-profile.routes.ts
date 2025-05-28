import { Router } from 'express';
import { messageProfile } from '../controllers/message-profile.controller';

const router = Router();

// POST /api/message-profile/:userId
router.post('/:userId', messageProfile);

export default router;
