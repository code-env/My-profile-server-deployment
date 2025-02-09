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

import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables before validation
dotenv.config();

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
const envSchema = z.object({
  // Core Application Settings
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(8080),
  MONGODB_URI: z.string(),
  BASE_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default("http://localhost:5000"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  APP_NAME: z.string().default("MyProfile"),

  // Security & Authentication
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRATION: z.string().default("15m"),
  JWT_REFRESH_EXPIRATION: z.string().default("7d"),
  COOKIE_SECRET: z.string(),

  // SSL Configuration
  SSL_KEY_PATH: z.string().optional(),
  SSL_CERT_PATH: z.string().optional(),
  SSL_ENABLED: z.string().default("false"),

  // Communication Services
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Email Configuration
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  SMTP_FROM: z.string(),
  SMTP_SERVICE: z.string().default("gmail"),

  // OAuth Configuration
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  FACEBOOK_APP_ID: z.string(),
  FACEBOOK_APP_SECRET: z.string(),
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
    console.log('MongoDB URI format:', parsedConfig.MONGODB_URI.split('@')[1]?.split('/')[0] || 'Invalid URI format');

    return parsedConfig;
  } catch (error) {
    console.error('Configuration validation error:', error);
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`${err.path.join('.')}: ${err.message}`);
      });
    }
    throw error;
  }
};

// Export type for TypeScript support
export type Config = z.infer<typeof envSchema>;

// Export the config as a named export
export const config = getConfig();
