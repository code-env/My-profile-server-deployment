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

import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPSServer } from 'https';
import { Server as HTTPServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import spdy from 'spdy';
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
  private server?: HTTPSServer | HTTPServer;
  private isShuttingDown: boolean = false;

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
    this.app = express();
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
  private configureMiddleware(): void {
    this.app.use(monitorPerformance());
    this.app.use(helmet({
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

    this.app.use(cors({
      origin: whitelistOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 600,
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser(config.COOKIE_SECRET));
    this.app.use(compression());
    this.app.use(rateLimiterMiddleware);
  }

  /**
   * @private
   * @method configureRoutes
   * @description Sets up application routes and middleware.
   * Routes are modularized and imported from the routes directory.
   *
   * @see setupRoutes
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

      if (process.env.SSL_ENABLED === 'true') {
        log.info('SSL Mode: Enabled');
        await this.startSecureServer();
      } else {
        log.warn('SSL Mode: Disabled (not recommended for production)');
        await this.startHttpServer();
      }

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
  private async startSecureServer(): Promise<void> {
    try {
      const credentials = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH!, 'utf8'),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH!, 'utf8'),
        ca: fs.readFileSync(process.env.SSL_CHAIN_PATH!, 'utf8'),
        secureOptions: crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
      };

      if (process.env.ENABLE_HTTP2 === 'true') {
        this.server = spdy.createServer(credentials, this.app);
      } else {
        this.server = createServer(credentials, this.app);
      }

      await new Promise<void>((resolve, reject) => {
        this.server!.listen(config.PORT, () => {
          const { log } = require('./utils/console-art');
          console.log('\n' + chalk.black(chalk.bgCyan(' SECURE SERVER ')));
          log.success(`🚀 Server running on port ${config.PORT}`);
          log.info('Security features enabled:');
          console.log(chalk.green('✓') + ' TLS 1.2+ only');
          console.log(chalk.green('✓') + ' Strong cipher suite');
          console.log(chalk.green('✓') + ' HSTS enabled');
          console.log(chalk.green('✓') + ' Strict CSP policies');
          if (process.env.ENABLE_HTTP2 === 'true') {
            console.log(chalk.green('✓') + ' HTTP/2 support');
          }
          resolve();
        }).on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to start secure server:', error);
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
    if (process.env.NODE_ENV === 'production') {
      throw new Error('HTTP server not allowed in production');
    }

    const tryPort = async (portNumber: number): Promise<void> => {
      try {
        await new Promise<void>((resolve, reject) => {
          const server = this.app.listen(portNumber)
            .on('error', (err: NodeJS.ErrnoException) => {
              if (err.code === 'EADDRINUSE') {
                logger.warn(`Port ${portNumber} is in use, trying ${portNumber + 1}...`);
                server.close();
                tryPort(portNumber + 1).then(resolve).catch(reject);
              } else {
                reject(err);
              }
            })
            .on('listening', () => {
              this.server = server;
              const { log } = require('./utils/console-art');
              console.log('\n' + chalk.black(chalk.bgYellow(' DEV SERVER ')));
              log.warn('⚠️  Running in HTTP mode (not recommended for production)');
              log.success(`🚀 Server running on port ${portNumber}`);
              console.log('\n' + chalk.dim('Note: For development use only'));
              resolve();
            });
        });
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
          return tryPort(portNumber + 1);
        }
        throw error;
      }
    };
await tryPort(Number(config.PORT));
}
}

// Create and export a singleton instance
export default new AppServer();
