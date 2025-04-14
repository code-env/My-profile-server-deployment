#!/usr/bin/env node
import { config } from '../src/config/config';
import { licenseManager } from '../src/utils/license-manager';
import { logger } from '../src/utils/logger';
import chalk from 'chalk';

async function listLicensedEmployees(): Promise<void> {
  try {
    console.log('\n=== MyProfile License Status ===\n');

    // Try to read and validate the current license
    if (!config.COMPANY_SECRET) {
      console.log(chalk.red('Error: COMPANY_SECRET environment variable is required'));
      console.log(chalk.yellow('\nAdd COMPANY_SECRET to your .env file or environment variables'));
      return;
    }

    const result = licenseManager.validateLicense(config.COMPANY_SECRET);

    if (!result.isValid) {
      console.log(chalk.yellow('No valid license found on this machine'));
      if (result.error) {
        console.log(chalk.red(`Error: ${result.error}`));
      }
      console.log(chalk.cyan('\nTo install a license:'));
      console.log('1. Obtain a LICENSE_KEY from your administrator');
      console.log('2. Add it to your .env file or environment variables');
      console.log('3. Restart the application');
      return;
    }

    const license = result.employee;
    if (!license) {
      console.log(chalk.yellow('No license information found'));
      return;
    }

    // Display license in a formatted table
    console.log(chalk.green('✓ Valid License Found\n'));
    console.log('Current License Details:');
    console.log('─'.repeat(100));
    console.log(
      chalk.bold(
        'Name'.padEnd(25) +
        'Email'.padEnd(35) +
        'Department'.padEnd(20) +
        'Status'
      )
    );
    console.log('─'.repeat(100));

    // Calculate days until expiration
    const now = new Date();
    const expiryDate = new Date(license.expiresAt);
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    const expiryStatus = daysRemaining > 30
      ? chalk.green(`Valid (${daysRemaining} days remaining)`)
      : chalk.yellow(`Expiring soon (${daysRemaining} days remaining)`);

    console.log(
      chalk.white(license.name.padEnd(25)) +
      chalk.cyan(license.email.padEnd(35)) +
      chalk.yellow(license.department.padEnd(20)) +
      expiryStatus
    );

    console.log('─'.repeat(100));
    console.log('\nLicense Details:');
    console.log('----------------');
    console.log(`Issued: ${new Date(license.issuedAt).toLocaleDateString()}`);
    console.log(`Expires: ${new Date(license.expiresAt).toLocaleDateString()}`);
    console.log(`Hardware Lock: ${license.hardwareFingerprint}`);

  } catch (error) {
    logger.error('Error reading license:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  listLicensedEmployees().catch(console.error);
}
