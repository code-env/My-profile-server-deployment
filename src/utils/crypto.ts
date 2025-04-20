/**
 * Utility functions for cryptographic operations
 */
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

/**
 * Generates a random OTP (One-Time Password) of specified length
 * @param length The length of the OTP to generate (default: 6)
 * @returns A string containing the generated OTP
 */
export function generateOTP(length: number = 6): string {
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
export const generateReferralCode = (length: number = 8): string => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking characters like I, 1, O, 0
  let result = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }

  return result;
};

/**
 * Generates a secure JWT access token for profile API access with no expiry
 * @param profileId The ID of the profile
 * @returns A JWT token with no expiration
 */
export const generateProfileAccessToken = (profileId: string): string => {
  // Create a JWT token with the profile ID and no expiration
  return (jwt as any).sign(
    {
      profileId,
      type: 'profile_access'
    },
    config.JWT_SECRET,
    {
      // No expiresIn property means the token never expires
    }
  );
};
