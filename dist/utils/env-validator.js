"use strict";
/**
 * @file env-validator.ts
 * @description Environment Configuration Validation System
 * ===================================================
 *
 * Advanced environment variable validation and type checking system.
 * Ensures application configuration integrity through strict validation
 * of required and optional environment variables.
 *
 * Key Features:
 * ------------
 * - Type-safe environment validation
 * - Required vs optional variable handling
 * - SSL configuration validation
 * - Secure credential masking
 * - Development mode debugging
 *
 * Variable Categories:
 * -----------------
 * 1. Required Core Variables
 *    - Runtime configuration (NODE_ENV, PORT)
 *    - Database connection (MONGODB_URI)
 *    - Security tokens (JWT_SECRET, COOKIE_SECRET)
 *    - Application URLs (CLIENT_URL)
 *
 * 2. Optional SSL Configuration
 *    - SSL_ENABLED
 *    - SSL_KEY_PATH
 *    - SSL_CERT_PATH
 *    - SSL_CHAIN_PATH
 *    - ENABLE_HTTP2
 *
 * 3. Feature Flags
 *    - WHATSAPP_ENABLED
 *
 * Security Considerations:
 * ----------------------
 * - Sensitive values are masked in logs
 * - SSL configuration is validated as a unit
 * - Type coercion prevention
 *
 * @version 1.0.0
 * @license MIT
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = void 0;
const logger_1 = require("./logger");
/**
 * Core required environment variables
 * Critical for application functionality
 */
const requiredEnvVars = [
    { name: 'NODE_ENV', required: true, type: 'string' },
    { name: 'PORT', required: true, type: 'number' },
    { name: 'MONGODB_URI', required: true, type: 'string' },
    { name: 'JWT_SECRET', required: true, type: 'string' },
    { name: 'COOKIE_SECRET', required: true, type: 'string' },
    { name: 'CLIENT_URL', required: true, type: 'string' },
];
/**
 * WhatsApp integration configuration
 * Optional feature flag with development fallback
 */
const whatsappEnvVars = [
    { name: 'WHATSAPP_ENABLED', required: false, type: 'boolean' },
];
/**
 * Optional SSL and HTTP/2 configuration
 * Used for production deployments
 */
const optionalEnvVars = [
    { name: 'SSL_ENABLED', required: false, type: 'boolean' },
    { name: 'SSL_KEY_PATH', required: false, type: 'string' },
    { name: 'SSL_CERT_PATH', required: false, type: 'string' },
    { name: 'SSL_CHAIN_PATH', required: false, type: 'string' },
    { name: 'ENABLE_HTTP2', required: false, type: 'boolean' },
];
/**
 * Validates environment variables and their types
 * @throws {Error} If required environment variables are missing or of wrong type
 *
 * Validation Process:
 * 1. Checks presence of required variables
 * 2. Validates variable types
 * 3. Verifies SSL configuration completeness
 * 4. Logs environment status (development only)
 *
 * @example
 * try {
 *   validateEnv();
 *   console.log('Environment validation passed');
 * } catch (error) {
 *   console.error('Environment validation failed:', error.message);
 *   process.exit(1);
 * }
 */
const validateEnv = () => {
    const errors = [];
    // Validate required environment variables
    requiredEnvVars.forEach(({ name, type }) => {
        const value = process.env[name];
        if (!value) {
            errors.push(`Missing required environment variable: ${name}`);
            return;
        }
        // Type validation
        switch (type) {
            case 'number':
                if (isNaN(Number(value))) {
                    errors.push(`Environment variable ${name} must be a number`);
                }
                break;
            case 'boolean':
                if (value !== 'true' && value !== 'false') {
                    errors.push(`Environment variable ${name} must be a boolean`);
                }
                break;
        }
    });
    // Validate SSL configuration
    if (process.env.SSL_ENABLED === 'true') {
        const sslVars = ['SSL_KEY_PATH', 'SSL_CERT_PATH'];
        sslVars.forEach(varName => {
            if (!process.env[varName]) {
                errors.push(`SSL is enabled but ${varName} is missing`);
            }
        });
    }
    // Validate optional WhatsApp configuration
    if (process.env.WHATSAPP_ENABLED === 'true') {
        logger_1.logger.info('WhatsApp service is enabled');
    }
    // Log all environment variables in development
    if (process.env.NODE_ENV === 'development') {
        const envVars = [...requiredEnvVars, ...optionalEnvVars, ...whatsappEnvVars]
            .map(({ name }) => ({
            name,
            set: Boolean(process.env[name]),
            value: name.includes('SECRET') || name.includes('KEY')
                ? '********'
                : process.env[name],
        }));
        logger_1.logger.debug('Environment variables:', envVars);
    }
    // Throw error if any validation failed
    if (errors.length > 0) {
        logger_1.logger.error('Environment validation failed:', errors);
        throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }
    logger_1.logger.info('Environment validation passed');
};
exports.validateEnv = validateEnv;
