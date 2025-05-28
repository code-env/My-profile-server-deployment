import express from 'express';
import { ProfileReferralController } from '../controllers/profile-referral.controller';
import { protect } from '../middleware/auth.middleware';
import { attachProfile } from '../middleware/profile-auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const validateReferralCodeSchema = z.object({
  referralCode: z.string().min(1, 'Referral code is required')
});

// Protected routes (require authentication and profile)
router.get('/', protect, attachProfile, ProfileReferralController.getReferralInfo);
router.get('/tree', protect, attachProfile, ProfileReferralController.getReferralTree);
router.get('/share-link', protect, attachProfile, ProfileReferralController.getShareableLink);
router.post('/initialize', protect, attachProfile, ProfileReferralController.initializeReferralCode);

// Helper function for optional authentication
const optionalAuth = (req: any, res: any, next: any) => {
  // Try to authenticate but continue even if it fails
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    protect(req, res, (err) => {
      // If authentication fails, just continue without attaching the user
      if (err) {
        next();
      } else {
        // If authentication succeeds, try to attach the profile
        attachProfile(req, res, (_profileErr) => {
          // Continue regardless of whether profile attachment succeeds
          next();
        });
      }
    });
  } else {
    // No auth header, just continue
    next();
  }
};

// Public routes with optional authentication
router.get('/leaderboard', optionalAuth, ProfileReferralController.getReferralLeaderboard);
router.get('/top-earners', optionalAuth, ProfileReferralController.getTopEarnersLeaderboard);
router.post('/validate', validateRequest(validateReferralCodeSchema), ProfileReferralController.validateReferralCode);

export default router;
