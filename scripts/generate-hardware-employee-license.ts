#!/usr/bin/env node
import { licenseManager } from '../src/utils/license-manager';
import { config } from '../src/config/config';
import { logger } from '../src/utils/logger';
import chalk from 'chalk';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';

// Load environment variables
dotenv.config();

const args = process.argv.slice(2);

if (args.length !== 4) {
  console.error(chalk.red(`
Usage: generate-hardware-employee-license <employeeId> <employeeName> <employeeEmail> <department>
Example: generate-hardware-employee-license 507f1f77bcf86cd799439011 "John Doe" john.doe@myprofile.com "Engineering"
  `));
  process.exit(1);
}

const [employeeId, employeeName, employeeEmail, department] = args;

async function sendLicenseEmail(
  employeeName: string,
  employeeEmail: string,
  licenseKey: string
): Promise<void> {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Create email content
    const emailContent = `
    <h2>MyProfile License Key</h2>
    <p>Dear ${employeeName},</p>
    <p>Welcome to MyProfile! Your license key has been generated. Please follow these instructions to activate your license:</p>

    <h3>Your License Key:</h3>
    <pre style="background-color: #f4f4f4; padding: 10px; border-radius: 5px;">
LICENSE_KEY=${licenseKey}
    </pre>

    <h3>Installation Instructions:</h3>
    <ol>
      <li>Create a .env file in your project root directory (if it doesn't exist)</li>
      <li>Add the following line to your .env file:</li>
      <pre style="background-color: #f4f4f4; padding: 10px; border-radius: 5px;">
LICENSE_KEY=${licenseKey}
      </pre>
      <li>Start the application - your license will be validated automatically</li>
    </ol>

    <p><strong>Important Notes:</strong></p>
    <ul>
      <li>This license is hardware-locked to your machine</li>
      <li>The license will expire in 1 year from activation</li>
      <li>Do not share your license key with others</li>
    </ul>

    <p>If you have any issues activating your license, please contact your administrator.</p>

    <p>Best regards,<br>
    Marco Blaise<br>
    MyProfile Administrator</p>
    `;

    await transporter.sendMail({
      from: `"MyProfile Admin" <${process.env.SMTP_FROM}>`,
      to: employeeEmail,
      subject: 'Your MyProfile License Key',
      html: emailContent,
    });

    console.log(chalk.green(`\n✓ License key sent to ${employeeEmail}`));

  } catch (error) {
    logger.error('Failed to send license email:', error);
    console.error(chalk.red('\nWarning: Could not send email with license key'));
    console.error(chalk.yellow('Please provide the license key to the employee manually'));
  }
}

async function generateHardwareEmployeeLicense(): Promise<void> {
  try {
    // Check for existing company secret
    if (!process.env.COMPANY_SECRET) {
      console.error(chalk.red('Error: COMPANY_SECRET not found in environment variables'));
      console.log(chalk.yellow('\nPlease ensure COMPANY_SECRET is set in your .env file'));
      process.exit(1);
    }

    // Generate license with hardware lock for current machine
    const employeeData = {
      employeeId,
      name: employeeName,
      email: employeeEmail,
      department
    };

    // Generate license key but don't install it
    const licenseKey = licenseManager.generateLicense(employeeData, process.env.COMPANY_SECRET);

    // Format output for admin
    console.log('\n=== MyProfile Hardware-Locked License ===\n');

    console.log('Generated License for Employee:');
    console.log('-----------------------------');
    console.log(chalk.cyan(`Name: ${employeeName}`));
    console.log(chalk.cyan(`Email: ${employeeEmail}`));
    console.log(chalk.cyan(`Department: ${department}`));

    // Send license key via email
    await sendLicenseEmail(employeeName, employeeEmail, licenseKey);

    console.log('\nLicense Details (Admin Reference):');
    console.log('--------------------------------');
    console.log(chalk.yellow('1. License is hardware-locked to the employee\'s machine'));
    console.log(chalk.yellow('2. License will expire in 1 year from activation'));
    console.log(chalk.yellow('3. License key has been emailed to the employee'));

    // Also show the license key in console for backup purposes
    console.log('\nBackup License Key:');
    console.log('----------------');
    console.log(chalk.dim(`LICENSE_KEY=${licenseKey}`));

  } catch (error) {
    logger.error('Error generating license:', error);
    console.error(chalk.red('\nFailed to generate license. Error:', error));
    process.exit(1);
  }
}

generateHardwareEmployeeLicense().catch(console.error);
