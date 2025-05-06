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
handlebars_1.default.registerHelper('gt', function (a, b) {
    return a > b;
});
handlebars_1.default.registerHelper('eq', function (a, b) {
    return a === b;
});
handlebars_1.default.registerHelper('formatNumber', function (num) {
    return num.toLocaleString();
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
class EmailService {
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
    _a.transporter
        .verify()
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
