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
const plan_routes_1 = __importDefault(require("./plan.routes"));
const profile_routes_1 = __importDefault(require("./profile.routes"));
// import connectionRoutes from './connection.routes';
const profile_connection_routes_1 = __importDefault(require("./profile-connection.routes"));
const contact_route_1 = __importDefault(require("./contact.route"));
const relationshipType_routes_1 = __importDefault(require("./relationshipType.routes"));
const logs_routes_1 = __importDefault(require("./logs.routes"));
const my_pts_routes_1 = __importDefault(require("./my-pts.routes"));
const my_pts_value_routes_1 = __importDefault(require("./my-pts-value.routes"));
const my_pts_hub_routes_1 = __importDefault(require("./my-pts-hub.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const admin_notification_routes_1 = __importDefault(require("./admin-notification.routes"));
const index_1 = __importDefault(require("./admin/index"));
const stripe_routes_1 = __importDefault(require("./stripe.routes"));
const task_routes_1 = __importDefault(require("./task.routes"));
const list_routes_1 = __importDefault(require("./list.routes"));
const event_routes_1 = __importDefault(require("./event.routes"));
const interaction_routes_1 = __importDefault(require("./interaction.routes"));
const notification_routes_1 = __importDefault(require("./notification.routes"));
const user_notification_preferences_routes_1 = __importDefault(require("./user-notification-preferences.routes"));
const notification_test_routes_1 = __importDefault(require("./notification-test.routes"));
const user_device_routes_1 = __importDefault(require("./user-device.routes"));
const profile_referral_routes_1 = __importDefault(require("./profile-referral.routes"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const test_routes_1 = require("./test.routes");
const enforce_license_middleware_1 = require("../middleware/enforce-license.middleware");
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const auth_social_routes_1 = __importDefault(require("./auth.social.routes"));
/**
 * Configures and sets up all API routes for the application
 * @param app Express application instance
 * @description Initializes routes with their respective middleware chains
 */
const setupRoutes = (app) => {
    // Apply license validation enforcement globally
    app.use(enforce_license_middleware_1.enforceLicenseValidation);
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
    app.get('/api/auth/google/callback', (req, res, next) => {
        console.log('Received Google callback at /api/auth/google/callback');
        // Import the controller
        const { SocialAuthController } = require('../controllers/auth.social.controller');
        // Call the controller method directly
        SocialAuthController.googleCallback(req, res, next);
    });
    // Public routes
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/users', user_routes_1.default);
    app.use('/api/auth/social', auth_social_routes_1.default);
    // Protected routes
    app.use('/api/profiles', auth_middleware_1.protect, profile_routes_1.default);
    // app.use('/api/connections', protect, connectionRoutes);
    app.use('/api/profile-connections', auth_middleware_1.protect, profile_connection_routes_1.default);
    app.use('/api/contacts', auth_middleware_1.protect, contact_route_1.default);
    app.use('/api/plans', auth_middleware_1.protect, plan_routes_1.default);
    app.use('/api/tasks', auth_middleware_1.protect, task_routes_1.default);
    app.use('/api/lists', auth_middleware_1.protect, list_routes_1.default);
    app.use('/api/events', auth_middleware_1.protect, event_routes_1.default);
    app.use('/api/interactions', auth_middleware_1.protect, interaction_routes_1.default);
    app.use('/api/relationships', auth_middleware_1.protect, relationshipType_routes_1.default);
    app.use('/api/logs', logs_routes_1.default);
    app.use('/api/my-pts', auth_middleware_1.protect, my_pts_routes_1.default);
    app.use('/api/my-pts-value', auth_middleware_1.protect, my_pts_value_routes_1.default);
    app.use('/api/my-pts-hub', auth_middleware_1.protect, my_pts_hub_routes_1.default);
    app.use('/api/admin', auth_middleware_1.protect, admin_routes_1.default);
    app.use('/api/admin/notifications', auth_middleware_1.protect, admin_notification_routes_1.default);
    app.use('/api/admin', index_1.default);
    app.use('/api/stripe', stripe_routes_1.default);
    app.use('/api/notifications', auth_middleware_1.protect, notification_routes_1.default);
    app.use('/api/user/notification-preferences', auth_middleware_1.protect, user_notification_preferences_routes_1.default);
    app.use('/api/user/devices', auth_middleware_1.protect, user_device_routes_1.default);
    app.use('/api/test/notifications', auth_middleware_1.protect, notification_test_routes_1.default);
    app.use('/api/referrals', profile_referral_routes_1.default);
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
    if (process.env.NODE_ENV !== 'production') {
        app.use('/api', test_routes_1.testRoutes);
    }
    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    // Register additional routes here
};
exports.setupRoutes = setupRoutes;
