import nodemailer from "nodemailer";
import { config } from "../config/config";
import { logger } from "../utils/logger";
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

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

  private static async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
    const templateContent = await fs.promises.readFile(templatePath, 'utf-8');
    return Handlebars.compile(templateContent);
  }

  private static async sendEmail(to: string, subject: string, html: string) {
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
}

export default EmailService;
