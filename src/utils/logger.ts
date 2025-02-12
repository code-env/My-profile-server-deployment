import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Custom log format
// Add emoji indicators for different log types
const getLogPrefix = (info: any) => {
  const type = info.type?.toLowerCase() || '';
  if (type.includes('registration')) return '🔐';
  if (type.includes('login')) return '🔑';
  if (type.includes('error')) return '❌';
  if (type.includes('security')) return '🛡️';
  if (type.includes('performance')) return '⚡';
  return 'ℹ️';
};

const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss:SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.metadata(),
  winston.format.printf(info => {
    const prefix = getLogPrefix(info);
    const meta = info.metadata && Object.keys(info.metadata).length
      ? `\n${JSON.stringify(info.metadata, null, 2)}`
      : '';

    return `${info.timestamp} ${prefix} ${info.level}: ${info.message}${meta}`;
  })
);

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  defaultMeta: { service: 'my-profile-api' },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Only add file transports in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error'
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log')
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'access.log'),
    level: 'http'
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'all.log')
  }));
}

// Create specialized logging functions for specific contexts
export const accessLogger = {
  log: (req: any, res: any, responseTime: number) => {
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      responseTime,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?._id,
      requestId: req.id,
      ...(req.metadata || {}) // Include all advanced tracking metadata if available
    };

    logger.http('Access Log', logData);
  }
};

export const securityLogger = {
  log: (event: string, details: any) => {
    logger.warn('Security Event', {
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
};

export const performanceLogger = {
  log: (metric: string, value: number, metadata: any = {}) => {
    logger.info('Performance Metric', {
      metric,
      value,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }
};

export const debugLogger = {
  log: (context: string, details: any) => {
    logger.debug('Debug Information', {
      context,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
};

// Export the main logger instance and specialized loggers
export default {
  logger,
  accessLogger,
  securityLogger,
  performanceLogger,
  debugLogger
};
