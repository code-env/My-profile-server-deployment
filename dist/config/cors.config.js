"use strict";
/**
 * CORS configuration
 * Defines allowed origins for Cross-Origin Resource Sharing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.whitelistOrigins = void 0;
exports.whitelistOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    process.env.CLIENT_URL,
].filter(Boolean);
