"use strict";
/**
 * @file server.ts
 * @description Application Entry Point for My Profile Platform
 * ==========================================================
 *
 * This is the main entry point for the My Profile server application.
 * It initializes environment variables and starts the server instance.
 *
 * Key responsibilities:
 * - Load environment variables before any other imports
 * - Initialize and start the server instance
 * - Handle startup errors gracefully
 * - Ensure proper process termination on failure
 *
 * Server initialization sequence:
 * 1. Load .env configuration
 * 2. Import server instance
 * 3. Start server with error handling
 *
 * @requires dotenv
 * @requires ./app
 *
 * @version 1.0.0
 * @license MIT
 * @author Marco Blaise
 * @copyright 2025 My Profile
 *
 * Environment Variables:
 * @see .env file for all required environment variables
 *
 * Error Handling:
 * - Catches and logs startup errors
 * - Ensures clean process exit on failure
 * - Proper error propagation to process manager
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Configure environment variables before other imports
// This ensures environment variables are available to all subsequent imports
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
/**
 * Server Startup Sequence
 * ----------------------
 * Initializes and starts the server with proper error handling.
 * Any startup errors will be logged and result in process termination.
 *
 * @throws {Error} If server fails to start
 * @exits Process exits with code 1 on startup failure
 */
app_1.default.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
/**
 * Production Notes:
 * ----------------
 * - Ensure all required environment variables are set
 * - Use process manager (e.g., PM2) in production
 * - Monitor process exit codes for troubleshooting
 * - Configure proper logging in production environment
 */
