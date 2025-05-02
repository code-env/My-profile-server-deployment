import nodemailer from "nodemailer";
import { config } from "../config/config";
import { logger } from "../utils/logger";
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

// Register Handlebars helpers
Handlebars.registerHelper('gt', function(a, b) {
  return a > b;
});

Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

Handlebars.registerHelper('formatNumber', function(num) {
  return num.toLocaleString();
});

Handlebars.registerHelper('formatDate', function(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

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
  private static transporter = nodemailer.createTransport({
    // service: "gmail",  // REMOVE THIS LINE
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT == 465, // Set dynamically: true if port is 465
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASSWORD,
    },
  });

  private static OTP_EXPIRY_MINUTES = 15;

  // Verify email connection on service initialization
  static {
    this.transporter
      .verify()
      .then(() => {
        const { log } = require('../utils/console-art');
        const chalk = require('chalk');
        logger.info("Email Service Connected Successfully");
        log.success("✉️ Email Service Connected Successfully");
        log.info('Connection Details:');
        console.log(chalk.cyan(`   • SMTP Host: ${chalk.bold(config.SMTP_HOST)}`));
        console.log(chalk.cyan(`   • SMTP Port: ${chalk.bold(config.SMTP_PORT)}`));
        console.log(chalk.cyan(`   • From Address: ${chalk.bold(config.SMTP_FROM)}`));
      })
      .catch((error: unknown) => {
        const { log } = require('../utils/console-art');
        logger.error("Email Service Connection Failed:", error);
        log.error("✉️ Email Service Connection Failed: " + (error instanceof Error ? error.message : String(error)));
      });
  }

  public static async loadAndCompileTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
    const templateContent = await fs.promises.readFile(templatePath, 'utf-8');
    return Handlebars.compile(templateContent);
  }

  private static async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    return this.loadAndCompileTemplate(templateName);
  }

  public static async sendEmail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: `${config.APP_NAME} <${config.SMTP_FROM}>`,
        to,
        subject,
        html,
        attachments: [{
          filename: 'profileblack.png',
          path: path.join(__dirname, '../../public/profileblack.png'),
          cid: 'company-logo'
        }]
      });

      logger.info(`Email sent successfully to ${to}`);
    } catch (error: unknown) {
      logger.error("Error sending email:", error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send email');
    }
  }

  public static async sendVerificationEmail(
    email: string,
    code: string,
    deviceInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      const template = await this.loadTemplate('verification-email');

      // Split the code into individual digits for the template
      const digits = code.split('');

      const html = template({
        digits,
        ipAddress: deviceInfo?.ipAddress || 'Unknown',
        deviceInfo: deviceInfo?.userAgent || 'Unknown Device',
        baseUrl: config.BASE_URL || 'http://localhost:3000'
      });

      await this.sendEmail(
        email,
        `Verify Your Account ${config.APP_NAME}`,
        html
      );

      logger.info(`Verification email sent to ${email}`);
    } catch (error: unknown) {
      logger.error('Failed to send verification email:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send verification email');
    }
  }

  public static async sendPasswordResetEmail(
    email: string,
    code: string,
    deviceInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      const template = await this.loadTemplate('verification-email');

      const digits = code.split('');

      const html = template({
        digits,
        ipAddress: deviceInfo?.ipAddress || 'Unknown',
        deviceInfo: deviceInfo?.userAgent || 'Unknown Device',
        baseUrl: config.BASE_URL || 'http://localhost:3000'
      });

      await this.sendEmail(
        email,
        `Reset Your Password - ${config.APP_NAME}`,
        html
      );
    } catch (error: unknown) {
      logger.error('Failed to send password reset email:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send password reset email');
    }
  }

  public static async sendTwoFactorAuthEmail(
    email: string,
    code: string,
    deviceInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      const template = await this.loadTemplate('verification-email');

      const digits = code.split('');

      const html = template({
        digits,
        ipAddress: deviceInfo?.ipAddress || 'Unknown',
        deviceInfo: deviceInfo?.userAgent || 'Unknown Device',
        baseUrl: config.BASE_URL || 'http://localhost:3000'
      });

      await this.sendEmail(
        email,
        `Two-Factor Authentication - ${config.APP_NAME}`,
        html
      );
    } catch (error: unknown) {
      logger.error('Failed to send 2FA email:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send 2FA email');
    }
  }

  /**
   * Send an admin notification email
   * @param to Admin email address
   * @param subject Email subject
   * @param content HTML content of the email
   */
  public static async sendAdminNotification(
    to: string,
    subject: string,
    content: string
  ): Promise<void> {
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
              <h2>${config.APP_NAME} Admin Notification</h2>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p>This is an automated message from the ${config.APP_NAME} system.</p>
              <p>© ${new Date().getFullYear()} ${config.APP_NAME}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.sendEmail(to, subject, html);
      logger.info(`Admin notification email sent to ${to}`);
    } catch (error: unknown) {
      logger.error('Failed to send admin notification email:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send admin notification email');
    }
  }
}

export default EmailService;
