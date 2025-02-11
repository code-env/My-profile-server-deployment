import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

export const accessLogger = () => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const start = process.hrtime();

        // Capture the response
        res.on('finish', async () => {
            const [seconds, nanoseconds] = process.hrtime(start);
            const duration = Math.round(seconds * 1000 + nanoseconds / 1e6); // Convert to milliseconds

            const timestamp = new Date()
                .toISOString()
                .replace('T', ' ')
                .replace(/\.\d+Z$/, '');

            // Format: [timestamp] http METHOD path status duration
            const logEntry = `[${timestamp}] http ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms\n`;

            try {
                // Ensure logs directory exists
                await fs.mkdir('logs', { recursive: true });

                // Append to access.log
                await fs.appendFile(
                    path.join('logs', 'access.log'),
                    logEntry,
                    'utf8'
                );
            } catch (error) {
                logger.error('Failed to write to access log:', error);
            }
        });

        next();
    };
};
