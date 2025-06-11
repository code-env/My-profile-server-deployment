"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
// Register Handlebars helpers
handlebars_1.default.registerHelper('eq', (a, b) => a === b);
handlebars_1.default.registerHelper('gt', (a, b) => a > b);
handlebars_1.default.registerHelper('formatNumber', function (num) {
    return num.toLocaleString();
});
handlebars_1.default.registerHelper('split', function (str, delimiter) {
    if (!str)
        return [];
    return str.split(delimiter || '');
});
handlebars_1.default.registerHelper('now', function () {
    return new Date();
});
handlebars_1.default.registerHelper('formatDate', function (timestamp) {
    if (!timestamp)
        return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime()))
        return '';
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
});
handlebars_1.default.registerHelper('formatDateTime', function (timestamp) {
    if (!timestamp)
        return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime()))
        return '';
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
});
handlebars_1.default.registerHelper('or', (...args) => {
    return args.slice(0, -1).some(arg => !!arg);
});
handlebars_1.default.registerHelper('unless', (conditional, options) => {
    if (!conditional) {
        return options.fn(this);
    }
    else {
        return options.inverse(this);
    }
});
handlebars_1.default.registerHelper('substring', (str, start, end) => {
    if (!str)
        return '';
    return end ? str.substring(start, end) : str.substring(start);
});
class EmailService {
    // Custom verification method
    static async verifyConnection() {
        return new Promise((resolve, reject) => {
            // @ts-ignore - Using internal verify method
            this.transporter.verify((error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    static async loadAndCompileTemplate(templateName) {
        logger_1.logger.debug(`loadAndCompileTemplate called for: ${templateName}`);
        logger_1.logger.debug(`__dirname: ${__dirname}`);
        // Try multiple possible paths to handle different environments
        const possiblePaths = [
            // Standard path (development)
            path_1.default.join(__dirname, '../templates/emails', `${templateName}.hbs`),
            // Production path with double templates folder
            path_1.default.join(__dirname, '../templates/templates/emails', `${templateName}.hbs`),
            // Fallback path
            path_1.default.join(process.cwd(), 'dist/templates/emails', `${templateName}.hbs`),
            // Another fallback path
            path_1.default.join(process.cwd(), 'dist/templates/templates/emails', `${templateName}.hbs`),
            // Source path
            path_1.default.join(process.cwd(), 'src/templates/emails', `${templateName}.hbs`)
        ];
        let templateContent = null;
        let loadedPath = null;
        // Try each path until we find one that works
        for (const templatePath of possiblePaths) {
            try {
                logger_1.logger.info(`Attempting to load email template from path: ${templatePath}`);
                templateContent = await fs_1.default.promises.readFile(templatePath, 'utf-8');
                loadedPath = templatePath;
                logger_1.logger.debug(`Successfully read template file: ${templatePath}`);
                break;
            }
            catch (error) {
                logger_1.logger.debug(`Template not found at ${templatePath}`);
                // Continue to the next path
            }
        }
        if (!templateContent) {
            const error = new Error(`Could not find template '${templateName}' in any of the expected locations`);
            logger_1.logger.error('Template loading error:', error);
            throw error;
        }
        return handlebars_1.default.compile(templateContent);
    }
    static async loadTemplate(templateName) {
        return this.loadAndCompileTemplate(templateName);
    }
    static async sendEmail(to, subject, html) {
        try {
            await this.transporter.sendMail({
                from: `${config_1.config.APP_NAME} <${config_1.config.SMTP_FROM}>`,
                to,
                subject,
                html,
                attachments: [{
                        filename: 'profileblack.png',
                        path: path_1.default.join(__dirname, '../../public/profileblack.png'),
                        cid: 'company-logo'
                    }]
            });
            logger_1.logger.info(`Email sent successfully to ${to}`);
        }
        catch (error) {
            logger_1.logger.error("Error sending email:", error);
            throw new Error(error instanceof Error ? error.message : 'Failed to send email');
        }
    }
    static async sendVerificationEmail(email, code, deviceInfo) {
        try {
            const template = await this.loadTemplate('verification-email');
            // Split the code into individual digits for the template
            const digits = code.split('');
            const html = template({
                digits,
                ipAddress: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.ipAddress) || 'Unknown',
                deviceInfo: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.userAgent) || 'Unknown Device',
                baseUrl: config_1.config.BASE_URL || 'http://localhost:3000'
            });
            await this.sendEmail(email, `Verify Your Account ${config_1.config.APP_NAME}`, html);
            logger_1.logger.info(`Verification email sent to ${email}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send verification email:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to send verification email');
        }
    }
    static async sendLogoutAllSessionsEmail(email, otp, deviceInfo) {
        try {
            const template = await this.loadTemplate('logout-all-sessions-email');
            const html = template({
                otp,
                ipAddress: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.ipAddress) || 'Unknown',
                deviceInfo: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.userAgent) || 'Unknown Device',
            });
            await this.sendEmail(email, `Logout All Sessions - ${config_1.config.APP_NAME}`, html);
        }
        catch (error) {
            logger_1.logger.error('Failed to send logout all sessions email:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to send logout all sessions email');
        }
    }
    static async sendPasswordResetEmail(email, resetUrl, name, expiryMinutes, deviceInfo) {
        try {
            // Ensure the reset URL is properly encoded
            const encodedResetUrl = encodeURI(resetUrl);
            logger_1.logger.info(`Sending password reset email with URL: ${encodedResetUrl}`);
            const template = await this.loadTemplate('password-reset-link');
            const html = template({
                resetUrl: encodedResetUrl,
                name,
                expiryMinutes,
                appName: config_1.config.APP_NAME || 'MyProfile',
                ipAddress: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.ipAddress) || 'Unknown',
                deviceInfo: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.userAgent) || 'Unknown Device',
            });
            await this.sendEmail(email, `Reset Your Password - ${config_1.config.APP_NAME || 'MyProfile'}`, html);
            logger_1.logger.info(`Password reset email sent successfully to ${email}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send password reset email:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to send password reset email');
        }
    }
    static async sendTwoFactorAuthEmail(email, code, deviceInfo) {
        try {
            const template = await this.loadTemplate('verification-email');
            const digits = code.split('');
            const html = template({
                digits,
                ipAddress: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.ipAddress) || 'Unknown',
                deviceInfo: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.userAgent) || 'Unknown Device',
                baseUrl: config_1.config.BASE_URL || 'http://localhost:3000'
            });
            await this.sendEmail(email, `Two-Factor Authentication - ${config_1.config.APP_NAME}`, html);
        }
        catch (error) {
            logger_1.logger.error('Failed to send 2FA email:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to send 2FA email');
        }
    }
    /**
     * Send an admin notification email
     * @param to Admin email address
     * @param subject Email subject
     * @param content HTML content of the email
     */
    static async sendAdminNotification(to, subject, content) {
        try {
            // For admin notifications, we'll use a simple HTML template
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${config_1.config.APP_NAME} Admin Notification</h2>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p>This is an automated message from the ${config_1.config.APP_NAME} system.</p>
              <p>© ${new Date().getFullYear()} ${config_1.config.APP_NAME}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
            await this.sendEmail(to, subject, html);
            logger_1.logger.info(`Admin notification email sent to ${to}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send admin notification email:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to send admin notification email');
        }
    }
    /**
     * Send login verification OTP email
     * @param email User's email address
     * @param code 6-digit OTP code
     * @param deviceInfo Optional device information
     */
    static async sendLoginVerificationOTP(email, code, deviceInfo) {
        try {
            const template = await this.loadTemplate('login-verification-otp');
            const digits = code.split('');
            // Get user's first name for personalization
            const User = require('../models/user.model').default;
            const user = await User.findOne({ email });
            const firstName = (user === null || user === void 0 ? void 0 : user.firstName) || 'User';
            const html = template({
                firstName,
                digits,
                loginTime: new Date(),
                ipAddress: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.ipAddress) || 'Not detected',
                deviceInfo: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.userAgent) || 'Not detected',
                location: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.location) || 'Not detected',
                expiryMinutes: this.OTP_EXPIRY_MINUTES,
                baseUrl: config_1.config.BASE_URL || 'http://localhost:3000'
            });
            await this.sendEmail(email, `Login Verification Code - ${config_1.config.APP_NAME}`, html);
            logger_1.logger.info(`Login verification OTP sent to ${email}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send login verification OTP:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to send login verification OTP');
        }
    }
    /**
     * Send password reset OTP email
     * @param email User's email address
     * @param code 6-digit OTP code
     * @param name User's name
     * @param resetContext Context information about what is being reset
     */
    static async sendPasswordResetOTP(email, code, name, resetContext) {
        try {
            const template = await this.loadTemplate('password-reset-otp');
            // Default context if not provided
            const context = resetContext || {
                type: 'password',
                identifier: email,
                requestedBy: 'password'
            };
            // Generate dynamic content based on reset type
            const getResetTitle = () => {
                switch (context.type) {
                    case 'email':
                        return 'Email Change Verification';
                    case 'username':
                        return 'Username Recovery';
                    case 'phone':
                        return 'Phone Number Change';
                    case 'account_recovery':
                        return 'Account Recovery';
                    default:
                        return 'Password Reset Code';
                }
            };
            const getResetSubtitle = () => {
                switch (context.type) {
                    case 'email':
                        return 'Secure email change verification';
                    case 'username':
                        return 'Recover your username securely';
                    case 'phone':
                        return 'Secure phone number change';
                    case 'account_recovery':
                        return 'Secure account recovery process';
                    default:
                        return 'Secure password reset verification';
                }
            };
            const getResetMessage = () => {
                switch (context.type) {
                    case 'email':
                        return `Hello ${name}, we've received a request to change your email address. Use the verification code below to confirm this change.`;
                    case 'username':
                        return `Hello ${name}, we've received a request to recover your username. Use the verification code below to proceed with username recovery.`;
                    case 'phone':
                        return `Hello ${name}, we've received a request to change your phone number. Use the verification code below to confirm this change.`;
                    case 'account_recovery':
                        return `Hello ${name}, we've received a request for account recovery. Use the verification code below to proceed with recovering your account.`;
                    default:
                        return `Hello ${name}, we've received a request to reset your password. Use the verification code below to proceed with resetting your password.`;
                }
            };
            const getSecurityMessage = () => {
                switch (context.type) {
                    case 'email':
                        return 'This email change verification code is for your protection. If you didn\'t request an email change, please ignore this email and contact our support team immediately.';
                    case 'username':
                        return 'This username recovery code is for your protection. If you didn\'t request username recovery, please ignore this email and contact our support team immediately.';
                    case 'phone':
                        return 'This phone number change verification code is for your protection. If you didn\'t request a phone number change, please ignore this email and contact our support team immediately.';
                    case 'account_recovery':
                        return 'This account recovery code is for your protection. If you didn\'t request account recovery, please ignore this email and contact our support team immediately.';
                    default:
                        return 'This password reset code is for your protection. If you didn\'t request a password reset, please ignore this email and contact our support team immediately.';
                }
            };
            const html = template({
                name,
                otpCode: code,
                expiryMinutes: this.OTP_EXPIRY_MINUTES,
                appName: config_1.config.APP_NAME || 'MyProfile',
                resetTitle: getResetTitle(),
                resetSubtitle: getResetSubtitle(),
                resetMessage: getResetMessage(),
                securityMessage: getSecurityMessage(),
                identifier: context.identifier || email,
                requestedBy: context.requestedBy || 'password reset'
            });
            await this.sendEmail(email, `${getResetTitle()} - ${config_1.config.APP_NAME}`, html);
            logger_1.logger.info(`${getResetTitle()} OTP sent to ${email}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to send ${(resetContext === null || resetContext === void 0 ? void 0 : resetContext.type) || 'password reset'} OTP:`, error);
            throw new Error(error instanceof Error ? error.message : `Failed to send ${(resetContext === null || resetContext === void 0 ? void 0 : resetContext.type) || 'password reset'} OTP`);
        }
    }
    /**
     * Send account verification OTP email (for registration)
     * @param email User's email address
     * @param code 6-digit OTP code
     * @param deviceInfo Optional device information
     */
    static async sendAccountVerificationOTP(email, code, deviceInfo) {
        try {
            const template = await this.loadTemplate('verification-email');
            const digits = code.split('');
            const html = template({
                digits,
                ipAddress: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.ipAddress) || 'Unknown',
                deviceInfo: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.userAgent) || 'Unknown Device',
                baseUrl: config_1.config.BASE_URL || 'http://localhost:3000'
            });
            await this.sendEmail(email, `Verify Your Account - ${config_1.config.APP_NAME}`, html);
            logger_1.logger.info(`Account verification OTP sent to ${email}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to send account verification OTP:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to send account verification OTP');
        }
    }
}
_a = EmailService;
EmailService.transporter = nodemailer_1.default.createTransport({
    host: config_1.config.SMTP_HOST,
    port: config_1.config.SMTP_PORT,
    secure: config_1.config.SMTP_PORT == 465, // Set dynamically: true if port is 465
    auth: {
        user: config_1.config.SMTP_USER,
        pass: config_1.config.SMTP_PASSWORD,
    },
});
EmailService.OTP_EXPIRY_MINUTES = 15;
// Verify email connection on service initialization
(() => {
    // Use a custom verification method instead of the built-in verify()
    _a.verifyConnection()
        .then(() => {
        const { log } = require('../utils/console-art');
        const chalk = require('chalk');
        logger_1.logger.info("Email Service Connected Successfully");
        log.success("✉️ Email Service Connected Successfully");
        log.info('Connection Details:');
        console.log(chalk.cyan(`   • SMTP Host: ${chalk.bold(config_1.config.SMTP_HOST)}`));
        console.log(chalk.cyan(`   • SMTP Port: ${chalk.bold(config_1.config.SMTP_PORT)}`));
        console.log(chalk.cyan(`   • From Address: ${chalk.bold(config_1.config.SMTP_FROM)}`));
    })
        .catch((error) => {
        const { log } = require('../utils/console-art');
        logger_1.logger.error("Email Service Connection Failed:", error);
        log.error("✉️ Email Service Connection Failed: " + (error instanceof Error ? error.message : String(error)));
    });
})();
exports.default = EmailService;
