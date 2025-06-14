"use strict";
/**
 * @fileoverview Authentication controller for the My Profile platform.
 * Implements authentication and authorization endpoints following OAuth 2.0 principles
 * and industry security best practices.
 *
 * @package myprofile
 * @module auth
 *
 * This controller handles all authentication-related operations including:
 * - User registration and verification
 * - Login and session management
 * - Password reset flows
 * - Two-factor authentication (2FA)
 * - Social authentication
 * - Token management (access/refresh)
 * - Session tracking and security
 *
 * Core Security Features:
 * - Rate limiting on sensitive endpoints
 * - IP and device tracking
 * - Brute force prevention
 * - Session invalidation
 * - Token rotation
 * - Activity logging
 *
 * Key Dependencies:
 * - auth.service.ts: Core authentication logic
 * - email.service.ts: Email notifications
 * - twoFactor.service.ts: 2FA implementation
 * - whatsapp.service.ts: OTP via WhatsApp
 *
 * Architecture:
 * - Follows Controller-Service pattern
 * - Implements stateless authentication
 * - Uses JWT for token-based auth
 * - Supports multiple 2FA methods
 *
 * Error Handling:
 * - Comprehensive error logging
 * - Secure error responses
 * - Rate limit monitoring
 * - Failed attempt tracking
 *
 * Performance Considerations:
 * - Connection pooling
 * - Response caching where appropriate
 * - Asynchronous operations
 * - Optimized token validation
 *
 * @see {@link https://tools.ietf.org/html/rfc6749} OAuth 2.0 Spec
 * @see {@link https://tools.ietf.org/html/rfc7519} JWT Spec
 * @see {@link https://cloud.google.com/apis/design/errors} Google API Design Guide
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
exports.socialAuthCallback = socialAuthCallback;
const auth_service_1 = require("../services/auth.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const User_1 = require("../models/User"); // Added IUser import
const email_service_1 = __importDefault(require("../services/email.service"));
const crypto_1 = require("crypto");
const config_1 = require("../config/config");
const twoFactor_service_1 = __importDefault(require("../services/twoFactor.service"));
const auth_types_1 = require("../types/auth.types");
// import { getClientInfo } from "../utils/controllerUtils";
const twilio_service_1 = __importDefault(require("../services/twilio.service"));
const ua_parser_js_1 = __importDefault(require("ua-parser-js")); // Default import
const Country_1 = __importDefault(require("../models/Country"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Implemented getClientInfo using ua-parser-js
async function getClientInfo(req) {
    var _a, _b, _c;
    const uaString = req.headers["user-agent"] || "";
    // @ts-ignore - Temporarily ignoring due to persistent type issues with ua-parser-js
    const parser = new ua_parser_js_1.default(uaString);
    const result = parser.getResult();
    // Attempt to get IP address
    // Prioritize 'x-forwarded-for' if behind a proxy, then req.ip, then req.socket.remoteAddress
    const ip = ((_b = (_a = req.headers["x-forwarded-for"]) === null || _a === void 0 ? void 0 : _a.split(",").shift()) === null || _b === void 0 ? void 0 : _b.trim()) ||
        req.ip ||
        ((_c = req.socket) === null || _c === void 0 ? void 0 : _c.remoteAddress) ||
        "Unknown";
    return {
        ip,
        device: result.device.vendor
            ? `${result.device.vendor} ${result.device.model || ""}`.trim()
            : result.device.type || "Unknown Device",
        browser: result.browser.name
            ? `${result.browser.name} ${result.browser.version || ""}`.trim()
            : "Unknown Browser",
        os: result.os.name
            ? `${result.os.name} ${result.os.version || ""}`.trim()
            : "Unknown OS",
        platform: result.device.type || result.os.name || "Unknown Platform",
        userAgent: uaString,
    };
}
/**
 * Authentication Controller Class
 *
 * Implements comprehensive authentication and authorization functionality
 * following security best practices and OAuth 2.0 principles.
 *
 * Core Features:
 * - User registration with validation
 * - Multi-factor authentication
 * - Secure session management
 * - Password reset flows
 * - Social authentication
 * - Token-based authentication
 * - Security monitoring
 *
 * Security Measures:
 * - Rate limiting on sensitive endpoints
 * - IP and device tracking
 * - Brute force prevention
 * - Session invalidation
 * - Token rotation
 * - Activity logging
 *
 * Implementation Notes:
 * 1. All passwords are hashed using bcrypt
 * 2. Tokens are signed with RS256
 * 3. Sessions tracked with device info
 * 4. All operations are logged
 * 5. Errors handled securely
 *
 * Example Usage:
 * ```typescript
 * // In routes/auth.routes.ts
 * router.post('/register', AuthController.register);
 * router.post('/login', AuthController.login);
 * router.post('/logout', AuthController.logout);
 * ```
 */
class AuthController {
    /**
     * Register a new user
     * @route POST /auth/register
     */
    static async register(req, res) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        try {
            // Validate request body against schema
            const validatedData = await auth_types_1.registerSchema.parseAsync(req.body);
            // Register user using auth service
            const plainPhoneNumber = validatedData.phoneNumber.replace(/[^+\d]/g, "");
            const user = {
                email: validatedData.email,
                password: validatedData.password,
                fullName: validatedData.fullName,
                firstName: validatedData.firstName,
                lastName: validatedData.lastName,
                username: validatedData.username,
                dateOfBirth: validatedData.dateOfBirth,
                countryOfResidence: validatedData.countryOfResidence,
                phoneNumber: plainPhoneNumber, // Store the plain phone number
                formattedPhoneNumber: validatedData.phoneNumber, // Store the formatted phone number
                accountType: validatedData.accountType,
                accountCategory: validatedData.accountCategory,
                verificationMethod: validatedData.verificationMethod,
                isEmailVerified: false, // Default value
                isPhoneVerified: false, // Default value
                verificationData: {}, // Provide appropriate data structure
                refreshTokens: [], // Default value
                lastLogin: new Date(), // Optional
                failedLoginAttempts: 0, // Default value
                lockUntil: new Date(Date.now() + 60 * 60 * 1000), // Default value
                role: "user", // Default value
                subscription: {}, // Provide appropriate data structure
                address: {}, // Added missing property
                documents: [], // Added missing property
                twoFactorAuth: {}, // Added missing property
                profilePicture: "", // Added missing property
                coverPicture: "", // Added missing property
                followers: [], // Added missing property
                following: [], // Added missing property
                notifications: [], // Added missing property
                deviceInfo: {}, // Added missing property
                loginHistory: [], // Added missing property
                securityQuestions: [], // Added missing property
            };
            // find the country in the db by name or code
            const country = await Country_1.default.findOne({
                $or: [
                    { code: validatedData.countryOfResidence },
                    { name: validatedData.countryOfResidence },
                ],
            });
            if (!country) {
                return res.status(400).json({ error: "Invalid country code or name" });
            }
            user.countryOfResidence = country;
            const clientInfo = await getClientInfo(req);
            console.log("🔐 Registration request from:", clientInfo.ip, clientInfo.os);
            // Check if referral code was provided
            const referralCode = validatedData.referralCode || undefined;
            const result = await auth_service_1.AuthService.register(user, clientInfo.ip, clientInfo.os, referralCode);
            // CRITICAL: Link user to device fingerprint after successful registration
            logger_1.logger.info("🔗 Attempting to link user to device fingerprint", {
                hasDeviceFingerprint: !!req.deviceFingerprint,
                fingerprintValue: ((_b = (_a = req.deviceFingerprint) === null || _a === void 0 ? void 0 : _a.fingerprint) === null || _b === void 0 ? void 0 : _b.substring(0, 8)) + "...",
                hasUserId: !!((_c = result.user) === null || _c === void 0 ? void 0 : _c._id),
                userId: (_d = result.user) === null || _d === void 0 ? void 0 : _d._id,
                email: (_e = result.user) === null || _e === void 0 ? void 0 : _e.email,
            });
            if (((_f = req.deviceFingerprint) === null || _f === void 0 ? void 0 : _f.fingerprint) && ((_g = result.user) === null || _g === void 0 ? void 0 : _g._id)) {
                try {
                    const { FraudDetectionService, } = require("../services/fraudDetection.service");
                    await FraudDetectionService.linkUserToDevice(req.deviceFingerprint.fingerprint, result.user._id.toString(), result.user.email);
                    logger_1.logger.info("✅ User successfully linked to device fingerprint", {
                        userId: result.user._id,
                        email: result.user.email,
                        fingerprint: req.deviceFingerprint.fingerprint.substring(0, 8) + "...",
                    });
                }
                catch (linkError) {
                    logger_1.logger.error("❌ Failed to link user to device fingerprint:", linkError);
                    // Don't fail registration if linking fails, but log it
                }
            }
            else {
                logger_1.logger.warn("⚠️ Cannot link user to device - missing data", {
                    hasDeviceFingerprint: !!req.deviceFingerprint,
                    hasFingerprint: !!((_h = req.deviceFingerprint) === null || _h === void 0 ? void 0 : _h.fingerprint),
                    hasUserId: !!((_j = result.user) === null || _j === void 0 ? void 0 : _j._id),
                    hasUserEmail: !!((_k = result.user) === null || _k === void 0 ? void 0 : _k.email),
                });
            }
            // Return the response
            res.status(201).json({
                success: true,
                message: "Registration successful. Please verify your email.",
                userId: result.user._id,
                verificationMethod: validatedData.verificationMethod,
                otpRequired: true,
                otpChannel: validatedData.verificationMethod.toLowerCase(),
            });
        }
        catch (error) {
            logger_1.logger.error("Registration error:", error);
            res
                .status(error instanceof errors_1.CustomError ? ((_l = error.statusCode) !== null && _l !== void 0 ? _l : 400) : 400)
                .json({
                success: false,
                message: error instanceof Error ? error.message : "Registration failed",
            });
        }
    }
    /**
     * Authenticate user and create secure session with token-based authentication
     *
     * @route POST /api/auth/login
     * @param {Request} req Express request object
     * @param {Response} res Express response object
     *
     * @security
     * - Rate limiting to prevent brute force
     * - HTTP-only secure cookies
     * - Secure token rotation
     * - Device fingerprinting
     * - IP tracking
     * - Failed attempts monitoring
     *
     * @returns {Promise<void>} JSON response with login status and tokens
     *
     * @example
     * ```typescript
     * // Request body
     * {
     *   "email": "user@example.com",
     *   "password": "securePassword123"
     * }
     *
     * // Success Response
     * {
     *   "success": true,
     *   "user": {
     *     "id": "user_id",
     *     "email": "user@example.com",
     *     "fullName": "John Doe"
     *   },
     *   "tokens": {
     *     "accessToken": "...",
     *     "refreshToken": "..."
     *   }
     * }
     *
     * // Error Response
     * {
     *   "success": false,
     *   "message": "Invalid credentials"
     * }
     * ```
     */
    static async login(req, res) {
        var _a, _b;
        try {
            const validatedData = await auth_types_1.loginSchema.parseAsync(req.body);
            const { identifier, password, rememberMe } = validatedData;
            // Find user first to check sessions BEFORE authentication
            const userDoc = await User_1.User.findOne({
                $or: [{ email: identifier }, { username: identifier }],
            });
            if (!userDoc) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials",
                });
            }
            // Check session limits BEFORE authentication using device fingerprints
            if (userDoc.sessions && userDoc.sessions.length > 0) {
                // Get device fingerprint consistently
                const currentFingerprint = (_a = req.deviceFingerprint) === null || _a === void 0 ? void 0 : _a.fingerprint;
                if (!currentFingerprint) {
                    logger_1.logger.warn("⚠️ No device fingerprint available for session management");
                    return res.status(400).json({
                        success: false,
                        message: "Device verification required. Please try again.",
                    });
                }
                console.log("🔍 Pre-auth session check - Current device fingerprint:", currentFingerprint.substring(0, 12) + "...");
                // Categorize sessions
                const validSessions = [];
                const expiredSessions = [];
                const invalidSessions = [];
                console.log("🔍 Pre-auth - Total sessions before categorization:", userDoc.sessions.length);
                userDoc.sessions.forEach((session, index) => {
                    var _a;
                    console.log(`🔍 Pre-auth Session ${index}:`, {
                        hasRefreshToken: !!session.refreshToken,
                        deviceFingerprint: ((_a = session.deviceFingerprint) === null || _a === void 0 ? void 0 : _a.substring(0, 12)) + "..." || "No fingerprint",
                        isActive: session.isActive,
                    });
                    if (session.refreshToken && session.isActive) {
                        try {
                            const decoded = jsonwebtoken_1.default.verify(session.refreshToken, config_1.config.JWT_REFRESH_SECRET);
                            if (decoded.exp && decoded.exp >= Date.now() / 1000) {
                                validSessions.push(session);
                                console.log(`✅ Pre-auth Session ${index} is valid`);
                            }
                            else {
                                expiredSessions.push(session);
                                console.log(`⏰ Pre-auth Session ${index} is expired`);
                            }
                        }
                        catch (error) {
                            invalidSessions.push(session);
                            console.log(`❌ Pre-auth Session ${index} is invalid:`, error.message);
                        }
                    }
                    else {
                        console.log(`⚠️ Pre-auth Session ${index} skipped - no refresh token or inactive`);
                    }
                });
                console.log("🔍 Pre-auth Session categorization:", {
                    valid: validSessions.length,
                    expired: expiredSessions.length,
                    invalid: invalidSessions.length,
                });
                // Group valid sessions by device fingerprint
                const deviceGroups = new Map();
                validSessions.forEach((session, index) => {
                    const deviceFingerprint = session.deviceFingerprint || "Unknown";
                    console.log(`🔍 Pre-auth Session ${index} device fingerprint: "${deviceFingerprint.substring(0, 12)}..."`);
                    if (!deviceGroups.has(deviceFingerprint)) {
                        deviceGroups.set(deviceFingerprint, []);
                    }
                    deviceGroups.get(deviceFingerprint).push(session);
                });
                console.log("🔍 Pre-auth Device groups:", Array.from(deviceGroups.keys()).map(fp => fp.substring(0, 12) + "..."));
                console.log("🔍 Pre-auth Current device sessions count:", ((_b = deviceGroups.get(currentFingerprint)) === null || _b === void 0 ? void 0 : _b.length) || 0);
                // Check device limit (only if this is a new device)
                const maxDevices = 3;
                if (deviceGroups.size >= maxDevices &&
                    !deviceGroups.has(currentFingerprint)) {
                    return res.status(400).json({
                        success: false,
                        message: "You have exceeded the maximum number of devices (3). Please sign out from other devices before logging in again.",
                        currentDevices: deviceGroups.size,
                        maxAllowedDevices: maxDevices,
                        action: "logout_required",
                    });
                }
                // Check sessions per current device
                const maxSessionsPerDevice = 5;
                const currentDeviceSessions = deviceGroups.get(currentFingerprint) || [];
                console.log("🔍 Pre-auth Current device sessions:", currentDeviceSessions.length);
                if (currentDeviceSessions.length >= maxSessionsPerDevice) {
                    return res.status(400).json({
                        success: false,
                        message: "You have reached the maximum number of sessions (5) for this device. Please sign out from other sessions on this device before logging in again.",
                        currentSessions: currentDeviceSessions.length,
                        maxAllowed: maxSessionsPerDevice,
                        action: "logout_required",
                    });
                }
            }
            // Now proceed with authentication since session limits are OK
            const result = await auth_service_1.AuthService.login({ identifier, password, rememberMe }, req);
            if (!result.success || !result.tokens) {
                return res.status(401).json({
                    success: false,
                    user: { id: result.userId },
                    message: result.message || "Invalid credentials or token generation failed",
                });
            }
            const tokens = result.tokens;
            // Update user document after successful authentication
            const updatedUserDoc = await User_1.User.findById(result.userId);
            if (updatedUserDoc) {
                updatedUserDoc.lastLogin = new Date();
                await updatedUserDoc.save();
            }
            // Set cookies
            const accessExpMs = AuthController.parseDuration(config_1.config.JWT_ACCESS_EXPIRATION);
            const refreshExpMs = AuthController.parseDuration(config_1.config.JWT_REFRESH_EXPIRATION);
            res.cookie("accesstoken", tokens.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/",
                maxAge: accessExpMs,
            });
            res.cookie("refreshtoken", tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/",
                maxAge: refreshExpMs,
            });
            const userSessions = await auth_service_1.AuthService.getAllUserSessions(result.userId);
            return res.status(200).json({
                success: true,
                user: { id: result.userId },
                message: "Login successful",
                tokens: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Login error:", error);
            return res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : "Login failed",
            });
        }
    }
    static parseDuration(duration) {
        if (!duration || typeof duration !== "string") {
            // Default to 24 hours if duration is invalid or not provided
            logger_1.logger.warn(`Invalid or missing duration string: "${duration}". Defaulting to 24 hours.`);
            return 24 * 60 * 60 * 1000;
        }
        const unit = duration.slice(-1);
        const valueString = duration.slice(0, -1);
        const value = parseInt(valueString, 10);
        if (isNaN(value) || value <= 0) {
            logger_1.logger.warn(`Invalid duration value: "${valueString}". Defaulting to 24 hours.`);
            return 24 * 60 * 60 * 1000; // Default 24 hours
        }
        switch (unit) {
            case "s": // seconds
                return value * 1000;
            case "m": // minutes
                return value * 60 * 1000;
            case "h": // hours
                return value * 60 * 60 * 1000;
            case "d": // days
                return value * 24 * 60 * 60 * 1000;
            default:
                logger_1.logger.warn(`Unknown duration unit: "${unit}" in duration string "${duration}". Defaulting to 24 hours.`);
                return 24 * 60 * 60 * 1000; // Default 24 hours if unit is unrecognized
        }
    }
    /**
     * Get active sessions for the authenticated user
     *
     * @route GET /api/auth/sessions
     * @param {Request} req Express request object with authenticated user
     * @param {Response} res Express response object
     *
     * @security
     * - Requires valid authentication
     * - Validates user session
     * - Only returns sessions for authenticated user
     *
     * @returns {Promise<void>} JSON response with active sessions
     *
     * @example
     * ```typescript
     * // Success Response
     * {
     *   "success": true,
     *   "sessions": [
     *     {
     *       "deviceInfo": {
     *         "browser": "Chrome",
     *         "os": "Windows",
     *         "ip": "192.168.1.1"
     *       },
     *       "lastActive": "2025-02-08T22:13:31.000Z",
     *       "location": "San Francisco, US",
     *       "status": "active"
     *     }
     *   ]
     * }
     * ```
     */
    static async getSessions(req, res) {
        try {
            const user = req.user;
            const sessions = await auth_service_1.AuthService.getUserSessions(user._id);
            res.json({ success: true, sessions });
        }
        catch (error) {
            logger_1.logger.error("Get sessions error:", error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : "Failed to get sessions",
            });
        }
    }
    /**
     * Logout user from all active sessions and devices
     *
     * @route POST /api/auth/logout-all
     * @param {Request} req Express request object with authenticated user
     * @param {Response} res Express response object
     *
     * @security
     * - Requires valid authentication
     * - Invalidates all refresh tokens
     * - Clears all HTTP-only cookies
     * - Logs security event with device info
     * - Updates user's session history
     *
     * @returns {Promise<void>} JSON response with logout status
     *
     * @example
     * ```typescript
     * // Success Response
     * {
     *   "success": true,
     *   "message": "Logged out from all sessions"
     * }
     *
     * // Error Response
     * {
     *   "success": false,
     *   "message": "Failed to logout from all sessions"
     * }
     * ```
     */
    static async logoutAll(req, res) {
        try {
            const user = req.user;
            await auth_service_1.AuthService.logoutAll(user._id);
            // Clear auth cookies
            console.log("🗑️  Clearing auth cookies for all sessions...");
            res.clearCookie("accesstoken");
            res.clearCookie("refreshtoken");
            console.log("✅ Auth cookies cleared successfully for all sessions");
            res.json({ success: true, message: "Logged out from all sessions" });
        }
        catch (error) {
            logger_1.logger.error("Logout all error:", error);
            res.status(400).json({
                success: false,
                message: error instanceof Error
                    ? error.message
                    : "Failed to logout from all sessions",
            });
        }
    }
    static async logoutAllSessions(req, res) {
        try {
            // get the user email from the body and send an otp to the email
            const { email } = req.body;
            const user = await User_1.User.findOne({ email });
            const clientInfo = await getClientInfo(req);
            if (!user) {
                return res
                    .status(400)
                    .json({ success: false, message: "User not found" });
            }
            const otp = generateOTP(6);
            console.log("🔑 OTP:", otp);
            const otpExpiry = new Date();
            otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);
            const verificationData = {
                otp,
                otpExpiry,
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.os,
            };
            await User_1.User.findByIdAndUpdate(user._id, { $set: { verificationData } });
            await email_service_1.default.sendLogoutAllSessionsEmail(user.email, otp, verificationData);
            res.json({ success: true, message: "OTP sent to email" });
        }
        catch (error) {
            logger_1.logger.error("Logout all sessions error:", error);
            res.status(400).json({
                success: false,
                message: error instanceof Error
                    ? error.message
                    : "Failed to logout all sessions",
            });
        }
    }
    /**
     * Public endpoint to clear all user sessions by email
     * This is a public endpoint for emergency use cases
     * @route POST /auth/public/clear-sessions
     */
    static async clearSessionsByEmail(req, res) {
        try {
            const { email, confirmText } = req.body;
            // Validate required fields
            if (!email || !confirmText) {
                return res.status(400).json({
                    success: false,
                    message: "Email and confirmation text are required"
                });
            }
            // Check confirmation text for security
            if (confirmText !== "CLEAR_ALL_SESSIONS") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid confirmation text. Please type 'CLEAR_ALL_SESSIONS' exactly."
                });
            }
            // Find user by email
            const user = await User_1.User.findOne({ email: email.toLowerCase().trim() });
            console.log("🔍 User found:", user);
            if (!user) {
                // Don't reveal if user exists or not for security
                return res.json({
                    success: true,
                    message: "If a user with this email exists, all sessions have been cleared."
                });
            }
            // Get client info for logging
            const clientInfo = await getClientInfo(req);
            // Clear all sessions for the user
            await auth_service_1.AuthService.logoutAll(user._id.toString());
            // Log this security action
            logger_1.logger.warn("🚨 Public session clearing requested", {
                email,
                requestIP: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                timestamp: new Date().toISOString(),
                userId: user._id
            });
            // Send notification email to user about session clearing
            try {
                await email_service_1.default.sendSecurityNotificationEmail(user.email, "All Sessions Cleared", `All your active sessions have been cleared via public security endpoint from IP: ${clientInfo.ip}`, {
                    action: "All sessions cleared",
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                    timestamp: new Date()
                });
            }
            catch (emailError) {
                logger_1.logger.error("Failed to send security notification email:", emailError);
                // Don't fail the request if email fails
            }
            res.json({
                success: true,
                message: "If a user with this email exists, all sessions have been cleared."
            });
        }
        catch (error) {
            logger_1.logger.error("Clear sessions by email error:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }
    /**
     * Verify One-Time Password (OTP) for account verification
     *
     * @route POST /api/auth/verify-otp
     * @param {Request} req Express request object
     * @param {Response} res Express response object
     *
     * @security
     * - OTP expiration validation
     * - Max attempts limit
     * - Time-based throttling
     * - Device fingerprinting
     * - IP tracking
     * - Concurrent verification prevention
     *
     * @returns {Promise<void>} JSON response with verification status and tokens
     *
     * @example
     * ```typescript
     * // Request body
     * {
     *   "_id": "user_id",
     *   "otp": "123456",
     *   "verificationMethod": "email" // or "phone"
     * }
     *
     * // Success Response
     * {
     *   "success": true,
     *   "message": "OTP verified successfully",
     *   "user": {
     *     "id": "user_id",
     *     "email": "user@example.com",
     *     "isVerified": true
     *   },
     *   "tokens": {
     *     "accessToken": "...",
     *     "refreshToken": "..."
     *   }
     * }
     *
     * // Error Response
     * {
     *   "success": false,
     *   "message": "Invalid OTP or OTP expired"
     * }
     * ```
     */
    /**
     * Verify One-Time Password (OTP) for account verification
     *
     * @route POST /api/auth/verify-otp
     * @param {Request} req Express request object
     * @param {Response} res Express response object
     *
     * @security
     * - OTP expiration validation
     * - Max attempts limit
     * - Time-based throttling
     * - Device fingerprinting
     * - IP tracking
     * - Concurrent verification prevention
     *
     * @returns {Promise<void>} JSON response with verification status and tokens
     *
     * @example
     * ```typescript
     * // Request body
     * {
     *   "_id": "user_id",
     *   "otp": "123456",
     *   "verificationMethod": "email" // or "phone"
     * }
     *
     * // Success Response
     * {
     *   "success": true,
     *   "message": "OTP verified successfully",
     *   "user": {
     *     "id": "user_id",
     *     "email": "user@example.com",
     *     "isVerified": true
     *   },
     *   "tokens": {
     *     "accessToken": "...",
     *     "refreshToken": "..."
     *   }
     * }
     *
     * // Error Response
     * {
     *   "success": false,
     *   "message": "Invalid OTP or OTP expired"
     * }
     * ```
     */
    static async verifyOTP(req, res) {
        try {
            const { _id, otp, verificationMethod, issue, email } = req.body;
            const motive = req.body.motive || "login"; // Default to "login"
            if ((!_id && !otp && !verificationMethod) || (email && motive !== "logout_all_sessions")) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: _id, otp, or verificationMethod",
                });
            }
            // look for the user with given email if the email is not null
            if (email && motive === "logout_all_sessions") {
                const foundUser = await User_1.User.findOne({ email });
                if (!foundUser) {
                    return res.status(400).json({
                        success: false,
                        message: "User not found",
                    });
                }
                // Call the verifyOTP method
                const result = await auth_service_1.AuthService.verifyOTPResponse(foundUser._id, otp, verificationMethod.toLowerCase());
                if (!result.success) {
                    return res.status(400).json({
                        success: false,
                        message: result.message,
                    });
                }
                // call the logout all sessions function
                await auth_service_1.AuthService.logoutAll(foundUser._id);
                return res.json({
                    success: true,
                    message: "OTP verified successfully. All sessions have been logged out.",
                    email: foundUser === null || foundUser === void 0 ? void 0 : foundUser.email,
                });
            }
            // Call the verifyOTP method
            const result = await auth_service_1.AuthService.verifyOTPResponse(_id, otp, verificationMethod.toLowerCase());
            if (result.success) {
                const user = result.user;
                // Handle different verification purposes
                switch (issue) {
                    case "forgot_username":
                        return res.json({
                            success: true,
                            message: "Username retrieved successfully",
                            username: user === null || user === void 0 ? void 0 : user.username,
                        });
                    case "forgot_email":
                        return res.json({
                            success: true,
                            message: "Email retrieved successfully",
                            email: user === null || user === void 0 ? void 0 : user.email,
                        });
                    case "forgot_password":
                        // For password reset, we still need to let them set a new password
                        return res.json({
                            success: true,
                            message: "OTP verified successfully. You can now reset your password.",
                            email: user === null || user === void 0 ? void 0 : user.email,
                        });
                    case "phone_number_change":
                    case "email_change":
                        // For changes, we verify their identity first, then they can make the change
                        return res.json({
                            success: true,
                            message: "Identity verified successfully. You can now make the requested change.",
                            currentValue: issue === "phone_number_change"
                                ? user === null || user === void 0 ? void 0 : user.phoneNumber
                                : user === null || user === void 0 ? void 0 : user.email,
                        });
                    default:
                        // Handle regular login case
                        if (motive === "login") {
                            const tokens = auth_service_1.AuthService.generateTokens(_id, user.email);
                            // Convert JWT expiration strings to milliseconds
                            const accessExpMs = AuthController.parseDuration(config_1.config.JWT_ACCESS_EXPIRATION);
                            const refreshExpMs = AuthController.parseDuration(config_1.config.JWT_REFRESH_EXPIRATION);
                            res.cookie("accesstoken", tokens.accessToken, {
                                httpOnly: true,
                                secure: process.env.NODE_ENV === "production",
                                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                                path: "/",
                                maxAge: accessExpMs,
                            });
                            res.cookie("refreshtoken", tokens.refreshToken, {
                                httpOnly: true,
                                secure: process.env.NODE_ENV === "production",
                                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                                path: "/",
                                maxAge: refreshExpMs,
                            });
                            return res.json({
                                success: true,
                                message: "OTP verified successfully",
                                tokens,
                                user: {
                                    _id: user === null || user === void 0 ? void 0 : user._id,
                                    email: user === null || user === void 0 ? void 0 : user.email,
                                    username: user === null || user === void 0 ? void 0 : user.username,
                                    fullname: user === null || user === void 0 ? void 0 : user.fullName,
                                },
                            });
                        }
                        return res.json({
                            success: true,
                            message: "OTP verified successfully",
                        });
                }
            }
            return res.status(400).json({
                success: false,
                message: result.message || "Invalid OTP",
            });
        }
        catch (error) {
            logger_1.logger.error("OTP verification error:", error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : "Failed to verify OTP",
            });
        }
    }
    /**
     * Refresh user's access token using a valid refresh token
     *
     * @route POST /api/auth/refresh-token
     * @param {Request} req Express request object with refresh token in cookie or body
     * @param {Response} res Express response object
     *
     * @security
     * - Validates refresh token
     * - Implements token rotation
     * - Sets secure HTTP-only cookies
     * - Tracks token usage
     * - Prevents token reuse
     * - Updates session activity
     *
     * @returns {Promise<void>} JSON response with new token pair
     *
     * @example
     * ```typescript
     * // Success Response
     * {
     *   "success": true,
     *   "tokens": {
     *     "accessToken": "new-access-token",
     *     "refreshToken": "new-refresh-token"
     *   }
     * }
     *
     * // Error Response
     * {
     *   "success": false,
     *   "message": "Invalid refresh token"
     * }
     * ```
     */
    static async refreshToken(req, res) {
        try {
            // Get refresh token from body or cookies
            let refreshToken = req.body.refreshToken;
            // If not in body, try to get from cookies
            if (!refreshToken) {
                refreshToken =
                    req.cookies.refreshtoken ||
                        req.cookies.refreshToken ||
                        req.cookies["better-auth.refresh-token"];
            }
            const deviceInfo = await getClientInfo(req); // Get device info
            if (!refreshToken) {
                logger_1.logger.warn("Refresh token missing in request");
                return res
                    .status(400)
                    .json({ success: false, message: "Refresh token is required" });
            }
            logger_1.logger.debug(`Attempting to refresh token: ${refreshToken.substring(0, 10)}...`);
            // Try to refresh the token
            const result = await auth_service_1.AuthService.refreshAccessToken(refreshToken, deviceInfo);
            // Convert JWT expiration strings to milliseconds
            const accessExpMs = AuthController.parseDuration(config_1.config.JWT_ACCESS_EXPIRATION);
            const refreshExpMs = AuthController.parseDuration(config_1.config.JWT_REFRESH_EXPIRATION);
            // Set new tokens in HTTP-only cookies with proper security settings
            res.cookie("accesstoken", result.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/",
                maxAge: accessExpMs,
            });
            res.cookie("refreshtoken", result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/",
                maxAge: refreshExpMs,
            });
            res.status(200).json({
                success: true,
                tokens: result,
            });
        }
        catch (error) {
            logger_1.logger.error("Refresh token error:", error);
            // Handle different error types
            if (error.name === "CustomError" && error.code === "INVALID_TOKEN") {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired refresh token",
                });
            }
            if (error.name === "JsonWebTokenError" ||
                error.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired refresh token",
                });
            }
            // For development mode, provide more details
            if (process.env.NODE_ENV === "development") {
                return res.status(500).json({
                    success: false,
                    message: "Failed to refresh token",
                    error: error.message,
                    stack: error.stack,
                });
            }
            // For production, just return a generic error
            res
                .status(500)
                .json({ success: false, message: "Failed to refresh token" });
        }
    }
    /**
     * Logout user
     * @route POST /auth/logout
     */
    static async logout(req, res) {
        var _a;
        try {
            // The refreshToken to invalidate a specific session can be passed in the body
            // Or from the httpOnly cookie if specifically designed that way (more complex)
            const { refreshToken } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId; // Assuming userId is populated by an auth middleware if available
            if (!userId && !refreshToken) {
                // If no specific session to logout and no user context, clear cookies as a general measure
                res.clearCookie("accesstoken", { path: "/" });
                res.clearCookie("refreshtoken", { path: "/" });
                return res
                    .status(200)
                    .json({ success: true, message: "Logged out (cookies cleared)" });
            }
            // If userId is available (e.g., from access token), prefer logging out that user's session
            // If only refreshToken is available, AuthService.logout should handle finding the user by that token if needed.
            await auth_service_1.AuthService.logout(userId, refreshToken);
            res.clearCookie("accesstoken", { path: "/" });
            res.clearCookie("refreshtoken", { path: "/" });
            res
                .status(200)
                .json({ success: true, message: "Logged out successfully" });
        }
        catch (error) {
            logger_1.logger.error("Logout error:", error.message);
            res.status(500).json({ success: false, message: "Logout failed" });
        }
    }
    /**
     * Request password reset
     * @route POST /auth/forgot-password
     */
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                throw new errors_1.CustomError("MISSING_EMAIL", "Email is required");
            }
            // Fetch user first to ensure email exists and get name
            const user = await User_1.User.findOne({ email }).select("fullName");
            // Always return success message for security, even if user not found
            // But only proceed if user exists
            if (user) {
                const resetToken = (0, crypto_1.randomBytes)(32).toString("hex");
                await auth_service_1.AuthService.setResetToken(email, resetToken, "reset_password", "email");
                const clientInfo = await getClientInfo(req);
                // Define expiry time (e.g., 60 minutes)
                const expiryMinutes = 60;
                // Send reset email with properly encoded token
                const encodedToken = encodeURIComponent(resetToken);
                // Make sure we have a valid CLIENT_URL, with fallback to the hardcoded production URL
                const clientUrl = config_1.config.CLIENT_URL || "https://my-pts-dashboard-management.vercel.app";
                const resetUrl = `${clientUrl}/reset-password?token=${encodedToken}`;
                logger_1.logger.info(`Generated reset URL in auth controller: ${resetUrl}`);
                await email_service_1.default.sendPasswordResetEmail(email, resetUrl, // Pass the full URL
                user.fullName || "User", // Pass user's name (or default)
                expiryMinutes, // Pass expiry time
                { ipAddress: clientInfo.ip, userAgent: clientInfo.os });
            }
            else {
                // Log if user not found, but don't reveal this to the client
                logger_1.logger.warn(`Password reset requested for non-existent email: ${email}`);
            }
            res.json({
                success: true,
                message: "If an account exists with this email, password reset instructions have been sent", // Kept generic for security
            });
        }
        catch (error) {
            logger_1.logger.error("Forgot password error:", error);
            // Use vague message for security
            res.status(200).json({
                success: true,
                message: "If an account exists with this email, password reset instructions have been sent",
            });
        }
    }
    /**
     * Reset password using a valid reset token
     *
     * @route POST /api/auth/reset-password
     * @param {Request} req Express request object
     * @param {Response} res Express response object
     *
     * @security
     * - Validates token expiration
     * - Enforces password strength
     * - Rate limiting on attempts
     * - IP tracking for suspicious activity
     * - Secure token validation
     * - Password history check
     *
     * @returns {Promise<void>} JSON response with reset status
     *
     * @example
     * ```typescript
     * // Request body
     * {
     *   "token": "reset-token-here",
     *   "password": "newSecurePassword123"
     * }
     *
     * // Success Response
     * {
     *   "success": true,
     *   "message": "Password reset successful"
     * }
     *
     * // Error Response
     * {
     *   "success": false,
     *   "message": "Invalid or expired reset token"
     * }
     * ```
     */
    static async resetPassword(req, res) {
        try {
            const { token, password } = req.body;
            if (!token || !password) {
                throw new errors_1.CustomError("MISSING_FIELDS", "Token and password are required");
            }
            await auth_service_1.AuthService.resetPassword(token, password, "reset_password");
            res.json({
                success: true,
                message: "Password reset successful",
            });
        }
        catch (error) {
            logger_1.logger.error("Reset password error:", error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : "Password reset failed",
            });
        }
    }
    /**
     * Resend verification email
     * @route POST /auth/resend-verification
     */
    static async resendVerification(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                throw new errors_1.CustomError("MISSING_EMAIL", "Email is required");
            }
            const clientInfo = await getClientInfo(req);
            // Logic to resend verification email
            const result = await auth_service_1.AuthService.resendVerification(email);
            res.json({
                success: true,
                message: "Verification email resent successfully",
            });
        }
        catch (error) {
            logger_1.logger.error("Resend verification error:", error);
            res.status(400).json({
                success: false,
                message: error instanceof Error
                    ? error.message
                    : "Failed to resend verification email",
            });
        }
    }
    /**
     * Verify user email address
     *
     * @route POST /api/auth/verify-email
     * @param {Request} req Express request object
     * @param {Response} res Express response object
     *
     * @security
     * - Validates verification token
     * - Rate limiting protection
     * - Token expiration check
     * - IP tracking for suspicious activity
     * - One-time use tokens
     * - Secure session creation
     *
     * @returns {Promise<void>} JSON response with verification status
     *
     * @example
     * ```typescript
     * // Request body
     * {
     *   "token": "verification-token-here"
     * }
     *
     * // Success Response
     * {
     *   "success": true,
     *   "message": "Email verified successfully"
     * }
     *
     * // Error Response
     * {
     *   "success": false,
     *   "message": "Invalid verification token"
     * }
     * ```
     */
    static async verifyEmail(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: "Verification token is required",
                });
            }
            // Get request info for security tracking
            const clientInfo = await getClientInfo(req);
            // First find user by verification token
            const user = await User_1.User.findOne({ "verificationData.token": token });
            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid verification token",
                });
            }
            // Validate the token using AuthService
            const result = await auth_service_1.AuthService.verifyEmail(token);
            if (result.success) {
                // Generate tokens
                const tokens = await auth_service_1.AuthService.generateTokens(user.email, user._id);
                // Set access token cookie
                res.cookie("accesstoken", tokens.accessToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    path: "/",
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches JWT_ACCESS_EXPIRATION)
                });
                // Send success response
                return res.status(200).json({
                    success: true,
                    message: "Email verified successfully",
                });
            }
            return res.status(400).json({
                success: false,
                message: result.message || "Email verification failed",
            });
        }
        catch (error) {
            logger_1.logger.error("Email verification error:", error);
            res.status(500).json({
                success: false,
                message: "An error occurred during email verification",
            });
        }
    }
    /**
     * Generate Two-Factor Authentication (2FA) secret for user
     *
     * @route POST /api/auth/generate-2fa
     * @param {Request} req Express request object with authenticated user
     * @param {Response} res Express response object
     *
     * @security
     * - Requires authentication
     * - Validates user session
     * - Generates cryptographically secure secret
     * - QR code generation for authenticator apps
     * - Email notification with setup instructions
     * - Device tracking for audit
     *
     * @returns {Promise<void>} JSON response with 2FA setup data
     *
     * @example
     * ```typescript
     * // Request header
     * Authorization: Bearer <access_token>
     *
     * // Success Response
     * {
     *   "message": "2FA code sent successfully",
     *   "qrCode": "data:image/png;base64,..." // QR code for authenticator app
     * }
     *
     * // Error Response
     * {
     *   "message": "User not authenticated",
     *   "statusCode": 401
     * }
     * ```
     */
    static async generate2FA(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "User not authenticated" });
            }
            const user = req.user;
            const userId = user._id;
            // Generate 2FA secret
            const secretData = await twoFactor_service_1.default.generateSecret(userId);
            // Get request info for security tracking
            const clientInfo = await getClientInfo(req);
            // Send 2FA code via email with security info
            await email_service_1.default.sendLoginVerificationOTP(user.email, secretData.secret, {
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.os,
                location: `${clientInfo.device || "Unknown Device"} - ${clientInfo.browser || "Unknown Browser"}`,
            });
            res.status(200).json({
                message: "2FA code sent successfully",
                qrCode: secretData.qrCode,
            });
        }
        catch (error) {
            logger_1.logger.error("Error generating 2FA:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
    /**
     * Verify 2FA code submitted by user
     *
     * @route POST /api/auth/verify-2fa
     * @param {Request} req Express request object with authenticated user
     * @param {Response} res Express response object
     *
     * @security
     * - Requires authentication
     * - Time-based code validation
     * - Rate limiting per user
     * - Invalid attempts tracking
     * - Session validation
     * - Device fingerprinting
     *
     * @returns {Promise<void>} JSON response with verification status
     *
     * @example
     * ```typescript
     * // Request body
     * {
     *   "code": "123456"
     * }
     *
     * // Success Response
     * {
     *   "message": "2FA code verified successfully"
     * }
     *
     * // Error Response
     * {
     *   "message": "Invalid 2FA code"
     * }
     * ```
     */
    static async verify2FA(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "User not authenticated" });
            }
            const { code } = req.body;
            const user = req.user;
            const userId = user._id; // Assuming user is authenticated
            const isValid = await twoFactor_service_1.default.verifyToken(userId, code);
            if (isValid) {
                res.status(200).json({ message: "2FA code verified successfully" });
            }
            else {
                res.status(400).json({ message: "Invalid 2FA code" });
            }
        }
        catch (error) {
            logger_1.logger.error("Error verifying 2FA:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
    /**
     * Disable 2FA
     * @route POST /auth/disable-2fa
     */
    static async disable2FA(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "User not authenticated" });
            }
            const user = req.user;
            const userId = user._id; // Assuming user is authenticated
            await twoFactor_service_1.default.disable(userId);
            res.status(200).json({ message: "2FA disabled successfully" });
        }
        catch (error) {
            logger_1.logger.error("Error disabling 2FA:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
    /**
     * Validate 2FA code
     * @route POST /auth/validate-2fa
     */
    static async validate2FA(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "User not authenticated" });
            }
            const { code } = req.body;
            const user = req.user;
            const userId = user._id; // Assuming user is authenticated
            const isValid = await twoFactor_service_1.default.verifyToken(userId, code);
            if (isValid) {
                res.status(200).json({ message: "2FA code is valid" });
            }
            else {
                res.status(400).json({ message: "Invalid 2FA code" });
            }
        }
        catch (error) {
            logger_1.logger.error("Error validating 2FA:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
    /**
     * Resend OTP
     * @route POST /auth/resend-otp
     */
    static async resendOTP(req, res) {
        try {
            const { _id, verificationMethod } = req.body;
            if (!_id || !verificationMethod) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: _id",
                });
            }
            if (_id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID",
                });
            }
            // Find user
            const user = await User_1.User.findById(_id);
            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: "User not found",
                });
            }
            user.verificationMethod = verificationMethod;
            // Generate new OTP
            const otp = generateOTP(6);
            console.log("🔐 Resending OTP:", otp);
            // Get request info for security tracking
            const clientInfo = await getClientInfo(req);
            // Update user's verification data
            user.verificationData = {
                otp,
                otpExpiry: new Date(Date.now() + auth_service_1.AuthService.OTP_EXPIRY_MINUTES * 60 * 1000),
                attempts: 0,
                lastAttempt: new Date(),
            };
            await user.save();
            // Send OTP based on verification method
            if (user.verificationMethod.toLowerCase() === "email") {
                await email_service_1.default.sendVerificationEmail(user.email, otp, {
                    ipAddress: clientInfo.ip,
                    userAgent: clientInfo.os,
                });
                logger_1.logger.info(`🟣 Registration OTP (Email): ${otp}`);
            }
            else if (user.verificationMethod.toLowerCase() === "phone" &&
                user.phoneNumber) {
                console.log("Sending OTP to phone number:", user.phoneNumber);
                await twilio_service_1.default.sendOTPMessage(user.phoneNumber, otp);
                logger_1.logger.info(`🟣 Registration OTP (Phone): ${otp}`);
            }
            res.json({
                success: true,
                message: `OTP resent successfully via ${user.verificationMethod}:  ${user.verificationMethod.toLowerCase() === "phone" ? user.phoneNumber : user.email} `,
                userId: user._id,
                otp: otp,
            });
        }
        catch (error) {
            logger_1.logger.error("Resend OTP error:", error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : "Failed to resend OTP",
            });
        }
    }
    static async selectOTPMethod(req, res) {
        try {
            const { _id, verificationMethod } = req.body;
            if (!_id || !verificationMethod) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: _id or verificationMethod",
                });
            }
            // Find user
            const user = await User_1.User.findById(_id);
            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: "User not found",
                });
            }
            // Update user's verification data
            user.verificationMethod = verificationMethod;
            await user.save();
            // Send OTP based on verification method
            res.json({
                success: true,
                message: `OTP verification method sent,  ${verificationMethod}`,
                userId: user._id,
            });
        }
        catch (error) {
            logger_1.logger.error("Error sending OPT verification method:", error);
            res.status(400).json({
                success: false,
                message: error instanceof Error
                    ? error.message
                    : "Failed to send OTP verification method",
            });
        }
    }
    /**
     * Check if an email address is available (not already registered)
     *
     * @route GET /api/auth/check-email/:email
     * @param {Request} req Express request object
     * @param {Response} res Express response object
     *
     * @returns {Promise<void>} JSON response indicating if email is available
     */
    static async checkEmail(req, res) {
        try {
            const email = req.params.email;
            const user = await User_1.User.findOne({ email: email.toLowerCase() });
            res.json({
                available: !user,
                message: user ? "Email is already registered" : "Email is available",
            });
        }
        catch (error) {
            logger_1.logger.error("Check email error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to check email availability",
            });
        }
    }
    /**
     * Check if a username is available (not already taken)
     *
     * @route GET /api/auth/check-username/:username
     * @param {Request} req Express request object
     * @param {Response} res Express response object
     *
     * @returns {Promise<void>} JSON response indicating if username is available
     */
    static async checkUsername(req, res) {
        try {
            const username = req.params.username;
            const user = await User_1.User.findOne({ username: username.toLowerCase() });
            res.json({
                available: !user,
                message: user ? "Username is already taken" : "Username is available",
            });
        }
        catch (error) {
            logger_1.logger.error("Check username error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to check username availability",
            });
        }
    }
    /**
     * Retrieve forgotten information (email/username) after OTP validation
     * @route POST /auth/retrieve-forgotten-info
     */
    static async retrieveForgottenInfo(req, res) {
        try {
            const { token, infoType } = req.body;
            if (!token || !infoType) {
                return res.status(400).json({
                    success: false,
                    message: "Token and infoType are required",
                });
            }
            // Validate infoType
            if (!["email", "username", "phone_number"].includes(infoType)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid infoType. Must be 'email', 'username', or 'phone_number'",
                });
            }
            const result = await auth_service_1.AuthService.retrieveForgottenInfo(token, infoType);
            if (result.success && result.info) {
                return res.json({
                    success: true,
                    message: `Your ${infoType} has been retrieved successfully`,
                    [infoType]: result.info,
                });
            }
            return res.status(400).json({
                success: false,
                message: result.message || "Failed to retrieve information",
            });
        }
        catch (error) {
            logger_1.logger.error("Error retrieving forgotten info:", error);
            return res.status(500).json({
                success: false,
                message: "Error retrieving information",
            });
        }
    }
    /**
     * Handle trouble logging in by providing personalized assistance
     *
     * @route POST /api/auth/trouble-login
     * @param {Request} req Express request object
     * @param {Response} res Express response object
     *
     * @returns {Promise<void>} JSON response with helpful next steps
     */
    static async troubleLogin(req, res) {
        try {
            const { identifier, issue, verificationMethod } = req.body;
            // Validate request payload
            if (!identifier) {
                return res.status(400).json({
                    success: false,
                    message: "Identifier (email, username, or phone) is required",
                });
            }
            if (!issue) {
                return res.status(400).json({
                    success: false,
                    message: "Issue is required",
                });
            }
            // Find user based on identifier
            const user = await User_1.User.findOne({
                $or: [
                    { email: identifier.toLowerCase() },
                    { username: identifier.toLowerCase() },
                    { phoneNumber: identifier },
                ],
            });
            if (!user) {
                return res.json({
                    success: true,
                    message: "If an account exists with this email, we'll send instructions to help you log in.",
                    nextSteps: [
                        "Check if you used the correct email address",
                        "Try creating a new account if you haven't registered",
                    ],
                });
            }
            // Function to get next steps based on issue
            const getNextSteps = (method, issue) => {
                const commonSteps = {
                    account_locked: [
                        "Your account will automatically unlock after 1 hour",
                        "Contact support if you need immediate assistance",
                        "Enable 2FA to prevent future lockouts",
                    ],
                    "2fa_issues": [
                        "Make sure your device's time is correctly synchronized",
                        "Use backup codes if you've lost access to your authenticator app",
                        "Contact support if you've lost access to your 2FA device",
                    ],
                    default: [
                        "Ensure you're using the correct credentials",
                        "Check if Caps Lock is on",
                        "Reset your password if you can't remember it",
                        "Contact support if you continue having problems",
                    ],
                };
                if (issue === "forgot_password" ||
                    "forgot_username" ||
                    "forgot_email" ||
                    "phone_number_change" ||
                    "email_change") {
                    return method === "EMAIL"
                        ? [
                            "Check your email for a verification code",
                            "Enter the code to reset your password",
                            "If you don't receive the email, check your spam folder",
                        ]
                        : [
                            "Check your phone for a verification code",
                            "Enter the code to reset your password",
                            "If you don't receive the SMS, check your network signal",
                        ];
                }
                return commonSteps[issue] || commonSteps.default;
            };
            // Function to handle password reset
            const handlePasswordReset = async (method, identifier, issue) => {
                const otp = generateOTP(6); // Generate 6-digit OTP
                const expiry = new Date(Date.now() + auth_service_1.AuthService.OTP_EXPIRY_MINUTES * 60 * 1000);
                // Store OTP in user record
                user.verificationData = {
                    otp,
                    otpExpiry: expiry,
                    attempts: 0,
                    lastAttempt: new Date(),
                };
                await user.save();
                console.log("Updated user verification data:", user.verificationData);
                // Determine reset context based on issue
                const getResetContext = (issue) => {
                    switch (issue) {
                        case "forgot_username":
                            return {
                                type: "username",
                                identifier: user.email,
                                requestedBy: "username recovery",
                            };
                        case "forgot_email":
                            return {
                                type: "email",
                                identifier: user.username || user.email,
                                requestedBy: "email recovery",
                            };
                        case "phone_number_change":
                            return {
                                type: "phone",
                                identifier: user.email,
                                requestedBy: "phone number change",
                            };
                        case "email_change":
                            return {
                                type: "email",
                                identifier: user.email,
                                requestedBy: "email change",
                            };
                        case "forgot_password":
                        default:
                            return {
                                type: "password",
                                identifier: user.email,
                                requestedBy: "password reset",
                            };
                    }
                };
                if (method === "EMAIL") {
                    await email_service_1.default.sendPasswordResetOTP(user.email, otp, user.fullName || user.username || "User", getResetContext(issue));
                    logger_1.logger.info(`${getResetContext(issue).requestedBy} OTP sent via email to ${user.email}`);
                }
                else if (method === "PHONE") {
                    try {
                        await twilio_service_1.default.sendOTPMessage(user.phoneNumber, otp);
                        logger_1.logger.info(`${getResetContext(issue).requestedBy} OTP sent via SMS to ${user.phoneNumber}`);
                    }
                    catch (error) {
                        logger_1.logger.error("Failed to send SMS OTP:", error);
                        throw new Error("Failed to send SMS verification. Please try email verification.");
                    }
                }
                return otp;
            };
            // Trigger password reset if necessary
            let otpSent = null;
            const resetIssues = [
                "forgot_password",
                "forgot_username",
                "forgot_email",
                "phone_number_change",
                "email_change",
            ];
            if (resetIssues.includes(issue)) {
                otpSent = await handlePasswordReset(verificationMethod, identifier.toLowerCase(), issue);
            }
            // Response with next steps
            return res.json({
                success: true,
                message: "We've identified some steps to help you log in",
                nextSteps: getNextSteps(verificationMethod, issue),
                userId: user._id,
                otpSent, // Include OTP in response only for testing/debugging (remove in production)
                supportEmail: config_1.config.SMTP_FROM,
                supportPhone: config_1.config.SUPPORT_PHONE,
            });
        }
        catch (error) {
            logger_1.logger.error("Trouble login error:", error);
            return res.status(500).json({
                success: false,
                message: "Error processing your request. Please try again later.",
            });
        }
    }
    /**
     * Change user's email address after verification
     * @route POST /auth/change-email
     */
    static async changeEmail(req, res) {
        try {
            const { userId, newEmail } = req.body;
            if (!userId || !newEmail) {
                return res.status(400).json({
                    success: false,
                    message: "User ID and new email are required",
                });
            }
            // Check if email is already in use
            const existingUser = await User_1.User.findOne({
                email: newEmail,
                _id: { $ne: userId },
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Email is already in use",
                });
            }
            // Update user's email
            const user = await User_1.User.findByIdAndUpdate(userId, {
                email: newEmail,
                isEmailVerified: true, // Since they've already verified through OTP
            }, { new: true });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }
            return res.json({
                success: true,
                message: "Email updated successfully",
                email: newEmail,
            });
        }
        catch (error) {
            logger_1.logger.error("Change email error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to update email",
            });
        }
    }
    /**
     * Change user's phone number after verification
     * @route POST /auth/change-phone
     */
    static async changePhoneNumber(req, res) {
        try {
            const { userId, newPhoneNumber, formattedPhoneNumber } = req.body;
            if (!userId || !newPhoneNumber) {
                return res.status(400).json({
                    success: false,
                    message: "User ID and new phone number are required",
                });
            }
            // Check if phone number is already in use
            const existingUser = await User_1.User.findOne({
                phoneNumber: newPhoneNumber,
                _id: { $ne: userId },
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number is already in use",
                });
            }
            // Update user's phone number
            const user = await User_1.User.findByIdAndUpdate(userId, {
                phoneNumber: newPhoneNumber,
                formattedPhoneNumber: formattedPhoneNumber || newPhoneNumber,
                isPhoneVerified: true, // Since they've already verified through OTP
            }, { new: true });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }
            return res.json({
                success: true,
                message: "Phone number updated successfully",
                phoneNumber: newPhoneNumber,
                formattedPhoneNumber: formattedPhoneNumber || newPhoneNumber,
            });
        }
        catch (error) {
            logger_1.logger.error("Change phone number error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to update phone number",
            });
        }
    }
    /**
     * Change username after verification
     * @route POST /auth/change-username
     */
    static async changeUsername(req, res) {
        try {
            const { userId, newUsername } = req.body;
            if (!userId || !newUsername) {
                return res.status(400).json({
                    success: false,
                    message: "User ID and new username are required",
                });
            }
            // Check if username is already in use
            const existingUser = await User_1.User.findOne({
                username: newUsername.toLowerCase(),
                _id: { $ne: userId },
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Username is already taken",
                });
            }
            // Update user's username
            const user = await User_1.User.findByIdAndUpdate(userId, { username: newUsername.toLowerCase() }, { new: true });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }
            return res.json({
                success: true,
                message: "Username updated successfully",
                username: newUsername.toLowerCase(),
            });
        }
        catch (error) {
            logger_1.logger.error("Change username error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to update username",
            });
        }
    }
    /**
     * Change user identifier (email, username, phone) after verification
     * @route POST /auth/change-identifier
     */
    static async changeIdentifier(req, res) {
        try {
            const { userId, identifierType, newValue, formattedValue } = req.body;
            // Validate required fields
            if (!userId || !identifierType || !newValue) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: userId, identifierType, or newValue",
                });
            }
            // Validate identifier type
            const validTypes = ["email", "username", "phone"];
            if (!validTypes.includes(identifierType)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid identifier type. Must be one of: email, username, phone",
                });
            }
            // Find user
            const user = await User_1.User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }
            // Check if new value is already in use by another user
            const existingUser = await User_1.User.findOne({
                [identifierType]: identifierType === "phone"
                    ? newValue
                        .replace(/[^+\d]/g, "")
                        .replace("+", "")
                        .replace(" ", "")
                    : newValue.toLowerCase(),
                _id: { $ne: userId },
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: `${identifierType.charAt(0).toUpperCase() + identifierType.slice(1)} is already in use`,
                });
            }
            // Prepare update object based on identifier type
            const updateData = {};
            switch (identifierType) {
                case "email":
                    updateData.email = newValue.toLowerCase();
                    updateData.isEmailVerified = true; // Since they've already verified through OTP
                    break;
                case "username":
                    updateData.username = newValue.toLowerCase();
                    break;
                case "phone":
                    updateData.phoneNumber = newValue
                        .replace(/[^+\d]/g, "")
                        .replace("+", "")
                        .replace(" ", "");
                    updateData.formattedPhoneNumber = formattedValue || newValue;
                    updateData.isPhoneVerified = true;
                    break;
            }
            // Update user's identifier
            const updatedUser = await User_1.User.findByIdAndUpdate(userId, updateData, {
                new: true,
            });
            if (!updatedUser) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to update identifier",
                });
            }
            // Get client info for security logging
            const clientInfo = await getClientInfo(req);
            // Log the change for security audit
            logger_1.logger.info(`User ${userId} changed their ${identifierType} from ${user[identifierType]} to ${newValue}`, {
                userId,
                oldValue: user[identifierType],
                newValue,
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                timestamp: new Date(),
            });
            // Send notification email about the change
            if (identifierType === "email") {
                // Send to old email
                await email_service_1.default.sendVerificationEmail(user.email, "email", {
                    ipAddress: clientInfo.ip,
                    userAgent: clientInfo.os,
                });
            }
            else if (identifierType === "phone") {
                // Send SMS notification to old phone
                // TODO: Send SMS
                // await TwilioService.sendOTPMessage(
                //   user.phoneNumber,
                //   'phone'
                // );
            }
            return res.json({
                success: true,
                message: `${identifierType.charAt(0).toUpperCase() + identifierType.slice(1)} updated successfully`,
                [identifierType]: newValue,
            });
        }
        catch (error) {
            logger_1.logger.error("Change identifier error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to update identifier",
            });
        }
    }
    /**
     * Verifies the validity of an access token (JWT) and returns user info if valid.
     * Endpoint: POST /api/auth/verify
     */
    static async verifyToken(req, res) {
        try {
            // Accept token from Authorization header or cookie
            let token = req.header("Authorization");
            if (token && token.startsWith("Bearer ")) {
                token = token.replace("Bearer ", "");
            }
            if (!token && req.cookies) {
                token =
                    req.cookies["accessToken"] ||
                        req.cookies["accesstoken"] ||
                        req.cookies["better-auth.access-token"];
            }
            if (!token) {
                return res
                    .status(401)
                    .json({ success: false, message: "No token provided" });
            }
            // Verify the token
            const jsonwebtoken = require("jsonwebtoken");
            const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET || "your-secret-key");
            // Find the user
            const user = await User_1.User.findById(decoded.userId || decoded.id);
            if (!user) {
                return res
                    .status(404)
                    .json({ success: false, message: "User not found" });
            }
            // Return sanitized user data
            return res.json({
                success: true,
                user: {
                    id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    username: user.username,
                    isAdmin: user.role === "admin",
                    role: user.role,
                    profileImage: user.profileImage,
                    phoneNumber: user.phoneNumber,
                    countryOfResidence: user.countryOfResidence,
                    dateOfBirth: user.dateOfBirth,
                    isProfileComplete: user.isProfileComplete,
                },
            });
        }
        catch (err) {
            console.error("Token verification error:", err);
            return res
                .status(401)
                .json({ success: false, message: "Invalid or expired token" });
        }
    }
}
exports.AuthController = AuthController;
function generateOTP(length) {
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}
async function socialAuthCallback(req, res) {
    try {
        const { user, accessToken, refreshToken } = req.body;
        // Handle the returned user and tokens
        res.json({ success: true, user, accessToken, refreshToken });
        console.log("🔑 Social auth callback successful:", user, accessToken, refreshToken);
    }
    catch (error) {
        logger_1.logger.error("Social auth callback error:", error);
        res.status(400).json({
            statusCode: 200, // Successful response
            success: false,
            message: error instanceof Error
                ? error.message
                : "Failed to authenticate with social provider",
        });
    }
}
