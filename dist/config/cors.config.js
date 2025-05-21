"use strict";
/**
 * CORS configuration
 * Defines allowed origins for Cross-Origin Resource Sharing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.whitelistOrigins = void 0;
exports.whitelistOrigins = [
    // Local development
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:42133',
    'http://127.0.0.1:42133',
    'https://solid-trout-6jqrj4gpgrqfrv6x-3000.app.github.dev',
    // Production domains
    "https://my-pts-dashboard-management.vercel.app",
    "https://my-profile-web-olive.vercel.app",
    "https://new-backend-chat-system.onrender.com",
    "https://my-profile-server-api.onrender.com",
    "https://my-pts.vercel.app",
    // Environment variables
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    // Vercel preview deployments (for testing)
    /\.vercel\.app$/,
    // Allow all origins in development mode for easier testing
    ...(process.env.NODE_ENV === 'development' ? ['*'] : []),
].filter(Boolean);
