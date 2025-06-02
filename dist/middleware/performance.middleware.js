"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorPerformance = void 0;
const logger_1 = require("../utils/logger");
const SLOW_RESPONSE_THRESHOLD = 1000; // 1 second
/**
 * Middleware to monitor request performance and log slow responses
 */
const monitorPerformance = () => {
    return (req, res, next) => {
        const start = process.hrtime();
        // Capture the response
        res.on('finish', () => {
            var _a, _b;
            const [seconds, nanoseconds] = process.hrtime(start);
            const duration = Math.round(seconds * 1000 + nanoseconds / 1e6); // Convert to milliseconds
            const metrics = {
                path: req.path,
                method: req.method,
                statusCode: res.statusCode,
                duration,
                timestamp: new Date().toISOString(),
                userAgent: req.get('user-agent'),
                userId: (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString(),
                host: req.get('host') || req.hostname
            };
            // Disable verbose API access logging and slow response warnings
            // to reduce log clutter and improve performance monitoring clarity
            // Only log extremely slow responses (over 5 seconds) as errors
            if (duration > 5000) {
                logger_1.logger.error('Extremely slow response detected:', {
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
exports.monitorPerformance = monitorPerformance;
