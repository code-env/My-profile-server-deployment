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
const https_1 = require("https");
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const spdy_1 = __importDefault(require("spdy"));
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
const whatsapp_service_1 = __importDefault(require("./services/whatsapp.service"));
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
     * The constructor follows a specific order of operations to ensure proper server setup:
     * 1. Create Express application
     * 2. Configure middleware
     * 3. Set up routes
     * 4. Initialize error handling
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
     * @description Configures essential middleware for security, performance, and functionality.
     * Sets up:
     * - Performance monitoring
     * - Security headers (Helmet)
     * - CORS with whitelist
     * - Body parsing
     * - Cookie parsing
     * - Response compression
     * - Rate limiting
     *
     * @security This method implements critical security middleware. Modifications should be
     * thoroughly reviewed and tested.
     */
    configureMiddleware() {
        this.app.use((0, performance_middleware_1.monitorPerformance)());
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'strict-dynamic'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: true,
            crossOriginOpenerPolicy: { policy: 'same-origin' },
            crossOriginResourcePolicy: { policy: 'same-site' },
            dnsPrefetchControl: { allow: false },
            frameguard: { action: 'deny' },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true,
            },
            ieNoOpen: true,
            noSniff: true,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
            xssFilter: true,
        }));
        this.app.use((0, cors_1.default)({
            origin: cors_config_1.whitelistOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            exposedHeaders: ['Content-Range', 'X-Content-Range'],
            maxAge: 600,
        }));
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((0, cookie_parser_1.default)(config_1.config.COOKIE_SECRET));
        this.app.use((0, compression_1.default)());
        this.app.use(rate_limiter_middleware_1.rateLimiterMiddleware);
    }
    /**
     * @private
     * @method configureRoutes
     * @description Sets up application routes and middleware.
     * Routes are modularized and imported from the routes directory.
     *
     * @see setupRoutes
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
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception:', error);
            if (process.env.NODE_ENV === 'development') {
                console.error('Development mode - continuing despite error:', error);
            }
            else {
                this.shutdown(1);
            }
        });
        process.on('unhandledRejection', (reason) => {
            logger_1.logger.error('Unhandled Rejection:', reason);
        });
        process.on('SIGTERM', () => this.shutdown(0));
        process.on('SIGINT', () => this.shutdown(0));
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
    async initializeDatabase() {
        var _a;
        const maxRetries = 5;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                await mongoose_1.default.connect(config_1.config.MONGODB_URI, {
                    authSource: 'admin',
                    maxPoolSize: 10,
                    minPoolSize: 2,
                    connectTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                    serverSelectionTimeoutMS: 10000,
                });
                const { log } = require('./utils/console-art');
                log.success('MongoDB Connection Established');
                log.info('Connection Details:');
                console.log(chalk_1.default.cyan(`   • Database URL: ${chalk_1.default.bold(config_1.config.MONGODB_URI)}`));
                console.log(chalk_1.default.cyan(`   • Pool Size: ${chalk_1.default.bold(mongoose_1.default.connection.config.maxPoolSize || 'default')}`));
                console.log(chalk_1.default.cyan(`   • Database: ${chalk_1.default.bold(((_a = mongoose_1.default.connection.db) === null || _a === void 0 ? void 0 : _a.databaseName) || 'unknown')}`));
                break;
            }
            catch (error) {
                retryCount++;
                logger_1.logger.error(`Database connection attempt ${retryCount} failed:`, error);
                if (retryCount === maxRetries)
                    throw error;
                await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
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
            const { log, serverStartupArt } = require('./utils/console-art');
            console.log(serverStartupArt);
            log.highlight('Starting ODIN API Server...');
            log.info(`Environment: ${process.env.NODE_ENV}`);
            (0, env_validator_1.validateEnv)();
            await this.initializeDatabase();
            await whatsapp_service_1.default.initialize().catch((error) => {
                log.warn('WhatsApp service initialization failed: ' + error.message);
            });
            if (process.env.SSL_ENABLED === 'true') {
                log.info('SSL Mode: Enabled');
                await this.startSecureServer();
            }
            else {
                log.warn('SSL Mode: Disabled (not recommended for production)');
                await this.startHttpServer();
            }
            console.log('\n' + chalk_1.default.black(chalk_1.default.bgGreen(' SERVER READY ')));
            log.success(`API Server running on port ${config_1.config.PORT}`);
            log.info('Press CTRL+C to stop the server');
        }
        catch (error) {
            logger_1.logger.error('Server startup failed:', error);
            process.exit(1);
        }
    }
    /**
     * @private
     * @method startSecureServer
     * @description Initializes and starts HTTPS server with SSL/TLS support.
     *
     * Features:
     * - HTTPS with modern TLS configuration
     * - HTTP/2 support (optional)
     * - Strong cipher suite selection
     * - HSTS implementation
     *
     * @returns {Promise<void>} Resolves when secure server is started
     * @throws {Error} If server fails to start or SSL configuration is invalid
     *
     * @security Critical for production environments.
     * Ensures secure communication channel for all client-server interactions.
     */
    async startSecureServer() {
        try {
            const credentials = {
                key: fs_1.default.readFileSync(process.env.SSL_KEY_PATH, 'utf8'),
                cert: fs_1.default.readFileSync(process.env.SSL_CERT_PATH, 'utf8'),
                ca: fs_1.default.readFileSync(process.env.SSL_CHAIN_PATH, 'utf8'),
                secureOptions: crypto_1.default.constants.SSL_OP_NO_TLSv1 | crypto_1.default.constants.SSL_OP_NO_TLSv1_1,
            };
            if (process.env.ENABLE_HTTP2 === 'true') {
                this.server = spdy_1.default.createServer(credentials, this.app);
            }
            else {
                this.server = (0, https_1.createServer)(credentials, this.app);
            }
            await new Promise((resolve, reject) => {
                this.server.listen(config_1.config.PORT, () => {
                    const { log } = require('./utils/console-art');
                    console.log('\n' + chalk_1.default.black(chalk_1.default.bgCyan(' SECURE SERVER ')));
                    log.success(`🚀 Server running on port ${config_1.config.PORT}`);
                    log.info('Security features enabled:');
                    console.log(chalk_1.default.green('✓') + ' TLS 1.2+ only');
                    console.log(chalk_1.default.green('✓') + ' Strong cipher suite');
                    console.log(chalk_1.default.green('✓') + ' HSTS enabled');
                    console.log(chalk_1.default.green('✓') + ' Strict CSP policies');
                    if (process.env.ENABLE_HTTP2 === 'true') {
                        console.log(chalk_1.default.green('✓') + ' HTTP/2 support');
                    }
                    resolve();
                }).on('error', reject);
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to start secure server:', error);
            throw error;
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
        logger_1.logger.info('Initiating graceful shutdown...');
        try {
            if (this.server) {
                await new Promise((resolve, reject) => {
                    this.server.close((err) => {
                        if (err) {
                            logger_1.logger.error('Error closing server:', err);
                            reject(err);
                        }
                        else {
                            logger_1.logger.info('Server connections closed');
                            resolve();
                        }
                    });
                });
            }
            await mongoose_1.default.disconnect();
            logger_1.logger.info('Database connections closed');
            logger_1.logger.info('Shutdown completed');
            process.exit(exitCode);
        }
        catch (error) {
            logger_1.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
    async startHttpServer() {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('HTTP server not allowed in production');
        }
        const tryPort = async (portNumber) => {
            try {
                await new Promise((resolve, reject) => {
                    const server = this.app.listen(portNumber)
                        .on('error', (err) => {
                        if (err.code === 'EADDRINUSE') {
                            logger_1.logger.warn(`Port ${portNumber} is in use, trying ${portNumber + 1}...`);
                            server.close();
                            tryPort(portNumber + 1).then(resolve).catch(reject);
                        }
                        else {
                            reject(err);
                        }
                    })
                        .on('listening', () => {
                        this.server = server;
                        const { log } = require('./utils/console-art');
                        console.log('\n' + chalk_1.default.black(chalk_1.default.bgYellow(' DEV SERVER ')));
                        log.warn('⚠️  Running in HTTP mode (not recommended for production)');
                        log.success(`🚀 Server running on port ${portNumber}`);
                        console.log('\n' + chalk_1.default.dim('Note: For development use only'));
                        resolve();
                    });
                });
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
                    return tryPort(portNumber + 1);
                }
                throw error;
            }
        };
        await tryPort(Number(config_1.config.PORT));
    }
}
exports.AppServer = AppServer;
// Create and export a singleton instance
exports.default = new AppServer();
