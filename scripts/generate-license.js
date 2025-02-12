#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

if (!process.env.COMPANY_SECRET) {
  console.error('Error: COMPANY_SECRET environment variable is required');
  process.exit(1);
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: npm run generate-license <id> <name> <role> [--save]');
  console.error('Example: npm run generate-license MP001 "John Doe" "Developer" --save');
  process.exit(1);
}

const [developerId, developerName, developerRole] = args;
const shouldSave = args.includes('--save');

// License data
const licenseData = {
  developerId,
  name: developerName,
  role: developerRole,
  issuedAt: new Date().toISOString()
};

// Generate license key
function generateLicenseKey(data, secret) {
  // Generate a random IV
  const iv = crypto.randomBytes(12);

  // Generate key from secret
  const key = crypto.scryptSync(secret, 'salt', 32);

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Encrypt the data
  const dataStr = JSON.stringify(data);
  let encrypted = cipher.update(dataStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get the auth tag
  const authTag = cipher.getAuthTag();

  // Create the license key string
  return `MP-${iv.toString('hex')}.${encrypted}.${authTag.toString('hex')}`;
}

// Generate the license key
const licenseKey = generateLicenseKey(licenseData, process.env.COMPANY_SECRET);

if (shouldSave) {
  // Update developers.ts
  const developersPath = path.join(__dirname, '../src/utils/developers.ts');
  let developersContent = `import { Developer } from './types';\n\n`;
  developersContent += `export const developers: Developer[] = [\n`;
  developersContent += `  {\n`;
  developersContent += `    id: '${developerId}',\n`;
  developersContent += `    name: '${developerName}',\n`;
  developersContent += `    role: '${developerRole}',\n`;
  developersContent += `    issuedAt: '${licenseData.issuedAt}'\n`;
  developersContent += `  }\n`;
  developersContent += `];\n`;

  fs.writeFileSync(developersPath, developersContent);
  console.log('Updated src/utils/developers.ts');

  // Update .env file
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8')
      .split('\n')
      .filter(line => !line.startsWith('LICENSE_KEY='))
      .join('\n');
    if (!envContent.endsWith('\n')) envContent += '\n';
  }

  envContent += `LICENSE_KEY=${licenseKey}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log('Updated LICENSE_KEY in .env');

  // Log success
  console.log('\nLicense setup completed successfully!');
  console.log(`Developer ID: ${developerId}`);
  console.log(`Name: ${developerName}`);
  console.log(`Role: ${developerRole}`);
  console.log('\nThe license key has been saved to your .env file.');
} else {
  // Just display the license key
  console.log('\nGenerated License Key:');
  console.log(licenseKey);
  console.log('\nUse --save to automatically update developers.ts and .env');
}
