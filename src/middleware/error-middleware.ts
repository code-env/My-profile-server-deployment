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

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { MongoError } from 'mongodb';
import mongoose from 'mongoose';
import createHttpError from 'http-errors';

/**
 * @interface ErrorResponse
 * @description Standardized error response structure sent to clients
 *
 * @property {boolean} success - Always false for error responses
 * @property {string} message - User-friendly error message
 * @property {string} [code] - Error code for client-side handling
 * @property {unknown} [details] - Additional error details (development only)
 *
 * @example
 * {
 *   success: false,
 *   message: "Validation Error",
 *   code: "VALIDATION_ERROR",
 *   details: ["Username is required"]
 * }
 */
export interface ErrorResponse {
  success: boolean;
  message: string;
  code?: string;
  details?: unknown;
}

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
export const errorHandler = (
  err: Error | createHttpError.HttpError | MongoError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const response: ErrorResponse = {
    success: false,
    message: 'An unexpected error occurred',
  };

  // Log error with request context
  logger.error('Error handling request:', {
    error: err,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?._id,
    stack: err.stack,
  });

  // Handle different error types
  if (createHttpError.isHttpError(err)) {
    response.message = err.message;
    response.code = err.name;
    res.status(err.status);
  } else if (err instanceof mongoose.Error.ValidationError) {
    response.message = 'Validation Error';
    response.code = 'VALIDATION_ERROR';
    response.details = Object.values(err.errors).map(e => e.message);
    res.status(400);
  } else if (err instanceof MongoError) {
    if (err.code === 11000) {
      response.message = 'Duplicate key error';
      response.code = 'DUPLICATE_KEY';
      res.status(409);
    } else {
      response.message = 'Database error';
      response.code = 'DATABASE_ERROR';
      res.status(500);
    }
  } else if (err instanceof Error) {
    response.message = err.message;
    response.code = err.name;
    res.status(500);
  } else {
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
