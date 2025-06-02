// Import Jest types
require('@jest/globals');

// Increase the default timeout
jest.setTimeout(10000);

// Suppress console output during tests
global.console = {
  ...console,
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 