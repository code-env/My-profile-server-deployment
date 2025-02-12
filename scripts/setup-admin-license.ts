#!/usr/bin/env node
import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import { licenseManager } from '../src/utils/license-manager';
import { logger } from '../src/utils/logger';
import chalk from 'chalk';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Admin user details
const ADMIN_DETAILS = {
  employeeId: crypto.randomBytes(12).toString('hex'),
  name: 'Marco Blaise',
  email: 'marco.blaise@myprofile.com',
  department: 'Lead Software Engineering'
};

async function setupAdminLicense(): Promise<void> {
  try {
    const companySecret = process.env.COMPANY_SECRET;
    if (!companySecret) {
      throw new Error('COMPANY_SECRET not found in environment variables');
    }

    // Generate license
    console.log('\n=== MyProfile Admin License Setup ===\n');

    const license = licenseManager.generateLicense(ADMIN_DETAILS, companySecret);

    // Install the license
    licenseManager.installLicense(license);

    // Save license key to file
    const configPath = path.join(process.cwd(), '.env.license');
    fs.writeFileSync(configPath, `LICENSE_KEY=${license}\n`);

    // Now validate the installed license
    const validation = licenseManager.validateLicense(companySecret);

    if (!validation.isValid || !validation.employee) {
      throw new Error(`License validation failed: ${validation.error}`);
    }

    console.log(chalk.green('✔ Admin License Generated Successfully\n'));

    console.log('License Details:');
    console.log('---------------');
    console.log(chalk.cyan('Name:'), chalk.white(validation.employee.name));
    console.log(chalk.cyan('Email:'), chalk.white(validation.employee.email));
    console.log(chalk.cyan('Department:'), chalk.white(validation.employee.department));
    console.log(chalk.cyan('Issued:'), chalk.white(new Date(validation.employee.issuedAt).toLocaleDateString()));
    console.log(chalk.cyan('Expires:'), chalk.white(new Date(validation.employee.expiresAt).toLocaleDateString()));

    console.log('\nLicense Files:');
    console.log('-------------');
    console.log(chalk.green('✔'), '.license -', chalk.dim('Hardware-locked encrypted license data'));
    console.log(chalk.green('✔'), '.env.license -', chalk.dim('License key configuration'));

    console.log('\nNext Steps:');
    console.log('-----------');
    console.log('1. Add this to your .env file:');
    console.log(chalk.yellow(`LICENSE_KEY=${license}`));
    console.log('\n2. Verify your license:');
    console.log(chalk.yellow('npm run license:validate'));

  } catch (error) {
    logger.error('Failed to setup admin license:', error);
    console.error(chalk.red('\n✖ Error:'), error instanceof Error ? error.message : 'Unknown error');
    console.log('\nTo resolve:');
    console.log('1. Check that COMPANY_SECRET exists in your .env file');
    console.log('2. Run npm run license:generate-secret if needed');
    console.log('3. Try this command again\n');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  if (!process.env.COMPANY_SECRET) {
    console.error(chalk.red('\nError: COMPANY_SECRET not found in environment variables'));
    console.log('\nPlease run:');
    console.log('1. npm run license:generate-secret');
    console.log('2. Add the generated COMPANY_SECRET to your .env file');
    console.log('3. Try this command again\n');
    process.exit(1);
  }

  setupAdminLicense().catch(console.error);
}
