#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../src/utils/logger';

/**
 * Generates a new company secret for license validation
 */
function generateCompanySecret(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `MyProfile-${randomBytes}`;
}

/**
 * Main execution
 */
function main() {
  try {
    const companySecret = generateCompanySecret();

    console.log('\n=== MyProfile Company Secret Generator ===\n');

    console.log('Generated Company Secret:');
    console.log('------------------------');
    console.log(companySecret);

    console.log('\nConfiguration:');
    console.log('--------------');
    console.log('Add to your .env file:');
    console.log(`COMPANY_SECRET=${companySecret}`);

    // Save to example file
    const examplePath = path.join(__dirname, 'company-secret-example.txt');
    const content = `# MyProfile Company Secret
# ===================
# WARNING: This is your company's master secret for license validation.
# Keep this secret and secure. Never share or commit to version control.

COMPANY_SECRET=${companySecret}

# Usage Instructions:
# ----------------
# 1. Add this secret to your .env file
# 2. Use this secret to generate and validate employee license keys
# 3. Keep this secret secure - it's the master key for your licensing system
# 4. Never share this secret with employees
# 5. Backup this secret securely - you'll need it to validate all licenses
`;

    fs.writeFileSync(examplePath, content);
    console.log(`\nSecret saved to: ${examplePath}`);

    console.log('\nIMPORTANT SECURITY NOTES:');
    console.log('=======================');
    console.log('1. This is your MASTER company secret');
    console.log('2. Keep this secret secure and private');
    console.log('3. Never commit this secret to version control');
    console.log('4. Required for generating and validating ALL license keys');
    console.log('5. If compromised, all licenses would need to be regenerated');
    console.log('\nNext Steps:');
    console.log('-----------');
    console.log('1. Add the COMPANY_SECRET to your .env file');
    console.log('2. Use npm run generate-license to create employee licenses');
    console.log('3. Backup this secret securely');

  } catch (error) {
    logger.error('Failed to generate company secret:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}
