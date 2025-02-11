"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLogFile = exports.getLogFile = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const parseLogLine = (line) => {
    // Match timestamp and rest of the log
    const match = line.match(/^\[(.*?)\]\s+(\w+)\s+(.*)$/);
    if (!match)
        return null;
    const [, timestamp, level, message] = match;
    // If it's an HTTP log, try to extract host
    if (level === 'http' && message.includes(' from ')) {
        const [msg, host] = message.split(' from ');
        return { timestamp, level, message: msg, host };
    }
    return { timestamp, level, message };
};
const getLogFile = async (req, res) => {
    const { filename } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    try {
        // Ensure filename is valid to prevent directory traversal
        if (!/^[a-zA-Z0-9._-]+\.log$/.test(filename)) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const logPath = path_1.default.join('logs', filename);
        // Check if file exists
        try {
            await promises_1.default.access(logPath);
        }
        catch (error) {
            return res.status(404).json({ error: 'Log file not found' });
        }
        // Read and parse log file
        const content = await promises_1.default.readFile(logPath, 'utf-8');
        const lines = content.trim().split('\n');
        const logs = lines.reverse() // Most recent first
            .map(line => parseLogLine(line))
            .filter((log) => log !== null);
        // Calculate pagination
        const totalLogs = logs.length;
        const totalPages = Math.ceil(totalLogs / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        return res.json({
            logs: logs.slice(startIndex, endIndex),
            pagination: {
                page,
                pages: totalPages,
                total: totalLogs,
                limit
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error reading log file:', error);
        return res.status(500).json({ error: 'Failed to read log file' });
    }
};
exports.getLogFile = getLogFile;
const deleteLogFile = async (req, res) => {
    const { filename } = req.params;
    try {
        // Ensure filename is valid to prevent directory traversal
        if (!/^[a-zA-Z0-9._-]+\.log$/.test(filename)) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const logPath = path_1.default.join('logs', filename);
        // Check if file exists
        try {
            await promises_1.default.access(logPath);
        }
        catch (error) {
            return res.status(404).json({ error: 'Log file not found' });
        }
        // Write empty content to file instead of deleting to maintain file existence
        await promises_1.default.writeFile(logPath, '', 'utf-8');
        return res.json({ message: `Log file ${filename} cleared successfully` });
    }
    catch (error) {
        logger_1.logger.error('Error clearing log file:', error);
        return res.status(500).json({ error: 'Failed to clear log file' });
    }
};
exports.deleteLogFile = deleteLogFile;
