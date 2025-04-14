// import { Request, Response, NextFunction } from 'express';
// import rateLimit from 'express-rate-limit';
// import RedisStore from 'rate-limit-redis';
// import Redis from 'ioredis';
// import { logger } from '../utils/logger';

// // Create Redis client
// const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// // Configure different limiters for different endpoints
// export const loginLimiter = rateLimit({
//   store: new RedisStore({
//     sendCommand: (...args: string[]) => redis.call(...args),
//   }),
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // 5 attempts
//   skipSuccessfulRequests: true, // Don't count successful logins
//   handler: (req: Request, res: Response) => {
//     logger.warn(`Too many login attempts from IP: ${req.ip}`);
//     res.status(429).json({
//       error: {
//         code: 'TOO_MANY_ATTEMPTS',
//         message: 'Too many login attempts. Please try again after 15 minutes.',
//         nextAttemptAllowed: new Date(Date.now() + 15 * 60 * 1000)
//       }
//     });
//   }
// });

// // IP-based rate limiting for sensitive operations
// export const sensitiveOpsLimiter = rateLimit({
//   store: new RedisStore({
//     sendCommand: (...args: string[]) => redis.call(...args),
//   }),
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 10, // 10 attempts per hour
//   message: {
//     error: {
//       code: 'RATE_LIMIT_EXCEEDED',
//       message: 'Too many sensitive operations. Please try again later.'
//     }
//   }
// });
