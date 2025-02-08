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
}

/**
 * Middleware to monitor request performance and log slow responses
 */
export const monitorPerformance = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime();

    // Capture response metrics when the response is finished
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6; // Convert to milliseconds

      const metrics: PerformanceMetrics = {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString(),
        userAgent: req.get('user-agent'),
        userId: (req as any).user?._id?.toString(),
      };

      // Log slow responses
      if (duration > SLOW_RESPONSE_THRESHOLD) {
        logger.warn('Slow response detected:', {
          ...metrics,
          threshold: SLOW_RESPONSE_THRESHOLD,
        });
      }

      // Always log performance metrics in debug level
      logger.debug('Request performance metrics:', metrics);
    });

    next();
  };
};
