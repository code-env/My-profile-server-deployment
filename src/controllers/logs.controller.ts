import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

interface ParsedLog {
    timestamp: string;
    level: string;
    message: string;
    host?: string;
}

const parseLogLine = (line: string): ParsedLog | null => {
    // Match timestamp and rest of the log
    const match = line.match(/^\[(.*?)\]\s+(\w+)\s+(.*)$/);
    if (!match) return null;

    const [, timestamp, level, message] = match;

    // If it's an HTTP log, try to extract host
    if (level === 'http' && message.includes(' from ')) {
        const [msg, host] = message.split(' from ');
        return { timestamp, level, message: msg, host };
    }

    return { timestamp, level, message };
};

export const getLogFile = async (req: Request, res: Response) => {
    const { filename } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
        // Ensure filename is valid to prevent directory traversal
        if (!/^[a-zA-Z0-9._-]+\.log$/.test(filename)) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const logPath = path.join('logs', filename);

        // Check if file exists
        try {
            await fs.access(logPath);
        } catch (error) {
            return res.status(404).json({ error: 'Log file not found' });
        }

        // Read and parse log file
        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.trim().split('\n');
        const logs = lines.reverse() // Most recent first
            .map(line => parseLogLine(line))
            .filter((log): log is ParsedLog => log !== null);

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
    } catch (error) {
        logger.error('Error reading log file:', error);
        return res.status(500).json({ error: 'Failed to read log file' });
    }
};

export const deleteLogFile = async (req: Request, res: Response) => {
    const { filename } = req.params;

    try {
        // Ensure filename is valid to prevent directory traversal
        if (!/^[a-zA-Z0-9._-]+\.log$/.test(filename)) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const logPath = path.join('logs', filename);

        // Check if file exists
        try {
            await fs.access(logPath);
        } catch (error) {
            return res.status(404).json({ error: 'Log file not found' });
        }

        // Write empty content to file instead of deleting to maintain file existence
        await fs.writeFile(logPath, '', 'utf-8');

        return res.json({ message: `Log file ${filename} cleared successfully` });
    } catch (error) {
        logger.error('Error clearing log file:', error);
        return res.status(500).json({ error: 'Failed to clear log file' });
    }
};
