"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceFingerprintService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const geoip_lite_1 = __importDefault(require("geoip-lite"));
const logger_1 = require("../utils/logger");
class DeviceFingerprintService {
    static generateFingerprint(req) {
        const components = [
            req.ip,
            req.headers['user-agent'],
            req.headers['accept-language'],
            req.headers['sec-ch-ua'],
            req.headers['sec-ch-ua-platform']
        ];
        return crypto_1.default
            .createHash('sha256')
            .update(components.join('|'))
            .digest('hex');
    }
    static async analyzeDevice(req) {
        const fingerprint = this.generateFingerprint(req);
        const ip = req.ip;
        const geo = geoip_lite_1.default.lookup(ip);
        const deviceInfo = {
            fingerprint,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            location: geo,
            platform: req.headers['sec-ch-ua-platform'],
            browser: req.headers['sec-ch-ua'],
            language: req.headers['accept-language'],
            timestamp: new Date(),
            riskScore: await this.calculateRiskScore(req, geo)
        };
        logger_1.logger.info(`Device analysis completed for fingerprint: ${fingerprint}`);
        return deviceInfo;
    }
    static async calculateRiskScore(req, geo) {
        let score = 0;
        const ip = req.ip;
        // Check if IP is from a known VPN/proxy
        if (await this.isVPNorProxy(ip)) {
            score += 20;
        }
        // Check for suspicious geolocation
        if (geo && this.isHighRiskCountry(geo.country)) {
            score += 15;
        }
        // Check for bot-like behavior
        if (this.isBotLike(req)) {
            score += 25;
        }
        return score;
    }
    static async isVPNorProxy(ip) {
        // Implement VPN/proxy detection logic
        return false;
    }
    static isHighRiskCountry(country) {
        const highRiskCountries = ['XX', 'YY']; // Add high-risk country codes
        return highRiskCountries.includes(country);
    }
    static isBotLike(req) {
        const userAgent = req.headers['user-agent'] || '';
        return userAgent.toLowerCase().includes('bot') ||
            userAgent.toLowerCase().includes('crawler') ||
            !req.headers['accept-language'];
    }
}
exports.DeviceFingerprintService = DeviceFingerprintService;
