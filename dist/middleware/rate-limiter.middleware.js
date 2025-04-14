"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiterMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
const defaultConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
};
const getClientIp = (req) => {
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
exports.rateLimiterMiddleware = (0, express_rate_limit_1.default)({
    ...defaultConfig,
    handler: (req, res) => {
        const clientIp = getClientIp(req);
        logger_1.logger.warn(`Rate limit exceeded for IP: ${clientIp}`, {
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
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
    },
    keyGenerator: (req) => {
        return getClientIp(req);
    },
});
