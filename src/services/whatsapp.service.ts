import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { Browser } from 'puppeteer';
import chalk from 'chalk';
import { User } from '../models/User';
import EmailService from '../services/email.service';

class WhatsAppService {
  private static client: Client | null = null;
  private static isReady = false;
  private static isDevMode = process.env.NODE_ENV !== 'production';
  private static browser: Browser | null = null;

  /**
   * Initialize WhatsApp client
   */
  public static async initialize(): Promise<void> {
    // Skip WhatsApp initialization in production
    if (process.env.NODE_ENV === 'production') {
      logger.info('WhatsApp service disabled in production environment');
      return;
    }

    try {
      // Create a session ID based on environment
      const sessionId = `my-profile-ltd-${process.env.NODE_ENV || 'development'}`;
      logger.info(`Initializing WhatsApp client with session ID: ${sessionId}`);

      const chromePaths = {
        linux: '/usr/bin/google-chrome-stable',
        darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      };

      const defaultChromePath = chromePaths[process.platform as keyof typeof chromePaths] || '/usr/bin/google-chrome-stable';

      // Create WhatsApp client with LocalAuth
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: sessionId
        }),
        puppeteer: {
          headless: true,
          executablePath: process.env.CHROME_PATH || defaultChromePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-notifications',
            '--window-size=1280,720'
          ]
        }
      });

      // Setup cleanup handlers before initializing
      this.setupCleanupHandlers();

      // Generate QR code for authentication
      this.client.on('qr', (qr) => {
        logger.info('Please scan this QR code with WhatsApp:');
        qrcode.generate(qr, { small: true });
      });

      // Handle client ready event
      this.client.on('ready', async () => {
        const { log } = require('../utils/console-art');
        this.isReady = true;
        const info = await this.client?.getState();
        logger.info('WhatsApp client is ready!');
        log.success('WhatsApp client is ready!');
        log.info('Connection Status:');
        console.log(chalk.cyan(`   • State: ${chalk.bold(info || 'CONNECTED')}`));
      });

      // Handle authentication failures
      this.client.on('auth_failure', (msg) => {
        logger.error('WhatsApp authentication failed:', msg);
        this.isReady = false;
      });

      // Handle disconnections
      this.client.on('disconnected', async (reason) => {
        logger.warn('WhatsApp client disconnected:', reason);
        this.isReady = false;
        await this.cleanup();
      });

      // Initialize the client
      const { log } = require('../utils/console-art');
      log.info('Starting WhatsApp client initialization...');
      log.info('Connection Configuration:');
      console.log(chalk.cyan(`   • Chrome Path: ${chalk.bold(process.env.CHROME_PATH || defaultChromePath)}`));
      console.log(chalk.cyan(`   • Mode: ${chalk.bold(this.isDevMode ? 'Development' : 'Production')}`));
      console.log(chalk.cyan(`   • Session ID: ${chalk.bold(sessionId)}`));
      await this.client.initialize();
    } catch (error: any) {
      logger.error('Failed to initialize WhatsApp client:', error.message);
      logger.error('Error details:', error);
      await this.cleanup();
      throw new Error(`WhatsApp initialization failed: ${error.message}`);
    }
  }

  /**
   * Set up cleanup handlers for graceful shutdown
   */
  private static setupCleanupHandlers(): void {
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, cleaning up WhatsApp client...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, cleaning up WhatsApp client...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', reason);
      await this.cleanup();
    });

    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught Exception:', error);
      await this.cleanup();
    });
  }

  /**
   * Cleanup function to properly close browser and client
   */
  private static async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }
      this.isReady = false;
      logger.info('WhatsApp client cleaned up successfully');
    } catch (error) {
      logger.error('Error during WhatsApp cleanup:', error);
    }
  }

  /**
   * Send verification code via WhatsApp
   * @param phoneNumber Recipient phone number (with country code)
   * @param code Verification code
   */
  public static async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    try {
      if (!this.isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Format phone number for WhatsApp (remove '+' and add @c.us)
      const whatsappId = `${phoneNumber.replace(/\D/g, '')}@c.us`;

      // In development mode, just log
      if (this.isDevMode) {
        logger.info(`📱 Development Mode: Would send WhatsApp verification code to ${phoneNumber}: ${code}`);
        return;
      }

      // Check if client is ready
      if (!this.isReady || !this.client) {
        throw new Error('WhatsApp client is not ready. Please scan the QR code first.');
      }

      // Create message with verification code
      const message = `${config.APP_NAME} verification code: ${code}\n\nThis code will expire in 15 minutes.\nIf you didn't request this code, please ignore this message.`;

      // Send the message
      await this.client.sendMessage(whatsappId, message);
      logger.info(`✅ WhatsApp verification code sent successfully to ${phoneNumber}`);
    } catch (error: any) {
      logger.error('Failed to send WhatsApp verification code:', error.message);
      throw new Error(`Failed to send verification code: ${error.message}`);
    }
  }

  /**
   * Send a WhatsApp message
   * @param phoneNumber Phone number to send message to (with country code)
   * @param message Message content
   */
  public static async sendMessage(phoneNumber: string, message: string): Promise<void> {
    // Prevent WhatsApp usage in production
    if (process.env.NODE_ENV === 'production') {
      const user = await User.findOne({ phoneNumber });
      if (!user || !user.email) {
        logger.error('Cannot send message: No email found for phone number:', phoneNumber);
        throw new Error('Cannot send message: No email found for this phone number');
      }

      // Send message via email instead
      await EmailService.sendVerificationEmail(user.email, message);
      logger.info(`Production mode: Message sent via email to ${user.email}`);
      return;
    }

    try {
      if (!this.isReady || !this.client) {
        throw new Error('WhatsApp client is not ready. Please scan QR code first.');
      }

      // Format phone number to WhatsApp format (remove + and add @c.us)
      const formattedNumber = phoneNumber.replace('+', '') + '@c.us';

      // Send message
      await this.client.sendMessage(formattedNumber, message);
      logger.info(`✅ WhatsApp message sent successfully to ${phoneNumber}`);
    } catch (error: any) {
      logger.error('Failed to send WhatsApp message:', error.message);
      throw new Error(`Failed to send WhatsApp message: ${error.message}`);
    }
  }

  /**
   * Check if client is ready to send messages
   */
  public static isClientReady(): boolean {
    return this.isReady;
  }

  /**
   * Validate phone number format
   * @param phoneNumber Phone number to validate
   */
  private static isValidPhoneNumber(phoneNumber: string): boolean {
    // International phone number format (E.164)
    // Allows + prefix, followed by 1-15 digits
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  private static async getEmailFromPhone(phone: string): Promise<string> {
    try {
      const user = await User.findOne({ phoneNumber: phone });
      if (!user || !user.email) {
        throw new Error('No email found for this phone number');
      }
      return user.email;
    } catch (error) {
      logger.error('Error finding email for phone number:', error);
      throw new Error('Failed to find email for phone number');
    }
  }

  /**
   * Generate a verification code message
   * @param otp Verification code
   * @returns Formatted message string
   */
  public static formatOTPMessage(otp: string): string {
    return `${otp} is your verification code. For your security, do not share this code.`;
  }

  /**
   * Send a verification code message
   * @param phoneNumber Recipient's phone number
   * @param otp Verification code
   */
  public static async sendOTPMessage(
    phoneNumber: string,
    otp: string
  ): Promise<void> {
    try {
      // In production, always use email
      if (process.env.NODE_ENV === 'production') {
        // Find user's email from phone number
        const user = await User.findOne({ phoneNumber });
        if (!user || !user.email) {
          logger.error('No email found for phone number:', phoneNumber);
          throw new Error('Cannot send OTP: No email found for this phone number');
        }

        // Send OTP via email instead
        await EmailService.sendVerificationEmail(user.email, otp);
        logger.info(`Production mode: OTP sent via email to ${user.email}`);
        return;
      }

      // In development, use WhatsApp
      const message = this.formatOTPMessage(otp);
      logger.info(`Development mode: Sending OTP via WhatsApp to ${phoneNumber}`);
      await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error('Failed to send OTP:', error);
      throw error;
    }
  }
}

export default WhatsAppService;
