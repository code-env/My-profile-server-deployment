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
const contact_route_1 = __importDefault(require("./contact.route"));
const relationshipType_routes_1 = __importDefault(require("./relationshipType.routes"));
const logs_routes_1 = __importDefault(require("./logs.routes"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const test_routes_1 = require("./test.routes");
const enforce_license_middleware_1 = require("../middleware/enforce-license.middleware");
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const socials_auth_route_1 = __importDefault(require("./socials.auth.route"));
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
        secret: "some secret, here top secret",
        resave: false,
        saveUninitialized: true,
    }));
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    // Public routes
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/users', user_routes_1.default);
    app.use('/api/sauth', socials_auth_route_1.default);
    // Protected routes
    app.use('/api/profiles', auth_middleware_1.protect, profile_routes_1.default);
    app.use('/api/connections', auth_middleware_1.protect, connection_routes_1.default);
    app.use('/api/contacts', auth_middleware_1.protect, contact_route_1.default);
    app.use('/api/relationships', auth_middleware_1.protect, relationshipType_routes_1.default);
    app.use('/api/logs', logs_routes_1.default);
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
