import winston from 'winston';
import { config } from '../config/config';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const transports = [
  // File transports only - no console output
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
  // Separate transport for HTTP access logs with custom format
  new winston.transports.File({
    filename: 'logs/access.log',
    level: 'http',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      winston.format.printf(
        (info) => {
          const { timestamp, message, host } = info;
          return `[${timestamp}] http ${message}${host ? ` from ${host}` : ''}`;
        }
      )
    )
  })
];

export const logger = winston.createLogger({
  level: config.NODE_ENV === 'development' ? 'debug' : 'warn',
  levels,
  format,
  transports,
});
