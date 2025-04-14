/**
 * CORS configuration
 * Defines allowed origins for Cross-Origin Resource Sharing
 */

export const whitelistOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:5000',  // Chat system
  'http://127.0.0.1:5000', // Chat system
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:42133',
  'http://127.0.0.1:42133',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];
