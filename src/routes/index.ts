/**
 * @file index.ts
 * @description Central Route Configuration & Management
 * =================================================
 *
 * ----------------
 * - Separation of Concerns: Routes are modularized by domain
 * - Security First: Protected routes enforce authentication
 * - Scalability: Easy addition of new route modules
 * - Maintainability: Clear structure and organization
 *
 * Route Categories:
 * ---------------
 * 1. Public Routes
 *    - Authentication endpoints (login, register, password reset)
 *    - Health checks and public info
 *
 * 2. Protected Routes
 *    - Profile management
 *    - Connection handling
 *    - User-specific operations
 *
 * Security Features:
 * ----------------
 * - JWT authentication via middleware
 * - Role-based access control
 * - Request validation
 *
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * // Adding a new route module:
 * import newFeatureRoutes from './newFeature.routes';
 * app.use('/api/new-feature', protect, newFeatureRoutes);
 */

import { Application } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes'
import profileRoutes from './profile.routes';
import connectionRoutes from './connection.routes';
import connectionAnalyticsRoutes from './connection-analytics.routes';
// import profileConnectionRoutes from './profile-connection.routes';
import contactRoutes from './contact.route';
import RelationshipTypeRoutes from './relationshipType.routes';
import logsRoutes from './logs.routes';
import myPtsRoutes from './my-pts.routes';
import myPtsValueRoutes from './my-pts-value.routes';
import myPtsHubRoutes from './my-pts-hub.routes';
import adminRoutes from './admin.routes';
import adminNotificationRoutes from './admin-notification.routes';
import adminUserRoutes from './admin-user.routes';
import adminVerificationRoutes from './admin/verification-admin.routes';
import verificationRoutes from './verification.routes';
import adminModuleRoutes from './admin/index';
import stripeRoutes from './stripe.routes';
import taskRoutes from './task.routes';
import profileDataRoutes from './data.routes';
import settingsRoutes from './settings.routes';
import listRoutes from './list.routes';
import eventRoutes from './event.routes';
import interactionRoutes from './interaction.routes';
import notificationRoutes from './notification.routes';
import userNotificationPreferencesRoutes from './user-notification-preferences.routes';
import notificationTestRoutes from './notification-test.routes';
import userDeviceRoutes from './user-device.routes';
import profileReferralRoutes from './profile-referral.routes';
import presenceRoutes from './presence.routes';
import gamificationRoutes from './gamification.routes';
import analyticsDashboardRoutes from './analytics-dashboard.routes';
import sessionsRoutes from './sessions.routes';
import messageProfileRoutes from './message-profile.routes';
import scansRoutes from './scans.routes';
import nfcRoutes from './nfc.routes';
import vaultRoutes from './vault.routes';
import { protect } from '../middleware/auth.middleware';
import { testRoutes } from './test.routes';
import session from 'express-session';
import passport from 'passport';
import socialAuthRoutes from './auth.social.routes';
import participantRoutes from './participant.routes';
import reminderRoutes from './reminder.routes';
import plansRoutes from './plans.routes';
import communityRoutes from './community.routes';
import profileFullRoutes from './profile-full.routes';
import fraudRoutes from './fraud.routes';
import countryRoutes from './country.routes';
/**
 * Configures and sets up all API routes for the application
 * @param app Express application instance
 * @description Initializes routes with their respective middleware chains
 */
export const setupRoutes = (app: Application): void => {
  // License validation removed

  // Root route - serve landing page
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });

  //auth test
  app.get('/socials', (req, res) => {
    res.sendFile('authtest.html', { root: 'public' });
  });

  // Admin logs page
  app.get('/admin/logs', (req, res) => {
    res.sendFile('logs.html', { root: 'public' });
  });

  app.use(
    session({
      secret: process.env.COOKIE_SECRET || "some secret, here top secret",
      resave: false,
      saveUninitialized: false, // Changed to false to prevent creating empty sessions
      cookie: {
        secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
        httpOnly: true, // Prevents JavaScript from reading the cookie
        sameSite: "lax", // Helps prevent CSRF attacks
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: "/",
      }
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Direct route for Google OAuth callback to match what's configured in Google Developer Console
  // Import fraud detection middleware
  const {
    fraudDetectionMiddleware,
    deviceFingerprintMiddleware,
    suspiciousActivityLogger
  } = require('../middleware/fraudDetection.middleware');

  app.get('/api/auth/google/callback',
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
    async (req, res, next) => {
      console.log('Received Google callback at /api/auth/google/callback');

      // Check if fraud detection blocked the request
      if (req.fraudDetection && req.fraudDetection.shouldBlock) {
        const { logger } = require('../utils/logger');
        logger.warn('Google OAuth callback blocked due to fraud detection', {
          riskScore: req.fraudDetection.riskScore,
          flags: req.fraudDetection.flags,
        });

        // Get frontend URL from environment or default
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const blockedUrl = `${frontendUrl}/auth/blocked?provider=google&reason=fraud_detection&riskScore=${req.fraudDetection.riskScore}&flags=${req.fraudDetection.flags.join(',')}`;

        logger.info('Redirecting blocked OAuth to frontend', { blockedUrl });
        return res.redirect(blockedUrl);
      }

      // Import the controller
      const { SocialAuthController } = require('../controllers/auth.social.controller');
      // Call the controller method directly
      await SocialAuthController.googleCallback(req, res, next);
    }
  );

  // Public routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/auth/social', socialAuthRoutes);
  app.use('/api/profile-full', profileFullRoutes);
  app.use('/api/countries', countryRoutes);

    // settings routes
  app.use('/api/settings', protect, settingsRoutes);

  // profile data routes
  app.use('/api/p/data', profileDataRoutes);




  // Protected routes
  app.use('/api/profiles', protect, profileRoutes);
  app.use('/api/profiles', protect, scansRoutes);
  app.use('/api/nfc', protect, nfcRoutes);
  app.use('/api/vault', protect, vaultRoutes);
  // app.use('/api/connections', protect, connectionRoutes);
  app.use('/api/p/connections', protect, connectionRoutes);
  app.use('/api/connections/analytics', protect, connectionAnalyticsRoutes);
  app.use('/api/contacts', protect, contactRoutes);

  app.use('/api/tasks', protect, taskRoutes);
  app.use('/api/lists', protect, listRoutes);
  app.use('/api/events', protect, eventRoutes);
  app.use('/api/interactions', protect, interactionRoutes);
  app.use('/api/plans', protect, plansRoutes);
  app.use('/api/vault', protect, vaultRoutes);
  app.use('/api/relationships', protect, RelationshipTypeRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/my-pts', protect, myPtsRoutes);
  app.use('/api/my-pts-value', protect, myPtsValueRoutes);
  app.use('/api/my-pts-hub', protect, myPtsHubRoutes);
  app.use('/api/admin', protect, adminRoutes);
  app.use('/api/admin/notifications', protect, adminNotificationRoutes);
  app.use('/api/admin/users', adminUserRoutes);
  app.use('/api/admin/verification', protect, adminVerificationRoutes);
  app.use('/api/verification', verificationRoutes);
  app.use('/api/admin', adminModuleRoutes);
  app.use('/api/fraud', fraudRoutes);
  app.use('/api/stripe', stripeRoutes);
  app.use('/api/notifications', protect, notificationRoutes);
  app.use('/api/user/notification-preferences', protect, userNotificationPreferencesRoutes);
  app.use('/api/user/devices', protect, userDeviceRoutes);
  app.use('/api/test/notifications', protect, notificationTestRoutes);
  app.use('/api/referrals', profileReferralRoutes);
  app.use('/api/presence', protect, presenceRoutes);
  app.use('/api/community', protect, communityRoutes);
  // additional routes related to plans
  app.use('/api/participant', participantRoutes);
  app.use('/api/reminders', reminderRoutes);
  app.use('/api/gamification', protect, gamificationRoutes);
  app.use('/api/analytics', protect, analyticsDashboardRoutes);
  app.use('/api/sessions', protect, sessionsRoutes);
  app.use('/api/message-profile', protect, messageProfileRoutes);

  // Test email route
  app.get('/api/test/email', async (req, res) => {
    try {
      const EmailService = require('../services/email.service').default;
      const testEmail = req.query.email as string || 'bezingal@gmail.com';

      // Send a test verification email
      await EmailService.sendVerificationEmail(
        testEmail,
        '123456',
        { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
      );

      res.status(200).json({
        success: true,
        message: `Test email sent to ${testEmail}`,
        details: {
          recipient: testEmail,
          code: '123456',
          sentAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Test routes for advanced tracking (development only)
  // Use a more specific prefix to avoid intercepting other API routes
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/test', testRoutes);
  }

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Register additional routes here
};
