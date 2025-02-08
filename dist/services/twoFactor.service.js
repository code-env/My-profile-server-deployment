"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const User_1 = require("../models/User");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
class TwoFactorService {
    static async generateSecret(userId) {
        console.log('Entering generateSecret with userId:', userId);
        try {
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            const secret = speakeasy_1.default.generateSecret({
                name: `${config_1.config.APP_NAME}:${user.email}`,
            });
            user.twoFactorSecret = secret.base32;
            await user.save();
            const qrCodeUrl = await qrcode_1.default.toDataURL(secret.otpauth_url);
            return {
                secret: secret.base32,
                qrCode: qrCodeUrl,
            };
        }
        catch (error) {
            console.error('Error in generateSecret:', error);
            logger_1.logger.error('Error generating 2FA secret:', error);
            throw new Error('Failed to generate 2FA secret');
        }
    }
    static async verifyToken(userId, token) {
        console.log('Entering verifyToken with userId and token:', userId, token);
        try {
            const user = await User_1.User.findById(userId);
            if (!user || !user.twoFactorSecret) {
                throw new Error('User not found or 2FA not set up');
            }
            const isValid = speakeasy_1.default.totp.verify({
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
        }
        catch (error) {
            console.error('Error in verifyToken:', error);
            logger_1.logger.error('Error verifying 2FA token:', error);
            throw new Error('Failed to verify 2FA token');
        }
    }
    static async disable(userId) {
        try {
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            user.isTwoFactorEnabled = false;
            user.twoFactorSecret = undefined;
            await user.save();
        }
        catch (error) {
            logger_1.logger.error('Error disabling 2FA:', error);
            throw new Error('Failed to disable 2FA');
        }
    }
    static generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            // Generate a random 8-character backup code
            const code = Math.random().toString(36).substring(2, 10).toUpperCase();
            codes.push(code);
        }
        return codes;
    }
}
exports.default = TwoFactorService;
