import express from 'express';
import { SocialAuthController } from '../controllers/auth.social.controller';

const router = express.Router();

/**
 * Google OAuth routes
 */
// Initiate Google OAuth flow
router.get('/google', SocialAuthController.googleLogin);

// Handle Google OAuth callback
router.get('/google/callback', SocialAuthController.googleCallback);

/**
 * Get current user profile
 */
router.get('/user/me', SocialAuthController.getCurrentUser);

export default router;
