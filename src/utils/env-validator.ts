import { logger } from './logger';

interface EnvVariable {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
}

const requiredEnvVars: EnvVariable[] = [
  { name: 'NODE_ENV', required: true, type: 'string' },
  { name: 'PORT', required: true, type: 'number' },
  { name: 'MONGODB_URI', required: true, type: 'string' },
  { name: 'JWT_SECRET', required: true, type: 'string' },
  { name: 'COOKIE_SECRET', required: true, type: 'string' },
  { name: 'CLIENT_URL', required: true, type: 'string' },
];

const optionalEnvVars: EnvVariable[] = [
  { name: 'SSL_ENABLED', required: false, type: 'boolean' },
  { name: 'SSL_KEY_PATH', required: false, type: 'string' },
  { name: 'SSL_CERT_PATH', required: false, type: 'string' },
  { name: 'SSL_CHAIN_PATH', required: false, type: 'string' },
  { name: 'ENABLE_HTTP2', required: false, type: 'boolean' },
];

/**
 * Validates environment variables and their types
 * @throws {Error} If required environment variables are missing or of wrong type
 */
export const validateEnv = (): void => {
  const errors: string[] = [];

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

  // Log all environment variables in development
  if (process.env.NODE_ENV === 'development') {
    const envVars = [...requiredEnvVars, ...optionalEnvVars]
      .map(({ name }) => ({
        name,
        set: Boolean(process.env[name]),
        value: name.includes('SECRET') || name.includes('KEY')
          ? '********'
          : process.env[name],
      }));

    logger.debug('Environment variables:', envVars);
  }

  // Throw error if any validation failed
  if (errors.length > 0) {
    logger.error('Environment validation failed:', errors);
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}`
    );
  }

  logger.info('Environment validation passed');
};
