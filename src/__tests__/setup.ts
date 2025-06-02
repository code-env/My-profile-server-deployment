import mongoose from 'mongoose';
import '@jest/globals';

// Extend NodeJS.Global interface to include Jest functions
declare global {
  namespace NodeJS {
    interface Global {
      beforeAll: typeof beforeAll;
      afterAll: typeof afterAll;
      jest: typeof jest;
    }
  }
}

beforeAll(async () => {
  // Increase timeout for slow operations
  jest.setTimeout(10000);
});

afterAll(async () => {
  // Ensure all connections are closed
  await mongoose.connection.close();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in test environment
});

// Suppress console logs during tests unless explicitly enabled
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 