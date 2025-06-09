"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = void 0;
const auth_routes_1 = __importDefault(require("./auth.routes"));
const user_routes_1 = __importDefault(require("./user.routes"));
const profile_routes_1 = __importDefault(require("./profile.routes"));
const connection_routes_1 = __importDefault(require("./connection.routes"));
const connection_analytics_routes_1 = __importDefault(require("./connection-analytics.routes"));
// import profileConnectionRoutes from './profile-connection.routes';
const contact_route_1 = __importDefault(require("./contact.route"));
const relationshipType_routes_1 = __importDefault(require("./relationshipType.routes"));
const logs_routes_1 = __importDefault(require("./logs.routes"));
const my_pts_routes_1 = __importDefault(require("./my-pts.routes"));
const my_pts_value_routes_1 = __importDefault(require("./my-pts-value.routes"));
const my_pts_hub_routes_1 = __importDefault(require("./my-pts-hub.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const admin_notification_routes_1 = __importDefault(require("./admin-notification.routes"));
const admin_user_routes_1 = __importDefault(require("./admin-user.routes"));
const index_1 = __importDefault(require("./admin/index"));
const stripe_routes_1 = __importDefault(require("./stripe.routes"));
const task_routes_1 = __importDefault(require("./task.routes"));
const data_routes_1 = __importDefault(require("./data.routes"));
const settings_routes_1 = __importDefault(require("./settings.routes"));
const list_routes_1 = __importDefault(require("./list.routes"));
const event_routes_1 = __importDefault(require("./event.routes"));
const interaction_routes_1 = __importDefault(require("./interaction.routes"));
const notification_routes_1 = __importDefault(require("./notification.routes"));
const user_notification_preferences_routes_1 = __importDefault(require("./user-notification-preferences.routes"));
const notification_test_routes_1 = __importDefault(require("./notification-test.routes"));
const user_device_routes_1 = __importDefault(require("./user-device.routes"));
const profile_referral_routes_1 = __importDefault(require("./profile-referral.routes"));
const presence_routes_1 = __importDefault(require("./presence.routes"));
const gamification_routes_1 = __importDefault(require("./gamification.routes"));
const analytics_dashboard_routes_1 = __importDefault(require("./analytics-dashboard.routes"));
const sessions_routes_1 = __importDefault(require("./sessions.routes"));
const message_profile_routes_1 = __importDefault(require("./message-profile.routes"));
const scans_routes_1 = __importDefault(require("./scans.routes"));
const nfc_routes_1 = __importDefault(require("./nfc.routes"));
const vault_routes_1 = __importDefault(require("./vault.routes"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const test_routes_1 = require("./test.routes");
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const auth_social_routes_1 = __importDefault(require("./auth.social.routes"));
const participant_routes_1 = __importDefault(require("./participant.routes"));
const reminder_routes_1 = __importDefault(require("./reminder.routes"));
const plans_routes_1 = __importDefault(require("./plans.routes"));
const community_routes_1 = __importDefault(require("./community.routes"));
const profile_full_routes_1 = __importDefault(require("./profile-full.routes"));
const fraud_routes_1 = __importDefault(require("./fraud.routes"));
const country_routes_1 = __importDefault(require("./country.routes"));
/**
 * Configures and sets up all API routes for the application
 * @param app Express application instance
 * @description Initializes routes with their respective middleware chains
 */
const setupRoutes = (app) => {
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
    app.use((0, express_session_1.default)({
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
    }));
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    // Direct route for Google OAuth callback to match what's configured in Google Developer Console
    // Import fraud detection middleware
    const { fraudDetectionMiddleware, deviceFingerprintMiddleware, suspiciousActivityLogger } = require('../middleware/fraudDetection.middleware');
    app.get('/api/auth/google/callback', deviceFingerprintMiddleware(), fraudDetectionMiddleware({
        blockOnCritical: true,
        requireVerificationOnHigh: false, // Social auth users are already verified by provider
        logAllAttempts: true,
        customThresholds: {
            block: 100, // Block immediately if device already registered (score = 100)
            flag: 80, // Flag if risk score >= 80
            verify: 60, // Require verification if risk score >= 60
        }
    }), suspiciousActivityLogger(), async (req, res, next) => {
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
    });
    // Public routes
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/users', user_routes_1.default);
    app.use('/api/auth/social', auth_social_routes_1.default);
    app.use('/api/profile-full', profile_full_routes_1.default);
    app.use('/api/countries', country_routes_1.default);
    // settings routes
    app.use('/api/settings', auth_middleware_1.protect, settings_routes_1.default);
    // profile data routes
    app.use('/api/p/data', data_routes_1.default);
    // Protected routes
    app.use('/api/profiles', auth_middleware_1.protect, profile_routes_1.default);
    app.use('/api/profiles', auth_middleware_1.protect, scans_routes_1.default);
    app.use('/api/nfc', auth_middleware_1.protect, nfc_routes_1.default);
    app.use('/api/vault', auth_middleware_1.protect, vault_routes_1.default);
    // app.use('/api/connections', protect, connectionRoutes);
    app.use('/api/p/connections', auth_middleware_1.protect, connection_routes_1.default);
    app.use('/api/connections/analytics', auth_middleware_1.protect, connection_analytics_routes_1.default);
    app.use('/api/contacts', auth_middleware_1.protect, contact_route_1.default);
    app.use('/api/tasks', auth_middleware_1.protect, task_routes_1.default);
    app.use('/api/lists', auth_middleware_1.protect, list_routes_1.default);
    app.use('/api/events', auth_middleware_1.protect, event_routes_1.default);
    app.use('/api/interactions', auth_middleware_1.protect, interaction_routes_1.default);
    app.use('/api/plans', auth_middleware_1.protect, plans_routes_1.default);
    app.use('/api/vault', auth_middleware_1.protect, vault_routes_1.default);
    app.use('/api/relationships', auth_middleware_1.protect, relationshipType_routes_1.default);
    app.use('/api/logs', logs_routes_1.default);
    app.use('/api/my-pts', auth_middleware_1.protect, my_pts_routes_1.default);
    app.use('/api/my-pts-value', auth_middleware_1.protect, my_pts_value_routes_1.default);
    app.use('/api/my-pts-hub', auth_middleware_1.protect, my_pts_hub_routes_1.default);
    app.use('/api/admin', auth_middleware_1.protect, admin_routes_1.default);
    app.use('/api/admin/notifications', auth_middleware_1.protect, admin_notification_routes_1.default);
    app.use('/api/admin/users', admin_user_routes_1.default);
    app.use('/api/admin', index_1.default);
    app.use('/api/fraud', fraud_routes_1.default);
    app.use('/api/stripe', stripe_routes_1.default);
    app.use('/api/notifications', auth_middleware_1.protect, notification_routes_1.default);
    app.use('/api/user/notification-preferences', auth_middleware_1.protect, user_notification_preferences_routes_1.default);
    app.use('/api/user/devices', auth_middleware_1.protect, user_device_routes_1.default);
    app.use('/api/test/notifications', auth_middleware_1.protect, notification_test_routes_1.default);
    app.use('/api/referrals', profile_referral_routes_1.default);
    app.use('/api/presence', auth_middleware_1.protect, presence_routes_1.default);
    app.use('/api/community', auth_middleware_1.protect, community_routes_1.default);
    // additional routes related to plans
    app.use('/api/participant', participant_routes_1.default);
    app.use('/api/reminders', reminder_routes_1.default);
    app.use('/api/gamification', auth_middleware_1.protect, gamification_routes_1.default);
    app.use('/api/analytics', auth_middleware_1.protect, analytics_dashboard_routes_1.default);
    app.use('/api/sessions', auth_middleware_1.protect, sessions_routes_1.default);
    app.use('/api/message-profile', auth_middleware_1.protect, message_profile_routes_1.default);
    // Test email route
    app.get('/api/test/email', async (req, res) => {
        try {
            const EmailService = require('../services/email.service').default;
            const testEmail = req.query.email || 'bezingal@gmail.com';
            // Send a test verification email
            await EmailService.sendVerificationEmail(testEmail, '123456', { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
            res.status(200).json({
                success: true,
                message: `Test email sent to ${testEmail}`,
                details: {
                    recipient: testEmail,
                    code: '123456',
                    sentAt: new Date().toISOString()
                }
            });
        }
        catch (error) {
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
        app.use('/api/test', test_routes_1.testRoutes);
    }
    // Health check endpoint
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    // Register additional routes here
};
exports.setupRoutes = setupRoutes;
