import { Twilio } from 'twilio';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { User } from '../models/User';

class TwilioService {
    private static client: Twilio;
    private static isReady = false;

    public static async initialize(): Promise<void> {
        const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = config;

        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
            logger.warn('⚠️ Twilio credentials not fully set in environment. SMS functionality will be disabled.');
            this.isReady = false;
            return;
        }

        try {
            this.client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            this.isReady = true;
            logger.info('✅ Twilio client initialized successfully');
        } catch (error: any) {
            logger.error('❌ Failed to initialize Twilio client:', error.message);
            this.isReady = false;
        }
    }

    public static async cleanup(): Promise<void> {
        logger.info('Twilio cleanup - no action needed');
    }

    public static isClientReady(): boolean {
        return this.isReady;
    }

    public static async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
        try {
            if (!this.isValidPhoneNumber(phoneNumber)) {
                throw new Error('Invalid phone number format');
            }

            const message = `Your verification code is: ${code}`;
            await this.sendSMS(phoneNumber, message);
            logger.info(`✅ Verification code sent via SMS to ${phoneNumber}`);
        } catch (error: any) {
            logger.error('❌ Failed to send verification code:', error.message);
            throw error;
        }
    }

    public static async sendMessage(phoneNumber: string, message: string): Promise<void> {
        try {
            if (!this.isValidPhoneNumber(phoneNumber)) {
                throw new Error('Invalid phone number format');
            }

            await this.sendSMS(phoneNumber, message);
            logger.info(`✅ Message sent via SMS to ${phoneNumber}`);
        } catch (error: any) {
            logger.error('❌ Failed to send SMS message:', error.message);
            throw error;
        }
    }

    public static async sendOTPMessage(phoneNumber: string, otp: string): Promise<void> {
        try {
            if (!this.isValidPhoneNumber(phoneNumber)) {
                throw new Error('Invalid phone number format');
            }

            const message = `🔐 Hi there!\n\nYour MyProfile One-Time Passcode (OTP) is: ${otp}\n\n⚠️ Do not share this One-Time Passcode (OTP). We will never ask for it.\nPlease use it within 10 minutes.`;
            this.initialize();
            await this.sendSMS(phoneNumber, message);

            logger.info(`✅ OTP sent via SMS to ${phoneNumber}`);
        } catch (error: any) {
            logger.error('❌ Failed to send OTP:', error.message);
            throw error;
        }
    }

    private static async sendSMS(to: string, body: string): Promise<void> {
        if (!this.isReady || !this.client) {
            throw new Error('Twilio client not initialized or unavailable');
        }

        await this.client.messages.create({
            body,
            from: config.TWILIO_PHONE_NUMBER!,
            to,
        });
    }

    private static isValidPhoneNumber(phoneNumber: string): boolean {
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        console.log('Validating phone number:', phoneNumber);
        return phoneRegex.test(phoneNumber);
    }
}

export default TwilioService;
