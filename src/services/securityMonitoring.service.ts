import { logger } from '../utils/logger';
import { IRequestMetadata } from '../middleware/advanced-tracking.middleware';
import { AuditLogService } from './auditLog.service';

export class SecurityMonitoringService {
  private static readonly SUSPICIOUS_PATTERNS = [
    /union\s+select/i,
    /exec(\s|\+)/i,
    /<script>/i,
    /javascript:/i,
    /onload=/i,
    /onerror=/i
  ];

  private static readonly RATE_LIMITS = {
    maxRequestsPerMinute: 100,
    maxFailedLogins: 5,
    maxConcurrentSessions: 5
  };

  private requestCounts: Map<string, number> = new Map();
  private failedLogins: Map<string, number> = new Map();
  private activeSessions: Map<string, Set<string>> = new Map();

  constructor(private auditLogService: AuditLogService) {}

  async analyzeRequest(metadata: IRequestMetadata): Promise<void> {
    try {
      await Promise.all([
        this.checkForSuspiciousPatterns(metadata),
        this.enforceRateLimits(metadata),
        this.trackGeoAnomalies(metadata),
        this.monitorBruteForce(metadata),
        this.analyzeUserBehavior(metadata)
      ]);
    } catch (error) {
      logger.error('Error in security analysis:', error);
      throw error;
    }
  }

  private async checkForSuspiciousPatterns(metadata: IRequestMetadata): Promise<void> {
    const route = metadata.route || '';
    const userInput = JSON.stringify(metadata);

    for (const pattern of SecurityMonitoringService.SUSPICIOUS_PATTERNS) {
      if (pattern.test(userInput)) {
        logger.warn('Suspicious pattern detected', {
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

  private async enforceRateLimits(metadata: IRequestMetadata): Promise<void> {
    const { ip, userId } = metadata;
    const key = userId || ip;
    const currentCount = (this.requestCounts.get(key) || 0) + 1;
    this.requestCounts.set(key, currentCount);

    if (currentCount > SecurityMonitoringService.RATE_LIMITS.maxRequestsPerMinute) {
      logger.warn('Rate limit exceeded', { ip, userId, count: currentCount });

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

  private async trackGeoAnomalies(metadata: IRequestMetadata): Promise<void> {
    if (!metadata.userId || !metadata.geolocation) return;

    const userLastLocation = await this.getUserLastLocation(metadata.userId);
    if (userLastLocation &&
        this.calculateDistance(
          userLastLocation.ll?.[0] || 0,
          userLastLocation.ll?.[1] || 0,
          metadata.geolocation.ll?.[0] || 0,
          metadata.geolocation.ll?.[1] || 0
        ) > 1000) { // More than 1000km difference

      logger.warn('Suspicious location change detected', {
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

  private async monitorBruteForce(metadata: IRequestMetadata): Promise<void> {
    if (metadata.statusCode === 401) {
      const key = metadata.ip;
      const failCount = (this.failedLogins.get(key) || 0) + 1;
      this.failedLogins.set(key, failCount);

      if (failCount >= SecurityMonitoringService.RATE_LIMITS.maxFailedLogins) {
        logger.warn('Possible brute force attack detected', {
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

  private async analyzeUserBehavior(metadata: IRequestMetadata): Promise<void> {
    if (!metadata.userId || !metadata.sessionId) return;

    const userSessions = this.activeSessions.get(metadata.userId) || new Set();
    userSessions.add(metadata.sessionId);
    this.activeSessions.set(metadata.userId, userSessions);

    if (userSessions.size > SecurityMonitoringService.RATE_LIMITS.maxConcurrentSessions) {
      logger.warn('Multiple concurrent sessions detected', {
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

  private async getUserLastLocation(userId: string): Promise<{
    country?: string;
    region?: string;
    city?: string;
    ll?: [number, number];
  } | null> {
    // Implement this method to fetch user's last known location from your database
    return null;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const securityMonitoringService = new SecurityMonitoringService(new AuditLogService());
