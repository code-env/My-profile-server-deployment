/**
 * Utility functions for controllers
 */
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

/**
 * Client information interface
 */
interface ClientInfo {
    ip: string;
    os: string;
    browser: string;
    device: string;
    userAgent: string;
}

/**
 * Get client information from request
 * @param req Express request object
 * @returns Client information including IP, OS, browser, and device details
 */
export const getClientInfo = async (req: Request): Promise<ClientInfo> => {
    const ua = new UAParser(req.headers['user-agent']);
    const parser = new UAParser();
    
    // Get the real IP address - properly handle proxy forwarding
    const xForwardedFor = req.headers['x-forwarded-for'];
    let ip = 'unknown';
    
    if (typeof xForwardedFor === 'string') {
        // Extract the leftmost IP which is the original client
        ip = xForwardedFor.split(',')[0].trim();
    } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
        ip = xForwardedFor[0].trim();
    } else {
        // Fallback to standard IP from Express (which should now work with trust proxy set)
        ip = req.ip || req.socket.remoteAddress || 'unknown';
    }

    return {
        ip: ip,
        os: ua.getOS().name || 'unknown',
        browser: ua.getBrowser().name || 'unknown',
        device: ua.getDevice().type || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    };
};

/**
 * Utility function to create a delay
 * @param ms Time to delay in milliseconds
 * @returns Promise that resolves after the specified delay
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Add artificial CPU load for testing
 * @param durationMs Duration to run the load in milliseconds
 */
export const generateCPULoad = (durationMs: number): void => {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
        Math.random() * Math.random();
    }
};

/**
 * Format bytes to human readable string
 * @param bytes Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Get request size in bytes
 * @param req Express request object
 * @returns Size in bytes
 */
export const getRequestSize = (req: any): number => {
    let size = 0;
    // Headers
    size += Buffer.byteLength(JSON.stringify(req.headers));
    // URL
    size += Buffer.byteLength(req.url);
    // Body
    if (req.body) {
        size += Buffer.byteLength(JSON.stringify(req.body));
    }
    return size;
};
