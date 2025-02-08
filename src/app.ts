/**
 * @fileoverview Main application server configuration and setup
 * This file sets up an Express application with security middleware, database connection,
 * routing, and both HTTP/HTTPS server configurations. It implements production-grade
 * security measures and follows Node.js best practices.
 *
 * @module app
 * @requires express
 * @requires mongoose
 * @requires cors
 * @requires helmet
 * @requires cookie-parser
 * @requires express-rate-limit
 * @requires compression
 * @requires morgan
 * @requires https
 * @requires crypto
 * @requires spdy
 */

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config/config";
import { logger } from "./utils/logger";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import connectionRoutes from "./routes/connection.routes";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { createServer } from "https";
import crypto from "crypto";
import spdy from "spdy";
import WhatsAppService from "./services/whatsapp.service";

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Access logging
const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), {
  flags: "a",
});
app.use(morgan("combined", { stream: accessLogStream }));

// Enhanced security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
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
  })
);

logger.info(
  "Security middleware initialized with strict CSP and CORS policies"
);

// Rate limiting configuration
// Protects against brute force attacks by limiting requests per IP
// @constant {RateLimit}
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  // handler: (req, res) => {
  //   logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
  //   res.status(429).json({
  //     message: 'Too many requests from this IP, please try again later.',
  //     retryAfter: Math.ceil(15 * 60), // 15 minutes
  //   });
  // }
});

app.use(limiter);
logger.info("Rate limiting middleware initialized");

// Compression middleware
app.use(compression());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600, // 10 minutes
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(config.COOKIE_SECRET));

// Health check endpoint
// Simple health check that returns OK status and timestamp
// @route GET /health
// @returns {Object} 200 - Basic health status
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Detailed health check endpoint
// Provides detailed system information including database status and memory usage
// @route GET /health/detailed
// @returns {Object} 200 - Detailed system health information
// @returns {Object} 500 - Server error
app.get("/health/detailed", async (req, res) => {
  try {
    const dbStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const memoryUsage = process.memoryUsage();

    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        connections: mongoose.connection.readyState,
      },
      system: {
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB",
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB",
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + "MB",
        },
        uptime: process.uptime() + "s",
        nodeVersion: process.version,
      },
    });
  } catch (error) {
    logger.error("Health check error:", error);
    res.status(500).json({ status: "ERROR", message: "Health check failed" });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/connections", connectionRoutes);

// Global error handler
// Catches all unhandled errors and provides a standardized error response
// @param {Error} err - Error object
// @param {express.Request} req - Express request object
// @param {express.Response} res - Express response object
// @param {express.NextFunction} next - Express next middleware function
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const user: any = req.user;
    logger.error("Unhandled error:", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?._id,
    });

    res.status(500).json({
      message: "An unexpected error occurred",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
);

// Initialize WhatsApp service
WhatsAppService.initialize().catch((error) => {
  logger.error("Failed to initialize WhatsApp service:", error.message);
});

// Database connection
logger.info("🔄 Initializing MongoDB connection...");
mongoose
  .connect(config.MONGODB_URI, {
    authSource: "admin", // Explicitly specify the authentication database
  })
  .then(() => {
    logger.info("✅ MongoDB Connection Status:");
    logger.info(`   • Database URL: ${config.MONGODB_URI.split("@")[1]}`); // Only show host:port, not credentials
    logger.info(
      `   • Connection Pool Size: ${mongoose.connection.config.maxPoolSize || "default"}`
    );
    logger.info(
      `   • Database: ${mongoose.connection.db?.databaseName || "unknown"}`
    );
    logger.info("   • Authentication: Using admin database as auth source");
    logger.info("🚀 Database connection established successfully");

    if (process.env.SSL_ENABLED === "true") {
      try {
        logger.info("Initializing SSL configuration...");

        // Check if paths are provided and files exist
        const privateKeyPath = process.env.SSL_KEY_PATH;
        const certificatePath = process.env.SSL_CERT_PATH;

        if (!privateKeyPath || !certificatePath) {
          throw new Error(
            "SSL paths not configured. Check SSL_KEY_PATH and SSL_CERT_PATH in .env"
          );
        }

        logger.debug(`Loading SSL certificates from:
          - Private Key: ${privateKeyPath}
          - Certificate: ${certificatePath}`);

        const privateKey = fs.readFileSync(privateKeyPath, "utf8");
        const certificate = fs.readFileSync(certificatePath, "utf8");

        // For Let's Encrypt chain
        const chainPath = process.env.SSL_CHAIN_PATH || certificatePath;
        const ca = fs.readFileSync(chainPath, "utf8");

        logger.info("SSL certificates loaded successfully");

        const credentials = {
          key: privateKey,
          cert: certificate,
          ca: ca,
          secureOptions:
            crypto.constants.SSL_OP_NO_TLSv1 |
            crypto.constants.SSL_OP_NO_TLSv1_1,
          ciphers: [
            "ECDHE-ECDSA-AES128-GCM-SHA256",
            "ECDHE-RSA-AES128-GCM-SHA256",
            "ECDHE-ECDSA-AES256-GCM-SHA384",
            "ECDHE-RSA-AES256-GCM-SHA384",
          ].join(":"),
          honorCipherOrder: true,
        };

        logger.info(
          "SSL configuration completed with TLS 1.2+ and secure cipher suite"
        );

        // Create HTTPS server with secure configuration
        const httpsServer = createServer(credentials, app);

        // Enable HTTP/2 if available
        if (process.env.ENABLE_HTTP2 === "true") {
          logger.info("Initializing HTTP/2 server...");
          const http2Server = spdy.createServer(credentials, app);
          http2Server.listen(config.PORT, () => {
            logger.info(`HTTP/2 Server running on port ${config.PORT}`);
            logger.info("Security features enabled:");
            logger.info("- TLS 1.2+ only");
            logger.info("- Strong cipher suite");
            logger.info("- HTTP/2 support");
            logger.info("- HSTS enabled");
            logger.info("- Strict CSP policies");
          });

          // Log HTTP/2 connection events
          http2Server.on("session", (session) => {
            logger.debug(
              `New HTTP/2 session established from ${session.socket.remoteAddress}`
            );
          });

          http2Server.on("error", (err) => {
            logger.error("HTTP/2 server error:", err);
          });
        } else {
          // Start HTTPS server
          httpsServer.listen(config.PORT, () => {
            logger.info(`HTTPS Server running on port ${config.PORT}`);
            logger.info("Security features enabled:");
            logger.info("- TLS 1.2+ only");
            logger.info("- Strong cipher suite");
            logger.info("- HSTS enabled");
            logger.info("- Strict CSP policies");
          });

          // Log TLS connection events
          httpsServer.on("secureConnection", (tlsSocket) => {
            logger.debug(
              `New TLS connection established from ${tlsSocket.remoteAddress}`
            );
            logger.debug(`TLS Protocol Version: ${tlsSocket.getProtocol()}`);
            logger.debug(`Cipher: ${tlsSocket.getCipher().name}`);
          });

          httpsServer.on("error", (err) => {
            logger.error("HTTPS server error:", err);
          });
        }

        // Redirect HTTP to HTTPS in production
        if (process.env.NODE_ENV === "production") {
          logger.info("Setting up HTTP to HTTPS redirect for production");
          const httpApp = express();
          httpApp.use(helmet());

          // HSTS configuration
          httpApp.use(
            helmet.hsts({
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            })
          );

          // Redirect all HTTP traffic to HTTPS
          httpApp.use((req, res) => {
            logger.debug(`Redirecting HTTP request from ${req.ip} to HTTPS`);
            res.redirect(`https://${req.hostname}${req.url}`);
          });

          const httpServer = require("http").createServer(httpApp);
          httpServer.listen(80, () => {
            logger.info("HTTP to HTTPS redirect server running on port 80");
          });
        }
      } catch (error) {
        logger.error("SSL configuration error:", error);
        if (process.env.NODE_ENV === "development") {
          logger.warn("Falling back to HTTP server in development mode");
          app.listen(config.PORT, () => {
            logger.info(
              `HTTP Server running on port ${config.PORT} (SSL disabled)`
            );
          });
        } else {
          logger.error(
            "SSL is required in production mode. Server startup failed."
          );
          process.exit(1);
        }
      }
    } else {
      logger.warn(
        "SSL is disabled. Running in HTTP mode only (not recommended for production)"
      );
      app.listen(config.PORT, () => {
        logger.info(`HTTP Server running on port ${config.PORT}`);
      });
    }
  })
  .catch((error) => {
    logger.error("❌ MongoDB Connection Error:");
    logger.error(`   • Error Type: ${error.name}`);
    logger.error(`   • Message: ${error.message}`);
    logger.error(`   • Code: ${error.code || "N/A"}`);
    logger.error("   • Possible causes:");
    logger.error("     - Database server is not running");
    logger.error("     - Network connectivity issues");
    logger.error("     - Authentication credentials are incorrect");
    logger.error("     - Firewall blocking the connection");
    logger.error(
      "⚠️  Application startup failed due to database connection error"
    );
    process.exit(1);
  });

export default app;
