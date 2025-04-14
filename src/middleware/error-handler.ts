import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { MongoError } from 'mongodb';
import mongoose from 'mongoose';
import createHttpError from 'http-errors';

export interface ErrorResponse {
  success: boolean;
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Global error handler middleware
 * Handles different types of errors and provides consistent error responses
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
