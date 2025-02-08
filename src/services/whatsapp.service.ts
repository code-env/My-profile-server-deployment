import { logger } from '../utils/logger';

interface WhatsAppMessage {
  to: string;
  text: string;
}

class WhatsAppService {
  private static instance: WhatsAppService;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = WhatsAppService.getInstance();
    if (instance.initialized) {
      return;
    }

    try {
      logger.info('Initializing WhatsApp service...');
      // Add initialization logic here
      instance.initialized = true;
      logger.info('WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service:', error);
      throw error;
    }
  }

  public static async cleanup(): Promise<void> {
    const instance = WhatsAppService.getInstance();
    if (!instance.initialized) {
      return;
    }

    try {
      logger.info('Cleaning up WhatsApp service...');
      // Add cleanup logic here
      instance.initialized = false;
      logger.info('WhatsApp service cleanup completed');
    } catch (error) {
      logger.error('Error during WhatsApp service cleanup:', error);
      throw error;
    }
  }

  public static async sendOTPMessage(phoneNumber: string, otp: string): Promise<void> {
    const instance = WhatsAppService.getInstance();
    if (!instance.initialized) {
      throw new Error('WhatsApp service not initialized');
    }

    try {
      logger.info(`Sending OTP to ${phoneNumber}`);
      const message: WhatsAppMessage = {
        to: phoneNumber,
        text: `Your verification code is: ${otp}. Valid for 10 minutes.`,
      };

      // Add actual WhatsApp message sending logic here
      // For now, just log the message
      logger.debug('Would send WhatsApp message:', message);

    } catch (error) {
      logger.error('Failed to send WhatsApp OTP:', error);
      throw new Error('Failed to send OTP via WhatsApp');
    }
  }
}

export default WhatsAppService;
