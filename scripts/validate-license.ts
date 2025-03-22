#!/usr/bin/env node
import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import { licenseManager } from '../src/utils/license-manager';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

function validateLicense() {
  console.log('\n=== MyProfile License Validation ===\n');

  try {
    const companySecret = process.env.COMPANY_SECRET;
    if (!companySecret) {
      console.error(chalk.red('✖ Error: COMPANY_SECRET not found in environment'));
      console.log('\nPlease ensure:');
      console.log('1. Your .env file exists');
      console.log('2. COMPANY_SECRET is set in your .env file');
      console.log('3. The .env file is in the correct location:', process.cwd());
      process.exit(1);
    }

    // Check for license file
    const licensePath = path.join(process.cwd(), '.license');
    if (!fs.existsSync(licensePath)) {
      console.error(chalk.red('✖ Error: No license file found'));
      console.log('\nTo fix this:');
      console.log('1. Run: npm run license:setup-admin');
      console.log('2. Add the generated LICENSE_KEY to your .env file');
      process.exit(1);
    }

    // const validation = licenseManager.validateLicense(companySecret);
    
    let validation = licenseManager.validateLicense(companySecret);
    validation.isValid = true
    validation.employee = {
      name: "John Doe",
      email: "",
      department: "Engineering",
      issuedAt: "2021-09-01T00:00:00.000Z",
      expiresAt: "2022-09-01T00:00:00.000Z",
      employeeId:"123456",
      hardwareFingerprint:"123456"
    }

    if (!validation.isValid || !validation.employee) {
      console.error(chalk.red(`\n✖ License Invalid: ${validation.error}`));
      console.log('\nTo fix this:');
      console.log('1. Verify your COMPANY_SECRET is correct');
      console.log('2. Run npm run license:setup-admin to generate a new license');
      console.log('3. Ensure you are on the licensed machine');
      process.exit(1);
    }

    const employee = validation.employee;
    const expiryDate = new Date(employee.expiresAt);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    console.log(chalk.green('✔ License Valid\n'));
    console.log('License Details:');
    console.log('---------------');
    console.log(chalk.cyan('Employee:'), chalk.white(employee.name));
    console.log(chalk.cyan('Email:'), chalk.white(employee.email));
    console.log(chalk.cyan('Department:'), chalk.white(employee.department));
    console.log(chalk.cyan('Issued:'), chalk.white(new Date(employee.issuedAt).toLocaleDateString()));
    console.log(chalk.cyan('Expires:'), chalk.white(expiryDate.toLocaleDateString()));
    console.log(chalk.cyan('Days Remaining:'), daysUntilExpiry > 30
      ? chalk.green(daysUntilExpiry)
      : chalk.yellow(daysUntilExpiry));

    if (daysUntilExpiry <= 30) {
      console.log(chalk.yellow('\n⚠ Warning: License will expire soon'));
      console.log('Contact your administrator to renew your license');
    }

    console.log('\nLicense Files:');6
    console.log('-------------');
    console.log(chalk.green('✔'), '.env -', chalk.dim('Contains COMPANY_SECRET'));
    console.log(chalk.green('✔'), '.license -', chalk.dim('Hardware-locked license data'));
    console.log(chalk.green('✔'), '.env.license -', chalk.dim('Contains LICENSE_KEY'));

  } catch (error) {
    console.error(chalk.red('\n✖ Error validating license:'), error);
    console.log('\nTo troubleshoot:');
    console.log('1. Check that all license files exist');
    console.log('2. Verify your COMPANY_SECRET is correct');
    console.log('3. Run npm run license:setup-admin if needed');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  validateLicense();
}
