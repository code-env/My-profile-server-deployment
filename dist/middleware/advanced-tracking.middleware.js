"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.advancedTrackingMiddleware = void 0;
const requestInfo_1 = require("../utils/requestInfo");
const logger_1 = require("../utils/logger");
const geoip_lite_1 = __importDefault(require("geoip-lite"));
const ua_parser_js_1 = require("ua-parser-js");
const crypto_1 = __importDefault(require("crypto"));
const os_1 = __importDefault(require("os"));
const securityMonitoring_service_1 = require("../services/securityMonitoring.service");
const auditLog_service_1 = require("../services/auditLog.service");
function generateFingerprint(req) {
    const components = [
        req.headers['user-agent'],
        req.headers['accept-language'],
        req.headers['accept-encoding'],
        req.ip,
        req.headers['sec-ch-ua'],
        req.headers['sec-ch-ua-platform']
    ].filter(Boolean);
    return crypto_1.default.createHash('sha256').update(components.join('|')).digest('hex');
}
function getSystemMetrics() {
    const cpus = os_1.default.cpus();
    const totalCpuTime = cpus.reduce((acc, cpu) => {
        return acc + Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    }, 0);
    const cpuUsage = totalCpuTime / (cpus.length * 100); // Normalized CPU usage
    return {
        cpuUsage,
        totalMemory: os_1.default.totalmem(),
        freeMemory: os_1.default.freemem(),
        loadAverage: os_1.default.loadavg()
    };
}
function extractJwtData(authHeader) {
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')))
        return undefined;
    try {
        const token = authHeader.split(' ')[1];
        const base64Payload = token.split('.')[1];
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
        return {
            iat: payload.iat,
            exp: payload.exp,
            sub: payload.sub
        };
    }
    catch (error) {
        return undefined;
    }
}
const advancedTrackingMiddleware = async (req, res, next) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        // Basic request info
        const requestInfo = await (0, requestInfo_1.getRequestInfo)(req);
        const ua = new ua_parser_js_1.UAParser(req.headers['user-agent']);
        const geo = geoip_lite_1.default.lookup(requestInfo.ip);
        const user = req.user;
        const fingerprint = generateFingerprint(req);
        const startTime = Date.now();
        // Get TLS info if available
        const socket = req.socket;
        const tlsInfo = socket.encrypted ? {
            protocol: (_a = socket.getProtocol) === null || _a === void 0 ? void 0 : _a.call(socket),
            cipher: (_b = socket.getCipher) === null || _b === void 0 ? void 0 : _b.call(socket)
        } : undefined;
        // Calculate request size
        const requestSize = req.headers['content-length']
            ? parseInt(req.headers['content-length'])
            : Buffer.byteLength(JSON.stringify(req.body), 'utf8');
        // Initialize request metadata
        req.metadata = {
            ip: requestInfo.ip,
            userAgent: req.headers['user-agent'] || '',
            geolocation: geo ? {
                country: geo.country,
                region: geo.region,
                city: geo.city,
                ll: geo.ll
            } : undefined,
            device: {
                type: ua.getDevice().type,
                vendor: ua.getDevice().vendor,
                model: ua.getDevice().model,
                os: {
                    name: ua.getOS().name,
                    version: ua.getOS().version
                },
                browser: {
                    name: ua.getBrowser().name,
                    version: ua.getBrowser().version
                }
            },
            timestamps: {
                start: startTime
            },
            route: req.path,
            method: req.method,
            userId: (_c = user === null || user === void 0 ? void 0 : user._id) === null || _c === void 0 ? void 0 : _c.toString(),
            sessionId: (_d = req.cookies) === null || _d === void 0 ? void 0 : _d.sessionId,
            security: {
                tls: tlsInfo,
                headers: Object.entries(req.headers).reduce((acc, [key, value]) => {
                    acc[key] = Array.isArray(value) ? value.join(', ') : String(value || '');
                    return acc;
                }, {}),
                fingerprint,
                jwt: extractJwtData(req.headers.authorization)
            },
            request: {
                size: requestSize,
                query: req.query,
                body: req.body,
                params: req.params,
                contentType: Array.isArray(req.headers['content-type'])
                    ? req.headers['content-type'][0]
                    : req.headers['content-type'],
                acceptLanguage: Array.isArray(req.headers['accept-language'])
                    ? req.headers['accept-language'][0]
                    : req.headers['accept-language'],
                acceptEncoding: Array.isArray(req.headers['accept-encoding'])
                    ? req.headers['accept-encoding'][0]
                    : req.headers['accept-encoding']
            },
            network: {
                remoteAddress: socket === null || socket === void 0 ? void 0 : socket.remoteAddress,
                remotePort: socket === null || socket === void 0 ? void 0 : socket.remotePort,
                localAddress: socket === null || socket === void 0 ? void 0 : socket.localAddress,
                localPort: socket === null || socket === void 0 ? void 0 : socket.localPort,
                protocol: req.protocol
            }
        };
        // Track DB queries with error handling and cleanup
        let dbQueries = 0;
        let dbTime = 0;
        let originalExec;
        try {
            // Safely get mongoose Query prototype
            const mongoose = require('mongoose');
            if ((_f = (_e = mongoose === null || mongoose === void 0 ? void 0 : mongoose.Query) === null || _e === void 0 ? void 0 : _e.prototype) === null || _f === void 0 ? void 0 : _f.exec) {
                originalExec = mongoose.Query.prototype.exec;
                mongoose.Query.prototype.exec = async function () {
                    const start = Date.now();
                    try {
                        const result = await originalExec.apply(this, arguments);
                        dbTime += Date.now() - start;
                        dbQueries++;
                        return result;
                    }
                    catch (error) {
                        dbTime += Date.now() - start;
                        dbQueries++;
                        throw error;
                    }
                };
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to setup DB query tracking:', error);
        }
        // Track response with cleanup and error handling
        res.on('finish', async () => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            try {
                const endTime = Date.now();
                if (req.metadata) {
                    // Safely get memory metrics
                    let memoryMetrics;
                    try {
                        const memoryUsage = process.memoryUsage();
                        memoryMetrics = {
                            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                            external: Math.round(memoryUsage.external / 1024 / 1024),
                            rss: Math.round(memoryUsage.rss / 1024 / 1024)
                        };
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to get memory metrics:', error);
                        memoryMetrics = {
                            heapUsed: 0,
                            heapTotal: 0,
                            external: 0,
                            rss: 0
                        };
                    }
                    // Safely get system metrics
                    let systemMetrics;
                    try {
                        systemMetrics = getSystemMetrics();
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to get system metrics:', error);
                        systemMetrics = {
                            cpuUsage: 0,
                            totalMemory: 0,
                            freeMemory: 0,
                            loadAverage: [0, 0, 0]
                        };
                    }
                    req.metadata.timestamps.end = endTime;
                    req.metadata.performance = {
                        totalDuration: endTime - req.metadata.timestamps.start,
                        processingTime: endTime - req.metadata.timestamps.start,
                        dbQueries,
                        dbTime,
                        memoryUsage: memoryMetrics,
                        systemInfo: systemMetrics
                    };
                    req.metadata.statusCode = res.statusCode;
                    // Comprehensive logging using specialized loggers
                    logger_1.accessLogger.log(req, res, ((_a = req.metadata.performance) === null || _a === void 0 ? void 0 : _a.totalDuration) || 0);
                    logger_1.performanceLogger.log('request-complete', ((_b = req.metadata.performance) === null || _b === void 0 ? void 0 : _b.totalDuration) || 0, {
                        path: req.path,
                        method: req.method,
                        statusCode: res.statusCode,
                        dbQueries,
                        dbTime,
                        memoryUsage: req.metadata.performance.memoryUsage,
                        systemInfo: req.metadata.performance.systemInfo
                    });
                    if (res.statusCode >= 400) {
                        logger_1.securityLogger.log('request-error', {
                            statusCode: res.statusCode,
                            path: req.path,
                            method: req.method,
                            ip: req.metadata.ip,
                            userId: req.metadata.userId,
                            error: res.locals.error
                        });
                    }
                    try {
                        // Security monitoring
                        await securityMonitoring_service_1.securityMonitoringService.analyzeRequest(req.metadata);
                        // Audit logging with full request details
                        await auditLog_service_1.auditLogService.logRequest({
                            userId: req.metadata.userId,
                            action: `${req.method} ${req.path}`,
                            details: req.metadata,
                            timestamp: new Date()
                        });
                        // Log complete request metadata
                        // Create a structured log entry with better context
                        logger_1.logger.info('Request details', {
                            type: req.path.includes('auth/register') ? 'Registration' : 'General',
                            endpoint: req.path,
                            method: req.method,
                            ip: req.metadata.ip,
                            agent: req.metadata.userAgent,
                            location: req.metadata.geolocation,
                            device: {
                                ...req.metadata.device,
                                fingerprint: (_c = req.metadata.security) === null || _c === void 0 ? void 0 : _c.fingerprint
                            },
                            request: {
                                ...req.metadata.request,
                                headers: (_d = req.metadata.security) === null || _d === void 0 ? void 0 : _d.headers
                            },
                            timing: {
                                start: new Date(req.metadata.timestamps.start).toISOString(),
                                duration: (_e = req.metadata.performance) === null || _e === void 0 ? void 0 : _e.totalDuration,
                                dbTime: (_f = req.metadata.performance) === null || _f === void 0 ? void 0 : _f.dbTime
                            },
                            user: req.metadata.userId ? {
                                id: req.metadata.userId,
                                session: req.metadata.sessionId
                            } : 'anonymous',
                            security: {
                                tls: (_g = req.metadata.security) === null || _g === void 0 ? void 0 : _g.tls,
                                jwt: (_h = req.metadata.security) === null || _h === void 0 ? void 0 : _h.jwt
                            }
                        });
                    }
                    catch (error) {
                        logger_1.logger.error('Error in tracking handlers:', error);
                    }
                }
            }
            catch (error) {
                logger_1.logger.error('Error in response tracking:', error);
            }
            finally {
                // Always attempt to restore mongoose exec
                if (originalExec) {
                    try {
                        const mongoose = require('mongoose');
                        if ((_j = mongoose === null || mongoose === void 0 ? void 0 : mongoose.Query) === null || _j === void 0 ? void 0 : _j.prototype) {
                            mongoose.Query.prototype.exec = originalExec;
                        }
                    }
                    catch (error) {
                        logger_1.logger.error('Error restoring mongoose exec:', error);
                    }
                }
            }
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('Error in advanced tracking middleware:', error);
        next(error);
    }
};
exports.advancedTrackingMiddleware = advancedTrackingMiddleware;
