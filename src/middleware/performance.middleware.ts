import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const SLOW_RESPONSE_THRESHOLD = 1000; // 1 second

interface PerformanceMetrics {
  path: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: string;
  userAgent?: string;
  userId?: string;
  host?: string;
}

/**
 * Middleware to monitor request performance and log slow responses
 */
export const monitorPerformance = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime();

    // Capture the response
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = Math.round(seconds * 1000 + nanoseconds / 1e6); // Convert to milliseconds

      const metrics: PerformanceMetrics = {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString(),
        userAgent: req.get('user-agent'),
        userId: (req as any).user?._id?.toString(),
        host: req.get('host') || req.hostname
      };

      // Disable verbose API access logging and slow response warnings
      // to reduce log clutter and improve performance monitoring clarity

      // Only log extremely slow responses (over 5 seconds) as errors
      if (duration > 5000) {
        logger.error('Extremely slow response detected:', {
          path: metrics.path,
          method: metrics.method,
          duration,
          statusCode: metrics.statusCode
        });
      }
    });

    next();
  };
};
