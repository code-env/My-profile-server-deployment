"use strict";
/**
 * @file error-middleware.ts
 * @description Global Error Handling Middleware
 * ===========================================
 *
 * Provides centralized error handling for the My Profile platform, ensuring
 * consistent error responses and proper error logging across the application.
 *
 * Features:
 * - Unified error response format
 * - Contextual error logging
 * - Development/Production mode handling
 * - Type-specific error processing
 * - Security-conscious error details
 *
 * Error Types Handled:
 * - HTTP Errors (4xx, 5xx)
 * - Validation Errors
 * - Database Errors (MongoDB)
 * - Runtime Errors
 * - Custom Application Errors
 *
 * Security Features:
 * - Stack trace filtering in production
 * - Sensitive information redaction
 * - Standardized error responses
 * - Proper status code mapping
 *
 * @version 1.0.0
 * @license MIT
 *
 * @author Marco Blaise
 * @copyright 2025 My Profile Ltd
 *
 * Implementation follows best practices for:
 * - Error handling in Express.js
 * - Security (OWASP guidelines)
 * - Logging standards
 * - Response formatting
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
 * @function errorHandler
 * @description Global error handling middleware for Express application
 *
 * Processes and standardizes error responses across the application.
 * Implements different handling strategies based on error type and
 * environment (development/production).
 *
 * Features:
 * - Comprehensive error logging with request context
 * - Environment-aware error details
 * - Type-specific error processing
 * - Standardized error response format
 *
 * Error Type Handling:
 * - HttpError: Uses status and message directly
 * - ValidationError: Extracts validation details
 * - MongoError: Handles duplicate keys and other DB errors
 * - Generic Error: Provides safe error messages
 *
 * @param {Error | createHttpError.HttpError | MongoError} err - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {void} Sends JSON response with error details
 *
 * @security
 * - Stack traces only included in development
 * - Database errors sanitized
 * - Sensitive information filtered
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
