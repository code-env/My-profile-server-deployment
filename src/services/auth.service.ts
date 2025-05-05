import * as jwt from "jsonwebtoken";
import { User, IUser, IOTPData } from "../models/User";
import { config } from "../config/config";
import {
  LoginInput,
  AuthTokens,
  TokenPayload,
  OTPVerificationResponse,
} from "../types/auth.types";
import { logger } from "../utils/logger";
import { generateOTP } from "../utils/crypto";
import EmailService from "./email.service";
import WhatsAppService from "./whatsapp.service";
import { CustomError } from "../utils/errors";
import { sanitizeFilter } from "mongoose";
import { ProfileReferralService } from "./profile-referral.service";

/**
 * Advanced Authentication & Authorization Service
 * ============================================
 *
 * Enterprise-level authentication service implementing secure user management,
 * multi-factor authentication, and session handling with comprehensive security features.
 *
 * Security Features:
 * ----------------
 * 1. Authentication:
 *    - Password-based (bcrypt)
 *    - Multi-factor (Email/WhatsApp)
 *    - JWT session management
 *    - Account lockout
 *
 * 2. Account Protection:
 *    - Brute force prevention
 *    - Rate limiting
 *    - Suspicious activity monitoring
 *    - Session management
 *
 * 3. Verification:
 *    - Email verification
 *    - Phone verification
 *    - OTP management
 *    - 2FA support
 *
 * Error Handling:
 * -------------
 * - Custom error types
 * - Secure error responses
 * - Comprehensive logging
 * - Automatic cleanup
 *
 * @see API.md - API Documentation
 * @see ARCHITECTURE.md - System Design
 */
export class AuthService {
  public static readonly MAX_LOGIN_ATTEMPTS = 20000;
  private static readonly LOCK_TIME_MINUTES = 15;
  private static readonly ACCESS_TOKEN_EXPIRY = "24h";    // Increased
  private static readonly REFRESH_TOKEN_EXPIRY = "30d";   // Increased
  public static readonly OTP_EXPIRY_MINUTES = 10;

  static async register(
    user: IUser,
    ip?: string,
    os?: string,
    referralCode?: string
  ): Promise<{ user: IUser; tokens: AuthTokens }> {
    try {
      // Check for existing user
      const existingUser = await User.findOne({
        $or: [{ email: user.email }, { username: user.username }, { phoneNumber: user.phoneNumber }],
      });

      if (existingUser) {
        throw new CustomError(
          "DUPLICATE_USER",
          existingUser.email === user.email
            ? "Email already registered"
            : existingUser.username === user.username
            ? "Username already taken"
            : "Phone number already registered"
        );
      }

      // Store referral code temporarily if provided
      // It will be processed when creating the profile
      if (referralCode) {
        user.referralCode = referralCode;
      }

      // Create new user with email verification token
      const otp = generateOTP(6);

      const createdUser = (await User.create({
        ...user,
        isEmailVerified: false,
        isPhoneVerified: false,
        verificationData: {
          otp: otp,
          otpExpiry: new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000),
          attempts: 0,
          lastAttempt: new Date(),
        },
      })) as any;

      // Log OTP based on verification method
      if (user.verificationMethod === "EMAIL") {
        logger.info(`🟢 Registration OTP (Email): ${otp}`);
        console.log(`🟢 Registration OTP (Email): ${otp}`);
      } else if (user.verificationMethod === "PHONE") {
        logger.info(`🟣 Registration OTP (Phone): ${otp}`);
        console.log(`🟣 Registration OTP (Phone): ${otp}`);
      }

      // Send verification code
      if (user.verificationMethod === "EMAIL") {
        await EmailService.sendVerificationEmail(user.email, otp, { ipAddress: ip, userAgent: os });
      } else if (user.verificationMethod === "PHONE") {
        console.log(`🟣 Registration OTP (Phone): ${otp}`);
        if (user.phoneNumber) {
          try {
            await WhatsAppService.sendOTPMessage(user.phoneNumber, otp);
            logger.info(`OTP sent to ${user.phoneNumber} via WhatsApp`);
          } catch (whatsappError) {
            logger.error("Failed to send OTP via WhatsApp:", whatsappError);
            // Optionally, you can choose to throw an error or continue
          }
        }
      }

      // Generate auth tokens
      const tokens = this.generateTokens(
        createdUser._id.toString(),
        createdUser.email
      );
      console.log("Generated tokens:", tokens);

      // Store refresh token
      createdUser.refreshTokens = [tokens.refreshToken];
      await createdUser.save();

      return { user: createdUser, tokens };
    } catch (error) {
      logger.error("Registration error:", error);
      throw error;
    }
  }

//   static async login(
//     input: LoginInput,
//     req: unknown
//   ): Promise<OTPVerificationResponse> {
//     try {
//       const user = (await User.findOne({ email: input.email })) as any;
//       if (!user) {
//         // Use vague message for security
//         throw new CustomError(
//           "INVALID_CREDENTIALS",
//           "Invalid email or password"
//         );
//       }

//       // Check account lock
//       // if (user.lockUntil && user.lockUntil > new Date()) {
//       //   const remainingTime = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
//       //   throw new CustomError(
//       //     'ACCOUNT_LOCKED',
//       //     `Account is locked. Please try again in ${remainingTime} minutes`
//       //   );
//       // }

//       // Verify password
//       const isPasswordValid = await user.comparePassword(input.password);
//       if (!isPasswordValid) {
//         user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

//         if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
//           user.lockUntil = new Date(
//             Date.now() + this.LOCK_TIME_MINUTES * 60 * 1000
//           );
//           await user.save();
//           throw new CustomError(
//             "MAX_ATTEMPTS_EXCEEDED",
//             `Too many failed attempts. Account locked for ${this.LOCK_TIME_MINUTES} minutes`
//           );
//         }

//         await user.save();
//         throw new CustomError(
//           "INVALID_CREDENTIALS",
//           "Invalid email or password"
//         );
//       }

//       // Reset failed attempts on successful login
//       user.failedLoginAttempts = 0;
//       user.lockUntil = undefined;

//       // If 2FA is enabled, generate and send OTP
//       if (user.twoFactorEnabled) {
//         const otp = generateOTP(6);
//         console.log("\x1b[33m%s\x1b[0m", "🔑 Login 2FA Code:", otp); // Yellow colored output
//         const otpExpiry = new Date(
//           Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000
//         );

//         user.otpData = {
//           hash: otp,
//           expiry: otpExpiry,
//           attempts: 0,
//           channel: "email", // Already lowercase here
//           purpose: "login",
//         };

//         await user.save();

//         // Send OTP via WhatsApp
//         if (user.phoneNumber) {
//           try {
//             await WhatsAppService.sendOTPMessage(user.phoneNumber, otp);
//             logger.info(`OTP sent to ${user.phoneNumber} via WhatsApp`);
//           } catch (whatsappError) {
//             logger.error("Failed to send OTP via WhatsApp:", whatsappError);
//             // Optionally, you can choose to throw an error or continue
//           }
//         }

//         // Replace the direct user object with a sanitized version
//         const sanitizedUser = {
//           id: user._id,
//           email: user.email,
//           verificationData: user.verificationData,
//           username: user.username,
//           fullName: user.fullName,
//           role: user.role,
//           isEmailVerified: user.isEmailVerified,
//           isPhoneVerified: user.isPhoneVerified,
//           profilePicture: user.profilePicture,
//           registrationStep: user.registrationStep,
//           verificationMethod: user.verificationMethod,
//           lastLogin: user.lastLogin
//         };

//         return {
//           success: true,
//           message: "OTP sent for verification",
//           otpRequired: !user.isEmailVerified,
//           verificationMethod: user.verificationMethod,
//           user: sanitizedUser,
//           otpChannel: user.otpChannel
//         };
//       }

//       // If no 2FA, generate tokens and complete login
//       const tokens = this.generateTokens(user._id.toString(), user.email);
// console.log(user);

//       // Clear old refresh tokens and set the new one
//       user.refreshTokens = [tokens.refreshToken];
//       user.lastLogin = new Date();
//       await user.save();
//       const sanitizedUser = {
//         id: user._id,
//         email: user.email,
//         verificationData: user.verificationData,
//         username: user.username,
//         fullName: user.fullName,
//         role: user.role,
//         isEmailVerified: user.isEmailVerified,
//         isPhoneVerified: user.isPhoneVerified,
//         profilePicture: user.profilePicture,
//         registrationStep: user.registrationStep,
//         verificationMethod: user.verificationMethod,
//         lastLogin: user.lastLogin
//       };

//       return {
//         success: true,
//         message: "Login successful",
//         tokens,
//         user: sanitizedUser,
//         otpRequired: !user.isEmailVerified,
//         verificationMethod: user.verificationMethod,
//         // otpRequired: false,
//       };
//     } catch (error) {
//       logger.error("Login error:", error);
//       throw error;
//     }
//   }

static async login(
  input: LoginInput,
  req: unknown
): Promise<{ success: boolean, userId?: string, message?: string }> {
  try {
    // Find user by email or username
    const user = (await User.findOne({
      $or: [{ email: input.identifier }, { username: input.identifier }],
    })) as any;

    if (!user) {
      throw new CustomError("INVALID_CREDENTIALS", "Invalid credentials");
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(input.password);

    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + this.LOCK_TIME_MINUTES * 60 * 1000);
        await user.save();
        throw new CustomError(
          "MAX_ATTEMPTS_EXCEEDED",
          `Too many failed attempts. Account locked for ${this.LOCK_TIME_MINUTES} minutes`
        );
      }

      await user.save();
      throw new CustomError("INVALID_CREDENTIALS", "Invalid credentials");
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    // Handle Two-Factor Authentication (2FA)
    if (user.twoFactorEnabled) {
      const otp = generateOTP(6);
      console.log("\x1b[33m%s\x1b[0m", "🔑 Login 2FA Code:", otp); // Yellow colored output
      user.otpData = {
        hash: otp,
        expiry: new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        channel: "email",
        purpose: "login",
      };

      // await user.save();

      // if (user.phoneNumber) {
      //   try {
      //     await WhatsAppService.sendOTPMessage(user.phoneNumber, otp);
      //     logger.info(`OTP sent to ${user.phoneNumber} via WhatsApp`);
      //   } catch (whatsappError) {
      //     logger.error("Failed to send OTP via WhatsApp:", whatsappError);
      //   }
      // }

      // return { success: true }; // OTP required
    }

    // If no 2FA, login success
    // const tokens = this.generateTokens(user._id.toString(), user.email);

    // user.refreshTokens = [tokens.refreshToken];

    user.lastLogin = new Date();
    await user.save();

    return { success: true, userId: user._id.toString(),  };
    // return { success: true, userId: user._id.toString(),  };
  } catch (error:any) {
    logger.error("Login error:", error);
    return { success: false, message: error.message };
  }
}


  private async sendVerificationCode(
    phoneNumber: string,
    code: string
  ): Promise<void> {
    try {
      await WhatsAppService.sendOTPMessage(phoneNumber, code);
    } catch (error: any) {
      logger.error("Failed to send verification code:", error.message);
      throw new Error(
        "Failed to send verification code. Please try again later."
      );
    }
  }

  public static generateTokens(userId: string, email: string): AuthTokens {
    const accessToken = jwt.sign({ userId, email }, config.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(
      { userId, email, type: "refresh" },
      config.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify the refresh token
      const decoded = (jwt as any).verify(
        refreshToken,
        config.JWT_REFRESH_SECRET
      ) as TokenPayload;

      if (decoded.type !== "refresh") {
        throw new CustomError("INVALID_TOKEN", "Invalid token type");
      }

      // Find user and check if refresh token exists
      const user = (await User.findById(decoded.userId)) as any;
      if (!user || !user.refreshTokens?.includes(refreshToken)) {
        throw new CustomError("INVALID_TOKEN", "Invalid refresh token");
      }

      // Implement refresh token rotation for enhanced security
      // Remove the used refresh token and generate a new one
      const newRefreshToken = jwt.sign(
        { userId: user._id.toString(), email: user.email, type: "refresh" },
        config.JWT_REFRESH_SECRET,
        { expiresIn: this.REFRESH_TOKEN_EXPIRY }
      );

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: user._id.toString(), email: user.email },
        config.JWT_SECRET,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY }
      );

      // Update refresh tokens list (implement rotation)
      user.refreshTokens = user.refreshTokens.filter(
        (token: string) => token !== refreshToken
      );
      user.refreshTokens.push(newRefreshToken);
      await user.save();

      // Add metadata to help with session management
      user.lastTokenRefresh = new Date();
      await user.save();

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      logger.error("Token refresh error:", error);
      throw new CustomError("INVALID_TOKEN", "Failed to refresh token");
    }
  }

  static async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Clear all refresh tokens on logout for better security
      user.refreshTokens = [];
      await user.save();
    } catch (error) {
      logger.error("Logout error:", error);
      throw error;
    }
  }

  static async verifyEmail(
    token: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const user = await User.findOne({ verificationToken: token });
      if (!user) {
        return { success: false, message: "Invalid verification token." };
      }

      user.isEmailVerified = true;
      user.verificationToken = undefined; // Clear the verification token
      await user.save();

      return { success: true, message: "Email verified successfully." };
    } catch (error) {
      logger.error("Verification error:", error);
      return {
        success: false,
        message: "An error occurred during verification.",
      };
    }
  }

  /**
   * Sets a password reset token for a user
   * @param email User's email
   * @param resetToken Reset token to set
   * @returns The updated user
   * @throws CustomError if user not found
   */
  static async setResetToken(
    email: string,
    resetToken: string
  ): Promise<IUser> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new CustomError("USER_NOT_FOUND", "No user found with this email");
    }

    user.verificationToken = resetToken;
    user.otpData = {
      expiry: new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
      purpose: "reset_password",
      channel: "email",
    };

    await user.save();
    return user;
  }

  /**
   * Resets a user's password using a valid reset token
   * @param token Reset token
   * @param newPassword New password to set
   * @throws CustomError if token is invalid or expired
   */
  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<void> {
    try {
      const user = (await User.findOne({
        verificationToken: token,
        "otpData.purpose": "reset_password",
        "otpData.expiry": { $gt: new Date() },
      })) as any;

      if (!user) {
        throw new CustomError(
          "INVALID_TOKEN",
          "Invalid or expired reset token"
        );
      }

      // Update password and clear reset token data
      user.password = newPassword;
      user.verificationToken = undefined;
      user.otpData = {
        hash: undefined,
        expiry: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        channel: "email",
        purpose: undefined,
      };

      await user.save();
    } catch (error) {
      logger.error("Password reset error:", error);
      throw error;
    }
  }

  /**
   * Resends verification email to user
   * @param email User's email address
   * @throws CustomError if user not found or already verified
   */
  static async resendVerification(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new CustomError("USER_NOT_FOUND", "No user found with this email");
    }

    if (user.isEmailVerified) {
      throw new CustomError("ALREADY_VERIFIED", "Email is already verified");
    }

    // Generate new verification token
    const verificationToken = jwt.sign(
      { email: user.email },
      config.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Update user with new verification token
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Send new verification email
    // await EmailService.sendVerificationEmail(email, verificationToken);
  }

  /**
   * Verify OTP for a user
   * @param userId User's ID
   * @param otp OTP to verify
   * @param verificationMethod Method used for verification (email/sms)
   * @returns Promise<boolean> indicating if OTP is valid
   * @throws CustomError if user not found or OTP is invalid/expired
   */
  static async verifyOTP(
    userId: string,
    otp: string,
    verificationMethod: string
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId).select(
        "+verificationData +otpData"
      );
      console.log("User:", user);

      if (!user) {
        throw new CustomError("USER_NOT_FOUND", "User not found");
      }

      console.log("Verification Method:", verificationMethod);
      console.log("Provided OTP:", otp);

      // For email/phone verification during registration
      if (
        (verificationMethod === "email" && !user.isEmailVerified) ||
        (verificationMethod === "phone" && !user.isPhoneVerified)
      ) {
        console.log("Verification Data:", user.verificationData);

        // Validate OTP
        if (!user.verificationData?.otp) {
          throw new CustomError("INVALID_OTP", "No verification in progress");
        }

        if (
          user.verificationData.otpExpiry &&
          new Date() > user.verificationData.otpExpiry
        ) {
          throw new CustomError("OTP_EXPIRED", "OTP has expired");
        }

        // Update last attempt
        user.verificationData.lastAttempt = new Date();
        user.verificationData.attempts += 1;

        const isMatch = user.verificationData.otp === otp;
        console.log("OTP Match:", isMatch);

        if (!isMatch) {
          await user.save();
          throw new CustomError("INVALID_OTP", "Invalid OTP provided");
        }

        // Clear verification data and mark as verified
        user.verificationData = { attempts: 0 };
        if (verificationMethod === "email") {
          user.isEmailVerified = true;
        } else {
          user.isPhoneVerified = true;
        }
        await user.save();
        return true;
      }

      // For login/2FA, use otpData
      console.log("OTP Data:", user.otpData);
      if (!user.otpData?.hash) {
        throw new CustomError("INVALID_OTP", "No OTP verification in progress");
      }

      if (user.otpData.expiry && new Date() > user.otpData.expiry) {
        throw new CustomError("OTP_EXPIRED", "OTP has expired");
      }

      if (user.otpData.channel !== verificationMethod) {
        throw new CustomError("INVALID_METHOD", "Invalid verification method");
      }

      // Update attempts
      user.otpData.attempts += 1;

      const isMatch = user.otpData.hash === otp;
      console.log("OTP Match:", isMatch);

      if (!isMatch) {
        await user.save();
        throw new CustomError("INVALID_OTP", "Invalid OTP provided");
      }

      // Clear OTP data after successful verification
      user.otpData = {
        hash: undefined,
        expiry: undefined,
        attempts: 0,
        channel: undefined,
        purpose: undefined,
      };
      await user.save();

      return true;
    } catch (error) {
      logger.error("OTP verification error:", error);
      throw error;
    }
  }

  /**
   * Verify OTP and return user data with tokens
   * @param userId User's ID
   * @param otp OTP to verify
   * @param verificationMethod Method used for verification (email/phone)
   */
  public static async verifyOTPResponse(
    userId: string,
    otp: string,
    verificationMethod: string
  ): Promise<{ success: boolean; message?: string; user?: IUser }> {
    try {
      // Find user
      const user: any = await User.findById(userId);
      if (!user) {
        throw new CustomError("USER_NOT_FOUND", "User not found");
      }

      // Check if OTP exists and hasn't expired
      if (!user.verificationData?.otp || !user.verificationData?.otpExpiry) {
        throw new CustomError("INVALID_OTP", "No OTP found or OTP has expired");
      }

      // Check if OTP has expired
      if (new Date() > user.verificationData.otpExpiry) {
        throw new CustomError("OTP_EXPIRED", "OTP has expired");
      }

      // Verify OTP
      if (user.verificationData.otp !== otp) {
        // Increment failed attempts
        user.verificationData.attempts =
          (user.verificationData.attempts || 0) + 1;
        user.verificationData.lastAttempt = new Date();
        await user.save();

        if (user.verificationData.attempts >= this.MAX_LOGIN_ATTEMPTS) {
          throw new CustomError(
            "MAX_ATTEMPTS",
            "Maximum OTP attempts exceeded. Please request a new OTP."
          );
        }

        throw new CustomError("INVALID_OTP", "Invalid OTP");
      }

      // OTP is valid - update user verification status
      if (verificationMethod === "email") {
        user.isEmailVerified = true;
      } else if (verificationMethod === "phone") {
        user.isPhoneVerified = true;
      }

      // Clear verification data
      user.verificationData = undefined;
      await user.save();

      try {
        // Create a default profile for the user
        const profileService = new (require('../services/profile.service').ProfileService)();
        const defaultProfile = await profileService.createDefaultProfile(userId);
        logger.info(`Default profile created for user ${userId} after successful verification`);

        // Referral processing is now handled in the profile service
        // when the default profile is created
      } catch (profileError) {
        // Log the error but don't fail the verification process
        logger.error(`Error creating default profile for user ${userId}:`, profileError);
      }

      return {
        success: true,
        message: "OTP verified successfully",
        user,
      };
    } catch (error) {
      if (error instanceof CustomError) {
        return {
          success: false,
          message: error.message,
        };
      }
      throw error;
    }
  }

  static async getUser(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new CustomError("USER_NOT_FOUND", "User not found");
    }
    return user;
  }

  static async updateUser(
    userId: string,
    userData: Partial<IUser>
  ): Promise<IUser> {
    const user = await User.findByIdAndUpdate(userId, userData, { new: true });
    if (!user) {
      throw new CustomError("USER_NOT_FOUND", "User not found");
    }
    return user;
  }

  static async deleteUser(userId: string): Promise<void> {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw new CustomError("USER_NOT_FOUND", "User not found");
    }
  }

  /**
   * Get all active sessions for a user
   * @param userId User's ID
   * @returns Array of active sessions with their refresh tokens
   */
  static async getUserSessions(
    userId: string
  ): Promise<{ refreshToken: string }[]> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new CustomError("USER_NOT_FOUND", "User not found");
      }

      return user.refreshTokens.map((token) => ({ refreshToken: token }));
    } catch (error) {
      logger.error("Get user sessions error:", error);
      throw error;
    }
  }
}
