// Jest setup file
jest.setTimeout(30000); // Set timeout to 30 seconds

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment the following lines to suppress specific console methods during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
}; 