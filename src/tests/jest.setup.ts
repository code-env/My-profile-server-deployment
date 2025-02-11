import mongoose from 'mongoose';


afterAll(async () => {
  await mongoose.disconnect();
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
