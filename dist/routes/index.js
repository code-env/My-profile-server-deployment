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
const profile_routes_1 = __importDefault(require("./profile.routes"));
const connection_routes_1 = __importDefault(require("./connection.routes"));
const logs_routes_1 = __importDefault(require("./logs.routes"));
const auth_middleware_1 = require("../middleware/auth.middleware");
/**
 * Configures and sets up all API routes for the application
 * @param app Express application instance
 * @description Initializes routes with their respective middleware chains
 */
const setupRoutes = (app) => {
    // Root route - serve landing page
    app.get('/', (req, res) => {
        res.sendFile('index.html', { root: 'public' });
    });
    // Admin logs page
    app.get('/admin/logs', (req, res) => {
        res.sendFile('admin-logs.html', { root: 'public' });
    });
    // Public routes
    app.use('/api/auth', auth_routes_1.default);
    // Protected routes
    app.use('/api/profiles', auth_middleware_1.protect, profile_routes_1.default);
    app.use('/api/connections', auth_middleware_1.protect, connection_routes_1.default);
    app.use('/api/logs', logs_routes_1.default);
    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    // Register additional routes here
};
exports.setupRoutes = setupRoutes;
