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
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
};

const getClientIp = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] || '0.0.0.0';
  }
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '0.0.0.0';
};

export const rateLimiterMiddleware: RateLimitRequestHandler = rateLimit({
  ...defaultConfig,
  handler: (req: Request, res: Response): void => {
    const clientIp = getClientIp(req);
    logger.warn(`Rate limit exceeded for IP: ${clientIp}`, {
      path: req.path,
      method: req.method,
      headers: req.headers,
    });

    res.status(429).json({
      success: false,
      message: defaultConfig.message,
      retryAfter: Math.ceil(defaultConfig.windowMs / 1000), // Convert to seconds
    });
  },
  skip: (req: Request): boolean => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  keyGenerator: (req: Request): string => {
    return getClientIp(req);
  },
});
