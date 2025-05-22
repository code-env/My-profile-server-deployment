import express from 'express';
import { getProfileWithOwner } from '../controllers/profile-full.controller';

const router = express.Router();

// Public route to get a profile and its owner/creator info
router.get('/:profileId', getProfileWithOwner);

export default router;
