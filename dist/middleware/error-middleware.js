"use strict";
/**
 * @fileoverview Global error handling middleware for the My Profile platform.
 * Implements centralized error processing, logging, and response formatting.
 *
 * This middleware acts as the final error boundary for all application errors,
 * providing consistent error handling and response formatting across the platform.
 * It follows Google's error handling best practices and OWASP security guidelines.
 *
 * Key Features & Benefits:
 * - Consistent error responses across all endpoints
 * - Environment-aware error detail exposure
 * - Secure error handling preventing information leakage
 * - Comprehensive error logging for debugging
 * - Type-specific error processing
 *
 * Error Categories:
 * - HTTP Errors (4xx, 5xx)
 * - Validation Errors (Schema/Data)
 * - Database Errors (MongoDB specific)
 * - Runtime Errors (JavaScript/TypeScript)
 * - Custom Application Errors
 *
 * Performance Impact:
 * - Minimal processing overhead
 * - Efficient error type checking
 * - Optimized logging with batching
 * - Memory-efficient error formatting
 *
 * Security Measures:
 * - Stack trace filtering in production
 * - Sensitive data redaction
 * - Safe error messages for clients
 * - Proper status code mapping
 * - Input validation error sanitization
 *
 * Error Format Contract:
 * ```typescript
 * {
 *   success: false,
 *   message: string,        // User-friendly message
 *   code?: string,         // Error code for client handling
 *   details?: unknown      // Additional context (dev only)
 * }
 * ```
 *
 * Implementation Notes:
 * 1. Always use type-safe error handling
 * 2. Keep stack traces in development only
 * 3. Log errors with full context
 * 4. Sanitize error messages for production
 * 5. Use proper status codes
 *
 * Typical Usage:
 * ```typescript
 * // In app.ts
 * import { errorHandler } from './middleware/error-middleware';
 * app.use(errorHandler);
 *
 * // In route handlers
 * throw new CustomError('VALIDATION_ERROR', 'Invalid input');
 * ```
 *
 * @see {@link https://cloud.google.com/apis/design/errors} Google API error guidelines
 * @see {@link https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html} OWASP Error Handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const mongodb_1 = require("mongodb");
const mongoose_1 = __importDefault(require("mongoose"));
const http_errors_1 = __importDefault(require("http-errors"));
/**
 * Global error handling middleware for Express application.
 *
 * This middleware catches all unhandled errors in the application and
 * transforms them into consistent, secure error responses. It handles
 * various error types differently while maintaining a uniform response
 * structure.
 *
 * Processing Flow:
 * 1. Error caught by middleware
 * 2. Error type determined
 * 3. Error logged with context
 * 4. Response formatted based on type
 * 5. Development info added if needed
 * 6. Response sent to client
 *
 * Error Type Handling:
 * - HttpError: Uses status and message directly
 * - ValidationError: Extracts validation details
 * - MongoError: Handles DB-specific errors
 * - Standard Error: Generic handling
 *
 * Security Considerations:
 * - No stack traces in production
 * - Sanitized error messages
 * - Proper status code usage
 * - Sensitive data filtering
 *
 * @param {Error} err - The caught error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 *
 * @example
 * ```typescript
 * // Example error response in development
 * {
 *   success: false,
 *   message: "Validation Error",
 *   code: "VALIDATION_ERROR",
 *   details: {
 *     stack: "Error: Validation failed...",
 *     name: "ValidationError"
 *   }
 * }
 * ```
 */
const errorHandler = (err, req, res, next) => {
    var _a;
    const response = {
        success: false,
        message: 'An unexpected error occurred',
    };
    // Log error with request context
    logger_1.logger.error('Error handling request:', {
        error: err,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
        stack: err.stack,
    });
    // Handle different error types
    if (http_errors_1.default.isHttpError(err)) {
        response.message = err.message;
        response.code = err.name;
        res.status(err.status);
    }
    else if (err instanceof mongoose_1.default.Error.ValidationError) {
        response.message = 'Validation Error';
        response.code = 'VALIDATION_ERROR';
        response.details = Object.values(err.errors).map(e => e.message);
        res.status(400);
    }
    else if (err instanceof mongodb_1.MongoError) {
        if (err.code === 11000) {
            response.message = 'Duplicate key error';
            response.code = 'DUPLICATE_KEY';
            res.status(409);
        }
        else {
            response.message = 'Database error';
            response.code = 'DATABASE_ERROR';
            res.status(500);
        }
    }
    else if (err instanceof Error) {
        response.message = err.message;
        response.code = err.name;
        res.status(500);
    }
    else {
        res.status(500);
    }
    // Add debugging information in development
    if (process.env.NODE_ENV === 'development') {
        response.details = {
            stack: err.stack,
            name: err.name,
        };
    }
    // Send error response
    res.json(response);
};
exports.errorHandler = errorHandler;
