"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Apply auth middleware to all routes
router.use(authMiddleware_1.authenticateToken);
// Rate limiting configuration
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 5 minutes'
    },
    handler: (req, res) => {
        logger_1.logger.warn(`Rate limit exceeded for IP ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many requests from this IP, please try again after 5 minutes'
        });
    }
});
// Apply rate limiting to all routes
router.use(limiter);
// Simple in-memory cache implementation
const cache = new Map();
const cacheTimeout = new Map();
const cacheMiddleware = (duration) => (req, res, next) => {
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);
    const cacheExpiry = cacheTimeout.get(key);
    if (cachedResponse && cacheExpiry && Date.now() < cacheExpiry) {
        return res.json(cachedResponse);
    }
    // Store the original res.json function
    const originalJson = res.json.bind(res);
    // Override res.json to cache the response
    res.json = (body) => {
        cache.set(key, body);
        cacheTimeout.set(key, Date.now() + duration * 1000);
        return originalJson(body);
    };
    next();
};
// Clean up expired cache entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, expiry] of cacheTimeout.entries()) {
        if (now >= expiry) {
            cache.delete(key);
            cacheTimeout.delete(key);
        }
    }
}, 5 * 60 * 1000);
// Dashboard analytics with caching (1 minute)
router.get('/dashboard', cacheMiddleware(60), analytics_controller_1.analyticsController.getDashboardAnalytics);
// Historical transaction data with caching (5 minutes)
router.get('/transactions/history', cacheMiddleware(300), analytics_controller_1.analyticsController.getTransactionHistory);
// Balance trend data with caching (5 minutes)
router.get('/balance/trend', cacheMiddleware(300), analytics_controller_1.analyticsController.getBalanceTrend);
exports.default = router;
