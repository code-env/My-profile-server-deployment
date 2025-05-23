/**
 * Runner script for the profile username update
 *
 * This script compiles and runs the TypeScript update-profile-usernames.ts script
 */

const { exec } = require('child_process');
const path = require('path');

// Path to the TypeScript script
const scriptPath = path.join(__dirname, 'update-profile-usernames.ts');

// Command to run the TypeScript script using ts-node
const command = `npx ts-node ${scriptPath}`;

console.log(`Running: ${command}`);

// Execute the command
const child = exec(command);

// Forward stdout and stderr to the console
child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Handle process exit
child.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
  process.exit(code);
});
