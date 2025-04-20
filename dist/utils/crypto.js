"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateProfileAccessToken = exports.generateReferralCode = void 0;
exports.generateOTP = generateOTP;
/**
 * Utility functions for cryptographic operations
 */
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
/**
 * Generates a random OTP (One-Time Password) of specified length
 * @param length The length of the OTP to generate (default: 6)
 * @returns A string containing the generated OTP
 */
function generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}
/**
 * Generates a unique referral code
 * @param length Length of the referral code (default: 8)
 * @returns A unique referral code string
 */
const generateReferralCode = (length = 8) => {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking characters like I, 1, O, 0
    let result = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += charset[randomValues[i] % charset.length];
    }
    return result;
};
exports.generateReferralCode = generateReferralCode;
/**
 * Generates a secure JWT access token for profile API access with no expiry
 * @param profileId The ID of the profile
 * @returns A JWT token with no expiration
 */
const generateProfileAccessToken = (profileId) => {
    // Create a JWT token with the profile ID and no expiration
    return jsonwebtoken_1.default.sign({
        profileId,
        type: 'profile_access'
    }, config_1.config.JWT_SECRET, {
    // No expiresIn property means the token never expires
    });
};
exports.generateProfileAccessToken = generateProfileAccessToken;
