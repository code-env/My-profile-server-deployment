import express from 'express';
import { AuthSocialController } from '../controllers/socials.auth.controllers';

const router = express.Router();

// Google OAuth routes
router.get('/google', AuthSocialController.googleConsent);
router.get('/google/callback', AuthSocialController.googleAuth);
router.post('/google/callback', AuthSocialController.googleAuth);

// Facebook OAuth routes
router.get('/facebook', AuthSocialController.facebookConsent);
router.get('/facebook/callback', AuthSocialController.facebookAuth);

// LinkedIn OAuth routes
router.get('/linkedin', AuthSocialController.linkedinConsent);
router.get('/linkedin/callback', AuthSocialController.linkedinAuth);

// Get current user info
router.get('/user/me', async (req, res) => {
  try {
    // Import required modules
    const jwt = require('jsonwebtoken');
    const { User } = require('../models/User');

    // Extract token from cookies or Authorization header
    const token = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Find the user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Return user data
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        googleId: user.googleId,
        facebookId: user.facebookId,
        linkedinId: user.linkedinId,
        signupType: user.signupType,
        isEmailVerified: user.isEmailVerified,
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;

//clientid: 124684938199-e7ocs5m4npm1hm31i5e0j5sbqk9m62m9.apps.googleusercontent.com
//clientsecret: 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
