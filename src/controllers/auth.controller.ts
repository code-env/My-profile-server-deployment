import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger";
import { CustomError } from "../utils/errors";
import { User } from "../models/User";
import EmailService from "../services/email.service";
import { randomBytes } from "crypto";
import { config } from "../config/config";
import TwoFactorService from "../services/twoFactor.service";
import {
  registerSchema,
  loginSchema,
  otpVerificationSchema,
} from "../types/auth.types";
import WhatsAppService from "../services/whatsapp.service";
import { getRequestInfo } from "../utils/requestInfo";


// Define a User type with the required properties
interface User {
  id: string;
  email: string;
  fullName: string;
  username: string;
}

// Extend the Express Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export class AuthController {
  /**
   * Register a new user
   * @route POST /auth/register
   */
  static async register(req: Request, res: Response) {
    try {
      // Validate request body against schema
      const validatedData = await registerSchema.parseAsync(req.body);

      // Register user using auth service
      const user: any = {
        email: validatedData.email,
        password: validatedData.password,
        fullName: validatedData.fullName,
        username: validatedData.username,
        dateOfBirth: validatedData.dateOfBirth,
        countryOfResidence: validatedData.countryOfResidence,
        phoneNumber: validatedData.phoneNumber,
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
      // Get request info for security tracking
      const { ip, os } = getRequestInfo(req);
      console.log("🔐 Registration request from:", ip, os);

      const result: any = await AuthService.register(user, ip, os);

      res.status(201).json({
        success: true,
        message: "Registration successful. Please verify your email.",
        userId: result.user._id,
        verificationMethod: validatedData.verificationMethod,
        otpRequired: true,
        otpChannel: validatedData.verificationMethod.toLowerCase(),
      });
    } catch (error) {
      logger.error("Registration error:", error);
      res
        .status(error instanceof CustomError ? (error.statusCode ?? 400) : 400)
        .json({
          success: false,
          message:
            error instanceof Error ? error.message : "Registration failed",
        });
    }
  }

  /**
   * Login user
   * @route POST /auth/login
   */
  static async login(req: Request, res: Response) {
    try {
      const validatedData = await loginSchema.parseAsync(req.body);
      const result = await AuthService.login(validatedData, req);

      // Set tokens in HTTP-only cookies
      if (result.tokens) {
        console.log("🍪 Setting auth cookies...");
        res.cookie("accesstoken", result.tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie("refreshtoken", result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        console.log("✅ Auth cookies set successfully");
      }

      res.json(result);
    } catch (error) {
      logger.error("Login error:", error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Login failed",
      });
    }
  }

  /**
   * Get active sessions
   * @route GET /auth/sessions
   */
  static async getSessions(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const sessions = await AuthService.getUserSessions(user._id);
      res.json({ success: true, sessions });
    } catch (error) {
      logger.error("Get sessions error:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to get sessions",
      });
    }
  }

  /**
   * Logout from all sessions
   * @route POST /auth/logout-all
   */
  static async logoutAll(req: Request, res: Response) {
    try {
      const user: any = req.user;
      await AuthService.logout(user._id, ""); // Pass empty refresh token to clear all tokens

      // Clear auth cookies
      console.log("🗑️  Clearing auth cookies for all sessions...");
      res.clearCookie("accesstoken");
      res.clearCookie("refreshtoken");
      console.log("✅ Auth cookies cleared successfully for all sessions");

      res.json({ success: true, message: "Logged out from all sessions" });
    } catch (error) {
      logger.error("Logout all error:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to logout from all sessions",
      });
    }
  }

  /**
   * Verify OTP
   * @route POST /auth/verify-otp
   */
  static async verifyOTP(req: Request, res: Response) {
    try {
      const { _id, otp, verificationMethod } = req.body;

      if (!_id || !otp || !verificationMethod) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: _id, otp, or verificationMethod",
        });
      }

      // Call the verifyOTP method
      const result = await AuthService.verifyOTPResponse(
        _id,
        otp,
        verificationMethod.toLowerCase()
      );

      if (result.success) {
        // Generate tokens only after successful verification
        const tokens = AuthService.generateTokens(result.user!.email, _id);

        // Set cookies
        res.cookie("accesstoken", tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie("refreshtoken", tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.json({
          success: true,
          message: "OTP verified successfully",
          user: result.user,
          tokens,
        });
      }

      return res.status(400).json({
        success: false,
        message: result.message || "Invalid OTP",
      });
    } catch (error) {
      logger.error("OTP verification error:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to verify OTP",
      });
    }
  }

  /**
   * Refresh access token
   * @route POST /auth/refresh-token
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies.refreshtoken || req.body.refreshToken;

      if (!refreshToken) {
        throw new CustomError("MISSING_TOKEN", "Refresh token is required");
      }

      const tokens = await AuthService.refreshAccessToken(refreshToken);

      // Set both cookies with the new tokens
      console.log("🔄 Rotating refresh token and setting new cookies...");
      res.cookie("accesstoken", tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie("refreshtoken", tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      console.log("✅ Token rotation completed successfully");

      // Send response
      res.json({ success: true, message: "Tokens refreshed successfully" });
    } catch (error) {
      logger.error("Token refresh error:", error);
      res.status(401).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Token refresh failed",
      });
    }
  }

  /**
   * Logout user
   * @route POST /auth/logout
   */
  static async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const user: any = req.user;

      await AuthService.logout(user._id, refreshToken);

      // Clear auth cookies
      console.log("🗑️  Clearing auth cookies...");
      res.clearCookie("accesstoken");
      res.clearCookie("refreshtoken");
      console.log("✅ Auth cookies cleared successfully");

      res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      logger.error("Logout error:", error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Logout failed",
      });
    }
  }

  /**
   * Request password reset
   * @route POST /auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new CustomError("MISSING_EMAIL", "Email is required");
      }

      const resetToken = randomBytes(32).toString("hex");
      await AuthService.setResetToken(email, resetToken);

      // Get request info for security tracking
      const { ip, os } = getRequestInfo(req);

      // Send reset email
      const resetUrl = `${config.CLIENT_URL}/reset-password?token=${resetToken}`;
      await EmailService.sendPasswordResetEmail(email, resetToken, { ipAddress: ip, userAgent: os });

      res.json({
        success: true,
        message: "Password reset instructions sent to your email",
      });
    } catch (error) {
      logger.error("Forgot password error:", error);
      // Use vague message for security
      res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, password reset instructions have been sent",
      });
    }
  }

  /**
   * Reset password with token
   * @route POST /auth/reset-password
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        throw new CustomError(
          "MISSING_FIELDS",
          "Token and password are required"
        );
      }

      await AuthService.resetPassword(token, password);
      res.json({
        success: true,
        message: "Password reset successful",
      });
    } catch (error) {
      logger.error("Reset password error:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Password reset failed",
      });
    }
  }

  /**
   * Resend verification email
   * @route POST /auth/resend-verification
   */
  static async resendVerification(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new CustomError("MISSING_EMAIL", "Email is required");
      }

      // Get request info for security tracking
      const { ip, os } = getRequestInfo(req);

      // Logic to resend verification email
      const result = await AuthService.resendVerification(email);
      res.json({
        success: true,
        message: "Verification email resent successfully",
      });
    } catch (error) {
      logger.error("Resend verification error:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to resend verification email",
      });
    }
  }

  /**
   * Verify user email
   * @route POST /auth/verify-email
   */
  static async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required"
        });
      }

      // Get request info for security tracking
      const { ip, os } = getRequestInfo(req);

      // First find user by verification token
      const user:any = await User.findOne({ 'verificationData.token': token });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification token"
        });
      }

      // Validate the token using AuthService
      const result = await AuthService.verifyEmail(token);

      if (result.success) {
        // Generate tokens
        const tokens = await AuthService.generateTokens(user.email, user._id);

        // Set access token cookie
        res.cookie("accesstoken", tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 15 * 60 * 1000, // 15 minutes
        });

        // Send success response
        return res.status(200).json({
          success: true,
          message: "Email verified successfully"
        });
      }

      return res.status(400).json({
        success: false,
        message: result.message || "Email verification failed"
      });
    } catch (error) {
      logger.error("Email verification error:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred during email verification"
      });
    }
  }

  /**
   * Generate 2FA secret
   * @route POST /auth/generate-2fa
   */
  static async generate2FA(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const user = req.user as any;
      const userId = user._id;

      // Generate 2FA secret
      const secretData = await TwoFactorService.generateSecret(userId);

      // Get request info for security tracking
      const { ip, os } = getRequestInfo(req);

      // Send 2FA code via email with security info
      await EmailService.sendTwoFactorAuthEmail(user.email, secretData.secret, { ipAddress: ip, userAgent: os });

      res.status(200).json({
        message: "2FA code sent successfully",
        qrCode: secretData.qrCode
      });
    } catch (error) {
      logger.error("Error generating 2FA:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }

  /**
   * Verify 2FA code
   * @route POST /auth/verify-2fa
   */
  static async verify2FA(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const { code } = req.body;
      const user = req.user as any;
      const userId = user._id; // Assuming user is authenticated
      const isValid = await TwoFactorService.verifyToken(userId, code);
      if (isValid) {
        res.status(200).json({ message: "2FA code verified successfully" });
      } else {
        res.status(400).json({ message: "Invalid 2FA code" });
      }
    } catch (error) {
      logger.error("Error verifying 2FA:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }

  /**
   * Disable 2FA
   * @route POST /auth/disable-2fa
   */
  static async disable2FA(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const user = req.user as any;
      const userId = user._id; // Assuming user is authenticated
      await TwoFactorService.disable(userId);
      res.status(200).json({ message: "2FA disabled successfully" });
    } catch (error) {
      logger.error("Error disabling 2FA:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }

  /**
   * Validate 2FA code
   * @route POST /auth/validate-2fa
   */
  static async validate2FA(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const { code } = req.body;
      const user = req.user as any;
      const userId = user._id; // Assuming user is authenticated

      const isValid = await TwoFactorService.verifyToken(userId, code);
      if (isValid) {
        res.status(200).json({ message: "2FA code is valid" });
      } else {
        res.status(400).json({ message: "Invalid 2FA code" });
      }
    } catch (error) {
      logger.error("Error validating 2FA:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }

  /**
   * Resend OTP
   * @route POST /auth/resend-otp
   */
  static async resendOTP(req: Request, res: Response) {
    try {
      const { _id, verificationMethod } = req.body;

      if (!_id || !verificationMethod) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: _id or verificationMethod",
        });
      }

      // Find user
      const user = await User.findById(_id);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User not found",
        });
      }

      // Generate new OTP
      const otp = generateOTP(6);

      // Get request info for security tracking
      const { ip, os } = getRequestInfo(req);

      // Update user's verification data
      user.verificationData = {
        otp,
        otpExpiry: new Date(
          Date.now() + AuthService.OTP_EXPIRY_MINUTES * 60 * 1000
        ),
        attempts: 0,
        lastAttempt: new Date(),
      };

      await user.save();

      // Send OTP based on verification method
      if (verificationMethod.toLowerCase() === "email") {
        await EmailService.sendVerificationEmail(user.email, otp, { ipAddress: ip, userAgent: os });
        logger.info(`🟣 Registration OTP (Email): ${otp}`);
      } else if (
        verificationMethod.toLowerCase() === "phone" &&
        user.phoneNumber
      ) {
        await WhatsAppService.sendOTPMessage(user.phoneNumber, otp);
        logger.info(`🟣 Registration OTP (Phone): ${otp}`);
      }

      res.json({
        success: true,
        message: `OTP resent successfully via ${verificationMethod}`,
        userId: user._id,
      });
    } catch (error) {
      logger.error("Resend OTP error:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to resend OTP",
      });
    }
  }
}

function generateOTP(length: number) {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

export async function socialAuthCallback(req: Request, res: Response) {
  try {
    const { user, accessToken, refreshToken } = req.body;
    // Handle the returned user and tokens
    res.json({ success: true, user, accessToken, refreshToken });
    console.log(
      "🔑 Social auth callback successful:",
      user,
      accessToken,
      refreshToken
    );
  } catch (error) {
    logger.error("Social auth callback error:", error);
    res.status(400).json({
      statusCode: 200, // Successful response
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to authenticate with social provider",
    });
  }
}
