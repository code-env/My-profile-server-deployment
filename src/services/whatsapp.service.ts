import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { config } from '../config/config';
import { logger } from '../utils/logger';

class WhatsAppService {
  private static client: Client;
  private static isReady = false;
  private static isDevMode = process.env.NODE_ENV !== 'production';
  //private static isWhatsAppEnabled = config.WHATSAPP_ENABLED;

  /**
   * Initialize WhatsApp client
   */
  public static async initialize(): Promise<void> {
    try {
      // Create a new client
      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: 'my-profile-ltd' }),
        puppeteer: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // Generate QR code for authentication
      this.client.on('qr', (qr) => {
        logger.info('Please scan this QR code with WhatsApp:');
        qrcode.generate(qr, { small: true });
      });

      // Handle client ready event
      this.client.on('ready', () => {
        this.isReady = true;
        logger.info('WhatsApp client is ready!');
      });

      // Handle authentication failures
      this.client.on('auth_failure', (msg) => {
        logger.error('WhatsApp authentication failed:', msg);
        this.isReady = false;
      });

      // Handle disconnections
      this.client.on('disconnected', (reason) => {
        logger.warn('WhatsApp client disconnected:', reason);
        this.isReady = false;
      });

      // Initialize the client
      await this.client.initialize();
    } catch (error: any) {
      logger.error('Failed to initialize WhatsApp client:', error.message);
      throw new Error(`WhatsApp initialization failed: ${error.message}`);
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
      if (!this.isReady) {
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
    try {
      if (!this.isReady) {
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
    const message = this.formatOTPMessage(otp);
    await this.sendMessage(phoneNumber, message);
  }
}

export default WhatsAppService;
