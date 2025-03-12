"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugLogger = exports.performanceLogger = exports.securityLogger = exports.accessLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure logs directory exists
const logsDir = 'logs';
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir);
}
// Custom log format
// Add emoji indicators for different log types
const getLogPrefix = (info) => {
    var _a;
    const type = ((_a = info.type) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    if (type.includes('registration'))
        return '🔐';
    if (type.includes('login'))
        return '🔑';
    if (type.includes('error'))
        return '❌';
    if (type.includes('security'))
        return '🛡️';
    if (type.includes('performance'))
        return '⚡';
    return 'ℹ️';
};
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss:SSS'
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.metadata(), winston_1.default.format.printf(info => {
    const prefix = getLogPrefix(info);
    const meta = info.metadata && Object.keys(info.metadata).length
        ? `\n${JSON.stringify(info.metadata, null, 2)}`
        : '';
    return `${info.timestamp} ${prefix} ${info.level}: ${info.message}${meta}`;
}));
// Create the logger instance
exports.logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: customFormat,
    defaultMeta: { service: 'my-profile-api' },
    transports: [
        // Console transport for all environments
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        })
    ]
});
// Only add file transports in development
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston_1.default.transports.File({
        filename: path_1.default.join(logsDir, 'error.log'),
        level: 'error'
    }));
    exports.logger.add(new winston_1.default.transports.File({
        filename: path_1.default.join(logsDir, 'combined.log')
    }));
    exports.logger.add(new winston_1.default.transports.File({
        filename: path_1.default.join(logsDir, 'access.log'),
        level: 'http'
    }));
    exports.logger.add(new winston_1.default.transports.File({
        filename: path_1.default.join(logsDir, 'all.log')
    }));
}
// Create specialized logging functions for specific contexts
exports.accessLogger = {
    log: (req, res, responseTime) => {
        var _a;
        const logData = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            responseTime,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
            requestId: req.id,
            ...(req.metadata || {}) // Include all advanced tracking metadata if available
        };
        exports.logger.http('Access Log', logData);
    }
};
exports.securityLogger = {
    log: (event, details) => {
        exports.logger.warn('Security Event', {
            event,
            timestamp: new Date().toISOString(),
            ...details
        });
    }
};
exports.performanceLogger = {
    log: (metric, value, metadata = {}) => {
        exports.logger.info('Performance Metric', {
            metric,
            value,
            timestamp: new Date().toISOString(),
            ...metadata
        });
    }
};
exports.debugLogger = {
    log: (context, details) => {
        exports.logger.debug('Debug Information', {
            context,
            timestamp: new Date().toISOString(),
            ...details
        });
    }
};
// Export the main logger instance and specialized loggers
exports.default = {
    logger: exports.logger,
    accessLogger: exports.accessLogger,
    securityLogger: exports.securityLogger,
    performanceLogger: exports.performanceLogger,
    debugLogger: exports.debugLogger
};
