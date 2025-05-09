"use strict";
/**
 * @file app.ts
 * @description My Profile - Professional Network Platform Core Server
 * =================================================================
 *
 * A robust and secure server implementation for the My Profile platform,
 * providing professional networking, profile management, and connection features.
 *
 * Features:
 * - Secure authentication & authorization
 * - Real-time messaging & notifications
 * - Profile management & customization
 * - Professional networking & connections
 * - Analytics & insights
 * - WhatsApp integration
 *
 * Technical Stack:
 * - Node.js with TypeScript
 * - Express.js framework
 * - MongoDB with Mongoose
 * - WebSocket for real-time features
 * - JWT authentication
 * - HTTP/2 & SSL/TLS support
 *
 * Security Features:
 * - HTTPS/HTTP2 with modern TLS
 * - CORS protection
 * - Rate limiting
 * - CSRF protection
 * - XSS prevention
 * - Security headers (CSP, HSTS)
 * - Input validation & sanitization
 *
 * @version 1.0.0
 * @license MIT
 *
 * @author Marco Blaise
 * @copyright 2025 My Profile Ltd
 *
 * Architecture: Clean Architecture with Domain-Driven Design principles
 * Documentation: JSDoc with TypeScript types
 * Testing: Jest with TypeScript support
 * CI/CD: GitHub Actions with automated testing
 *
 * Repository: []
 * Documentation: []
 *
 * For detailed API documentation, see API.md
 * For contribution guidelines, see CONTRIBUTING.md
 * For architecture overview, see ARCHITECTURE.md
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppServer = void 0;
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const chalk_1 = __importDefault(require("chalk"));
// Internal imports
const config_1 = require("./config/config");
const logger_1 = require("./utils/logger");
const cors_config_1 = require("./config/cors.config");
const routes_1 = require("./routes");
const error_middleware_1 = require("./middleware/error-middleware");
const rate_limiter_middleware_1 = require("./middleware/rate-limiter.middleware");
const performance_middleware_1 = require("./middleware/performance.middleware");
const env_validator_1 = require("./utils/env-validator");
const license_middleware_1 = require("./middleware/license.middleware");
const whatsapp_service_1 = __importDefault(require("./services/whatsapp.service"));
const initialize_my_pts_hub_1 = require("./startup/initialize-my-pts-hub");
const initialize_profile_templates_1 = require("./startup/initialize-profile-templates");
const advanced_tracking_middleware_1 = require("./middleware/advanced-tracking.middleware");
const cleanupTokens_1 = require("./jobs/cleanupTokens");
const scalableTokenCleanup_1 = require("./jobs/scalableTokenCleanup");
// Import passport configuration
require("./config/passport");
const license_service_1 = require("./services/license.service");
const cookie_config_middleware_1 = require("./middleware/cookie-config.middleware");
/**
 * @class AppServer
 * @description Core server application class that manages the Express application lifecycle,
 * middleware configuration, routing, and server operations. This class implements a robust
 * and secure server setup with support for both HTTP (development) and HTTPS (production)
 * environments.
 *
 * Key features:
 * - Secure HTTPS/HTTP2 support
 * - Automatic port selection with fallback
 * - Graceful shutdown handling
 * - Comprehensive error handling
 * - MongoDB integration
 * - Performance monitoring
 * - Security middleware (CORS, Helmet, Rate limiting)
 *
 * @example
 * const server = new AppServer();
 * server.start().catch(console.error);
 *
 * @version 1.0.0
 */
class AppServer {
    /**
     * @constructor
     * @description Initializes the Express application and configures core middleware and routes.
     *
     * Initialization Sequence:
     * 1. Create Express application
     * 2. Configure middleware stack
     * 3. Set up route handlers
     * 4. Initialize error handling
     *
     * @example
     * const server = new AppServer();
     */
    constructor() {
        this.isShuttingDown = false;
        this.app = (0, express_1.default)();
        this.configureMiddleware();
        this.configureRoutes();
        this.configureErrorHandling();
    }
    /**
     * @private
     * @method configureMiddleware
     * @description Configures essential middleware for security, performance, and functionality
     *
     * Middleware Stack:
     * 1. Static file serving
     * 2. Performance monitoring
     * 3. Security headers (Helmet)
     * 4. CORS with whitelist
     * 5. Body/Cookie parsing
     * 6. Compression
     * 7. Request logging
     *
     * Static File Configuration:
     * - Cache control
     * - MIME type handling
     * - Security headers
     *
     * Security Settings:
     * - CSP directives
     * - CORS restrictions
     * - XSS protection
     * - Frame guards
     *
     * @security Critical security component - modify with caution
     */
    configureMiddleware() {
        // Enable 'trust proxy' to get real client IP when behind a reverse proxy
        this.app.set('trust proxy', true);
        // Serve static files from public directory before security middleware
        this.app.use("/public", express_1.default.static("public", {
            maxAge: "1d",
            index: false,
            setHeaders: (res, path) => {
                if (path.endsWith(".css")) {
                    res.setHeader("Content-Type", "text/css");
                }
                else if (path.endsWith(".js")) {
                    res.setHeader("Content-Type", "application/javascript");
                }
                else if (path.endsWith(".png")) {
                    res.setHeader("Content-Type", "image/png");
                }
            },
        }));
        // Only add license validation middleware in non-production environments
        if (process.env.NODE_ENV !== "production") {
            this.app.use(license_middleware_1.validateLicenseMiddleware);
        }
        this.app.use((0, performance_middleware_1.monitorPerformance)());
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    scriptSrcAttr: ["'unsafe-inline'"],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https:",
                        "https://fonts.googleapis.com",
                        "https://cdnjs.cloudflare.com",
                    ],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    fontSrc: [
                        "'self'",
                        "https:",
                        "https://fonts.gstatic.com",
                        "https://cdnjs.cloudflare.com",
                    ],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: true,
            crossOriginOpenerPolicy: { policy: "same-origin" },
            crossOriginResourcePolicy: { policy: "same-site" },
            dnsPrefetchControl: { allow: false },
            frameguard: { action: "deny" },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true,
            },
            ieNoOpen: true,
            noSniff: true,
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },
            xssFilter: true,
        }));
        this.app.use((0, cors_1.default)({
            origin: function (origin, callback) {
                // Allow requests with no origin (like mobile apps, curl, etc)
                if (!origin)
                    return callback(null, true);
                // Check if origin is in whitelist
                if (cors_config_1.whitelistOrigins.indexOf(origin) !== -1 || cors_config_1.whitelistOrigins.includes('*')) {
                    return callback(null, true);
                }
                else {
                    logger_1.logger.warn(`CORS blocked request from origin: ${origin}`);
                    return callback(null, false);
                }
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "Cookie",
                "x-profile-token",
                "x-user-role",
                "x-token-verified",
                "x-user-is-admin",
                "x-access-token"
            ],
            exposedHeaders: ["Content-Range", "X-Content-Range", "Set-Cookie"],
            maxAge: 600,
        }));
        // Add advanced tracking middleware after security headers but before routes
        // Configure morgan with advanced tracking format
        const morganFormat = ":method :url :status :response-time ms - :res[content-length] - IP: :remote-addr - :user-agent";
        this.app.use((0, morgan_1.default)(morganFormat, {
            stream: {
                write: (message) => {
                    logger_1.logger.http(message.trim());
                },
            },
        }));
        this.app.use(advanced_tracking_middleware_1.advancedTrackingMiddleware);
        // Special handling for Stripe webhook route - needs raw body
        this.app.use((req, res, next) => {
            if (req.originalUrl === '/api/stripe/webhook') {
                next();
            }
            else {
                express_1.default.json({ limit: "10mb" })(req, res, next);
            }
        });
        this.app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
        this.app.use((0, cookie_parser_1.default)(config_1.config.COOKIE_SECRET));
        // Add cookie configuration middleware to ensure proper SameSite and Secure settings
        this.app.use(cookie_config_middleware_1.configureCookiesMiddleware);
        this.app.use((0, compression_1.default)());
        this.app.use(rate_limiter_middleware_1.rateLimiterMiddleware);
        // Serve static files from public directory
    }
    /**
     * @private
     * @method configureRoutes
     * @description Sets up application routes and API endpoints
     *
     * Route Categories:
     * - Authentication routes
     * - Profile management
     * - User connections
     * - Analytics endpoints
     * - Admin functions
     *
     * Features:
     * - Modular routing
     * - Input validation
     * - Error boundaries
     * - Response formatting
     *
     * @security Routes should validate authentication and authorization
     */
    configureRoutes() {
        (0, routes_1.setupRoutes)(this.app);
    }
    /**
     * @private
     * @method configureErrorHandling
     * @description Configures global error handling and process event listeners.
     * Handles:
     * - Uncaught exceptions
     * - Unhandled promise rejections
     * - Process termination signals (SIGTERM, SIGINT)
     *
     * @security Critical for application stability and security.
     * Ensures proper cleanup and logging of errors.
     */
    configureErrorHandling() {
        this.app.use(error_middleware_1.errorHandler);
        process.on("uncaughtException", (error) => {
            logger_1.logger.error("Uncaught Exception:", error);
            if (process.env.NODE_ENV === "development") {
                console.error("Development mode - continuing despite error:", error);
            }
            else {
                this.shutdown(1);
            }
        });
        process.on("unhandledRejection", (reason) => {
            logger_1.logger.error("Unhandled Rejection:", reason);
        });
        process.on("SIGTERM", () => this.shutdown(0));
        process.on("SIGINT", () => this.shutdown(0));
    }
    /**
     * @private
     * @method initializeDatabase
     * @description Establishes and verifies database connection with retry mechanism.
     *
     * @returns {Promise<void>} Resolves when database connection is established
     * @throws {Error} If connection fails after maximum retries
     *
     * Features:
     * - Automatic retry with exponential backoff
     * - Connection pool management
     * - Detailed logging of connection status
     *
     * @example
     * await this.initializeDatabase();
     */
    /**
     * @private
     * @method validateLicense
     * @description Validates the hardware-locked license before allowing server startup
     * @throws {Error} If license validation fails
     */
    async validateLicense() {
        // Skip all license validation in production
        if (process.env.BYPASS_LICENSE === "true") {
            logger_1.logger.info("✅ License validation skipped in production environment");
            return;
        }
        try {
            const licenseKey = process.env.LICENSE_KEY;
            const deviceId = require("os").hostname();
            const ipAddress = "127.0.0.1"; // Local server
            if (!licenseKey) {
                throw new Error("LICENSE_KEY environment variable is required");
            }
            if (!process.env.COMPANY_SECRET) {
                throw new Error("COMPANY_SECRET environment variable is required");
            }
            // Validate license
            const validationResult = await license_service_1.licenseService.validateLicense(licenseKey, deviceId, ipAddress);
            if (!validationResult.isValid) {
                throw new Error(`License validation failed: ${validationResult.error}`);
            }
            logger_1.logger.info("✅ License validated successfully");
            if (validationResult.employeeInfo) {
                logger_1.logger.info(`Licensed to: ${validationResult.employeeInfo.name}`);
            }
        }
        catch (error) {
            logger_1.logger.error("License validation error:", error);
            if (process.env.BYPASS_LICENSE === "true") {
                logger_1.logger.warn("Continuing in production despite license error");
                return;
            }
            throw error;
        }
    }
    /**
     * @private
     * @method initializeDatabase
     * @description Establishes MongoDB connection with retry mechanism
     *
     * Connection Features:
     * - Connection pooling
     * - Automatic retries
     * - Timeout handling
     * - Error logging
     *
     * Configuration:
     * - Pool size: 2-10 connections
     * - Connect timeout: 10s
     * - Socket timeout: 45s
     * - Server selection: 10s
     *
     * @throws {Error} If connection fails after max retries
     */
    async initializeDatabase() {
        var _a;
        const maxRetries = 5;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                await mongoose_1.default.connect(config_1.config.MONGODB_URI, {
                    authSource: "admin",
                    maxPoolSize: 10,
                    minPoolSize: 2,
                    connectTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                    serverSelectionTimeoutMS: 10000,
                });
                const { log } = require("./utils/console-art");
                log.success("MongoDB Connection Established");
                log.info("Connection Details:");
                console.log(chalk_1.default.cyan(`   • Database URL: ${chalk_1.default.bold(config_1.config.MONGODB_URI)}`));
                console.log(chalk_1.default.cyan(`   • Pool Size: ${chalk_1.default.bold(mongoose_1.default.connection.config.maxPoolSize || "default")}`));
                console.log(chalk_1.default.cyan(`   • Database: ${chalk_1.default.bold(((_a = mongoose_1.default.connection.db) === null || _a === void 0 ? void 0 : _a.databaseName) || "unknown")}`));
                break;
            }
            catch (error) {
                retryCount++;
                logger_1.logger.error(`Database connection attempt ${retryCount} failed:`, error);
                if (retryCount === maxRetries)
                    throw error;
                await new Promise((resolve) => setTimeout(resolve, 5000 * retryCount));
            }
        }
    }
    /**
     * @public
     * @method start
     * @description Initializes and starts the server with all required services.
     *
     * @returns {Promise<void>} Resolves when server is successfully started
     * @throws {Error} If server initialization fails
     *
     * Startup sequence:
     * 1. Load configuration
     * 2. Validate environment
     * 3. Initialize database
     * 4. Start required services (WhatsApp, etc.)
     * 5. Start HTTP/HTTPS server
     *
     * @example
     * const server = new AppServer();
     * await server.start();
     */
    async start() {
        try {
            const { log, serverStartupArt } = require("./utils/console-art");
            console.log(serverStartupArt);
            log.highlight("Starting ODIN API Server...");
            log.info(`Environment: ${process.env.NODE_ENV}`);
            (0, env_validator_1.validateEnv)();
            await this.initializeDatabase();
            await whatsapp_service_1.default.initialize().catch((error) => {
                log.warn("WhatsApp service initialization failed: " + error.message);
            });
            // Initialize profile templates
            try {
                await (0, initialize_profile_templates_1.initializeProfileTemplates)();
                log.success("Profile templates initialized successfully");
            }
            catch (error) {
                log.warn("Profile templates initialization failed: " + error.message);
            }
            // Start WhatsApp service with retries
            let attempts = 0;
            const initWhatsApp = async () => {
                try {
                    await whatsapp_service_1.default.initialize();
                }
                catch (error) {
                    if (attempts < 3) {
                        attempts++;
                        setTimeout(initWhatsApp, 5000 * attempts);
                    }
                }
            };
            await initWhatsApp();
            // Initialize MyPts Hub service
            await (0, initialize_my_pts_hub_1.initializeMyPtsHub)();
            // Initialize admin settings
            const { initializeDefaultSettings } = require('./models/admin-settings.model');
            await initializeDefaultSettings();
            // Schedule token cleanup job
            // Use scalable token cleanup for large user bases (1M+ users)
            const useScalableCleanup = process.env.USE_SCALABLE_CLEANUP === 'true' ||
                process.env.NODE_ENV === 'production';
            if (useScalableCleanup) {
                logger_1.logger.info('Using scalable token cleanup for large user bases');
                (0, scalableTokenCleanup_1.scheduleScalableTokenCleanup)();
            }
            else {
                logger_1.logger.info('Using standard token cleanup');
                (0, cleanupTokens_1.scheduleTokenCleanup)();
            }
            // Always use HTTP server as Render handles SSL/HTTPS
            await this.startHttpServer();
            console.log("\n" + chalk_1.default.black(chalk_1.default.bgGreen(" SERVER READY ")));
            log.success(`API Server running on port ${config_1.config.PORT}`);
            log.info("Press CTRL+C to stop the server");
        }
        catch (error) {
            logger_1.logger.error("Server startup failed:", error);
            process.exit(1);
        }
    }
    /**
     * @private
     * @method shutdown
     * @description Performs graceful shutdown of server and database connections.
     *
     * @param {number} exitCode - Process exit code (0 for success, non-zero for errors)
     * @returns {Promise<void>} Resolves when shutdown is complete
     *
     * Shutdown sequence:
     * 1. Prevent new connections
     * 2. Close existing connections
     * 3. Disconnect from database
     * 4. Exit process
     *
     * @security Critical for data integrity and resource cleanup
     */
    async shutdown(exitCode = 0) {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        logger_1.logger.info("Initiating graceful shutdown...");
        try {
            if (this.server) {
                await new Promise((resolve, reject) => {
                    this.server.close((err) => {
                        if (err) {
                            logger_1.logger.error("Error closing server:", err);
                            reject(err);
                        }
                        else {
                            logger_1.logger.info("Server connections closed");
                            resolve();
                        }
                    });
                });
            }
            await mongoose_1.default.disconnect();
            logger_1.logger.info("Database connections closed");
            logger_1.logger.info("Shutdown completed");
            process.exit(exitCode);
        }
        catch (error) {
            logger_1.logger.error("Error during shutdown:", error);
            process.exit(1);
        }
    }
    async startHttpServer() {
        const port = process.env.PORT || config_1.config.PORT;
        await new Promise((resolve, reject) => {
            this.server = this.app
                .listen(port, () => {
                // Initialize both WebSocket and Socket.IO
                const { initializeWebSocket } = require("./utils/websocket");
                initializeWebSocket(this.server, this.app);
                const { log } = require("./utils/console-art");
                log.success(`🚀 Server running on port ${port}`);
                log.info(`WebSocket (WS) available at /ws/logs`);
                log.info(`Socket.IO available at /socket.io`);
                if (process.env.NODE_ENV === "production") {
                    log.info("Running in production mode (SSL/HTTPS handled by Render)");
                }
                resolve();
            })
                .on("error", (err) => {
                logger_1.logger.error("Failed to start HTTP server:", err);
                reject(err);
            });
        });
    }
}
exports.AppServer = AppServer;
// Create and export a singleton instance
exports.default = new AppServer();
