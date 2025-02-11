"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityMonitoringService = exports.SecurityMonitoringService = void 0;
const logger_1 = require("../utils/logger");
const auditLog_service_1 = require("./auditLog.service");
class SecurityMonitoringService {
    constructor(auditLogService) {
        this.auditLogService = auditLogService;
        this.requestCounts = new Map();
        this.failedLogins = new Map();
        this.activeSessions = new Map();
    }
    async analyzeRequest(metadata) {
        try {
            await Promise.all([
                this.checkForSuspiciousPatterns(metadata),
                this.enforceRateLimits(metadata),
                this.trackGeoAnomalies(metadata),
                this.monitorBruteForce(metadata),
                this.analyzeUserBehavior(metadata)
            ]);
        }
        catch (error) {
            logger_1.logger.error('Error in security analysis:', error);
            throw error;
        }
    }
    async checkForSuspiciousPatterns(metadata) {
        const route = metadata.route || '';
        const userInput = JSON.stringify(metadata);
        for (const pattern of SecurityMonitoringService.SUSPICIOUS_PATTERNS) {
            if (pattern.test(userInput)) {
                logger_1.logger.warn('Suspicious pattern detected', {
                    pattern: pattern.source,
                    ip: metadata.ip,
                    userId: metadata.userId,
                    route
                });
                await this.auditLogService.logSecurity({
                    timestamp: new Date(),
                    type: 'SUSPICIOUS_PATTERN',
                    severity: 'HIGH',
                    ip: metadata.ip,
                    userId: metadata.userId,
                    details: {
                        pattern: pattern.source,
                        detectedIn: route,
                        metadata
                    }
                });
            }
        }
    }
    async enforceRateLimits(metadata) {
        const { ip, userId } = metadata;
        const key = userId || ip;
        const currentCount = (this.requestCounts.get(key) || 0) + 1;
        this.requestCounts.set(key, currentCount);
        if (currentCount > SecurityMonitoringService.RATE_LIMITS.maxRequestsPerMinute) {
            logger_1.logger.warn('Rate limit exceeded', { ip, userId, count: currentCount });
            await this.auditLogService.logSecurity({
                timestamp: new Date(),
                type: 'RATE_LIMIT_EXCEEDED',
                severity: 'MEDIUM',
                ip,
                userId,
                details: { ip, userId, requestCount: currentCount }
            });
            throw new Error('Rate limit exceeded');
        }
        // Reset counts after 1 minute
        setTimeout(() => {
            this.requestCounts.delete(key);
        }, 60000);
    }
    async trackGeoAnomalies(metadata) {
        var _a, _b, _c, _d;
        if (!metadata.userId || !metadata.geolocation)
            return;
        const userLastLocation = await this.getUserLastLocation(metadata.userId);
        if (userLastLocation &&
            this.calculateDistance(((_a = userLastLocation.ll) === null || _a === void 0 ? void 0 : _a[0]) || 0, ((_b = userLastLocation.ll) === null || _b === void 0 ? void 0 : _b[1]) || 0, ((_c = metadata.geolocation.ll) === null || _c === void 0 ? void 0 : _c[0]) || 0, ((_d = metadata.geolocation.ll) === null || _d === void 0 ? void 0 : _d[1]) || 0) > 1000) { // More than 1000km difference
            logger_1.logger.warn('Suspicious location change detected', {
                userId: metadata.userId,
                oldLocation: userLastLocation,
                newLocation: metadata.geolocation
            });
            await this.auditLogService.logSecurity({
                timestamp: new Date(),
                type: 'GEO_ANOMALY',
                severity: 'HIGH',
                ip: metadata.ip,
                userId: metadata.userId,
                details: {
                    userId: metadata.userId,
                    previousLocation: userLastLocation,
                    currentLocation: metadata.geolocation
                }
            });
        }
    }
    async monitorBruteForce(metadata) {
        if (metadata.statusCode === 401) {
            const key = metadata.ip;
            const failCount = (this.failedLogins.get(key) || 0) + 1;
            this.failedLogins.set(key, failCount);
            if (failCount >= SecurityMonitoringService.RATE_LIMITS.maxFailedLogins) {
                logger_1.logger.warn('Possible brute force attack detected', {
                    ip: metadata.ip,
                    userId: metadata.userId,
                    failCount
                });
                await this.auditLogService.logSecurity({
                    timestamp: new Date(),
                    type: 'BRUTE_FORCE_ATTEMPT',
                    severity: 'HIGH',
                    ip: metadata.ip,
                    userId: metadata.userId,
                    details: { ip: metadata.ip, failedAttempts: failCount }
                });
            }
            // Reset count after 30 minutes
            setTimeout(() => {
                this.failedLogins.delete(key);
            }, 30 * 60 * 1000);
        }
    }
    async analyzeUserBehavior(metadata) {
        if (!metadata.userId || !metadata.sessionId)
            return;
        const userSessions = this.activeSessions.get(metadata.userId) || new Set();
        userSessions.add(metadata.sessionId);
        this.activeSessions.set(metadata.userId, userSessions);
        if (userSessions.size > SecurityMonitoringService.RATE_LIMITS.maxConcurrentSessions) {
            logger_1.logger.warn('Multiple concurrent sessions detected', {
                userId: metadata.userId,
                sessionCount: userSessions.size
            });
            await this.auditLogService.logSecurity({
                timestamp: new Date(),
                type: 'CONCURRENT_SESSIONS',
                severity: 'MEDIUM',
                ip: metadata.ip,
                userId: metadata.userId,
                details: {
                    userId: metadata.userId,
                    sessionCount: userSessions.size
                }
            });
        }
    }
    async getUserLastLocation(userId) {
        // Implement this method to fetch user's last known location from your database
        return null;
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }
    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
}
exports.SecurityMonitoringService = SecurityMonitoringService;
SecurityMonitoringService.SUSPICIOUS_PATTERNS = [
    /union\s+select/i,
    /exec(\s|\+)/i,
    /<script>/i,
    /javascript:/i,
    /onload=/i,
    /onerror=/i
];
SecurityMonitoringService.RATE_LIMITS = {
    maxRequestsPerMinute: 100,
    maxFailedLogins: 5,
    maxConcurrentSessions: 5
};
exports.securityMonitoringService = new SecurityMonitoringService(new auditLog_service_1.AuditLogService());
