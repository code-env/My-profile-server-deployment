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

import express, { Application } from 'express';
import { Server as HTTPServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { MongoError } from 'mongodb';
import chalk from 'chalk';

// Internal imports
import { config } from './config/config';
import { logger } from './utils/logger';
import { whitelistOrigins } from './config/cors.config';
import { setupRoutes } from './routes';
import { errorHandler } from './middleware/error-middleware';
import { rateLimiterMiddleware } from './middleware/rate-limiter.middleware';
import { monitorPerformance } from './middleware/performance.middleware';
import { validateEnv } from './utils/env-validator';
import WhatsAppService from './services/whatsapp.service';
import { advancedTrackingMiddleware } from './middleware/advanced-tracking.middleware';
import { licenseConfig } from './config/license.config';
import { licenseService } from './services/license.service';

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
export class AppServer {
  private readonly app: Application;
  private server?: HTTPServer;
  private isShuttingDown: boolean = false;

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
    this.app = express();
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
  private configureMiddleware(): void {
    // Serve static files from public directory before security middleware
    this.app.use('/public', express.static('public', {
      maxAge: '1d',
      index: false,
      setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        }
      }
    }));

    this.app.use(monitorPerformance());
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "https:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
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

    this.app.use(cors({
      origin: whitelistOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 600,
    }));

    // Add advanced tracking middleware after security headers but before routes
    // Configure morgan with advanced tracking format
    const morganFormat = ':method :url :status :response-time ms - :res[content-length] - IP: :remote-addr - :user-agent';
    this.app.use(morgan(morganFormat, {
      stream: {
        write: (message: string) => {
          logger.http(message.trim());
        }
      }
    }));

    this.app.use(advancedTrackingMiddleware);
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser(config.COOKIE_SECRET));
    this.app.use(compression());
    this.app.use(rateLimiterMiddleware);

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
  private configureRoutes(): void {
    setupRoutes(this.app);
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
  private configureErrorHandling(): void {
    this.app.use(errorHandler);

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      if (process.env.NODE_ENV === 'development') {
        console.error('Development mode - continuing despite error:', error);
      } else {
        this.shutdown(1);
      }
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled Rejection:', reason);
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
  /**
   * @private
   * @method validateLicense
   * @description Validates the hardware-locked license before allowing server startup
   * @throws {Error} If license validation fails
   */
  private async validateLicense(): Promise<void> {
    const licenseKey = process.env.LICENSE_KEY;
    const deviceId = require('os').hostname();
    const ipAddress = '127.0.0.1'; // Local server

    if (!licenseKey) {
      throw new Error('LICENSE_KEY environment variable is required');
    }

    if (!process.env.COMPANY_SECRET) {
      throw new Error('COMPANY_SECRET environment variable is required');
    }

    // Validate license
    const validationResult = await licenseService.validateLicense(
      licenseKey,
      deviceId,
      ipAddress
    );

    if (!validationResult.isValid) {
      throw new Error(`License validation failed: ${validationResult.error}`);
    }

    logger.info(`License validated for employee: ${validationResult}`);
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
  private async initializeDatabase(): Promise<void> {
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await mongoose.connect(config.MONGODB_URI, {
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
        console.log(chalk.cyan(`   • Database URL: ${chalk.bold(config.MONGODB_URI)}`));
        console.log(chalk.cyan(`   • Pool Size: ${chalk.bold(mongoose.connection.config.maxPoolSize || 'default')}`));
        console.log(chalk.cyan(`   • Database: ${chalk.bold(mongoose.connection.db?.databaseName || 'unknown')}`));
        break;
      } catch (error) {
        retryCount++;
        logger.error(`Database connection attempt ${retryCount} failed:`, error);
        if (retryCount === maxRetries) throw error;
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
  public async start(): Promise<void> {
    try {
      const { log, serverStartupArt } = require('./utils/console-art');

      console.log(serverStartupArt);
      log.highlight('Starting ODIN API Server...');
      log.info(`Environment: ${process.env.NODE_ENV}`);

      validateEnv();
      await this.initializeDatabase();
      await WhatsAppService.initialize().catch((error: Error) => {
        log.warn('WhatsApp service initialization failed: ' + error.message);
      });
      await this.initializeDatabase();

       // Start WhatsApp service with retries
  let attempts = 0;
  const initWhatsApp = async () => {
    try {
      await WhatsAppService.initialize();
    } catch (error) {
      if (attempts < 3) {
        attempts++;
        setTimeout(initWhatsApp, 5000 * attempts);
      }
    }
  };
  await initWhatsApp();
      // Always use HTTP server as Render handles SSL/HTTPS
      await this.startHttpServer();

      console.log('\n' + chalk.black(chalk.bgGreen(' SERVER READY ')));
      log.success(`API Server running on port ${config.PORT}`);
      log.info('Press CTRL+C to stop the server');
    } catch (error) {
      logger.error('Server startup failed:', error);
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
  private async shutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Initiating graceful shutdown...');

    try {
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((err?: Error) => {
            if (err) {
              logger.error('Error closing server:', err);
              reject(err);
            } else {
              logger.info('Server connections closed');
              resolve();
            }
          });
        });
      }

      await mongoose.disconnect();
      logger.info('Database connections closed');

      logger.info('Shutdown completed');
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
private async startHttpServer(): Promise<void> {
  const port = process.env.PORT || config.PORT;

  await new Promise<void>((resolve, reject) => {
    this.server = this.app.listen(port, () => {
      const { initializeWebSocket } = require('./utils/websocket');
      initializeWebSocket(this.server);
      const { log } = require('./utils/console-art');
      log.success(`🚀 Server running on port ${port}`);
      if (process.env.NODE_ENV === 'production') {
        log.info('Running in production mode (SSL/HTTPS handled by Render)');
      }
      resolve();
    }).on('error', (err: Error) => {
      logger.error('Failed to start HTTP server:', err);
      reject(err);
    });
  });
}
}

// Create and export a singleton instance
export default new AppServer();
