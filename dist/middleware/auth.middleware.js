"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.optionalAuth = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const protect = async (req, res, next) => {
    try {
        const token = extractToken(req);
        logger_1.logger.debug('Processing authentication token');
        if (!token) {
            logger_1.logger.warn('Authentication failed: No token provided');
            return res.status(401).json({
                status: 'error',
                message: 'Authentication required'
            });
        }
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
        if (!decoded.userId) {
            logger_1.logger.warn('Authentication failed: Invalid token payload');
            return res.status(401).json({
                status: 'error',
                message: 'Invalid authentication token'
            });
        }
        const user = await User_1.User.findById(decoded.userId).select('-password');
        if (!user) {
            logger_1.logger.error(`User not found for ID: ${decoded.userId}`);
            return res.status(401).json({
                status: 'error',
                message: 'User no longer exists'
            });
        }
        req.user = user;
        req.token = token;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            logger_1.logger.warn('Invalid token:', error.message);
            return res.status(401).json({
                status: 'error',
                message: 'Invalid authentication token'
            });
        }
        logger_1.logger.error('Authentication error:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error during authentication'
        });
    }
};
exports.protect = protect;
const extractToken = (req) => {
    var _a;
    // Check cookies first
    const token = req.cookies.accesstoken ||
        (
        // Then check Authorization header
        (_a = req.header('Authorization')) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '')) ||
        // Finally check query parameter
        req.query.token;
    return token || null;
};
const optionalAuth = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            return next();
        }
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
        const user = await User_1.User.findById(decoded.userId);
        if (user) {
            req.user = user;
            req.token = token;
        }
        next();
    }
    catch (error) {
        // If token is invalid, just continue without setting user
        next();
    }
};
exports.optionalAuth = optionalAuth;
const requireRoles = (...roles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        if (!roles.includes(user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
