import express from 'express';
import { SocialAuthController } from '../controllers/auth.social.controller';
// Import fraud detection middleware
import {
  fraudDetectionMiddleware,
  deviceFingerprintMiddleware,
  suspiciousActivityLogger
} from '../middleware/fraudDetection.middleware';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Google OAuth routes
 */
// Initiate Google OAuth flow
router.get('/google', SocialAuthController.googleLogin);

// Handle Google OAuth callback with fraud detection
router.get('/google/callback',
  deviceFingerprintMiddleware(),
  fraudDetectionMiddleware({
    blockOnCritical: true,
    requireVerificationOnHigh: false, // Social auth users are already verified by provider
    logAllAttempts: true,
    customThresholds: {
      block: 100,   // Block immediately if device already registered (score = 100)
      flag: 80,     // Flag if risk score >= 80
      verify: 60,   // Require verification if risk score >= 60
    }
  }),
  suspiciousActivityLogger(),
  async (req: express.Request, res: express.Response) => {
    // Check if fraud detection blocked the request
    if (req.fraudDetection && req.fraudDetection.shouldBlock) {
      logger.warn('Social Auth Google OAuth blocked due to fraud detection', {
        riskScore: req.fraudDetection.riskScore,
        flags: req.fraudDetection.flags,
      });

      // Get frontend URL from environment or default
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const blockedUrl = `${frontendUrl}/auth/blocked?provider=google&reason=fraud_detection&riskScore=${req.fraudDetection.riskScore}&flags=${req.fraudDetection.flags.join(',')}`;

      logger.info('Redirecting blocked Social Auth OAuth to frontend', { blockedUrl });
      return res.redirect(blockedUrl);
    }

    // Continue to the controller
    await SocialAuthController.googleCallback(req, res);
  }
);

/**
 * Get current user profile
 */
router.get('/user/me', SocialAuthController.getCurrentUser);

export default router;
