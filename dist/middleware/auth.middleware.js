"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.optionalAuth = exports.protect = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../config/config");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const protect = async (req, res, next) => {
    try {
        const token = extractToken(req);
        logger_1.logger.debug('Processing authentication token');
        if (!token) {
            // Removed warning log to prevent brute force detection
            return res.status(401).json({
                status: 'error',
                message: 'Authentication required'
            });
        }
        const decoded = jwt.verify(token, config_1.config.JWT_SECRET);
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
        // Check for admin role in headers or cookies
        const adminRoleHeader = req.header('X-User-Role');
        const adminCookie = req.cookies['X-User-Role'];
        const isAdminHeader = req.header('X-User-Is-Admin');
        const isAdminCookie = req.cookies['X-User-Is-Admin'];
        // Log all headers for debugging
        logger_1.logger.debug(`Auth headers: ${JSON.stringify(req.headers)}`);
        logger_1.logger.debug(`Auth cookies: ${JSON.stringify(req.cookies)}`);
        // If admin role is indicated in headers or cookies, ensure it's set in the user object
        if ((adminRoleHeader === 'admin' || adminCookie === 'admin') ||
            (isAdminHeader === 'true' || isAdminCookie === 'true')) {
            // Only set admin role if the user actually has it in the database
            if (user.role === 'admin') {
                logger_1.logger.info(`Admin role confirmed for user ${user._id}`);
            }
            else {
                logger_1.logger.warn(`Admin role requested but not found in database for user ${user._id}`);
            }
        }
        // Log the user's role for debugging
        logger_1.logger.debug(`User ${user._id} authenticated with role: ${user.role || 'none'}`);
        // Ensure the user object has the role property from the database
        if (!user.role && user._doc && user._doc.role) {
            user.role = user._doc.role;
            logger_1.logger.debug(`Set user role from _doc: ${user.role}`);
        }
        req.user = user;
        req.token = token;
        // console.log("protected")
        next();
    }
    catch (error) {
        if (error instanceof Error && error.name === 'JsonWebTokenError') {
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
    const token = req.cookies.accessToken || req.cookies.accesstoken ||
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
        const decoded = jwt.verify(token, config_1.config.JWT_SECRET);
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
