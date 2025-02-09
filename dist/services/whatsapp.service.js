"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
class WhatsAppService {
    //private static isWhatsAppEnabled = config.WHATSAPP_ENABLED;
    /**
     * Initialize WhatsApp client
     */
    static async initialize() {
        try {
            // Ensure auth directory exists
            const authDir = '.wwebjs_auth';
            if (!require('fs').existsSync(authDir)) {
                require('fs').mkdirSync(authDir, { recursive: true });
            }
            // Create a new client
            // Configure WhatsApp client with Render-compatible settings
            this.client = new whatsapp_web_js_1.Client({
                authStrategy: new whatsapp_web_js_1.LocalAuth({ clientId: 'my-profile-ltd' }),
                puppeteer: {
                    executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome-stable',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1920x1080'
                    ]
                }
            });
            // Generate QR code for authentication
            this.client.on('qr', (qr) => {
                logger_1.logger.info('Please scan this QR code with WhatsApp:');
                qrcode_terminal_1.default.generate(qr, { small: true });
            });
            // Handle client ready event
            this.client.on('ready', () => {
                this.isReady = true;
                logger_1.logger.info('WhatsApp client is ready!');
            });
            // Handle authentication failures
            this.client.on('auth_failure', (msg) => {
                logger_1.logger.error('WhatsApp authentication failed:', msg);
                this.isReady = false;
            });
            // Handle disconnections
            this.client.on('disconnected', (reason) => {
                logger_1.logger.warn('WhatsApp client disconnected:', reason);
                this.isReady = false;
            });
            // Initialize the client
            await this.client.initialize();
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize WhatsApp client:', error.message);
            throw new Error(`WhatsApp initialization failed: ${error.message}`);
        }
    }
    /**
     * Send verification code via WhatsApp
     * @param phoneNumber Recipient phone number (with country code)
     * @param code Verification code
     */
    static async sendVerificationCode(phoneNumber, code) {
        try {
            if (!this.isValidPhoneNumber(phoneNumber)) {
                throw new Error('Invalid phone number format');
            }
            // Format phone number for WhatsApp (remove '+' and add @c.us)
            const whatsappId = `${phoneNumber.replace(/\D/g, '')}@c.us`;
            // In development mode, just log
            if (this.isDevMode) {
                logger_1.logger.info(`📱 Development Mode: Would send WhatsApp verification code to ${phoneNumber}: ${code}`);
                return;
            }
            // Check if client is ready
            if (!this.isReady) {
                throw new Error('WhatsApp client is not ready. Please scan the QR code first.');
            }
            // Create message with verification code
            const message = `${config_1.config.APP_NAME} verification code: ${code}\n\nThis code will expire in 15 minutes.\nIf you didn't request this code, please ignore this message.`;
            // Send the message
            await this.client.sendMessage(whatsappId, message);
            logger_1.logger.info(`✅ WhatsApp verification code sent successfully to ${phoneNumber}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send WhatsApp verification code:', error.message);
            throw new Error(`Failed to send verification code: ${error.message}`);
        }
    }
    /**
     * Send a WhatsApp message
     * @param phoneNumber Phone number to send message to (with country code)
     * @param message Message content
     */
    static async sendMessage(phoneNumber, message) {
        try {
            if (!this.isReady) {
                throw new Error('WhatsApp client is not ready. Please scan QR code first.');
            }
            // Format phone number to WhatsApp format (remove + and add @c.us)
            const formattedNumber = phoneNumber.replace('+', '') + '@c.us';
            // Send message
            await this.client.sendMessage(formattedNumber, message);
            logger_1.logger.info(`✅ WhatsApp message sent successfully to ${phoneNumber}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send WhatsApp message:', error.message);
            throw new Error(`Failed to send WhatsApp message: ${error.message}`);
        }
    }
    /**
     * Check if client is ready to send messages
     */
    static isClientReady() {
        return this.isReady;
    }
    /**
     * Validate phone number format
     * @param phoneNumber Phone number to validate
     */
    static isValidPhoneNumber(phoneNumber) {
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
    static formatOTPMessage(otp) {
        return `${otp} is your verification code. For your security, do not share this code.`;
    }
    /**
     * Send a verification code message
     * @param phoneNumber Recipient's phone number
     * @param otp Verification code
     */
    static async sendOTPMessage(phoneNumber, otp) {
        const message = this.formatOTPMessage(otp);
        await this.sendMessage(phoneNumber, message);
    }
}
WhatsAppService.isReady = false;
WhatsAppService.isDevMode = process.env.NODE_ENV !== 'production';
exports.default = WhatsAppService;
