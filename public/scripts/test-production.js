#!/usr/bin/env node

/**
 * Production Environment Test Script
 * ================================
 * This script tests the application in a production-like environment
 * to verify license key validation and other production behaviors.
 */

const { spawn } = require('child_process');

// Test license key following the required format
const testLicenseKey = 'MP-1234567890123456789012345678TEST';

console.log('\n🚀 Starting Production Environment Test');
console.log('=====================================');
console.log('Test License Key:', testLicenseKey);

// Create production-like environment variables
const testEnv = {
  ...process.env,
  NODE_ENV: 'production',
  LICENSE_KEY: testLicenseKey,
  PORT: '5000'
};

// Options for the child process
const options = {
  env: testEnv,
  stdio: ['inherit', 'inherit', 'inherit']
};

console.log('\n📝 Environment Configuration:');
console.log('NODE_ENV:', testEnv.NODE_ENV);
console.log('PORT:', testEnv.PORT);
console.log('LICENSE_KEY:', testEnv.LICENSE_KEY);

console.log('\n🔄 Starting application in production mode...\n');

// Start the application
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npm, ['start'], options);

// Handle process events
child.on('error', (err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (code !== null) {
    console.log(`Application exited with code ${code}`);
  } else if (signal !== null) {
    console.log(`Application was terminated with signal ${signal}`);
  }
});

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping test environment...');
  child.kill();
  process.exit();
});

console.log('\n❗ Press Ctrl+C to stop the test\n');
