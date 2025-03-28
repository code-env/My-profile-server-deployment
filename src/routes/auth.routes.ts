import express from "express";
import passport from "passport";
import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";
import { protect } from "../middleware/auth.middleware";
import { authenticateToken } from "../middleware/authMiddleware";
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger";
import EmailService from "../services/email.service";
import WhatsAppService from "../services/whatsapp.service";

const router = express.Router();

// API Documentation endpoint
router.get("/", (req, res) => {
  res.sendFile("api-docs.html", { root: "public" });
});

// Health check endpoint
router.get("/healthcheck", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

//Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 240 * 60 * 1000, // 15 minutes: @Brilydal123 TODO: Change this to 15 minutes later
  max: 50, // Limit each IP to 5 requests per windowMs, @Brilydal123 TODO: Change this to 5 later
  message: "Too many attempts from this IP, please try again after 15 minutes",
});

router.use("/login", authLimiter);
router.use("/forgot-password", authLimiter);
router.use("/reset-password", authLimiter);

// Auth routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", authenticateToken, AuthController.logout);
router.post("/logout-all", authenticateToken, AuthController.logoutAll);
router.post("/trouble-login", AuthController.troubleLogin);
router.get("/sessions", authenticateToken, AuthController.getSessions);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);


// User validation endpoints
router.get("/check-email/:email", AuthController.checkEmail);
router.get("/check-username/:username", AuthController.checkUsername);

// Unified OTP verification route
router.post("/verify-otp/", AuthController.verifyOTP);
router.post("/resend-otp/", AuthController.resendOTP);
router.post("/select-otp-method", AuthController.selectOTPMethod);

// Email verification
router.post("/verify-email", AuthController.verifyEmail);
router.post("/resend-verification", AuthController.resendVerification);
router.post(
  "/resend-verification-email",
  protect,
  AuthController.resendVerification
);

// Test routes (remove in production)
router.post("/test-email", async (req, res) => {
  try {
    const testEmail = req.body.email || "nebam0667@gmail.com";
    const testToken = "123456"; // Test verification code
    await EmailService.sendVerificationEmail(testEmail, testToken);
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error: any) {
    logger.error("Test email error:", error);
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

    await WhatsAppService.sendOTPMessage(testPhone, testCode);

    res.json({
      success: true,
      message: "Test WhatsApp message sent successfully",
      details: {
        phoneNumber: testPhone,
        code: testCode,
      },
    });
  } catch (error: any) {
    logger.error("Test WhatsApp error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test WhatsApp message",
      error: error.message,
    });
  }
});

// Two-factor authentication
router.post("/2fa/generate", protect, AuthController.generate2FA);
router.post("/2fa/verify", protect, AuthController.verify2FA);
router.post("/2fa/disable", protect, AuthController.disable2FA);
router.post("/2fa/validate", AuthController.validate2FA);

// User management routes
router.get("/user/:id", async (req, res) => {
  try {
    const user = await AuthService.getUser(req.params.id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    logger.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Failed to get user." });
  }
});

router.put("/user/:id", async (req, res) => {
  try {
    const updatedUser = await AuthService.updateUser(req.params.id, req.body);
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    logger.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Failed to update user." });
  }
});

router.delete("/user/:id", async (req, res) => {
  try {
    await AuthService.deleteUser(req.params.id);
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    logger.error("Delete user error:", error);
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

export default router;
