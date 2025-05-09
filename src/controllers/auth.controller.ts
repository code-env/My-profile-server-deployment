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

import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { logger } from "../utils/logger";
import { CustomError } from "../utils/errors";
import { User } from "../models/User"; // Added User import
import EmailService from "../services/email.service";
import { randomBytes } from "crypto";
import { config } from "../config/config";
import TwoFactorService from "../services/twoFactor.service";
import { registerSchema, loginSchema } from "../types/auth.types";
import WhatsAppService from "../services/whatsapp.service";
import TwilioService from "../services/twilio.service";
import UAParser from "ua-parser-js"; // Default import

// Implemented getClientInfo using ua-parser-js
async function getClientInfo(req: Request): Promise<{
  ip: string;
  device?: string;
  browser?: string;
  os?: string;
  platform?: string;
  userAgent: string;
}> {
  const uaString = req.headers["user-agent"] || "";
  // @ts-ignore - Temporarily ignoring due to persistent type issues with ua-parser-js
  const parser = new UAParser(uaString);
  const result = parser.getResult();

  // Attempt to get IP address
  // Prioritize 'x-forwarded-for' if behind a proxy, then req.ip, then req.socket.remoteAddress
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",").shift()?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
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
 * Core user interface defining essential user properties.
 * Used throughout the authentication flow for type safety and
 * data consistency.
 *
 * @interface User
 * @property {string} id - Unique user identifier
 * @property {string} email - User's email address
 * @property {string} fullName - User's full name
 * @property {string} username - User's chosen username
 *
 * Usage:
 * ```typescript
 * const user: User = {
 *   id: '123',
 *   email: 'user@example.com',
 *   fullName: 'John Doe',
 *   username: 'johndoe'
 * };
 * ```
 */
interface User {
  id: string;
  email: string;
  fullName: string;
  username: string;
}

/**
 * Extends Express Request to include authenticated user data.
 * This modification enables TypeScript to recognize the user object
 * that gets attached to requests by authentication middleware.
 *
 * @namespace Express
 * @interface Request
 * @property {User} [user] - Authenticated user data
 *
 * Usage:
 * ```typescript
 * app.get('/profile', (req: Request, res: Response) => {
 *   const user = req.user; // TypeScript knows this exists
 * });
 * ```
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
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
      const plainPhoneNumber = validatedData.phoneNumber.replace(/[^+\d]/g, "");

      const user: any = {
        email: validatedData.email,
        password: validatedData.password,
        fullName: validatedData.fullName,
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
      const clientInfo: any = await getClientInfo(req);
      console.log(
        "🔐 Registration request from:",
        clientInfo.ip,
        clientInfo.os
      );

      // Check if referral code was provided
      const referralCode = validatedData.referralCode || undefined;

      const result: any = await AuthService.register(
        user,
        clientInfo.ip,
        clientInfo.os,
        referralCode
      );

      // Return the response
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
  static async login(req: Request, res: Response) {
    try {
      const validatedData = await loginSchema.parseAsync(req.body);
      const { identifier, password } = validatedData;

      const result = await AuthService.login({ identifier, password }, req);

      console.log("🚀 ~ AuthController ~ login ~ result:", result);
      if (!result.success || !result.tokens) {
        res.status(401).json({
          success: false,
          user: {
            id: result.userId,
          },
          message:
            result.message || "Invalid credentials or token generation failed",
        });
        return;
      }

      // Use tokens directly from the AuthService.login result
      const tokens = result.tokens;

      // Get client info for session tracking
      const clientInfo = await getClientInfo(req);

      // Store session information
      const userDoc = await User.findById(result.userId);
      if (userDoc) {
        // Initialize sessions array if it doesn't exist
        if (!userDoc.sessions) {
          userDoc.sessions = [];
        }

        // Add refresh token to sessions with device info
        userDoc.sessions.push({
          refreshToken: tokens.refreshToken,
          deviceInfo: {
            userAgent: req.headers["user-agent"] || "Unknown",
            ip: req.ip || req.socket.remoteAddress || "Unknown",
            deviceType: clientInfo.device || "Unknown",
          },
          lastUsed: new Date(),
          createdAt: new Date(),
          isActive: true,
        });

        // Limit the number of sessions to 10
        if (userDoc.sessions.length > 10) {
          // Sort by lastUsed (most recent first) and keep only the 10 most recent
          userDoc.sessions.sort(
            (a: any, b: any) =>
              new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
          );
          userDoc.sessions = userDoc.sessions.slice(0, 10);
        }

        // Update last login time
        userDoc.lastLogin = new Date();

        await userDoc.save();
      }

      // Set tokens in HTTP-only cookies with proper settings
      // Note: The cookie-config middleware will handle SameSite and Secure settings in production
      res.cookie("accesstoken", tokens.accessToken, {
        httpOnly: true,
        path: "/",
        maxAge: 1 * 60 * 60 * 1000, // 1 hour
      });

      res.cookie("refreshtoken", tokens.refreshToken, {
        httpOnly: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Also include tokens in the response for the frontend to store in localStorage
      // This provides a fallback mechanism if cookies don't work properly
      console.log("Setting tokens in response for localStorage backup");

      res.status(200).json({
        success: true,
        user: {
          id: result.userId,
        },
        message: "Login successful",
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Login failed",
      });
    }
  }
  static async logoutAll(req: Request, res: Response) {
  }
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const deviceInfo = await getClientInfo(req); // Get device info

      if (!refreshToken) {
        return res
          .status(400)
          .json({ success: false, message: "Refresh token is required" });
      }

      const result = await AuthService.refreshAccessToken(
        refreshToken,
        deviceInfo
      );

      // Set new tokens in HTTP-only cookies
      res.cookie("accesstoken", result.accessToken, {
        httpOnly: true,
        path: "/",
        maxAge: 1 * 60 * 60 * 1000, // 1 hour
      });

      res.cookie("refreshtoken", result.refreshToken, {
        httpOnly: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({
        success: true,
        tokens: result,
      });
    } catch (error: any) {
      logger.error("Refresh token error:", error.message);
      if (error.name === "CustomError" && error.message === "INVALID_TOKEN") {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token",
        });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to refresh token" });
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
    static async verifyOTP(req: Request, res: Response) {
    }


  static async logout(req: Request, res: Response) {
    try {
      // The refreshToken to invalidate a specific session can be passed in the body
      // Or from the httpOnly cookie if specifically designed that way (more complex)
      const { refreshToken } = req.body;
      const userId = (req as any).user?.userId; // Assuming userId is populated by an auth middleware if available

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
      await AuthService.logout(userId, refreshToken);

      res.clearCookie("accesstoken", { path: "/" });
      res.clearCookie("refreshtoken", { path: "/" });

      res
        .status(200)
        .json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      logger.error("Logout error:", error.message);
      res.status(500).json({ success: false, message: "Logout failed" });
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
   static async getSessions(req: Request, res: Response) {
  }

  // static async verifyEmail(req: Request, res: Response) {
  //   try {
  //     const { token } = req.query; // Or req.body, depending on how token is sent
  //     if (!token || typeof token !== "string") {
  //       return res
  //         .status(400)
  //         .json({ success: false, message: "Verification token is required." });
  //     }
  //     const result = await AuthService.verifyEmail(token);
  //     if (result.success) {
  //       return res.status(200).json(result);
  //     } else {
  //       return res.status(400).json(result);
  //     }
  //   } catch (error) {
  //     logger.error("Email verification controller error:", error);
  //     return res
  //       .status(500)
  //       .json({ success: false, message: "Email verification failed." });
  //   }
  // }

  /**
   * Request password reset
   * @route POST /auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response) {}

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
  static async resetPassword(req: Request, res: Response) {}

  /**
   * Resend verification email
   * @route POST /auth/resend-verification
   */
  static async resendVerification(req: Request, res: Response) {}

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
  static async verifyEmail(req: Request, res: Response) {}

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
  static async generate2FA(req: Request, res: Response) {}

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
  static async verify2FA(req: Request, res: Response) {}

  /**
   * Disable 2FA
   * @route POST /auth/disable-2fa
   */
  static async disable2FA(req: Request, res: Response) {}

  /**
   * Validate 2FA code
   * @route POST /auth/validate-2fa
   */
  static async validate2FA(req: Request, res: Response) {}

  /**
   * Resend OTP
   * @route POST /auth/resend-otp
   */
  static async resendOTP(req: Request, res: Response) {}

  static async selectOTPMethod(req: Request, res: Response) {}

  /**
   * Check if an email address is available (not already registered)
   *
   * @route GET /api/auth/check-email/:email
   * @param {Request} req Express request object
   * @param {Response} res Express response object
   *
   * @returns {Promise<void>} JSON response indicating if email is available
   */
  static async checkEmail(req: Request, res: Response) {}

  /**
   * Check if a username is available (not already taken)
   *
   * @route GET /api/auth/check-username/:username
   * @param {Request} req Express request object
   * @param {Response} res Express response object
   *
   * @returns {Promise<void>} JSON response indicating if username is available
   */
  static async checkUsername(req: Request, res: Response) {}

  /**
   * Retrieve forgotten information (email/username) after OTP validation
   * @route POST /auth/retrieve-forgotten-info
   */
  static async retrieveForgottenInfo(req: Request, res: Response) {}

  /**
   * Handle trouble logging in by providing personalized assistance
   *
   * @route POST /api/auth/trouble-login
   * @param {Request} req Express request object
   * @param {Response} res Express response object
   *
   * @returns {Promise<void>} JSON response with helpful next steps
   */
  static async troubleLogin(req: Request, res: Response) {}

  /**
   * Change user's email address after verification
   * @route POST /auth/change-email
   */
  static async changeEmail(req: Request, res: Response) {}

  /**
   * Change user's phone number after verification
   * @route POST /auth/change-phone
   */
  static async changePhoneNumber(req: Request, res: Response) {}

  /**
   * Change username after verification
   * @route POST /auth/change-username
   */
  static async changeUsername(req: Request, res: Response) {}
}

function generateOTP(length: number) {}

export async function socialAuthCallback(req: Request, res: Response) {}
// This is the closing brace for the AuthController class

export default AuthController;
