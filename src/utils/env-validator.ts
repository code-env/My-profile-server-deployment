/**
 * Environment Variable Validation
 * =============================
 * Validates and enforces required environment variables for the application
 */

interface EnvVar {
  name: string;
  required: boolean;
  type?: 'string' | 'number' | 'boolean';
  default?: any;
  validate?: (value: any) => boolean;
}

const envVars: EnvVar[] = [
  {
    name: 'NODE_ENV',
    required: true,
    type: 'string',
    validate: (value) => ['development', 'production', 'test'].includes(value)
  },
  {
    name: 'PORT',
    required: true,
    type: 'number',
    default: '3000',
    validate: (value) => parseInt(value) > 0 && parseInt(value) < 65536
  },
  {
    name: 'LOG_LEVEL',
    required: true,
    type: 'string',
    default: 'info',
    validate: (value) => ['error', 'warn', 'info', 'debug'].includes(value)
  },
  {
    name: 'LOG_FORMAT',
    required: false,
    type: 'string',
    default: 'json',
    validate: (value) => ['json', 'text'].includes(value)
  },
  {
    name: 'ENABLE_REQUEST_LOGGING',
    required: false,
    type: 'boolean',
    default: 'true'
  },
  {
    name: 'MAX_REQUEST_SIZE',
    required: false,
    type: 'string',
    default: '10mb',
    validate: (value) => /^\d+mb$/.test(value)
  },
  {
    name: 'RATE_LIMIT_WINDOW',
    required: false,
    type: 'number',
    default: '900000', // 15 minutes in ms
    validate: (value) => parseInt(value) > 0
  },
  {
    name: 'RATE_LIMIT_MAX',
    required: false,
    type: 'number',
    default: '100',
    validate: (value) => parseInt(value) > 0
  },
  {
    name: 'ENABLE_SECURITY_TRACKING',
    required: false,
    type: 'boolean',
    default: 'true'
  },
  {
    name: 'ENABLE_PERFORMANCE_TRACKING',
    required: false,
    type: 'boolean',
    default: 'true'
  }
];

/**
 * Validates environment variables
 * @throws Error if required variables are missing or invalid
 */
export function validateEnv(): void {
  const errors: string[] = [];

  envVars.forEach((envVar) => {
    const value = process.env[envVar.name];

    // Check if required variable is missing
    if (envVar.required && !value && !envVar.default) {
      errors.push(`Missing required environment variable: ${envVar.name}`);
      return;
    }

    // Use default value if provided and value is missing
    const finalValue = value || envVar.default;

    // Skip validation if value is not required and not provided
    if (!finalValue && !envVar.required) {
      return;
    }

    // Type validation
    if (envVar.type) {
      let typedValue: any;
      switch (envVar.type) {
        case 'number':
          typedValue = parseInt(finalValue);
          if (isNaN(typedValue)) {
            errors.push(`Environment variable ${envVar.name} must be a number`);
          }
          break;
        case 'boolean':
          if (!['true', 'false'].includes(finalValue.toLowerCase())) {
            errors.push(`Environment variable ${envVar.name} must be a boolean`);
          }
          break;
        case 'string':
          if (typeof finalValue !== 'string') {
            errors.push(`Environment variable ${envVar.name} must be a string`);
          }
          break;
      }
    }

    // Custom validation
    if (envVar.validate && !envVar.validate(finalValue)) {
      errors.push(`Invalid value for environment variable: ${envVar.name}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  // Set default values
  envVars.forEach((envVar) => {
    if (!process.env[envVar.name] && envVar.default) {
      process.env[envVar.name] = envVar.default;
    }
  });
}

/**
 * Get all environment variables with their current values
 * Useful for debugging and logging
 */
export function getEnvStatus(): Record<string, any> {
  const status: Record<string, any> = {};

  envVars.forEach((envVar) => {
    const value = process.env[envVar.name] || envVar.default;
    if (value !== undefined) {
      status[envVar.name] = envVar.type === 'boolean'
        ? value.toLowerCase() === 'true'
        : envVar.type === 'number'
          ? parseInt(value)
          : value;
    }
  });

  return status;
}
