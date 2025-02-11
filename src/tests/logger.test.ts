import { logger } from '../utils/logger';
import { getClientInfo } from '../utils/controllerUtils';
import fs from 'fs';
import path from 'path';

async function validateLoggingSystem() {
  console.log('🔍 Starting logging system validation...\n');

  // Test different log levels
  logger.error('Test error message with stack trace', new Error('Test error').stack);
  logger.warn('Test warning message');
  logger.info('Test info message');
  logger.http('Test HTTP request', { host: 'localhost:3000' });
  logger.debug('Test debug message');

  // Test structured logging
  logger.info('Test structured log', {
    user: 'testUser',
    action: 'login',
    timestamp: new Date().toISOString()
  });

  // Validate log files exist
  const logFiles = ['all.log', 'error.log', 'access.log'];
  console.log('📁 Checking log files...');

  logFiles.forEach(file => {
    const logPath = path.join('logs', file);
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      console.log(`✅ ${file} exists (${stats.size} bytes)`);

      // Read last few lines of each log file
      const content = fs.readFileSync(logPath, 'utf8').split('\n').slice(-5).join('\n');
      console.log(`\nLast few entries from ${file}:`);
      console.log(content);
      console.log('\n---\n');
    } else {
      console.log(`❌ ${file} does not exist`);
    }
  });

  // Test error logging with stack traces
  try {
    throw new Error('Test error for stack trace');
  } catch (error) {
    logger.error('Caught test error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }

  // Test HTTP request logging
  const mockReq = {
    method: 'GET',
    url: '/api/test',
    headers: {
      'user-agent': 'Mozilla/5.0 (Test Browser)',
      'x-forwarded-for': '127.0.0.1'
    },
    ip: '127.0.0.1'
  };

  logger.http(`${mockReq.method} ${mockReq.url}`, {
    host: mockReq.headers['x-forwarded-for'],
    userAgent: mockReq.headers['user-agent']
  });

  console.log('\n✨ Logging system validation complete');
  console.log('📝 Please check the logs directory for the full log output');
}

// Run the validation
validateLoggingSystem().catch(console.error);
