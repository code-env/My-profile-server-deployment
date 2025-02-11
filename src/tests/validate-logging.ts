/**
 * Advanced Tracking System Validation
 * ================================
 * Validates the advanced tracking and monitoring capabilities
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { getEnvStatus } from '../utils/env-validator';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: any;
}

interface ValidationResult {
  passed: boolean;
  details: string[];
}

async function validateLogFiles(): Promise<ValidationResult> {
  const result: ValidationResult = {
    passed: true,
    details: []
  };

  try {
    // Verify log directory exists
    const logDir = path.join(process.cwd(), 'logs');
    await fs.access(logDir);
    result.details.push('✓ Log directory exists');

    // Check for required log files
    const requiredFiles = ['all.log', 'error.log', 'access.log'];
    for (const file of requiredFiles) {
      const filePath = path.join(logDir, file);
      await fs.access(filePath);
      result.details.push(`✓ ${file} exists`);
    }

    // Validate log content format
    const allLogs = await fs.readFile(path.join(logDir, 'all.log'), 'utf-8');
    const logEntries: LogEntry[] = allLogs
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));

    // Check log entry structure
    const sampleEntry = logEntries[0];
    const requiredFields = ['timestamp', 'level', 'message'];
    const hasRequiredFields = requiredFields.every(field =>
      sampleEntry && field in sampleEntry
    );

    if (hasRequiredFields) {
      result.details.push('✓ Log entries have correct structure');
    } else {
      result.passed = false;
      result.details.push('✗ Log entries missing required fields');
    }

    // Verify different log levels are present
    const levels = new Set(logEntries.map(entry => entry.level));
    const requiredLevels = ['info', 'warn', 'error'];
    const missingLevels = requiredLevels.filter(level => !levels.has(level));

    if (missingLevels.length === 0) {
      result.details.push('✓ All required log levels present');
    } else {
      result.passed = false;
      result.details.push(`✗ Missing log levels: ${missingLevels.join(', ')}`);
    }

    // Verify performance metrics
    const hasPerformanceMetrics = logEntries.some(entry =>
      entry.metadata?.performance?.totalDuration !== undefined
    );

    if (hasPerformanceMetrics) {
      result.details.push('✓ Performance metrics are being tracked');
    } else {
      result.passed = false;
      result.details.push('✗ No performance metrics found');
    }

    // Verify security tracking
    const hasSecurityLogs = logEntries.some(entry =>
      entry.metadata?.security?.fingerprint !== undefined
    );

    if (hasSecurityLogs) {
      result.details.push('✓ Security tracking is active');
    } else {
      result.passed = false;
      result.details.push('✗ No security tracking data found');
    }

    // Verify request metadata
    const hasRequestMetadata = logEntries.some(entry =>
      entry.metadata?.request?.size !== undefined &&
      entry.metadata?.ip !== undefined
    );

    if (hasRequestMetadata) {
      result.details.push('✓ Request metadata is being captured');
    } else {
      result.passed = false;
      result.details.push('✗ Request metadata is missing');
    }

  } catch (error) {
    result.passed = false;
    result.details.push(`✗ Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

async function validateEnvironment(): Promise<ValidationResult> {
  const result: ValidationResult = {
    passed: true,
    details: []
  };

  const env = getEnvStatus();

  // Verify required tracking settings
  const requiredSettings = [
    'ENABLE_REQUEST_LOGGING',
    'ENABLE_SECURITY_TRACKING',
    'ENABLE_PERFORMANCE_TRACKING',
    'LOG_LEVEL',
    'LOG_FORMAT'
  ];

  for (const setting of requiredSettings) {
    if (env[setting] !== undefined) {
      result.details.push(`✓ ${setting} is configured: ${env[setting]}`);
    } else {
      result.passed = false;
      result.details.push(`✗ Missing required setting: ${setting}`);
    }
  }

  return result;
}

async function runValidation(): Promise<void> {
  console.log('\n🔍 Starting Advanced Tracking Validation\n');

  try {
    // Validate environment configuration
    console.log('Checking Environment Configuration...');
    const envResult = await validateEnvironment();
    console.log(envResult.details.join('\n'));

    // Validate log files and content
    console.log('\nChecking Logging System...');
    const logResult = await validateLogFiles();
    console.log(logResult.details.join('\n'));

    // Final result
    const passed = envResult.passed && logResult.passed;
    console.log(`\n${passed ? '✅ Validation Passed' : '❌ Validation Failed'}\n`);

    if (!passed) {
      process.exit(1);
    }

  } catch (error) {
    logger.error('Validation failed', { error });
    process.exit(1);
  }
}

// Run validation if called directly
if (require.main === module) {
  runValidation().catch(console.error);
}

export { runValidation, validateLogFiles, validateEnvironment };
