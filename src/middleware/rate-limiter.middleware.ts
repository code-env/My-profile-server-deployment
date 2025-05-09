import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

const defaultConfig: RateLimiterConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Increased from 1000 to 3000 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
};

const getClientIp = (req: Request): string => {
  // Try to get IP from x-forwarded-for header
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor) {
    // The leftmost IP is the client's original IP
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0];
  }

  // Try other common proxy headers
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) {
    return realIp;
  }

  // With trust proxy enabled, req.ip should now contain the correct IP
  return req.ip || req.socket.remoteAddress || '0.0.0.0';
};

// More permissive config for authenticated users
const authenticatedConfig: RateLimiterConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5000, // 5000 requests per 5 minutes
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
};

// Helper function to create a rate limiter handler
const createRateLimiterHandler = (config: RateLimiterConfig) => {
  return (req: Request, res: Response): void => {
    const clientIp = getClientIp(req);
    logger.warn(`Rate limit exceeded for IP: ${clientIp}`, {
      path: req.path,
      method: req.method,
      headers: req.headers,
    });

    res.status(429).json({
      success: false,
      message: config.message,
      retryAfter: Math.ceil(config.windowMs / 1000), // Convert to seconds
    });
  };
};

// List of paths that should always skip rate limiting
const alwaysSkipPaths = [
  '/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/mypts/sell',
  '/api/mypts/balance',
  '/api/mypts/transactions',
  '/api/notifications/unread-count',
  '/api/referrals/tree',
  '/api/profiles',
  '/api/my-pts'
];

// Check if a request should skip rate limiting
const shouldSkipRateLimiting = (req: Request): boolean => {
  return alwaysSkipPaths.some(path => req.path.includes(path));
};

// Check if a request is authenticated
const isAuthenticated = (req: Request): boolean => {
  return !!req.headers.authorization || !!req.headers['x-profile-token'] || !!req.cookies?.accessToken;
};

// Main rate limiter middleware
export const rateLimiterMiddleware: RateLimitRequestHandler = rateLimit({
  ...defaultConfig,
  handler: createRateLimiterHandler(defaultConfig),
  skip: (req: Request): boolean => {
    // Skip rate limiting for defined paths or authenticated users
    return shouldSkipRateLimiting(req) || isAuthenticated(req);
  },
  keyGenerator: (req: Request): string => {
    return getClientIp(req);
  },
});
