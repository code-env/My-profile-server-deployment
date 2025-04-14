import express from 'express';
import { protect, optionalAuth } from '../middleware/auth.middleware';
import {
  generateQRCode,
  generateSharingImage,
  trackShare,
  getSharingMetadata,
} from '../controllers/sharing.controller';

const router = express.Router();

// Protected routes (require authentication)
router.post('/:profileId/qr', protect, generateQRCode);
router.post('/:profileId/image', protect, generateSharingImage);

// Public routes (optional authentication)
router.post('/:profileId/track', optionalAuth, trackShare);
router.get('/:profileId/meta', getSharingMetadata);

export default router;
