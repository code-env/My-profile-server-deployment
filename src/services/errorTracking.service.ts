import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { Redis } from 'ioredis';
import { auditLogService } from './auditLog.service';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface ErrorEvent {
  errorId: string;
  type: string;
  message: string;
  stack?: string;
  context: {
    userId?: string;
    path?: string;
    method?: string;
    query?: any;
    body?: any;
    headers?: any;
    timestamp: Date;
  };
  metadata?: any;
}

export class ErrorTrackingService {
  static async trackError(error: Error, req: Request, res: Response) {
    try {
      const errorEvent: ErrorEvent = {
        errorId: this.generateErrorId(),
        type: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        context: {
          userId: (req as any).user?.id,
          path: req.path,
          method: req.method,
          query: req.query,
          body: this.sanitizeRequestBody(req.body),
          headers: this.sanitizeHeaders(req.headers),
          timestamp: new Date()
        }
      };

      // Store error event
      await this.storeError(errorEvent);

      // Log to audit trail
      await auditLogService.logRequest({
        timestamp: new Date(),
        userId: (req as any).user?.id || 'anonymous',
        action: 'error_occurred',
        details: {
          errorId: errorEvent.errorId,
          errorType: error.name,
          errorMessage: error.message,
          path: req.path,
          status: 'failure'
        }
      });

      // Track error frequency
      await this.trackErrorFrequency(error.name, req.path);

      // Alert if error frequency is high
      await this.checkErrorThreshold(error.name, req.path);

      return errorEvent;
    } catch (trackingError) {
      logger.error('Failed to track error:', trackingError);
      return null;
    }
  }

  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static sanitizeRequestBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'credit_card'];
    const sanitized = { ...body };

    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private static sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    sensitiveHeaders.forEach(header => {
      if (header in sanitized) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private static async storeError(errorEvent: ErrorEvent) {
    // Store in Redis for quick access
    const key = `error:${errorEvent.errorId}`;
    await redis.setex(key, 24 * 60 * 60, JSON.stringify(errorEvent));

    // Store in error stream for analysis
    await redis.xadd(
      'error_stream',
      '*',
      'error',
      JSON.stringify(errorEvent)
    );
  }

  private static async trackErrorFrequency(errorType: string, path: string) {
    const now = Date.now();
    const key = `error_frequency:${errorType}:${path}`;

    await redis.zadd('error_timestamps', now, `${errorType}:${path}`);
    await redis.incr(key);
    await redis.expire(key, 60 * 60); // 1 hour
  }

  private static async checkErrorThreshold(errorType: string, path: string) {
    const key = `error_frequency:${errorType}:${path}`;
    const count = await redis.get(key);

    if (count && parseInt(count) > 10) {
      logger.error(`High error frequency detected for ${errorType} at ${path}`);
      // Implement notification system here
    }
  }

  // Get recent errors
  static async getRecentErrors(limit: number = 100) {
    const errors = await redis.xrevrange('error_stream', '+', '-', 'COUNT', limit);
    return errors.map(([id, [_, error]]) => JSON.parse(error));
  }

  // Get error metrics
  static async getErrorMetrics(timeWindow: number = 3600000) { // Default 1 hour
    const now = Date.now();
    const windowStart = now - timeWindow;

    return {
      totalErrors: await redis.zcount('error_timestamps', windowStart, now),
      errorsByType: await this.getErrorsByType(windowStart, now),
      mostFrequentErrors: await this.getMostFrequentErrors(5)
    };
  }

  private static async getErrorsByType(start: number, end: number) {
    const errors = await redis.zrangebyscore('error_timestamps', start, end);
    return errors.reduce((acc: any, error: string) => {
      const type = error.split(':')[0];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  private static async getMostFrequentErrors(limit: number) {
    const errors = await redis.zrevrange('error_timestamps', 0, limit - 1, 'WITHSCORES');
    const result: any[] = [];

    for (let i = 0; i < errors.length; i += 2) {
      result.push({
        error: errors[i],
        count: parseInt(errors[i + 1])
      });
    }

    return result;
  }
}
