"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_service_1 = require("../services/auth.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authMiddleware_1 = require("../middleware/authMiddleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
const email_service_1 = __importDefault(require("../services/email.service"));
const whatsapp_service_1 = __importDefault(require("../services/whatsapp.service"));
const router = express_1.default.Router();
// API Documentation endpoint
router.get("/", (req, res) => {
    res.sendFile("api-docs.html", { root: "public" });
});
// Health check endpoint
router.get("/healthcheck", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
//Rate limiting configuration
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: "Too many attempts from this IP, please try again after 15 minutes",
});
router.use("/login", authLimiter);
router.use("/forgot-password", authLimiter);
router.use("/reset-password", authLimiter);
// Auth routes
router.post("/register", auth_controller_1.AuthController.register);
router.post("/login", auth_controller_1.AuthController.login);
router.post("/refresh-token", auth_controller_1.AuthController.refreshToken);
router.post("/logout", authMiddleware_1.authenticateToken, auth_controller_1.AuthController.logout);
router.post("/logout-all", authMiddleware_1.authenticateToken, auth_controller_1.AuthController.logoutAll);
router.get("/sessions", authMiddleware_1.authenticateToken, auth_controller_1.AuthController.getSessions);
router.post("/forgot-password", auth_controller_1.AuthController.forgotPassword);
router.post("/reset-password", auth_controller_1.AuthController.resetPassword);
// Unified OTP verification route
router.post("/verify-otp", auth_controller_1.AuthController.verifyOTP);
router.post("/resend-otp", auth_controller_1.AuthController.resendOTP);
// Email verification
router.post("/verify-email", auth_controller_1.AuthController.verifyEmail);
router.post("/resend-verification", auth_controller_1.AuthController.resendVerification);
router.post("/resend-verification-email", auth_middleware_1.protect, auth_controller_1.AuthController.resendVerification);
// Test routes (remove in production)
router.post("/test-email", async (req, res) => {
    try {
        const testEmail = req.body.email || "nebam0667@gmail.com";
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
        const user = await auth_service_1.AuthService.getUser(req.params.id);
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        logger_1.logger.error("Get user error:", error);
        res.status(500).json({ success: false, message: "Failed to get user." });
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
// Social authentication routes - temporarily disabled
// router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
// router.get(
//   '/google/callback',
//   passport.authenticate('google', { session: false }),
//   AuthController.socialAuthCallback()
// );
// router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
// router.get(
//   '/facebook/callback',
//   passport.authenticate('facebook', { session: false }),
//   AuthController.socialAuthCallback
// );
exports.default = router;
