"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestSize = exports.formatBytes = exports.generateCPULoad = exports.delay = exports.getClientInfo = void 0;
const ua_parser_js_1 = require("ua-parser-js");
/**
 * Get client information from request
 * @param req Express request object
 * @returns Client information including IP, OS, browser, and device details
 */
const getClientInfo = async (req) => {
    const ua = new ua_parser_js_1.UAParser(req.headers['user-agent']);
    const parser = new ua_parser_js_1.UAParser();
    return {
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        os: ua.getOS().name || 'unknown',
        browser: ua.getBrowser().name || 'unknown',
        device: ua.getDevice().type || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    };
};
exports.getClientInfo = getClientInfo;
/**
 * Utility function to create a delay
 * @param ms Time to delay in milliseconds
 * @returns Promise that resolves after the specified delay
 */
const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.delay = delay;
/**
 * Add artificial CPU load for testing
 * @param durationMs Duration to run the load in milliseconds
 */
const generateCPULoad = (durationMs) => {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
        Math.random() * Math.random();
    }
};
exports.generateCPULoad = generateCPULoad;
/**
 * Format bytes to human readable string
 * @param bytes Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
const formatBytes = (bytes) => {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
exports.formatBytes = formatBytes;
/**
 * Get request size in bytes
 * @param req Express request object
 * @returns Size in bytes
 */
const getRequestSize = (req) => {
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
exports.getRequestSize = getRequestSize;
