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
import planRoutes from './plan.routes'
import profileRoutes from './profile.routes';
// import connectionRoutes from './connection.routes';
import profileConnectionRoutes from './profile-connection.routes';
import contactRoutes from './contact.route';
import RelationshipTypeRoutes from './relationshipType.routes';
import taskRoutes from './task.routes';
import eventRoutes from './event.routes';
import listRoutes from './list.routes';
import logsRoutes from './logs.routes';
import myPtsRoutes from './my-pts.routes';
import myPtsValueRoutes from './my-pts-value.routes';
import myPtsHubRoutes from './my-pts-hub.routes';
import adminNotificationRoutes from './admin-notification.routes';
import stripeRoutes from './stripe.routes';
import notificationRoutes from './notification.routes';
import userNotificationPreferencesRoutes from './user-notification-preferences.routes';
import notificationTestRoutes from './notification-test.routes';
import userDeviceRoutes from './user-device.routes';
import { protect } from '../middleware/auth.middleware';
import { testRoutes } from './test.routes';

import { enforceLicenseValidation } from '../middleware/enforce-license.middleware';
import session from 'express-session';
import passport from 'passport';
import socialAuthRoutes from './auth.social.routes';
/**
 * Configures and sets up all API routes for the application
 * @param app Express application instance
 * @description Initializes routes with their respective middleware chains
 */
export const setupRoutes = (app: Application): void => {
  // Apply license validation enforcement globally
  app.use(enforceLicenseValidation);

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
      secret: "some secret, here top secret",
      resave: false,
      saveUninitialized: true,
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Direct route for Google OAuth callback to match what's configured in Google Developer Console
  app.get('/api/auth/google/callback', (req, res, next) => {
    console.log('Received Google callback at /api/auth/google/callback');
    // Import the controller
    const { SocialAuthController } = require('../controllers/auth.social.controller');
    // Call the controller method directly
    SocialAuthController.googleCallback(req, res, next);
  });

  // Public routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/auth/social', socialAuthRoutes);

  // Protected routes
  app.use('/api/profiles', protect, profileRoutes);
  // app.use('/api/connections', protect, connectionRoutes);
  app.use('/api/profile-connections', protect, profileConnectionRoutes);
  app.use('/api/contacts', protect, contactRoutes);
  app.use('/api/plans', protect, planRoutes);
  app.use('/api/tasks', protect, taskRoutes);
  app.use('/api/lists', protect, listRoutes);
  app.use('/api/events', protect, eventRoutes);
  app.use('/api/relationships', protect, RelationshipTypeRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/my-pts', protect, myPtsRoutes);
  app.use('/api/my-pts-value', protect, myPtsValueRoutes);
  app.use('/api/my-pts-hub', protect, myPtsHubRoutes);
  app.use('/api/admin/notifications', protect, adminNotificationRoutes);
  app.use('/api/stripe', stripeRoutes);
  app.use('/api/notifications', protect, notificationRoutes);
  app.use('/api/user/notification-preferences', protect, userNotificationPreferencesRoutes);
  app.use('/api/user/devices', protect, userDeviceRoutes);
  app.use('/api/test/notifications', protect, notificationTestRoutes);

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
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api', testRoutes);
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Register additional routes here
};
