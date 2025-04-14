"use strict";
/**
 * Utility functions for cryptographic operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferralCode = void 0;
exports.generateOTP = generateOTP;
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
