import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { User } from '../models/User';
import { config } from '../config/config';
import { logger } from '../utils/logger';

class TwoFactorService {
  static async generateSecret(userId: string) {
    console.log('Entering generateSecret with userId:', userId);
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const secret = speakeasy.generateSecret({
        name: `${config.APP_NAME}:${user.email}`,
      });

      user.twoFactorSecret = secret.base32;
      await user.save();

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
      };
    } catch (error) {
      console.error('Error in generateSecret:', error);
      logger.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  }

  static async verifyToken(userId: string, token: string): Promise<boolean> {
    console.log('Entering verifyToken with userId and token:', userId, token);
    try {
      const user = await User.findById(userId);
      if (!user || !user.twoFactorSecret) {
        throw new Error('User not found or 2FA not set up');
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 1, // Allow 30 seconds clock skew
      });

      if (isValid && !user.isTwoFactorEnabled) {
        user.isTwoFactorEnabled = true;
        await user.save();
      }

      return isValid;
    } catch (error) {
      console.error('Error in verifyToken:', error);
      logger.error('Error verifying 2FA token:', error);
      throw new Error('Failed to verify 2FA token');
    }
  }

  static async disable(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.isTwoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      await user.save();
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw new Error('Failed to disable 2FA');
    }
  }

  static generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // Generate a random 8-character backup code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}

export default TwoFactorService;
