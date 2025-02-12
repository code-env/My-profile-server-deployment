#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../../src/utils/logger';

/**
 * Example company secret and license format
 */
const exampleFormat = {
  COMPANY_SECRET: 'MyProfile-a7c07acfaed24731fefd16d48754432ffcdb1113fbc69c0e7616c4d6a31cd048',
  LICENSE_KEY: 'MP-306a0bf07cc7cd592c89e3b20af79662.0b638948b334ce24ab73415190857d29749651d52586f6d07c5bcb5197f81eb019597499681712fa72bd426cd263abdc2168415edae0cd49b71047ffcabfe45eaa946ca7d41314cfee97e7bafdcc83efc55f81dbd4b48605b839a75978018e14925c6fbe1063c1f27f5e62b96444.97224c047300b3120912199cffb7d048'
};

/**
 * Example employee data
 */
const exampleEmployee = {
  id: '507f1f77bcf86cd799439011',
  name: 'John Doe',
  email: 'john.doe@myprofile.com',
  department: 'Engineering'
};

/**
 * Main execution
 */
function main() {
  try {
    console.log('\n=== MyProfile License System Example ===\n');

    console.log('Step 1: Generate Company Secret');
    console.log('------------------------------');
    console.log('Command:');
    console.log('npm run generate-company-secret');
    console.log('\nThis will generate your master company secret in this format:');
    console.log(`COMPANY_SECRET=${exampleFormat.COMPANY_SECRET}`);

    console.log('\nStep 2: Generate Employee License');
    console.log('-------------------------------');
    console.log('Command:');
    console.log('npm run generate-license \\');
    console.log(`  ${exampleEmployee.id} \\`);
    console.log(`  "${exampleEmployee.name}" \\`);
    console.log(`  ${exampleEmployee.email} \\`);
    console.log(`  "${exampleEmployee.department}"`);

    console.log('\nThis will generate a hardware-locked license key in this format:');
    console.log(`LICENSE_KEY=${exampleFormat.LICENSE_KEY}`);

    // Save example to file
    const examplePath = path.join(__dirname, 'license-example.txt');
    const content = `# MyProfile License System Example
# ============================

# Step 1: Generate Company Secret
# ---------------------------
# Run: npm run generate-company-secret
# This generates your master company secret:

COMPANY_SECRET=${exampleFormat.COMPANY_SECRET}

# Step 2: Generate Employee License
# -----------------------------
# Run: npm run generate-license <employeeId> "<name>" "<email>" "<department>"
# Example command:
# npm run generate-license \\
#   ${exampleEmployee.id} \\
#   "${exampleEmployee.name}" \\
#   "${exampleEmployee.email}" \\
#   "${exampleEmployee.department}"

# This generates a hardware-locked license key:
LICENSE_KEY=${exampleFormat.LICENSE_KEY}

# Important Notes:
# -------------
# 1. Generate ONE company secret and keep it secure
# 2. Use the same company secret to generate all employee licenses
# 3. Each license is hardware-locked to the machine where it's generated
# 4. Never share the company secret - it's your master key
# 5. Each employee gets their own unique license key

# Usage:
# -----
# 1. Add to .env file on the employee's machine:
COMPANY_SECRET=${exampleFormat.COMPANY_SECRET}
LICENSE_KEY=${exampleFormat.LICENSE_KEY}
`;

    fs.writeFileSync(examplePath, content);
    console.log('\nExample file saved to:', examplePath);

    console.log('\nLicense System Structure:');
    console.log('----------------------');
    console.log('1. One master company secret for your organization');
    console.log('2. Individual hardware-locked license keys for each employee');
    console.log('3. License keys can only be used on the machine they were generated for');
    console.log('4. The company secret validates all license keys');

    console.log('\nSecurity Notes:');
    console.log('--------------');
    console.log('1. Keep your company secret secure - it validates all licenses');
    console.log('2. Generate licenses on employee machines to ensure hardware locking');
    console.log('3. Each employee needs both the company secret and their license key');
    console.log('4. License validation occurs on every server startup');

  } catch (error) {
    logger.error('Error creating example:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}
