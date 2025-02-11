"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestInfo = void 0;
const ua_parser_js_1 = require("ua-parser-js");
const geoip_lite_1 = __importDefault(require("geoip-lite"));
const detect_browser_1 = require("detect-browser");
const bowser_1 = __importDefault(require("bowser"));
const crypto_1 = __importDefault(require("crypto"));
const dns_1 = __importDefault(require("dns"));
const util_1 = require("util");
const dnsResolve = (0, util_1.promisify)(dns_1.default.resolve);
async function checkTorExit(ip) {
    try {
        const torExits = await dnsResolve('exitlist.torproject.org', 'A');
        return torExits.includes(ip);
    }
    catch (_a) {
        return false;
    }
}
function calculateThreatScore(info) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    let score = 0;
    if ((_a = info.security) === null || _a === void 0 ? void 0 : _a.isProxy)
        score += 20;
    if ((_b = info.security) === null || _b === void 0 ? void 0 : _b.isTor)
        score += 30;
    if ((_c = info.security) === null || _c === void 0 ? void 0 : _c.isVPN)
        score += 15;
    // Suspicious headers
    if ((_e = (_d = info.headers) === null || _d === void 0 ? void 0 : _d['x-forwarded-for']) === null || _e === void 0 ? void 0 : _e.includes(','))
        score += 10;
    if (!((_f = info.headers) === null || _f === void 0 ? void 0 : _f['accept-language']))
        score += 5;
    // Geolocation mismatch
    if (((_g = info.geo) === null || _g === void 0 ? void 0 : _g.country) && ((_h = info.headers) === null || _h === void 0 ? void 0 : _h['accept-language'])) {
        const langCountry = info.headers['accept-language'].split(',')[0].split('-')[1];
        if (langCountry && langCountry.toLowerCase() !== info.geo.country.toLowerCase()) {
            score += 15;
        }
    }
    return Math.min(score, 100);
}
function generateFingerprint(req, deviceInfo) {
    const components = [
        req.headers['user-agent'],
        req.headers['accept-language'],
        deviceInfo.screenResolution,
        deviceInfo.colorDepth,
        deviceInfo.deviceMemory,
        deviceInfo.hardwareConcurrency,
        req.ip
    ];
    return crypto_1.default
        .createHash('sha256')
        .update(components.filter(Boolean).join('::'))
        .digest('hex');
}
const getRequestInfo = async (req) => {
    var _a, _b, _c, _d, _e;
    // Parse user agent
    const uaParser = new ua_parser_js_1.UAParser(req.headers['user-agent']);
    const browser = (0, detect_browser_1.detect)(req.headers['user-agent']);
    const bowser = bowser_1.default.parse(req.headers['user-agent'] || '');
    // Get IPs
    const ip = req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        ((_a = req.headers['x-forwarded-for']) === null || _a === void 0 ? void 0 : _a.toString().split(',')[0]);
    const proxyIPs = (_b = req.headers['x-forwarded-for']) === null || _b === void 0 ? void 0 : _b.toString().split(',').map(ip => ip.trim());
    // Get geo information
    const geo = geoip_lite_1.default.lookup(ip || '') || {};
    // Device metrics (some values may be undefined on server-side)
    const deviceMetrics = {
        screenResolution: req.headers['sec-ch-viewport-width']
            ? `${req.headers['sec-ch-viewport-width']}x${req.headers['sec-ch-viewport-height']}`
            : undefined,
        colorDepth: parseInt(req.headers['sec-ch-color-depth']) || undefined,
        deviceMemory: parseInt(req.headers['device-memory']) || undefined,
        hardwareConcurrency: parseInt(req.headers['sec-ch-ua-platform-version']) || undefined,
        devicePixelRatio: parseFloat(req.headers['sec-ch-dpr']) || undefined,
        maxTouchPoints: parseInt(req.headers['sec-ch-ua-mobile']) || undefined
    };
    // Generate security metrics
    const isTor = await checkTorExit(ip || '');
    const security = {
        isProxy: Boolean(proxyIPs === null || proxyIPs === void 0 ? void 0 : proxyIPs.length),
        isTor,
        isVPN: false, // Would need external VPN detection service
        threatScore: 0,
        securityFlags: []
    };
    const requestInfo = {
        // Basic Info
        timestamp: Date.now(),
        method: req.method,
        url: req.url,
        protocol: req.protocol,
        // IP and Network
        ip: ip || 'unknown',
        ipVersion: (ip === null || ip === void 0 ? void 0 : ip.includes(':')) ? 'IPv6' : 'IPv4',
        realIP: (_c = req.headers['x-real-ip']) === null || _c === void 0 ? void 0 : _c.toString(),
        proxyIPs,
        network: {
            asn: (_d = req.headers['cf-ipcountry']) === null || _d === void 0 ? void 0 : _d.toString(), // If using Cloudflare
            isp: undefined, // Would need external ISP detection service
            connectionType: req.headers['sec-ch-ua-mobile'] === '?1' ? 'mobile' : 'desktop',
            hostName: req.hostname,
        },
        // Geolocation
        geo: {
            country: geo.country,
            region: geo.region,
            city: geo.city,
            ll: geo.ll,
            timezone: geo.timezone
        },
        // Device Info
        os: {
            name: uaParser.getOS().name || 'unknown',
            version: uaParser.getOS().version || 'unknown',
            platform: bowser.platform.type || 'unknown'
        },
        device: {
            type: uaParser.getDevice().type,
            brand: uaParser.getDevice().vendor,
            model: uaParser.getDevice().model,
            metrics: deviceMetrics
        },
        // Browser Info
        browser: {
            name: (browser === null || browser === void 0 ? void 0 : browser.name) || 'unknown',
            version: (browser === null || browser === void 0 ? void 0 : browser.version) || 'unknown',
            engine: uaParser.getEngine().name || 'unknown',
            capabilities: {
                cookies: 'cookie' in req.headers,
                localStorage: true, // Determined client-side
                sessionStorage: true, // Determined client-side
                webGL: true, // Determined client-side
                webRTC: true, // Determined client-side
                canvas: true, // Determined client-side
                audio: true // Determined client-side
            }
        },
        // Security metrics
        security,
        // Headers and Fingerprint
        headers: req.headers,
        fingerprint: generateFingerprint(req, deviceMetrics),
        // Session
        sessionID: (_e = req.session) === null || _e === void 0 ? void 0 : _e.id,
        referrer: req.headers.referer,
        language: req.headers['accept-language']
    };
    // Calculate final threat score
    requestInfo.security.threatScore = calculateThreatScore(requestInfo);
    return requestInfo;
};
exports.getRequestInfo = getRequestInfo;
