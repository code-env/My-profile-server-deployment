"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const User_1 = require("../models/User");
const email_service_1 = __importDefault(require("../services/email.service"));
class WhatsAppService {
    static async initialize() {
        logger_1.logger.info('WhatsApp service is disabled');
    }
    static async cleanup() {
        logger_1.logger.info('WhatsApp cleanup - no action needed');
    }
    /**
     * Send verification code via Email (WhatsApp disabled)
     */
    static async sendVerificationCode(phoneNumber, code) {
        try {
            if (!this.isValidPhoneNumber(phoneNumber)) {
                throw new Error('Invalid phone number format');
            }
            // Find user by phone number
            const user = await User_1.User.findOne({ phoneNumber });
            if (!user || !user.email) {
                throw new Error('No email found for this phone number');
            }
            // Send via email
            await email_service_1.default.sendVerificationEmail(user.email, code);
            logger_1.logger.info(`✅ Verification code sent via email to ${user.email}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send verification code:', error.message);
            throw error;
        }
    }
    /**
     * Send message via Email (WhatsApp disabled)
     */
    static async sendMessage(phoneNumber, message) {
        try {
            const user = await User_1.User.findOne({ phoneNumber });
            if (!user || !user.email) {
                throw new Error('Cannot send message: No email found for phone number');
            }
            await email_service_1.default.sendVerificationEmail(user.email, message);
            logger_1.logger.info(`Message sent via email to ${user.email}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send message:', error.message);
            throw error;
        }
    }
    /**
     * Send OTP via Email (WhatsApp disabled)
     */
    static async sendOTPMessage(phoneNumber, otp) {
        try {
            const user = await User_1.User.findOne({ phoneNumber });
            if (!user || !user.email) {
                throw new Error('Cannot send OTP: No email found for this phone number');
            }
            await email_service_1.default.sendVerificationEmail(user.email, otp);
            logger_1.logger.info(`OTP sent via email to ${user.email}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send OTP:', error);
            throw error;
        }
    }
    /**
     * Validate phone number format
     */
    static isValidPhoneNumber(phoneNumber) {
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(phoneNumber);
    }
    // Maintain interface compatibility
    static isClientReady() {
        return false;
    }
}
WhatsAppService.isReady = false;
exports.default = WhatsAppService;
