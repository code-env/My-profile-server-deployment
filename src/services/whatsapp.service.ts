import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { Browser } from 'puppeteer';
import chalk from 'chalk';
import { User } from '../models/User';
import EmailService from '../services/email.service';
import path from 'path';
import fs from 'fs';

class WhatsAppService {
  private static client: Client | null = null;
  private static isReady = false;
  private static browser: Browser | null = null;
  private static currentQr: string | null = null;

  private static getSessionPath(sessionId: string): string {
    return path.join(
      process.env.WHATSAPP_SESSION_PATH || '/data/whatsapp-sessions',
      sessionId // Removed redundant "session-" prefix
    );
  }

  private static async ensureDirectoryExists(path: string): Promise<void> {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true, mode: 0o777 });
    }
  }

  private static async cleanupSessionDirectory(sessionId: string): Promise<void> {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      const lockFile = path.join(sessionPath, 'SingletonLock');

      if (fs.existsSync(lockFile)) {
        logger.info('Cleaning up stale session lock file...');
        fs.unlinkSync(lockFile);
      }
    } catch (error) {
      logger.error('Error cleaning up session directory:', error);
    }
  }

  public static async initialize(): Promise<void> {
    const maxRetries = 3;
    let retryCount = 0;

    const attemptInitialization = async (): Promise<void> => {
      try {
        const sessionId = `my-profile-ltd-${process.env.NODE_ENV || 'production'}`;
        logger.info(`Initializing WhatsApp client with session ID: ${sessionId}`);

        // Ensure session directory exists with proper permissions
        const sessionPath = this.getSessionPath(sessionId);
        await this.ensureDirectoryExists(sessionPath);
        fs.chmodSync(sessionPath, 0o777);

        await this.cleanupSessionDirectory(sessionId);
//re
        const chromePaths = {
          linux: '/usr/bin/chromium',
          darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        };

        const defaultChromePath = process.env.CHROME_PATH ||
          chromePaths[process.platform as keyof typeof chromePaths] ||
          '/usr/bin/chromium';

        this.client = new Client({
          authStrategy: new LocalAuth({
            clientId: sessionId,
            dataPath: sessionPath
          }),
          puppeteer: {
            headless: true,
            executablePath: defaultChromePath,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--single-process',
              '--no-zygote',
              '--disable-gpu',
              '--max-old-space-size=512'
            ]
          }
        });

        this.setupCleanupHandlers();

        this.client.on('qr', (qr) => {
          if (process.env.NODE_ENV === 'production') {
            this.storeQrCode(qr);
            logger.info('Production QR code available at /api/whatsapp/qr');
          } else {
            qrcode.generate(qr, { small: true });
          }
        });

        this.client.on('ready', async () => {
          this.isReady = true;
          logger.info(`WhatsApp client ready in ${process.env.NODE_ENV} mode`);
        });

        this.client.on('disconnected', async (reason) => {
          logger.warn(`Disconnected: ${reason}`);
          await this.cleanup();
          if (process.env.NODE_ENV === 'production') {
            setTimeout(() => this.initialize(), 10000);
          }
        });

        await this.client.initialize();
      } catch (error: any) {
        logger.error('Initialization failed:', error);
        await this.cleanup();

        if (retryCount < maxRetries) {
          retryCount++;
          const delay = 5000 * retryCount;
          logger.warn(`Retrying initialization in ${delay}ms (attempt ${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptInitialization();
        }

        logger.error('Maximum initialization retries exceeded');
        throw new Error(`WhatsApp initialization failed: ${error.message}`);
      }
    };

    return attemptInitialization();
  }

  private static setupCleanupHandlers(): void {
    const cleanup = async () => {
      await this.cleanup();
      if (process.env.NODE_ENV === 'production') {
        setTimeout(() => this.initialize(), 10000);
      }
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('unhandledRejection', cleanup);
    process.on('uncaughtException', cleanup);
  }

  private static async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close().catch(error => {
          logger.warn('Browser close error:', error);
        });
      }
      if (this.client) {
        await this.client.destroy().catch(error => {
          logger.warn('Client destroy error:', error);
        });
      }
      this.isReady = false;
      this.browser = null;
      this.client = null;
      logger.info('WhatsApp client cleaned up successfully');
    } catch (error) {
      logger.error('Error during WhatsApp cleanup:', error);
    }
  }

  public static async sendOTPMessage(phoneNumber: string, otp: string): Promise<void> {
    if (!this.isValidPhoneNumber(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    if (process.env.NODE_ENV === 'production' && !this.isReady) {
      const user = await User.findOne({ phoneNumber });
      if (user?.email) {
        await EmailService.sendVerificationEmail(user.email, otp);
        return;
      }
      throw new Error('No fallback email available');
    }

    const message = `${otp} is your verification code`;
    await this.sendDirectMessage(phoneNumber, message);
  }

  private static async sendDirectMessage(phoneNumber: string, message: string): Promise<void> {
    if (!this.isReady) throw new Error('WhatsApp client not ready');
    const formattedNumber = `${phoneNumber.replace(/\D/g, '')}@c.us`;
    await this.client!.sendMessage(formattedNumber, message);
  }

  private static isValidPhoneNumber(phoneNumber: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
  }

  public static storeQrCode(qr: string) {
    try {
      this.currentQr = qr;
      const qrPath = path.join(process.env.WHATSAPP_SESSION_PATH || '/data', 'qr-store.png');
      fs.writeFileSync(qrPath, qr);
      fs.chmodSync(qrPath, 0o666);
    } catch (error) {
      logger.error('Failed to store QR code:', error);
    }
  }

  public static getStoredQr() {
    try {
      const qrPath = path.join(process.env.WHATSAPP_SESSION_PATH || '/data', 'qr-store.png');
      return this.currentQr || fs.readFileSync(qrPath, 'utf-8');
    } catch (error) {
      logger.error('Failed to read stored QR code:', error);
      return null;
    }
  }
}

export default WhatsAppService;
