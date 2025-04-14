"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorTrackingService = void 0;
const logger_1 = require("../utils/logger");
const ioredis_1 = require("ioredis");
const auditLog_service_1 = require("./auditLog.service");
const redis = new ioredis_1.Redis(process.env.REDIS_URL || 'redis://localhost:6379');
class ErrorTrackingService {
    static async trackError(error, req, res) {
        var _a, _b;
        try {
            const errorEvent = {
                errorId: this.generateErrorId(),
                type: error.name,
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                context: {
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
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
            await auditLog_service_1.auditLogService.logRequest({
                timestamp: new Date(),
                userId: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 'anonymous',
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
        }
        catch (trackingError) {
            logger_1.logger.error('Failed to track error:', trackingError);
            return null;
        }
    }
    static generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static sanitizeRequestBody(body) {
        if (!body)
            return body;
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'credit_card'];
        const sanitized = { ...body };
        sensitiveFields.forEach(field => {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        });
        return sanitized;
    }
    static sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        sensitiveHeaders.forEach(header => {
            if (header in sanitized) {
                sanitized[header] = '[REDACTED]';
            }
        });
        return sanitized;
    }
    static async storeError(errorEvent) {
        // Store in Redis for quick access
        const key = `error:${errorEvent.errorId}`;
        await redis.setex(key, 24 * 60 * 60, JSON.stringify(errorEvent));
        // Store in error stream for analysis
        await redis.xadd('error_stream', '*', 'error', JSON.stringify(errorEvent));
    }
    static async trackErrorFrequency(errorType, path) {
        const now = Date.now();
        const key = `error_frequency:${errorType}:${path}`;
        await redis.zadd('error_timestamps', now, `${errorType}:${path}`);
        await redis.incr(key);
        await redis.expire(key, 60 * 60); // 1 hour
    }
    static async checkErrorThreshold(errorType, path) {
        const key = `error_frequency:${errorType}:${path}`;
        const count = await redis.get(key);
        if (count && parseInt(count) > 10) {
            logger_1.logger.error(`High error frequency detected for ${errorType} at ${path}`);
            // Implement notification system here
        }
    }
    // Get recent errors
    static async getRecentErrors(limit = 100) {
        const errors = await redis.xrevrange('error_stream', '+', '-', 'COUNT', limit);
        return errors.map(([id, [_, error]]) => JSON.parse(error));
    }
    // Get error metrics
    static async getErrorMetrics(timeWindow = 3600000) {
        const now = Date.now();
        const windowStart = now - timeWindow;
        return {
            totalErrors: await redis.zcount('error_timestamps', windowStart, now),
            errorsByType: await this.getErrorsByType(windowStart, now),
            mostFrequentErrors: await this.getMostFrequentErrors(5)
        };
    }
    static async getErrorsByType(start, end) {
        const errors = await redis.zrangebyscore('error_timestamps', start, end);
        return errors.reduce((acc, error) => {
            const type = error.split(':')[0];
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
    }
    static async getMostFrequentErrors(limit) {
        const errors = await redis.zrevrange('error_timestamps', 0, limit - 1, 'WITHSCORES');
        const result = [];
        for (let i = 0; i < errors.length; i += 2) {
            result.push({
                error: errors[i],
                count: parseInt(errors[i + 1])
            });
        }
        return result;
    }
}
exports.ErrorTrackingService = ErrorTrackingService;
