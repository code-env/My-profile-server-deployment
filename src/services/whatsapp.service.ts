import { config } from '../config/config';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import EmailService from '../services/email.service';

class WhatsAppService {
  private static isReady = false;

  public static async initialize(): Promise<void> {
    logger.info('WhatsApp service is disabled');
  }

  public static async cleanup(): Promise<void> {
    logger.info('WhatsApp cleanup - no action needed');
  }

  /**
   * Send verification code via Email (WhatsApp disabled)
   */
  public static async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    try {
      if (!this.isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Find user by phone number
      const user = await User.findOne({ phoneNumber });
      if (!user || !user.email) {
        throw new Error('No email found for this phone number');
      }

      // Send via email
      await EmailService.sendVerificationEmail(user.email, code);
      logger.info(`✅ Verification code sent via email to ${user.email}`);
    } catch (error: any) {
      logger.error('Failed to send verification code:', error.message);
      throw error;
    }
  }

  /**
   * Send message via Email (WhatsApp disabled)
   */
  public static async sendMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      const user = await User.findOne({ phoneNumber });
      if (!user || !user.email) {
        throw new Error('Cannot send message: No email found for phone number');
      }

      await EmailService.sendVerificationEmail(user.email, message);
      logger.info(`Message sent via email to ${user.email}`);
    } catch (error: any) {
      logger.error('Failed to send message:', error.message);
      throw error;
    }
  }

  /**
   * Send OTP via Email (WhatsApp disabled)
   */
  public static async sendOTPMessage(phoneNumber: string, otp: string): Promise<void> {
    try {
      const user = await User.findOne({ phoneNumber });
      if (!user || !user.email) {
        throw new Error('Cannot send OTP: No email found for this phone number');
      }

      await EmailService.sendVerificationEmail(user.email, otp);
      logger.info(`OTP sent via email to ${user.email}`);
    } catch (error) {
      logger.error('Failed to send OTP:', error);
      throw error;
    }
  }

  /**
   * Validate phone number format
   */
  private static isValidPhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  // Maintain interface compatibility
  public static isClientReady(): boolean {
    return false;
  }
}

export default WhatsAppService;
