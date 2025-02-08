"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityMonitoringService = void 0;
const logger_1 = require("../utils/logger");
const deviceFingerprint_service_1 = require("./deviceFingerprint.service");
const auditLog_service_1 = require("./auditLog.service");
const ioredis_1 = require("ioredis");
const redis = new ioredis_1.Redis(process.env.REDIS_URL || 'redis://localhost:6379');
class SecurityMonitoringService {
    static async monitorRequest(req, userId) {
        try {
            // Analyze device and get risk score
            const deviceInfo = await deviceFingerprint_service_1.DeviceFingerprintService.analyzeDevice(req);
            const riskScore = deviceInfo.riskScore;
            // Track suspicious IPs
            const ip = req.ip;
            await this.trackSuspiciousIP(ip);
            // Monitor for concurrent sessions
            if (userId) {
                await this.checkConcurrentSessions(userId, deviceInfo.fingerprint);
            }
            // Generate alerts based on risk score
            if (riskScore >= this.ALERT_THRESHOLD.HIGH) {
                await this.generateAlert('high', 'High-risk activity detected', {
                    userId,
                    deviceInfo,
                    riskScore
                });
            }
            else if (riskScore >= this.ALERT_THRESHOLD.MEDIUM) {
                await this.generateAlert('medium', 'Suspicious activity detected', {
                    userId,
                    deviceInfo,
                    riskScore
                });
            }
            // Log security event
            await auditLog_service_1.AuditLogService.log({
                userId: userId || 'anonymous',
                action: 'security_check',
                resourceType: 'security',
                request: req,
                status: 'success',
                metadata: {
                    riskScore,
                    deviceInfo
                }
            });
            return { riskScore, deviceInfo };
        }
        catch (error) {
            logger_1.logger.error('Security monitoring failed:', error);
            throw error;
        }
    }
    static async trackSuspiciousIP(ip) {
        const key = `suspicious_ip:${ip}`;
        const attempts = await redis.incr(key);
        await redis.expire(key, 24 * 60 * 60); // 24 hours
        if (attempts >= 10) {
            await this.generateAlert('high', 'Suspicious IP activity', { ip, attempts });
        }
    }
    static async checkConcurrentSessions(userId, deviceFingerprint) {
        const key = `user_sessions:${userId}`;
        const sessions = await redis.smembers(key);
        // Add current session
        await redis.sadd(key, deviceFingerprint);
        await redis.expire(key, 24 * 60 * 60); // 24 hours
        // Alert if too many concurrent sessions
        if (sessions.length > 5) {
            await this.generateAlert('medium', 'Multiple concurrent sessions detected', {
                userId,
                sessionCount: sessions.length
            });
        }
    }
    static async generateAlert(type, message, details) {
        const alert = {
            type,
            message,
            details,
            timestamp: new Date()
        };
        // Store alert in Redis for real-time monitoring
        await redis.lpush('security_alerts', JSON.stringify(alert));
        await redis.ltrim('security_alerts', 0, 999); // Keep last 1000 alerts
        // Log alert
        if (type === 'high') {
            logger_1.logger.error(`🚨 SECURITY ALERT: ${message}`, details);
        }
        else if (type === 'medium') {
            logger_1.logger.warn(`⚠️ SECURITY WARNING: ${message}`, details);
        }
        else {
            logger_1.logger.info(`ℹ️ SECURITY NOTICE: ${message}`, details);
        }
        // Implement notification system for high-priority alerts
        if (type === 'high') {
            await this.notifySecurityTeam(alert);
        }
    }
    static async notifySecurityTeam(alert) {
        // Implement your notification logic here (email, SMS, Slack, etc.)
        logger_1.logger.info('Security team notified of high-priority alert', alert);
    }
    // Get recent security alerts
    static async getRecentAlerts(limit = 100) {
        const alerts = await redis.lrange('security_alerts', 0, limit - 1);
        return alerts.map((alert) => JSON.parse(alert));
    }
    // Get security metrics
    static async getSecurityMetrics() {
        const now = Date.now();
        const hourAgo = now - 60 * 60 * 1000;
        return {
            highRiskAlerts: await redis.llen('security_alerts:high'),
            suspiciousIPs: await redis.keys('suspicious_ip:*'),
            recentFailedLogins: await redis.zcount('failed_logins', hourAgo, now)
        };
    }
}
exports.SecurityMonitoringService = SecurityMonitoringService;
SecurityMonitoringService.ALERT_THRESHOLD = {
    HIGH: 80,
    MEDIUM: 50,
    LOW: 30
};
