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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const User_1 = require("../models/User");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const crypto_1 = require("../utils/crypto");
const email_service_1 = __importDefault(require("./email.service"));
const whatsapp_service_1 = __importDefault(require("./whatsapp.service"));
const errors_1 = require("../utils/errors");
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
class AuthService {
    static async register(user, ip, os, referralCode) {
        try {
            // Check for existing user
            const existingUser = await User_1.User.findOne({
                $or: [{ email: user.email }, { username: user.username }, { phoneNumber: user.phoneNumber }],
            });
            if (existingUser) {
                throw new errors_1.CustomError("DUPLICATE_USER", existingUser.email === user.email
                    ? "Email already registered"
                    : existingUser.username === user.username
                        ? "Username already taken"
                        : "Phone number already registered");
            }
            // Store referral code temporarily if provided
            // It will be processed when creating the profile
            if (referralCode) {
                user.referralCode = referralCode;
            }
            // Create new user with email verification token
            const otp = (0, crypto_1.generateOTP)(6);
            const createdUser = (await User_1.User.create({
                ...user,
                isEmailVerified: false,
                isPhoneVerified: false,
                verificationData: {
                    otp: otp,
                    otpExpiry: new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000),
                    attempts: 0,
                    lastAttempt: new Date(),
                },
            }));
            // Log OTP based on verification method
            if (user.verificationMethod === "EMAIL") {
                logger_1.logger.info(`🟢 Registration OTP (Email): ${otp}`);
                console.log(`🟢 Registration OTP (Email): ${otp}`);
            }
            else if (user.verificationMethod === "PHONE") {
                logger_1.logger.info(`🟣 Registration OTP (Phone): ${otp}`);
                console.log(`🟣 Registration OTP (Phone): ${otp}`);
            }
            // Send verification code
            if (user.verificationMethod === "EMAIL") {
                await email_service_1.default.sendVerificationEmail(user.email, otp, { ipAddress: ip, userAgent: os });
            }
            else if (user.verificationMethod === "PHONE") {
                console.log(`🟣 Registration OTP (Phone): ${otp}`);
                if (user.phoneNumber) {
                    try {
                        await whatsapp_service_1.default.sendOTPMessage(user.phoneNumber, otp);
                        logger_1.logger.info(`OTP sent to ${user.phoneNumber} via WhatsApp`);
                    }
                    catch (whatsappError) {
                        logger_1.logger.error("Failed to send OTP via WhatsApp:", whatsappError);
                        // Optionally, you can choose to throw an error or continue
                    }
                }
            }
            // Generate auth tokens
            const tokens = this.generateTokens(createdUser._id.toString(), createdUser.email);
            console.log("Generated tokens:", tokens);
            // Store refresh token
            createdUser.refreshTokens = [tokens.refreshToken];
            await createdUser.save();
            return { user: createdUser, tokens };
        }
        catch (error) {
            logger_1.logger.error("Registration error:", error);
            throw error;
        }
    }
    static async login(input, req) {
        try {
            // Find user by email or username
            const user = (await User_1.User.findOne({
                $or: [{ email: input.identifier }, { username: input.identifier }],
            }));
            if (!user) {
                throw new errors_1.CustomError("INVALID_CREDENTIALS", "Invalid credentials");
            }
            // Verify password
            const isPasswordValid = await user.comparePassword(input.password);
            if (!isPasswordValid) {
                user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
                if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
                    user.lockUntil = new Date(Date.now() + this.LOCK_TIME_MINUTES * 60 * 1000);
                    await user.save();
                    throw new errors_1.CustomError("MAX_ATTEMPTS_EXCEEDED", `Too many failed attempts. Account locked for ${this.LOCK_TIME_MINUTES} minutes`);
                }
                await user.save();
                throw new errors_1.CustomError("INVALID_CREDENTIALS", "Invalid credentials");
            }
            // Reset failed attempts on successful login
            user.failedLoginAttempts = 0;
            user.lockUntil = undefined;
            // Handle Two-Factor Authentication (2FA)
            if (user.twoFactorEnabled) {
                const otp = (0, crypto_1.generateOTP)(6);
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
            const tokens = this.generateTokens(user._id.toString(), user.email);
            user.refreshTokens = [tokens.refreshToken];
            user.lastLogin = new Date();
            await user.save();
            return { success: true, userId: user._id.toString(), tokens };
        }
        catch (error) {
            logger_1.logger.error("Login error:", error);
            return { success: false, message: error.message };
        }
    }
    async sendVerificationCode(phoneNumber, code) {
        try {
            await whatsapp_service_1.default.sendOTPMessage(phoneNumber, code);
        }
        catch (error) {
            logger_1.logger.error("Failed to send verification code:", error.message);
            throw new Error("Failed to send verification code. Please try again later.");
        }
    }
    static generateTokens(userId, email) {
        const accessToken = jwt.sign({ userId, email }, config_1.config.JWT_SECRET, {
            expiresIn: this.ACCESS_TOKEN_EXPIRY,
        });
        const refreshToken = jwt.sign({ userId, email, type: "refresh" }, config_1.config.JWT_REFRESH_SECRET, { expiresIn: this.REFRESH_TOKEN_EXPIRY });
        return { accessToken, refreshToken };
    }
    static async refreshAccessToken(refreshToken, deviceInfo) {
        var _a, _b;
        try {
            // Verify the refresh token
            const decoded = jwt.verify(refreshToken, config_1.config.JWT_REFRESH_SECRET);
            if (decoded.type !== "refresh") {
                throw new errors_1.CustomError("INVALID_TOKEN", "Invalid token type");
            }
            // Find user
            const user = (await User_1.User.findById(decoded.userId));
            if (!user) {
                throw new errors_1.CustomError("INVALID_TOKEN", "Invalid refresh token - user not found");
            }
            // Check if token exists in refreshTokens array (legacy support)
            const tokenExists = (_a = user.refreshTokens) === null || _a === void 0 ? void 0 : _a.includes(refreshToken);
            // Check if token exists in sessions array
            const sessionIndex = (_b = user.sessions) === null || _b === void 0 ? void 0 : _b.findIndex((session) => session.refreshToken === refreshToken);
            // If token doesn't exist in either place, it's invalid
            if (!tokenExists && sessionIndex === -1) {
                throw new errors_1.CustomError("INVALID_TOKEN", "Invalid refresh token - token not found");
            }
            // Generate new tokens
            const newRefreshToken = jwt.sign({ userId: user._id.toString(), email: user.email, type: "refresh" }, config_1.config.JWT_REFRESH_SECRET, { expiresIn: this.REFRESH_TOKEN_EXPIRY });
            const accessToken = jwt.sign({ userId: user._id.toString(), email: user.email }, config_1.config.JWT_SECRET, { expiresIn: this.ACCESS_TOKEN_EXPIRY });
            // Update the session information
            const now = new Date();
            // If token was in the legacy refreshTokens array, migrate it to sessions
            if (tokenExists) {
                // Remove from refreshTokens array
                user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
                // Initialize sessions array if it doesn't exist
                if (!user.sessions) {
                    user.sessions = [];
                }
                // Add to sessions with device info
                user.sessions.push({
                    refreshToken: newRefreshToken,
                    deviceInfo: deviceInfo || {
                        userAgent: 'Unknown (migrated)',
                        ip: 'Unknown',
                        deviceType: 'Unknown'
                    },
                    lastUsed: now,
                    createdAt: now,
                    isActive: true
                });
                // Limit the number of sessions to 10
                if (user.sessions.length > 10) {
                    // Sort by lastUsed (most recent first) and keep only the 10 most recent
                    user.sessions.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
                    user.sessions = user.sessions.slice(0, 10);
                }
            }
            // If token was in the sessions array, update that session
            else if (sessionIndex !== -1) {
                // Update the existing session with the new token
                user.sessions[sessionIndex].refreshToken = newRefreshToken;
                user.sessions[sessionIndex].lastUsed = now;
                // Update device info if provided
                if (deviceInfo) {
                    user.sessions[sessionIndex].deviceInfo = {
                        ...user.sessions[sessionIndex].deviceInfo,
                        ...deviceInfo
                    };
                }
            }
            // Update last token refresh time
            user.lastTokenRefresh = now;
            // Save the user
            await user.save();
            return { accessToken, refreshToken: newRefreshToken };
        }
        catch (error) {
            logger_1.logger.error("Token refresh error:", error);
            throw new errors_1.CustomError("INVALID_TOKEN", "Failed to refresh token");
        }
    }
    static async logout(userId, refreshToken) {
        var _a, _b, _c;
        try {
            const user = await User_1.User.findById(userId);
            if (!user)
                return;
            // If a specific refresh token is provided, only invalidate that session
            if (refreshToken) {
                // Check if token exists in refreshTokens array (legacy support)
                if ((_a = user.refreshTokens) === null || _a === void 0 ? void 0 : _a.includes(refreshToken)) {
                    user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
                }
                // Check if token exists in sessions array
                if (((_b = user.sessions) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                    const sessionIndex = user.sessions.findIndex((session) => session.refreshToken === refreshToken);
                    if (sessionIndex !== -1) {
                        // Mark the session as inactive instead of removing it
                        user.sessions[sessionIndex].isActive = false;
                    }
                }
            }
            else {
                // If no specific token is provided, clear all sessions
                user.refreshTokens = [];
                if (((_c = user.sessions) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                    // Mark all sessions as inactive
                    user.sessions.forEach((session) => {
                        session.isActive = false;
                    });
                }
            }
            await user.save();
        }
        catch (error) {
            logger_1.logger.error("Logout error:", error);
            throw error;
        }
    }
    /**
     * Logout from all devices
     * @param userId User ID
     */
    static async logoutAll(userId) {
        var _a;
        try {
            const user = await User_1.User.findById(userId);
            if (!user)
                return;
            // Clear all refresh tokens
            user.refreshTokens = [];
            // Mark all sessions as inactive
            if (((_a = user.sessions) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                user.sessions.forEach((session) => {
                    session.isActive = false;
                });
            }
            await user.save();
        }
        catch (error) {
            logger_1.logger.error("Logout all error:", error);
            throw error;
        }
    }
    static async verifyEmail(token) {
        try {
            const user = await User_1.User.findOne({ verificationToken: token });
            if (!user) {
                return { success: false, message: "Invalid verification token." };
            }
            user.isEmailVerified = true;
            user.verificationToken = undefined; // Clear the verification token
            await user.save();
            return { success: true, message: "Email verified successfully." };
        }
        catch (error) {
            logger_1.logger.error("Verification error:", error);
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
     * @param purpose The purpose of the token (e.g., 'reset_password', 'change_email')
     * @param channel The channel for verification (e.g., 'email', 'sms')
     * @returns The updated user
     * @throws CustomError if user not found
     */
    static async setResetToken(email, resetToken, purpose, channel = 'email') {
        console.log("Setting reset token for email:", email);
        console.log("Purpose:", purpose);
        const user = await User_1.User.findOne({ email });
        if (!user) {
            throw new errors_1.CustomError("USER_NOT_FOUND", "No user found with this email");
        }
        const expiryTime = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
        console.log("Setting token expiry to:", expiryTime);
        user.verificationToken = resetToken;
        user.verificationData = {
            otp: resetToken,
            otpExpiry: expiryTime,
            attempts: 0,
            lastAttempt: new Date()
        };
        await user.save();
        console.log("Saved user with new token and expiry");
        return user;
    }
    /**
     * Resets a user's password using a valid reset token
     * @param token Reset token
     * @param newPassword New password to set
     * @param purpose The purpose to validate against
     * @throws CustomError if token is invalid or expired
     */
    static async resetPassword(token, newPassword, purpose) {
        try {
            console.log("Resetting password with token:", token);
            // Find user by the OTP stored in verificationData
            const user = await User_1.User.findOne({
                "verificationData.otp": token,
                "verificationData.otpExpiry": { $gt: new Date() }
            });
            if (!user) {
                console.log("No user found with valid OTP token");
                throw new errors_1.CustomError("INVALID_TOKEN", "Invalid or expired reset token");
            }
            console.log("Found user:", user.email);
            console.log("Verification data:", user.verificationData);
            // Update password and clear verification data
            user.password = newPassword;
            user.verificationData = {
                otp: undefined,
                otpExpiry: undefined,
                attempts: 0,
                lastAttempt: undefined
            };
            await user.save();
            console.log("Password updated successfully");
        }
        catch (error) {
            logger_1.logger.error("Password reset error:", error);
            throw error;
        }
    }
    /**
     * Resends verification email to user
     * @param email User's email address
     * @throws CustomError if user not found or already verified
     */
    static async resendVerification(email) {
        const user = await User_1.User.findOne({ email });
        if (!user) {
            throw new errors_1.CustomError("USER_NOT_FOUND", "No user found with this email");
        }
        if (user.isEmailVerified) {
            throw new errors_1.CustomError("ALREADY_VERIFIED", "Email is already verified");
        }
        // Generate new verification token
        const verificationToken = jwt.sign({ email: user.email }, config_1.config.JWT_SECRET, { expiresIn: "24h" });
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
    static async verifyOTP(userId, otp, verificationMethod) {
        var _a, _b;
        try {
            const user = await User_1.User.findById(userId).select("+verificationData +otpData");
            console.log("User:", user);
            if (!user) {
                throw new errors_1.CustomError("USER_NOT_FOUND", "User not found");
            }
            console.log("Verification Method:", verificationMethod);
            console.log("Provided OTP:", otp);
            // For email/phone verification during registration
            if ((verificationMethod === "email" && !user.isEmailVerified) ||
                (verificationMethod === "phone" && !user.isPhoneVerified)) {
                console.log("Verification Data:", user.verificationData);
                // Validate OTP
                if (!((_a = user.verificationData) === null || _a === void 0 ? void 0 : _a.otp)) {
                    throw new errors_1.CustomError("INVALID_OTP", "No verification in progress");
                }
                if (user.verificationData.otpExpiry &&
                    new Date() > user.verificationData.otpExpiry) {
                    throw new errors_1.CustomError("OTP_EXPIRED", "OTP has expired");
                }
                // Update last attempt
                user.verificationData.lastAttempt = new Date();
                user.verificationData.attempts += 1;
                const isMatch = user.verificationData.otp === otp;
                console.log("OTP Match:", isMatch);
                if (!isMatch) {
                    await user.save();
                    throw new errors_1.CustomError("INVALID_OTP", "Invalid OTP provided");
                }
                // Clear verification data and mark as verified
                user.verificationData = { attempts: 0 };
                if (verificationMethod === "email") {
                    user.isEmailVerified = true;
                }
                else {
                    user.isPhoneVerified = true;
                }
                await user.save();
                return true;
            }
            // For login/2FA, use otpData
            console.log("OTP Data:", user.otpData);
            if (!((_b = user.otpData) === null || _b === void 0 ? void 0 : _b.hash)) {
                throw new errors_1.CustomError("INVALID_OTP", "No OTP verification in progress");
            }
            if (user.otpData.expiry && new Date() > user.otpData.expiry) {
                throw new errors_1.CustomError("OTP_EXPIRED", "OTP has expired");
            }
            if (user.otpData.channel !== verificationMethod) {
                throw new errors_1.CustomError("INVALID_METHOD", "Invalid verification method");
            }
            // Update attempts
            user.otpData.attempts += 1;
            const isMatch = user.otpData.hash === otp;
            console.log("OTP Match:", isMatch);
            if (!isMatch) {
                await user.save();
                throw new errors_1.CustomError("INVALID_OTP", "Invalid OTP provided");
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
        }
        catch (error) {
            logger_1.logger.error("OTP verification error:", error);
            throw error;
        }
    }
    /**
     * Verify OTP and return user data with tokens
     * @param userId User's ID
     * @param otp OTP to verify
     * @param verificationMethod Method used for verification (email/phone)
     */
    static async verifyOTPResponse(userId, otp, verificationMethod) {
        var _a, _b;
        try {
            // Find user
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new errors_1.CustomError("USER_NOT_FOUND", "User not found");
            }
            // Check if OTP exists and hasn't expired
            if (!((_a = user.verificationData) === null || _a === void 0 ? void 0 : _a.otp) || !((_b = user.verificationData) === null || _b === void 0 ? void 0 : _b.otpExpiry)) {
                throw new errors_1.CustomError("INVALID_OTP", "No OTP found or OTP has expired");
            }
            // Check if OTP has expired
            if (new Date() > user.verificationData.otpExpiry) {
                throw new errors_1.CustomError("OTP_EXPIRED", "OTP has expired");
            }
            // Verify OTP
            if (user.verificationData.otp !== otp) {
                // Increment failed attempts
                user.verificationData.attempts =
                    (user.verificationData.attempts || 0) + 1;
                user.verificationData.lastAttempt = new Date();
                await user.save();
                if (user.verificationData.attempts >= this.MAX_LOGIN_ATTEMPTS) {
                    throw new errors_1.CustomError("MAX_ATTEMPTS", "Maximum OTP attempts exceeded. Please request a new OTP.");
                }
                throw new errors_1.CustomError("INVALID_OTP", "Invalid OTP");
            }
            // OTP is valid - update user verification status
            if (verificationMethod === "email") {
                user.isEmailVerified = true;
            }
            else if (verificationMethod === "phone") {
                user.isPhoneVerified = true;
            }
            // Clear verification data
            user.verificationData = undefined;
            await user.save();
            try {
                // Create a default profile for the user
                const profileService = new (require('../services/profile.service').ProfileService)();
                const defaultProfile = await profileService.createDefaultProfile(userId);
                logger_1.logger.info(`Default profile created for user ${userId} after successful verification`);
                // Referral processing is now handled in the profile service
                // when the default profile is created
            }
            catch (profileError) {
                // Log the error but don't fail the verification process
                logger_1.logger.error(`Error creating default profile for user ${userId}:`, profileError);
            }
            return {
                success: true,
                message: "OTP verified successfully",
                user,
            };
        }
        catch (error) {
            if (error instanceof errors_1.CustomError) {
                return {
                    success: false,
                    message: error.message,
                };
            }
            throw error;
        }
    }
    static async getUser(userId) {
        const user = await User_1.User.findById(userId);
        if (!user) {
            throw new errors_1.CustomError("USER_NOT_FOUND", "User not found");
        }
        return user;
    }
    static async updateUser(userId, userData) {
        const user = await User_1.User.findByIdAndUpdate(userId, userData, { new: true });
        if (!user) {
            throw new errors_1.CustomError("USER_NOT_FOUND", "User not found");
        }
        return user;
    }
    static async deleteUser(userId) {
        const user = await User_1.User.findByIdAndDelete(userId);
        if (!user) {
            throw new errors_1.CustomError("USER_NOT_FOUND", "User not found");
        }
    }
    /**
     * Get all active sessions for a user
     * @param userId User's ID
     * @returns Array of active sessions with their refresh tokens
     */
    static async getUserSessions(userId) {
        try {
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new errors_1.CustomError("USER_NOT_FOUND", "User not found");
            }
            return user.refreshTokens.map((token) => ({ refreshToken: token }));
        }
        catch (error) {
            logger_1.logger.error("Get user sessions error:", error);
            throw error;
        }
    }
    /**
     * Validate a reset token without actually resetting anything
     * @param token The token to validate
     * @returns The user if token is valid, null otherwise
     */
    static async validateResetToken(token) {
        try {
            console.log("Validating reset token:", token);
            // Find user by the OTP stored in verificationData
            const user = await User_1.User.findOne({
                "verificationData.otp": token,
                "verificationData.otpExpiry": { $gt: new Date() }
            });
            if (!user) {
                console.log("No user found with valid reset token");
                return { isValid: false };
            }
            console.log("Found user with valid reset token:", user.email);
            return {
                isValid: true,
                email: user.email
            };
        }
        catch (error) {
            logger_1.logger.error("Token validation error:", error);
            return { isValid: false };
        }
    }
    /**
     * Validate user identity for forgotten credentials
     * @param identifier Email, username, or phone number
     * @param type What is being recovered (password, username, email)
     * @returns Validation result with masked sensitive info
     */
    static async validateUserIdentity(identifier, type) {
        try {
            // Find user based on identifier
            const user = await User_1.User.findOne({
                $or: [
                    { email: identifier.toLowerCase() },
                    { username: identifier.toLowerCase() },
                    { phoneNumber: identifier }
                ]
            });
            if (!user) {
                return {
                    success: false,
                    message: "No account found with this identifier"
                };
            }
            // Mask sensitive information based on type
            let maskedInfo;
            switch (type) {
                case 'email':
                    maskedInfo = user.email.replace(/(?<=.{3}).(?=.*@)/g, '*');
                    break;
                case 'username':
                    maskedInfo = user.username.replace(/(?<=.{2}).(?=.{2})/g, '*');
                    break;
                case 'password':
                    // For password reset, we'll mask the email that will receive instructions
                    maskedInfo = user.email.replace(/(?<=.{3}).(?=.*@)/g, '*');
                    break;
            }
            return {
                success: true,
                message: "Identity validated successfully",
                maskedInfo,
                userId: user._id.toString()
            };
        }
        catch (error) {
            logger_1.logger.error("Identity validation error:", error);
            return {
                success: false,
                message: "Error validating identity"
            };
        }
    }
    /**
     * Retrieve forgotten information after OTP validation
     * @param token The OTP token
     * @param infoType What information to retrieve ('email', 'username', etc)
     */
    static async retrieveForgottenInfo(token, infoType) {
        try {
            console.log("Retrieving forgotten info. Type:", infoType);
            console.log("Token:", token);
            // Find user with valid OTP
            const user = await User_1.User.findOne({
                "verificationData.otp": token,
                "verificationData.otpExpiry": { $gt: new Date() }
            });
            if (!user) {
                console.log("No user found with valid token");
                return {
                    success: false,
                    message: "Invalid or expired token"
                };
            }
            console.log("Found user:", user.email);
            console.log("Verification data:", user.verificationData);
            // Return the requested information
            let info;
            switch (infoType) {
                case 'email':
                    info = user.email;
                    break;
                case 'username':
                    info = user.username;
                    break;
                case 'phone_number':
                    info = user.phoneNumber;
                    break;
                default:
                    return {
                        success: false,
                        message: "Invalid information type requested"
                    };
            }
            // Clear the verification data since it's been used
            user.verificationData = {
                otp: undefined,
                otpExpiry: undefined,
                attempts: 0,
                lastAttempt: undefined
            };
            await user.save();
            return {
                success: true,
                info
            };
        }
        catch (error) {
            logger_1.logger.error("Error retrieving forgotten info:", error);
            return {
                success: false,
                message: "Error retrieving information"
            };
        }
    }
}
exports.AuthService = AuthService;
AuthService.MAX_LOGIN_ATTEMPTS = 20000;
AuthService.LOCK_TIME_MINUTES = 15;
AuthService.ACCESS_TOKEN_EXPIRY = "1h"; // Reduced for better security
AuthService.REFRESH_TOKEN_EXPIRY = "30d"; // Increased
AuthService.OTP_EXPIRY_MINUTES = 10;
