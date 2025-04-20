import express from "express";
import passport from "passport";
import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";
import { protect } from "../middleware/auth.middleware";
import { authenticateToken } from "../middleware/authMiddleware";
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger";
import EmailService from "../services/email.service";
import WhatsAppService from "../services/whatsapp.service";
import { User } from "../models/User";

const router = express.Router();

// API Documentation endpoint
router.get("/", (req, res) => {
  res.sendFile("api-docs.html", { root: "public" });
});

// Health check endpoint
router.get("/healthcheck", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

//Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 240 * 60 * 1000, // 15 minutes: @Brilydal123 TODO: Change this to 15 minutes later
  max: 50, // Limit each IP to 5 requests per windowMs, @Brilydal123 TODO: Change this to 5 later
  message: "Too many attempts from this IP, please try again after 15 minutes",
});

router.use("/login", authLimiter);
router.use("/forgot-password", authLimiter);
router.use("/reset-password", authLimiter);

// Auth routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", authenticateToken, AuthController.logout);
router.post("/logout-all", authenticateToken, AuthController.logoutAll);
router.post("/trouble-login", AuthController.troubleLogin);
router.get("/sessions", authenticateToken, AuthController.getSessions);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);


// User validation endpoints
router.get("/check-email/:email", AuthController.checkEmail);
router.get("/check-username/:username", AuthController.checkUsername);

// Get current user info
router.get("/user/me", authenticateToken, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Return sanitized user object
  const user = req.user as any;
  const sanitizedUser = {
    id: user._id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    profileImage: user.profileImage,
    isEmailVerified: user.isEmailVerified,
    signupType: user.signupType,
    googleId: user.googleId,
    facebookId: user.facebookId,
    linkedinId: user.linkedinId
  };

  res.json({ success: true, user: sanitizedUser });
});

// Get user info from token
router.get("/user/info", (req, res) => {
  try {
    // Extract token from Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // Verify the token using require instead of import
    const jsonwebtoken = require('jsonwebtoken');
    const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Find the user
    User.findById(decoded.userId)
      .then(user => {
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
      })
      .catch(err => {
        console.error('Error finding user:', err);
        res.status(500).json({ success: false, message: 'Server error' });
      });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// Unified OTP verification route
router.post("/verify-otp", AuthController.verifyOTP);
router.post("/resend-otp", AuthController.resendOTP);
router.post("/select-otp-method", AuthController.selectOTPMethod);

// Email verification
router.post("/verify-email", AuthController.verifyEmail);
router.post("/resend-verification", AuthController.resendVerification);
router.post(
  "/resend-verification-email",
  protect,
  AuthController.resendVerification
);

// Test routes (remove in production)
router.post("/test-email", async (req, res) => {
  try {
    const testEmail = req.body.email || "bezingal@gmail.com";
    const testToken = "123456"; // Test verification code
    await EmailService.sendVerificationEmail(testEmail, testToken);
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error: any) {
    logger.error("Test email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: error.message,
    });
  }
});

router.post("/test-whatsapp", async (req, res) => {
  try {
    const testPhone = req.body.phoneNumber || "+237693028598";
    const testCode = "123456"; // Test verification code

    await WhatsAppService.sendOTPMessage(testPhone, testCode);

    res.json({
      success: true,
      message: "Test WhatsApp message sent successfully",
      details: {
        phoneNumber: testPhone,
        code: testCode,
      },
    });
  } catch (error: any) {
    logger.error("Test WhatsApp error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test WhatsApp message",
      error: error.message,
    });
  }
});

// Two-factor authentication
router.post("/2fa/generate", protect, AuthController.generate2FA);
router.post("/2fa/verify", protect, AuthController.verify2FA);
router.post("/2fa/disable", protect, AuthController.disable2FA);
router.post("/2fa/validate", AuthController.validate2FA);

// User management routes
router.get("/user/:id", async (req, res) => {
  try {
    // Add debug logging
    console.log('Received request for user:', req.params.id);
    console.log('Authorization header:', req.headers.authorization);

    const user = await AuthService.getUser(req.params.id);

    // Ensure we're returning the expected fields
    const sanitizedUser = {
      _id: user._id,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      profileImage: user.profileImage
    };

    console.log('Returning user data:', sanitizedUser);

    res.status(200).json({
      success: true,
      user: sanitizedUser
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user.",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put("/user/:id", async (req, res) => {
  try {
    const updatedUser = await AuthService.updateUser(req.params.id, req.body);
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    logger.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Failed to update user." });
  }
});

router.delete("/user/:id", async (req, res) => {
  try {
    await AuthService.deleteUser(req.params.id);
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    logger.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Failed to delete user." });
  }
});

// Social authentication routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req: express.Request, res: express.Response) => {
    const data = req.user as any;
    if (!data) {
      return res.redirect('/auth/login?error=google_auth_failed');
    }

    // Set tokens in cookies
    res.cookie('accessToken', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.cookie('refreshToken', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with success
    res.redirect(`/socials?success=true&provider=google`);
  }
);

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  (req: express.Request, res: express.Response) => {
    const data = req.user as any;
    if (!data) {
      return res.redirect('/auth/login?error=facebook_auth_failed');
    }

    // Set tokens in cookies
    res.cookie('accessToken', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.cookie('refreshToken', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with success
    res.redirect(`/socials?success=true&provider=facebook`);
  }
);

router.get('/linkedin', passport.authenticate('linkedin', { scope: ['r_emailaddress', 'r_liteprofile'] }));
router.get(
  '/linkedin/callback',
  passport.authenticate('linkedin', { session: false }),
  (req: express.Request, res: express.Response) => {
    const data = req.user as any;
    if (!data) {
      return res.redirect('/auth/login?error=linkedin_auth_failed');
    }

    // Set tokens in cookies
    res.cookie('accessToken', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.cookie('refreshToken', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with success
    res.redirect(`/socials?success=true&provider=linkedin`);
  }
);

// Mobile OAuth endpoints
router.post('/google/mobile', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    // Use the OAuth2Client to verify the token
    const { OAuth2Client } = require('google-auth-library');
    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: 'Invalid ID token' });
    }

    // Find or create user
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.findOne({ email: payload.email });

      if (user) {
        // Link Google account to existing user
        user.googleId = payload.sub;
        user.signupType = 'google';
        user.isEmailVerified = true;
        await user.save();
      } else {
        // Create new user
        user = new User({
          googleId: payload.sub,
          email: payload.email,
          fullName: payload.name,
          username: payload.email?.split('@')[0],
          signupType: 'google',
          isEmailVerified: true,
          password: 'oauth2-user-no-password',
          dateOfBirth: new Date(),
          countryOfResidence: 'Unknown',
          accountType: 'MYSELF',
          accountCategory: 'PRIMARY_ACCOUNT',
          verificationMethod: 'EMAIL',
          profileImage: payload.picture,
          refreshTokens: [],
        });
        await user.save();
      }
    }

    // Generate tokens
    const { generateTokens } = require('../config/passport');
    const { accessToken, refreshToken } = generateTokens(user.id.toString(), user.email);

    // Store refresh token
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.json({ accessToken, refreshToken, user });
  } catch (err:any) {
    logger.error('Google Mobile authentication failed:', err);
    res.status(401).json({ error: 'Google authentication failed', message: err.message });
  }
});

export default router;
