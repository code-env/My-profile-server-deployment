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
exports.requireVerified = exports.verifyOTP = exports.optionalAuth = exports.authenticateToken = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../config/config");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const authenticateToken = async (req, res, next) => {
    var _a;
    try {
        // Get token from cookie or Authorization header
        const token = req.cookies.accessToken || req.cookies.accesstoken || ((_a = req.header('Authorization')) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', ''));
        if (!token) {
            throw new errors_1.CustomError('UNAUTHORIZED', 'Authentication required');
        }
        // Verify token
        const decoded = jwt.verify(token, config_1.config.JWT_SECRET);
        // Find user
        const user = await User_1.User.findById(decoded.userId);
        if (!user) {
            throw new errors_1.CustomError('UNAUTHORIZED', 'User not found');
        }
        // Attach user to request
        req.user = user;
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication error:', error);
        if (error instanceof Error && error.name === 'JsonWebTokenError') {
            res.status(401).json({ success: false, message: 'Invalid token' });
        }
        else {
            res.status(401).json({
                success: false,
                message: error instanceof Error ? error.message : 'Authentication failed'
            });
        }
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuth = async (req, _res, next) => {
    var _a;
    try {
        // Get token from cookie or Authorization header
        const token = req.cookies.accessToken || req.cookies.accesstoken || ((_a = req.header('Authorization')) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', ''));
        if (!token) {
            // If no token, continue without authentication
            return next();
        }
        // Verify token
        const decoded = jwt.verify(token, config_1.config.JWT_SECRET);
        // Find user
        const user = await User_1.User.findById(decoded.userId);
        if (user) {
            // If user found, attach to request
            req.user = user;
        }
        next();
    }
    catch (error) {
        // If token verification fails, continue without authentication
        logger_1.logger.warn('Optional authentication failed:', error);
        next();
    }
};
exports.optionalAuth = optionalAuth;
const verifyOTP = async (req, res, next) => {
    var _a, _b;
    const reqUSer = req.user;
    try {
        const { otp } = req.body;
        const user = await User_1.User.findById(reqUSer === null || reqUSer === void 0 ? void 0 : reqUSer._id);
        if (!user) {
            throw new errors_1.CustomError('NOT_FOUND', 'User not found');
        }
        // Check if OTP exists and hasn't expired
        if (!((_a = user.verificationData) === null || _a === void 0 ? void 0 : _a.otp) || !((_b = user.verificationData) === null || _b === void 0 ? void 0 : _b.otpExpiry)) {
            throw new errors_1.CustomError('INVALID_OTP', 'No OTP verification in progress');
        }
        // Check if OTP has expired
        if (new Date() > new Date(user.verificationData.otpExpiry)) {
            throw new errors_1.CustomError('EXPIRED_OTP', 'OTP has expired');
        }
        // Verify OTP
        if (user.verificationData.otp !== otp) {
            // Increment attempts
            user.verificationData.attempts = (user.verificationData.attempts || 0) + 1;
            await user.save();
            if (user.verificationData.attempts >= 3) {
                // Reset OTP after 3 failed attempts
                user.verificationData.otp = undefined;
                user.verificationData.otpExpiry = undefined;
                await user.save();
                throw new errors_1.CustomError('MAX_ATTEMPTS', 'Maximum OTP attempts reached. Please request a new OTP.');
            }
            throw new errors_1.CustomError('INVALID_OTP', 'Invalid OTP');
        }
        // Mark verification as complete based on method
        if (user.verificationMethod === 'EMAIL') {
            user.isEmailVerified = true;
        }
        else if (user.verificationMethod === 'PHONE') {
            user.isPhoneVerified = true;
        }
        // Clear OTP data after successful verification
        user.verificationData.otp = undefined;
        user.verificationData.otpExpiry = undefined;
        user.verificationData.attempts = 0;
        await user.save();
        next();
    }
    catch (error) {
        logger_1.logger.error('OTP verification error:', error);
        res.status(error instanceof errors_1.CustomError ? 400 : 500).json({
            success: false,
            message: error instanceof Error ? error.message : 'OTP verification failed'
        });
    }
};
exports.verifyOTP = verifyOTP;
const requireVerified = async (req, res, next) => {
    try {
        const userre = req.user;
        const user = await User_1.User.findById(userre === null || userre === void 0 ? void 0 : userre._id);
        if (!user) {
            throw new errors_1.CustomError('NOT_FOUND', 'User not found');
        }
        if (!user.isEmailVerified && !user.isPhoneVerified) {
            throw new errors_1.CustomError('UNVERIFIED', 'Account verification required');
        }
        next();
    }
    catch (error) {
        res.status(403).json({
            success: false,
            message: error instanceof Error ? error.message : 'Verification required'
        });
    }
};
exports.requireVerified = requireVerified;
