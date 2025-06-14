"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_service_1 = require("../services/auth.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authMiddleware_1 = require("../middleware/authMiddleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
const email_service_1 = __importDefault(require("../services/email.service"));
const whatsapp_service_1 = __importDefault(require("../services/whatsapp.service"));
const User_1 = require("../models/User");
// Import the TypeScript version of the controller
const auth_update_controller_1 = require("../controllers/auth.update.controller");
// Import fraud detection middleware
const fraudDetection_middleware_1 = require("../middleware/fraudDetection.middleware");
const router = express_1.default.Router();
// API Documentation endpoint
router.get("/", (req, res) => {
    res.sendFile("api-docs.html", { root: "public" });
});
// Health check endpoint
router.get("/healthcheck", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
// Verify authentication status
router.get("/verify", authMiddleware_1.authenticateToken, (req, res) => {
    // If we get here, the user is authenticated
    const user = req.user;
    res.status(200).json({
        success: true,
        isAuthenticated: true,
        user: {
            _id: user._id,
            email: user.email,
            role: user.role || (user._doc ? user._doc.role : null),
            isAdmin: user.role === 'admin' || (user._doc && user._doc.role === 'admin')
        }
    });
});
//Rate limiting configuration
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 240 * 60 * 1000, // 15 minutes: @Brilydal123 TODO: Change this to 15 minutes later
    max: 50, // Limit each IP to 5 requests per windowMs, @Brilydal123 TODO: Change this to 5 later
    message: "Too many attempts from this IP, please try again after 15 minutes",
});
router.use("/login", authLimiter);
router.use("/forgot-password", authLimiter);
router.use("/reset-password", authLimiter);
// Enhanced registration rate limiting for fraud prevention
const registrationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 registration attempts per hour
    message: {
        success: false,
        error: {
            code: 'REGISTRATION_RATE_LIMIT',
            message: 'Too many registration attempts from this IP. Please try again after 1 hour.',
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Auth routes with STRICT fraud detection - ONE ACCOUNT PER DEVICE
router.post("/register", registrationLimiter, (0, fraudDetection_middleware_1.deviceFingerprintMiddleware)(), (0, fraudDetection_middleware_1.fraudDetectionMiddleware)({
    blockOnCritical: true,
    requireVerificationOnHigh: true,
    logAllAttempts: true,
    customThresholds: {
        block: 100, // Block immediately if device already registered (score = 100)
        flag: 80, // Flag if risk score >= 80
        verify: 60, // Require verification if risk score >= 60
    }
}), (0, fraudDetection_middleware_1.suspiciousActivityLogger)(), auth_controller_1.AuthController.register);
router.post("/login", (0, fraudDetection_middleware_1.deviceFingerprintMiddleware)(), (0, fraudDetection_middleware_1.suspiciousActivityLogger)(), auth_controller_1.AuthController.login);
router.post("/refresh-token", auth_controller_1.AuthController.refreshToken);
router.post("/logout", authMiddleware_1.authenticateToken, auth_controller_1.AuthController.logout);
router.post("/logout-all", authMiddleware_1.authenticateToken, auth_controller_1.AuthController.logoutAll);
router.post("/logout-all-sessions", auth_controller_1.AuthController.logoutAllSessions);
router.post("/trouble-login", auth_controller_1.AuthController.troubleLogin);
router.get("/sessions", authMiddleware_1.authenticateToken, auth_controller_1.AuthController.getSessions);
router.post("/forgot-password", auth_controller_1.AuthController.forgotPassword);
router.post("/reset-password", auth_controller_1.AuthController.resetPassword);
// Remove the broken reference to AuthController.verifyToken and implement /verify here
router.post("/verify", auth_controller_1.AuthController.verifyToken);
// User validation endpoints
router.get("/check-email/:email", auth_controller_1.AuthController.checkEmail);
router.get("/check-username/:username", auth_controller_1.AuthController.checkUsername);
// Get current user info
router.get("/user/me", authMiddleware_1.authenticateToken, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    // Return sanitized user object
    const user = req.user;
    const sanitizedUser = {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        profileImage: user.profileImage,
        isEmailVerified: user.isEmailVerified,
        signupType: user.signupType,
        googleId: user.googleId,
        facebookId: user.facebookId,
        linkedinId: user.linkedinId
    };
    res.json({ success: true, user: sanitizedUser });
});
// Get user info from token
router.get("/user/info", (req, res) => {
    var _a;
    try {
        // Extract token from Authorization header
        const token = (_a = req.header('Authorization')) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        // Verify the token using require instead of import
        const jsonwebtoken = require('jsonwebtoken');
        const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        // Find the user
        User_1.User.findById(decoded.userId)
            .then(user => {
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            // Return user data
            res.json({
                success: true,
                user: {
                    id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    username: user.username,
                    googleId: user.googleId,
                    facebookId: user.facebookId,
                    linkedinId: user.linkedinId,
                    signupType: user.signupType,
                    isEmailVerified: user.isEmailVerified,
                    profileImage: user.profileImage,
                    phoneNumber: user.phoneNumber,
                    countryOfResidence: user.countryOfResidence,
                    dateOfBirth: user.dateOfBirth,
                    isProfileComplete: user.isProfileComplete
                }
            });
        })
            .catch(err => {
            console.error('Error finding user:', err);
            res.status(500).json({ success: false, message: 'Server error' });
        });
    }
    catch (err) {
        console.error('Token verification error:', err);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});
// Unified OTP verification route
router.post("/verify-otp", auth_controller_1.AuthController.verifyOTP);
router.post("/resend-otp", auth_controller_1.AuthController.resendOTP);
router.post("/select-otp-method", auth_controller_1.AuthController.selectOTPMethod);
// Change identifier endpoint (requires authentication)
router.post("/change-identifier", auth_controller_1.AuthController.changeIdentifier);
// Email verification
router.post("/verify-email", auth_controller_1.AuthController.verifyEmail);
router.post("/resend-verification", auth_controller_1.AuthController.resendVerification);
router.post("/resend-verification-email", auth_middleware_1.protect, auth_controller_1.AuthController.resendVerification);
// Test routes (remove in production)
router.post("/test-email", async (req, res) => {
    try {
        const testEmail = req.body.email || "bezingal@gmail.com";
        const testToken = "123456"; // Test verification code
        await email_service_1.default.sendVerificationEmail(testEmail, testToken);
        res.json({ success: true, message: "Test email sent successfully" });
    }
    catch (error) {
        logger_1.logger.error("Test email error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send test email",
            error: error.message,
        });
    }
});
router.post("/test-whatsapp", async (req, res) => {
    try {
        const testPhone = req.body.phoneNumber || "+237693028598";
        const testCode = "123456"; // Test verification code
        await whatsapp_service_1.default.sendOTPMessage(testPhone, testCode);
        res.json({
            success: true,
            message: "Test WhatsApp message sent successfully",
            details: {
                phoneNumber: testPhone,
                code: testCode,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Test WhatsApp error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send test WhatsApp message",
            error: error.message,
        });
    }
});
// Two-factor authentication
router.post("/2fa/generate", auth_middleware_1.protect, auth_controller_1.AuthController.generate2FA);
router.post("/2fa/verify", auth_middleware_1.protect, auth_controller_1.AuthController.verify2FA);
router.post("/2fa/disable", auth_middleware_1.protect, auth_controller_1.AuthController.disable2FA);
router.post("/2fa/validate", auth_controller_1.AuthController.validate2FA);
// User management routes
router.get("/user/:id", async (req, res) => {
    try {
        // Add debug logging
        console.log('Received request for user:', req.params.id);
        console.log('Authorization header:', req.headers.authorization);
        const user = await auth_service_1.AuthService.getUser(req.params.id);
        // Ensure we're returning the expected fields
        const sanitizedUser = {
            _id: user._id,
            email: user.email,
            username: user.username || user.email.split('@')[0],
            profileImage: user.profileImage
        };
        console.log('Returning user data:', sanitizedUser);
        res.status(200).json({
            success: true,
            user: sanitizedUser
        });
    }
    catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get user.",
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put("/user/:id", async (req, res) => {
    try {
        const updatedUser = await auth_service_1.AuthService.updateUser(req.params.id, req.body);
        res.status(200).json({ success: true, user: updatedUser });
    }
    catch (error) {
        logger_1.logger.error("Update user error:", error);
        res.status(500).json({ success: false, message: "Failed to update user." });
    }
});
router.delete("/user/:id", async (req, res) => {
    try {
        await auth_service_1.AuthService.deleteUser(req.params.id);
        res
            .status(200)
            .json({ success: true, message: "User deleted successfully." });
    }
    catch (error) {
        logger_1.logger.error("Delete user error:", error);
        res.status(500).json({ success: false, message: "Failed to delete user." });
    }
});
// Social authentication routes
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', (0, fraudDetection_middleware_1.deviceFingerprintMiddleware)(), (0, fraudDetection_middleware_1.fraudDetectionMiddleware)({
    blockOnCritical: true,
    requireVerificationOnHigh: false, // Social auth users are already verified by provider
    logAllAttempts: true,
    customThresholds: {
        block: 100, // Block immediately if device already registered (score = 100)
        flag: 80, // Flag if risk score >= 80
        verify: 60, // Require verification if risk score >= 60
    }
}), (0, fraudDetection_middleware_1.suspiciousActivityLogger)(), passport_1.default.authenticate('google', { session: false }), async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    const data = req.user;
    if (!data) {
        return res.redirect('/auth/login?error=google_auth_failed');
    }
    // Check if fraud detection blocked the request
    if (req.fraudDetection && req.fraudDetection.shouldBlock) {
        logger_1.logger.warn('Google OAuth blocked due to fraud detection', {
            email: (_a = data.user) === null || _a === void 0 ? void 0 : _a.email,
            riskScore: req.fraudDetection.riskScore,
            flags: req.fraudDetection.flags,
        });
        // Get frontend URL from environment or default
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const blockedUrl = `${frontendUrl}/auth/blocked?provider=google&reason=fraud_detection&riskScore=${req.fraudDetection.riskScore}&flags=${req.fraudDetection.flags.join(',')}`;
        logger_1.logger.info('Redirecting blocked Google OAuth to frontend', { blockedUrl });
        return res.redirect(blockedUrl);
    }
    // Link user to device fingerprint after successful authentication
    if (((_b = req.deviceFingerprint) === null || _b === void 0 ? void 0 : _b.fingerprint) && ((_c = data.user) === null || _c === void 0 ? void 0 : _c._id)) {
        try {
            const { FraudDetectionService } = require('../services/fraudDetection.service');
            await FraudDetectionService.linkUserToDevice(req.deviceFingerprint.fingerprint, data.user._id.toString(), data.user.email);
            logger_1.logger.info('✅ Google OAuth user successfully linked to device fingerprint', {
                userId: data.user._id,
                email: data.user.email,
                fingerprint: req.deviceFingerprint.fingerprint.substring(0, 8) + '...',
            });
        }
        catch (linkError) {
            logger_1.logger.error('❌ Failed to link Google OAuth user to device fingerprint:', linkError);
            // Don't fail authentication if linking fails, but log it
        }
    }
    else {
        logger_1.logger.warn('⚠️ Cannot link Google OAuth user to device - missing data', {
            hasDeviceFingerprint: !!req.deviceFingerprint,
            hasFingerprint: !!((_d = req.deviceFingerprint) === null || _d === void 0 ? void 0 : _d.fingerprint),
            hasUserId: !!((_e = data.user) === null || _e === void 0 ? void 0 : _e._id),
            hasUserEmail: !!((_f = data.user) === null || _f === void 0 ? void 0 : _f.email),
        });
    }
    // Set tokens in cookies
    res.cookie('accessToken', data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000, // 1 hour
    });
    res.cookie('refreshToken', data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Redirect to frontend with success
    res.redirect(`/socials?success=true&provider=google`);
});
router.get('/facebook', passport_1.default.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', (0, fraudDetection_middleware_1.deviceFingerprintMiddleware)(), (0, fraudDetection_middleware_1.fraudDetectionMiddleware)({
    blockOnCritical: true,
    requireVerificationOnHigh: false, // Social auth users are already verified by provider
    logAllAttempts: true,
    customThresholds: {
        block: 100, // Block immediately if device already registered (score = 100)
        flag: 80, // Flag if risk score >= 80
        verify: 60, // Require verification if risk score >= 60
    }
}), (0, fraudDetection_middleware_1.suspiciousActivityLogger)(), passport_1.default.authenticate('facebook', { session: false }), async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    const data = req.user;
    if (!data) {
        return res.redirect('/auth/login?error=facebook_auth_failed');
    }
    // Check if fraud detection blocked the request
    if (req.fraudDetection && req.fraudDetection.shouldBlock) {
        logger_1.logger.warn('Facebook OAuth blocked due to fraud detection', {
            email: (_a = data.user) === null || _a === void 0 ? void 0 : _a.email,
            riskScore: req.fraudDetection.riskScore,
            flags: req.fraudDetection.flags,
        });
        // Get frontend URL from environment or default
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const blockedUrl = `${frontendUrl}/auth/blocked?provider=facebook&reason=fraud_detection&riskScore=${req.fraudDetection.riskScore}&flags=${req.fraudDetection.flags.join(',')}`;
        logger_1.logger.info('Redirecting blocked Facebook OAuth to frontend', { blockedUrl });
        return res.redirect(blockedUrl);
    }
    // Link user to device fingerprint after successful authentication
    if (((_b = req.deviceFingerprint) === null || _b === void 0 ? void 0 : _b.fingerprint) && ((_c = data.user) === null || _c === void 0 ? void 0 : _c._id)) {
        try {
            const { FraudDetectionService } = require('../services/fraudDetection.service');
            await FraudDetectionService.linkUserToDevice(req.deviceFingerprint.fingerprint, data.user._id.toString(), data.user.email);
            logger_1.logger.info('✅ Facebook OAuth user successfully linked to device fingerprint', {
                userId: data.user._id,
                email: data.user.email,
                fingerprint: req.deviceFingerprint.fingerprint.substring(0, 8) + '...',
            });
        }
        catch (linkError) {
            logger_1.logger.error('❌ Failed to link Facebook OAuth user to device fingerprint:', linkError);
            // Don't fail authentication if linking fails, but log it
        }
    }
    else {
        logger_1.logger.warn('⚠️ Cannot link Facebook OAuth user to device - missing data', {
            hasDeviceFingerprint: !!req.deviceFingerprint,
            hasFingerprint: !!((_d = req.deviceFingerprint) === null || _d === void 0 ? void 0 : _d.fingerprint),
            hasUserId: !!((_e = data.user) === null || _e === void 0 ? void 0 : _e._id),
            hasUserEmail: !!((_f = data.user) === null || _f === void 0 ? void 0 : _f.email),
        });
    }
    // Set tokens in cookies
    res.cookie('accessToken', data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000, // 1 hour
    });
    res.cookie('refreshToken', data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Redirect to frontend with success
    res.redirect(`/socials?success=true&provider=facebook`);
});
router.get('/linkedin', passport_1.default.authenticate('linkedin', { scope: ['r_emailaddress', 'r_liteprofile'] }));
router.get('/linkedin/callback', (0, fraudDetection_middleware_1.deviceFingerprintMiddleware)(), (0, fraudDetection_middleware_1.fraudDetectionMiddleware)({
    blockOnCritical: true,
    requireVerificationOnHigh: false, // Social auth users are already verified by provider
    logAllAttempts: true,
    customThresholds: {
        block: 100, // Block immediately if device already registered (score = 100)
        flag: 80, // Flag if risk score >= 80
        verify: 60, // Require verification if risk score >= 60
    }
}), (0, fraudDetection_middleware_1.suspiciousActivityLogger)(), passport_1.default.authenticate('linkedin', { session: false }), async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    const data = req.user;
    if (!data) {
        return res.redirect('/auth/login?error=linkedin_auth_failed');
    }
    // Check if fraud detection blocked the request
    if (req.fraudDetection && req.fraudDetection.shouldBlock) {
        logger_1.logger.warn('LinkedIn OAuth blocked due to fraud detection', {
            email: (_a = data.user) === null || _a === void 0 ? void 0 : _a.email,
            riskScore: req.fraudDetection.riskScore,
            flags: req.fraudDetection.flags,
        });
        return res.redirect('/auth/blocked?provider=linkedin&reason=fraud_detection');
    }
    // Link user to device fingerprint after successful authentication
    if (((_b = req.deviceFingerprint) === null || _b === void 0 ? void 0 : _b.fingerprint) && ((_c = data.user) === null || _c === void 0 ? void 0 : _c._id)) {
        try {
            const { FraudDetectionService } = require('../services/fraudDetection.service');
            await FraudDetectionService.linkUserToDevice(req.deviceFingerprint.fingerprint, data.user._id.toString(), data.user.email);
            logger_1.logger.info('✅ LinkedIn OAuth user successfully linked to device fingerprint', {
                userId: data.user._id,
                email: data.user.email,
                fingerprint: req.deviceFingerprint.fingerprint.substring(0, 8) + '...',
            });
        }
        catch (linkError) {
            logger_1.logger.error('❌ Failed to link LinkedIn OAuth user to device fingerprint:', linkError);
            // Don't fail authentication if linking fails, but log it
        }
    }
    else {
        logger_1.logger.warn('⚠️ Cannot link LinkedIn OAuth user to device - missing data', {
            hasDeviceFingerprint: !!req.deviceFingerprint,
            hasFingerprint: !!((_d = req.deviceFingerprint) === null || _d === void 0 ? void 0 : _d.fingerprint),
            hasUserId: !!((_e = data.user) === null || _e === void 0 ? void 0 : _e._id),
            hasUserEmail: !!((_f = data.user) === null || _f === void 0 ? void 0 : _f.email),
        });
    }
    // Set tokens in cookies
    res.cookie('accessToken', data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000, // 1 hour
    });
    res.cookie('refreshToken', data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Redirect to frontend with success
    res.redirect(`/socials?success=true&provider=linkedin`);
});
// Mobile OAuth endpoints
router.post('/google/mobile', (0, fraudDetection_middleware_1.deviceFingerprintMiddleware)(), (0, fraudDetection_middleware_1.fraudDetectionMiddleware)({
    blockOnCritical: true,
    requireVerificationOnHigh: false, // Social auth users are already verified by provider
    logAllAttempts: true,
    customThresholds: {
        block: 100, // Block immediately if device already registered (score = 100)
        flag: 80, // Flag if risk score >= 80
        verify: 60, // Require verification if risk score >= 60
    }
}), (0, fraudDetection_middleware_1.suspiciousActivityLogger)(), async (req, res) => {
    var _a, _b, _c;
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required' });
        }
        // Use the OAuth2Client to verify the token
        const { OAuth2Client } = require('google-auth-library');
        const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) {
            return res.status(401).json({ error: 'Invalid ID token' });
        }
        // Check if fraud detection blocked the request
        if (req.fraudDetection && req.fraudDetection.shouldBlock) {
            logger_1.logger.warn('Google Mobile OAuth blocked due to fraud detection', {
                email: payload.email,
                riskScore: req.fraudDetection.riskScore,
                flags: req.fraudDetection.flags,
            });
            return res.status(403).json({
                success: false,
                error: {
                    code: 'DEVICE_ALREADY_REGISTERED',
                    message: 'This device is not eligible for registration. Only one account per device is allowed.',
                    riskScore: req.fraudDetection.riskScore,
                    flags: req.fraudDetection.flags,
                    deviceBlocked: true,
                    requiresManualReview: true,
                },
            });
        }
        // Find or create user
        let user = await User_1.User.findOne({ googleId: payload.sub });
        if (!user) {
            user = await User_1.User.findOne({ email: payload.email });
            if (user) {
                // Link Google account to existing user
                user.googleId = payload.sub;
                user.signupType = 'google';
                user.isEmailVerified = true;
                await user.save();
            }
            else {
                // Create new user
                user = new User_1.User({
                    googleId: payload.sub,
                    email: payload.email,
                    fullName: payload.name,
                    username: (_a = payload.email) === null || _a === void 0 ? void 0 : _a.split('@')[0],
                    signupType: 'google',
                    isEmailVerified: true,
                    password: 'oauth2-user-no-password',
                    // Set dateOfBirth to undefined to avoid validation errors
                    // They will be collected in the complete-profile page
                    dateOfBirth: undefined,
                    countryOfResidence: undefined,
                    accountType: 'MYSELF',
                    accountCategory: 'PRIMARY_ACCOUNT',
                    verificationMethod: 'EMAIL',
                    profileImage: payload.picture,
                    refreshTokens: [],
                });
                await user.save();
                // Create a default profile for new users
                try {
                    const { ProfileService } = require('../services/profile.service');
                    const profileService = new ProfileService();
                    await profileService.createDefaultProfile(user._id.toString());
                    logger_1.logger.info(`Default profile created for new Google user ${user._id}`);
                }
                catch (profileError) {
                    logger_1.logger.error(`Error creating default profile for Google user ${user._id}:`, profileError);
                }
            }
        }
        // Link user to device fingerprint after successful authentication
        if (((_b = req.deviceFingerprint) === null || _b === void 0 ? void 0 : _b.fingerprint) && (user === null || user === void 0 ? void 0 : user._id)) {
            try {
                const { FraudDetectionService } = require('../services/fraudDetection.service');
                await FraudDetectionService.linkUserToDevice(req.deviceFingerprint.fingerprint, user._id.toString(), user.email);
                logger_1.logger.info('✅ Google Mobile OAuth user successfully linked to device fingerprint', {
                    userId: user._id,
                    email: user.email,
                    fingerprint: req.deviceFingerprint.fingerprint.substring(0, 8) + '...',
                });
            }
            catch (linkError) {
                logger_1.logger.error('❌ Failed to link Google Mobile OAuth user to device fingerprint:', linkError);
                // Don't fail authentication if linking fails, but log it
            }
        }
        else {
            logger_1.logger.warn('⚠️ Cannot link Google Mobile OAuth user to device - missing data', {
                hasDeviceFingerprint: !!req.deviceFingerprint,
                hasFingerprint: !!((_c = req.deviceFingerprint) === null || _c === void 0 ? void 0 : _c.fingerprint),
                hasUserId: !!(user === null || user === void 0 ? void 0 : user._id),
                hasUserEmail: !!(user === null || user === void 0 ? void 0 : user.email),
            });
        }
        // Generate tokens
        const { generateTokens } = require('../config/passport');
        const { accessToken, refreshToken } = generateTokens(user.id.toString(), user.email);
        // Store refresh token
        user.refreshTokens.push(refreshToken);
        await user.save();
        res.json({ accessToken, refreshToken, user });
    }
    catch (err) {
        logger_1.logger.error('Google Mobile authentication failed:', err);
        res.status(401).json({ error: 'Google authentication failed', message: err.message });
    }
});
// Change user information routes (after verification)
router.post("/change-email", auth_controller_1.AuthController.changeEmail);
router.post("/change-phone", auth_controller_1.AuthController.changePhoneNumber);
router.post("/change-username", auth_controller_1.AuthController.changeUsername);
// Update profile information
router.post("/update-profile", authMiddleware_1.authenticateToken, auth_update_controller_1.AuthUpdateController.updateProfile);
// Public endpoint to clear all user sessions by email (for emergency use)
router.post("/public/clear-sessions", auth_controller_1.AuthController.clearSessionsByEmail);
exports.default = router;
