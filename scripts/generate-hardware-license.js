#!/usr/bin/env node

/**
 * Hardware-Locked License Generator
 * ===============================
 * This script generates a license key that's locked to the current machine's
 * hardware configuration. The generated license key will only work on this
 * specific machine.
 */

const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Constants
const ENCRYPTION_KEY = 'your-secret-encryption-key-here';
const REQUIRED_PREFIX = 'MP-';
const LICENSE_LENGTH = 32;

// Generate hardware fingerprint
function generateHardwareFingerprint() {
    const cpu = os.cpus()[0]?.model || '';
    const totalMem = os.totalmem();
    const hostname = os.hostname();
    const platform = os.platform();
    const release = os.release();
    const networkInterfaces = os.networkInterfaces();

    // Get MAC address
    let macAddress = '';
    Object.values(networkInterfaces).forEach(interfaces => {
        interfaces?.forEach(details => {
            if (!details.internal && !macAddress) {
                macAddress = details.mac;
            }
        });
    });

    const hardwareString = `${cpu}-${totalMem}-${hostname}-${platform}-${release}-${macAddress}`;
    return crypto
        .createHash('sha256')
        .update(hardwareString)
        .digest('hex');
}

// Generate encrypted license key
function generateLicense(hardwareHash) {
    const licenseData = {
        hardwareHash,
        customerId: 'LOCAL-DEV',
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        features: ['all'],
        generatedAt: new Date().toISOString()
    };

    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(JSON.stringify(licenseData), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Ensure the encrypted part fits within our length requirements
    const maxEncryptedLength = LICENSE_LENGTH - REQUIRED_PREFIX.length;
    encrypted = encrypted.substring(0, maxEncryptedLength);

    return `${REQUIRED_PREFIX}${encrypted}`;
}

// Main execution
const hardwareHash = generateHardwareFingerprint();
const licenseKey = generateLicense(hardwareHash);

// Update the source code with the hardware hash
const licenseFilePath = path.join(__dirname, '..', 'src', 'utils', 'license.ts');
let licenseFileContent = fs.readFileSync(licenseFilePath, 'utf8');

// Replace the VALID_HARDWARE_HASHES array
const hashArrayRegex = /private static readonly VALID_HARDWARE_HASHES: string\[\] = \[([\s\S]*?)\];/;
const newHashArray = `private static readonly VALID_HARDWARE_HASHES: string[] = [
    '${hardwareHash}' // Generated for this machine
  ];`;

licenseFileContent = licenseFileContent.replace(hashArrayRegex, newHashArray);

// Save the updated file
fs.writeFileSync(licenseFilePath, licenseFileContent);

console.log('\nHardware-Locked License Generated');
console.log('===============================');
console.log('\nHardware Hash:', hardwareHash);
console.log('License Key:', licenseKey);
console.log('\nThis license key has been locked to your current hardware configuration.');
console.log('The license.ts file has been updated with your hardware hash.');
console.log('\nTo use this license:');
console.log('1. Add this to your .env file:');
console.log(`   LICENSE_KEY=${licenseKey}`);
console.log('2. Add this to your Render environment variables if deploying there.');
console.log('\nNOTE: This license will only work on this specific machine.');
console.log('Generate a new license on each machine where you want to run the application.\n');
