export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
  
    constructor(message: string, statusCode: number, isOperational: boolean = true) {
      super(message);
      Object.setPrototypeOf(this, new.target.prototype);
  
      this.statusCode = statusCode;
      this.isOperational = isOperational;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  // 400 Bad Request
  export class BadRequestError extends AppError {
    constructor(message: string = 'Bad Request') {
      super(message, 400);
    }
  }
  
  // 401 Unauthorized
  export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
      super(message, 401);
    }
  }
  
  // 403 Forbidden
  export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
      super(message, 403);
    }
  }
  
  // 404 Not Found
  export class NotFoundError extends AppError {
    constructor(message: string = 'Not Found') {
      super(message, 404);
    }
  }
  
  // 409 Conflict
  export class ConflictError extends AppError {
    constructor(message: string = 'Conflict') {
      super(message, 409);
    }
  }
  
  // 422 Unprocessable Entity
  export class ValidationError extends AppError {
    public readonly errors: Record<string, string[]>;
  
    constructor(errors: Record<string, string[]>, message: string = 'Validation Failed') {
      super(message, 422);
      this.errors = errors;
    }
  }
  
  // 429 Too Many Requests
  export class RateLimitError extends AppError {
    constructor(message: string = 'Too Many Requests') {
      super(message, 429);
    }
  }
  
  // 500 Internal Server Error
  export class InternalServerError extends AppError {
    constructor(message: string = 'Internal Server Error') {
      super(message, 500, false); // Not operational by default
    }
  }
  
  // Database Errors
  export class DatabaseError extends AppError {
    constructor(message: string = 'Database Error') {
      super(message, 500);
    }
  }
  
  // Service Unavailable
  export class ServiceUnavailableError extends AppError {
    constructor(message: string = 'Service Unavailable') {
      super(message, 503);
    }
  }
  
  // Custom Business Logic Errors
  export class BusinessRuleError extends AppError {
    constructor(message: string, statusCode: number = 400) {
      super(message, statusCode);
    }
  }
  
  // Authentication Errors
  export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication Failed') {
      super(message, 401);
    }
  }
  
  // Authorization Errors
  export class AuthorizationError extends AppError {
    constructor(message: string = 'Authorization Failed') {
      super(message, 403);
    }
  }
  
  // File/Upload Errors
  export class FileUploadError extends AppError {
    constructor(message: string = 'File Upload Failed') {
      super(message, 400);
    }
  }
  
  // Payment Errors
  export class PaymentError extends AppError {
    constructor(message: string = 'Payment Processing Failed') {
      super(message, 402);
    }
  }
  
  // API Error (for external API failures)
  export class APIError extends AppError {
    public readonly service: string;
  
    constructor(service: string, message: string = 'API Request Failed', statusCode: number = 502) {
      super(message, statusCode);
      this.service = service;
    }
  }
  
  // Network Error
  export class NetworkError extends AppError {
    constructor(message: string = 'Network Error') {
      super(message, 503);
    }
  }
  
  // Configuration Error
  export class ConfigurationError extends AppError {
    constructor(message: string = 'Configuration Error') {
      super(message, 500, false); // Not operational
    }
  }
  
  // Custom error type guard
  export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }
  
  // Error handler utility
  export function handleError(error: unknown): AppError {
    if (isAppError(error)) {
      return error;
    }
  
    if (error instanceof Error) {
      return new InternalServerError(error.message);
    }
  
    return new InternalServerError('Unknown error occurred');
  }