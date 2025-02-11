"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.advancedTrackingMiddleware = void 0;
const geoip_lite_1 = __importDefault(require("geoip-lite"));
const ua_parser_js_1 = require("ua-parser-js");
const uuid_1 = require("uuid");
const maxmind = __importStar(require("maxmind"));
const logs_controller_1 = require("../controllers/logs.controller");
const logger_1 = require("../utils/logger");
const securityMonitoring_service_1 = require("../services/securityMonitoring.service");
let asnReader;
// Initialize MaxMind ASN database
(async () => {
    try {
        asnReader = await maxmind.open('./GeoLite2-ASN.mmdb');
    }
    catch (error) {
        logger_1.logger.warn('Failed to load ASN database:', error);
    }
})();
const parser = new ua_parser_js_1.UAParser();
const advancedTrackingMiddleware = async (req, res, next) => {
    const startTime = Date.now();
    // Basic request info
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    // Parse user agent
    const ua = parser.setUA(userAgent).getResult();
    // Get geo info
    const geoData = geoip_lite_1.default.lookup(ip);
    const geo = {
        country: (geoData === null || geoData === void 0 ? void 0 : geoData.country) || '',
        region: (geoData === null || geoData === void 0 ? void 0 : geoData.region) || '',
        city: (geoData === null || geoData === void 0 ? void 0 : geoData.city) || '',
        ll: (geoData === null || geoData === void 0 ? void 0 : geoData.ll) || [0, 0],
        range: (geoData === null || geoData === void 0 ? void 0 : geoData.range) || [0, 0]
    };
    // Network info
    let networkInfo = {
        hostName: req.hostname
    };
    try {
        if (asnReader) {
            const asnData = asnReader.get(ip);
            if (asnData) {
                networkInfo = {
                    ...networkInfo,
                    asn: asnData.autonomous_system_number,
                    organization: asnData.autonomous_system_organization,
                    networkType: asnData.type
                };
            }
        }
    }
    catch (error) {
        logger_1.logger.warn('Error getting ASN data:', error);
    }
    // Security checks
    const securityChecks = {
        threatScore: 0,
        isProxy: false,
        isTor: false,
        isVPN: false,
        suspiciousHeaders: [],
        responseCode: res.statusCode
    };
    // Check for proxy indicators
    const proxyHeaders = [
        'via',
        'x-forwarded-for',
        'forwarded',
        'client-ip',
        'x-real-ip',
        'proxy-connection'
    ];
    proxyHeaders.forEach(header => {
        if (req.headers[header]) {
            securityChecks.isProxy = true;
            securityChecks.threatScore += 10;
            securityChecks.suspiciousHeaders.push(header);
        }
    });
    // Check for VPN/Tor based on ASN and geo data
    if (networkInfo.organization) {
        const vpnKeywords = ['vpn', 'virtual', 'proxy', 'tor', 'exit', 'relay', 'cloud'];
        if (vpnKeywords.some(keyword => networkInfo.organization.toLowerCase().includes(keyword))) {
            securityChecks.isVPN = true;
            securityChecks.threatScore += 20;
        }
    }
    // Add threat score for various factors
    if (geo.country !== req.headers['cf-ipcountry']) {
        securityChecks.threatScore += 15;
    }
    if (req.headers['dnt'] === '1') {
        securityChecks.threatScore += 5;
    }
    // Device fingerprinting
    const fingerprint = {
        id: (0, uuid_1.v4)(),
        userAgent,
        acceptHeaders: {
            language: acceptLanguage,
            encoding: req.headers['accept-encoding'] || '',
            mimeTypes: req.headers['accept'] || ''
        },
        screen: {
            colorDepth: req.headers['sec-ch-color-depth'] || '',
            width: req.headers['sec-ch-width'] || '',
            height: req.headers['sec-ch-height'] || ''
        },
        timezone: req.headers['sec-ch-timezone'] || '',
        platform: req.headers['sec-ch-platform'] || ''
    };
    // Convert headers to Record<string, string>
    const headers = {};
    Object.entries(req.headers).forEach(([key, value]) => {
        headers[key] = Array.isArray(value) ? value.join(', ') : (value || '');
    });
    // Convert cookies to Record<string, string>
    const cookies = {};
    Object.entries(req.cookies || {}).forEach(([key, value]) => {
        cookies[key] = typeof value === 'string' ? value : JSON.stringify(value);
    });
    // Construct detailed request info
    const requestInfo = {
        timestamp: startTime,
        fingerprint: fingerprint.id,
        method: req.method,
        url: req.originalUrl,
        protocol: req.protocol,
        ip,
        ipVersion: ip.includes(':') ? 'IPv6' : 'IPv4',
        geo,
        network: networkInfo,
        browser: {
            name: ua.browser.name || 'Unknown',
            version: ua.browser.version || 'Unknown'
        },
        os: {
            name: ua.os.name || 'Unknown',
            version: ua.os.version || 'Unknown'
        },
        device: {
            type: ua.device.type || 'desktop',
            brand: ua.device.vendor,
            model: ua.device.model
        },
        language: acceptLanguage,
        headers,
        cookies,
        sessionID: req.sessionID,
        security: securityChecks
    };
    // Capture response info
    const originalEnd = res.end;
    res.end = function (chunk, encoding, callback) {
        var _a, _b, _c;
        const responseTime = Date.now() - startTime;
        requestInfo.responseTime = responseTime;
        requestInfo.security.responseCode = res.statusCode;
        // Add to tracking cache
        (0, logs_controller_1.addToTrackingCache)(requestInfo);
        // Send to security monitoring
        const metadata = {
            ip: requestInfo.ip,
            userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
            sessionId: requestInfo.sessionID,
            route: (_b = req.route) === null || _b === void 0 ? void 0 : _b.path,
            statusCode: res.statusCode,
            geolocation: {
                ...requestInfo.geo,
                ll: ((_c = requestInfo.geo.ll) === null || _c === void 0 ? void 0 : _c.length) >= 2 ? [requestInfo.geo.ll[0], requestInfo.geo.ll[1]] : undefined
            }
        };
        securityMonitoring_service_1.securityMonitoringService.analyzeRequest(metadata).catch(error => {
            logger_1.logger.error('Error in security monitoring:', error);
        });
        // Broadcast to WebSocket clients if needed
        if (req.app.locals.wss) {
            req.app.locals.wss.clients.forEach((client) => {
                if (client.readyState === 1) { // OPEN
                    client.send(JSON.stringify(requestInfo));
                }
            });
        }
        return originalEnd.call(this, chunk, encoding, callback);
    };
    next();
};
exports.advancedTrackingMiddleware = advancedTrackingMiddleware;
