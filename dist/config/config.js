"use strict";
/**
 * @file config.ts
 * @description Configuration Management System
 * ==========================================
 *
 * This module provides a robust configuration management system with runtime
 * validation using Zod schema validation. It ensures type safety and proper
 * configuration loading across different environments.
 *
 * Features:
 * - Environment variable validation
 * - Type-safe configuration
 * - Default values management
 * - Strict runtime checking
 * - Grouped configuration settings
 *
 * @version 1.0.0
 * @license MIT
 * @author Marco Blaise
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
// Load environment variables before validation
dotenv_1.default.config();
/**
 * Configuration Schema Definition
 * ------------------------------
 * Defines the structure and validation rules for all configuration values.
 * Each field is strictly typed and validated at runtime.
 *
 * Groups:
 * - Core Application Settings
 * - Security & Authentication
 * - SSL Configuration
 * - Communication Services (Twilio)
 * - Email Settings
 * - OAuth Providers
 */
const envSchema = zod_1.z.object({
    // Core Application Settings
    NODE_ENV: zod_1.z
        .enum(["development", "production", "test"])
        .default("development"),
    PORT: zod_1.z.coerce.number().default(8080),
    MONGODB_URI: zod_1.z.string(),
    BASE_URL: zod_1.z.string().default('http://localhost:3000'),
    API_URL: zod_1.z.string().default("http://localhost:5000"),
    CLIENT_URL: zod_1.z.string().default("http://localhost:3000"),
    APP_NAME: zod_1.z.string().default("MyProfile"),
    COMPANY_SECRET: zod_1.z.string(),
    SUPPORT_EMAIL: zod_1.z.string().default("support@myprofile.ltd"),
    SUPPORT_PHONE: zod_1.z.string().default("+237693028598"),
    // Security & Authentication
    JWT_SECRET: zod_1.z.string(),
    JWT_REFRESH_SECRET: zod_1.z.string(),
    JWT_ACCESS_EXPIRATION: zod_1.z.string().default("24h"), // Increased
    JWT_REFRESH_EXPIRATION: zod_1.z.string().default("30d"), // Increased
    COOKIE_SECRET: zod_1.z.string(),
    RENDER_NODE_ENV: zod_1.z.string().optional(),
    // SSL Configuration
    SSL_KEY_PATH: zod_1.z.string().optional(),
    SSL_CERT_PATH: zod_1.z.string().optional(),
    SSL_ENABLED: zod_1.z.string().default("false"),
    // Communication Services
    TWILIO_ACCOUNT_SID: zod_1.z.string().optional(),
    TWILIO_AUTH_TOKEN: zod_1.z.string().optional(),
    TWILIO_PHONE_NUMBER: zod_1.z.string().optional(),
    // Email Configuration
    SMTP_HOST: zod_1.z.string(),
    SMTP_PORT: zod_1.z.coerce.number().default(587),
    SMTP_USER: zod_1.z.string(),
    SMTP_PASSWORD: zod_1.z.string(),
    SMTP_FROM: zod_1.z.string(),
    SMTP_SERVICE: zod_1.z.string().default("gmail"),
    // OAuth Configuration
    GOOGLE_CLIENT_ID: zod_1.z.string(),
    GOOGLE_CLIENT_SECRET: zod_1.z.string(),
    FACEBOOK_APP_ID: zod_1.z.string(),
    FACEBOOK_APP_SECRET: zod_1.z.string(),
});
/**
 * Configuration Validator
 * ---------------------
 * Validates and parses environment variables according to the defined schema.
 *
 * @throws {Error} If validation fails or required environment variables are missing
 * @returns {z.infer<typeof envSchema>} Validated configuration object
 *
 * Security Note:
 * - Sensitive values should never be logged or exposed in responses
 * - Use appropriate security measures when handling secrets
 *
 * Usage:
 * ```typescript
 * import { config } from './config';
 * console.log(config.PORT); // Typed and validated access
 * ```
 */
const getConfig = () => {
    var _a;
    try {
        const parsedConfig = envSchema.parse({
            // Core Application Settings
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            MONGODB_URI: process.env.MONGODB_URI,
            BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
            API_URL: process.env.API_URL,
            CLIENT_URL: process.env.CLIENT_URL,
            APP_NAME: process.env.APP_NAME,
            COMPANY_SECRET: process.env.COMPANY_SECRET,
            // Security & Authentication
            JWT_SECRET: process.env.JWT_SECRET,
            JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
            JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION,
            JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION,
            COOKIE_SECRET: process.env.COOKIE_SECRET,
            // SSL Configuration
            SSL_KEY_PATH: process.env.SSL_KEY_PATH,
            SSL_CERT_PATH: process.env.SSL_CERT_PATH,
            SSL_ENABLED: process.env.SSL_ENABLED,
            // Communication Services
            TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
            TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
            // Email Configuration
            SMTP_HOST: process.env.SMTP_HOST,
            SMTP_PORT: process.env.SMTP_PORT,
            SMTP_USER: process.env.SMTP_USER,
            SMTP_PASSWORD: process.env.SMTP_PASSWORD,
            SMTP_FROM: process.env.SMTP_FROM,
            SMTP_SERVICE: process.env.SMTP_SERVICE,
            // OAuth Configuration
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
            FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
            FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
        });
        console.log('Configuration loaded successfully');
        console.log('Environment:', parsedConfig.NODE_ENV);
        console.log('Port:', parsedConfig.PORT);
        console.log('MongoDB URI format:', ((_a = parsedConfig.MONGODB_URI.split('@')[1]) === null || _a === void 0 ? void 0 : _a.split('/')[0]) || 'Invalid URI format');
        return parsedConfig;
    }
    catch (error) {
        console.error('Configuration validation error:', error);
        if (error instanceof zod_1.z.ZodError) {
            error.errors.forEach(err => {
                console.error(`${err.path.join('.')}: ${err.message}`);
            });
        }
        throw error;
    }
};
// Export the config as a named export
exports.config = getConfig();
