import { Request } from 'express';
import { logger } from '../utils/logger';
import { DeviceFingerprintService } from './deviceFingerprint.service';
import { AuditLogService } from './auditLog.service';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface SecurityAlert {
  type: 'high' | 'medium' | 'low';
  message: string;
  details: any;
  timestamp: Date;
}

export class SecurityMonitoringService {
  private static readonly ALERT_THRESHOLD = {
    HIGH: 80,
    MEDIUM: 50,
    LOW: 30
  };

  static async monitorRequest(req: Request, userId?: string) {
    try {
      // Analyze device and get risk score
      const deviceInfo = await DeviceFingerprintService.analyzeDevice(req);
      const riskScore = deviceInfo.riskScore;

      // Track suspicious IPs
      const ip = req.ip as any
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
      } else if (riskScore >= this.ALERT_THRESHOLD.MEDIUM) {
        await this.generateAlert('medium', 'Suspicious activity detected', {
          userId,
          deviceInfo,
          riskScore
        });
      }

      // Log security event
      await AuditLogService.log({
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
    } catch (error) {
      logger.error('Security monitoring failed:', error);
      throw error;
    }
  }

  private static async trackSuspiciousIP(ip: string) {
    const key = `suspicious_ip:${ip}`;
    const attempts = await redis.incr(key);
    await redis.expire(key, 24 * 60 * 60); // 24 hours

    if (attempts >= 10) {
      await this.generateAlert('high', 'Suspicious IP activity', { ip, attempts });
    }
  }

  private static async checkConcurrentSessions(userId: string, deviceFingerprint: string) {
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

  private static async generateAlert(type: 'high' | 'medium' | 'low', message: string, details: any) {
    const alert: SecurityAlert = {
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
      logger.error(`🚨 SECURITY ALERT: ${message}`, details);
    } else if (type === 'medium') {
      logger.warn(`⚠️ SECURITY WARNING: ${message}`, details);
    } else {
      logger.info(`ℹ️ SECURITY NOTICE: ${message}`, details);
    }

    // Implement notification system for high-priority alerts
    if (type === 'high') {
      await this.notifySecurityTeam(alert);
    }
  }

  private static async notifySecurityTeam(alert: SecurityAlert) {
    // Implement your notification logic here (email, SMS, Slack, etc.)
    logger.info('Security team notified of high-priority alert', alert);
  }

  // Get recent security alerts
  static async getRecentAlerts(limit: number = 100) {
    const alerts = await redis.lrange('security_alerts', 0, limit - 1);
    return alerts.map((alert: string) => JSON.parse(alert));
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
