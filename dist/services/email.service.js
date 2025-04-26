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
class EmailService {
    static async loadAndCompileTemplate(templateName) {
        const templatePath = path_1.default.join(__dirname, '../templates', `${templateName}.html`);
        const templateContent = await fs_1.default.promises.readFile(templatePath, 'utf-8');
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
    static async sendPasswordResetEmail(email, code, deviceInfo) {
        try {
            const template = await this.loadTemplate('verification-email');
            const digits = code.split('');
            const html = template({
                digits,
                ipAddress: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.ipAddress) || 'Unknown',
                deviceInfo: (deviceInfo === null || deviceInfo === void 0 ? void 0 : deviceInfo.userAgent) || 'Unknown Device',
                baseUrl: config_1.config.BASE_URL || 'http://localhost:3000'
            });
            await this.sendEmail(email, `Reset Your Password - ${config_1.config.APP_NAME}`, html);
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
    // service: "gmail",  // REMOVE THIS LINE
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
