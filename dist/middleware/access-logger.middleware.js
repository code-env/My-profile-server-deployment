"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessLogger = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const accessLogger = () => {
    return async (req, res, next) => {
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
                await promises_1.default.mkdir('logs', { recursive: true });
                // Append to access.log
                await promises_1.default.appendFile(path_1.default.join('logs', 'access.log'), logEntry, 'utf8');
            }
            catch (error) {
                logger_1.logger.error('Failed to write to access log:', error);
            }
        });
        next();
    };
};
exports.accessLogger = accessLogger;
