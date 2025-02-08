/**
 * CORS configuration
 * Defines allowed origins for Cross-Origin Resource Sharing
 */

export const whitelistOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];
