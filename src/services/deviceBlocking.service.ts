import { DeviceFingerprint } from '../models/device-fingerprint.model';
import { IPTracking } from '../models/ip-tracking.model';
import { logger } from '../utils/logger';

export interface DeviceBlockResult {
  isBlocked: boolean;
  reason?: string;
  blockedAt?: Date;
  canAppeal: boolean;
}

export class DeviceBlockingService {
  /**
   * Check if a device is permanently blocked
   */
  static async isDeviceBlocked(fingerprint: string): Promise<DeviceBlockResult> {
    try {
      const device = await DeviceFingerprint.findOne({ fingerprint });
      
      if (!device) {
        return { isBlocked: false, canAppeal: false };
      }

      if (device.isBlocked) {
        return {
          isBlocked: true,
          reason: device.blockedReason || 'Device blocked for security reasons',
          blockedAt: device.blockedAt,
          canAppeal: true,
        };
      }

      // Check if device has multiple accounts (auto-block)
      if (device.associatedUsers.length > 1) {
        await this.blockDevice(
          fingerprint,
          'Multiple accounts detected on single device',
          'SYSTEM'
        );
        
        return {
          isBlocked: true,
          reason: 'Multiple accounts detected on single device',
          blockedAt: new Date(),
          canAppeal: true,
        };
      }

      return { isBlocked: false, canAppeal: false };
    } catch (error) {
      logger.error('Error checking device block status:', error);
      return { isBlocked: false, canAppeal: false };
    }
  }

  /**
   * Block a device permanently
   */
  static async blockDevice(
    fingerprint: string,
    reason: string,
    blockedBy: string
  ): Promise<void> {
    try {
      await DeviceFingerprint.updateOne(
        { fingerprint },
        {
          $set: {
            isBlocked: true,
            blockedReason: reason,
            blockedAt: new Date(),
            isFlagged: true,
            flagReason: reason,
            flaggedAt: new Date(),
          },
        },
        { upsert: true }
      );

      logger.warn('Device permanently blocked', {
        fingerprint: fingerprint.substring(0, 8) + '...',
        reason,
        blockedBy,
      });
    } catch (error) {
      logger.error('Error blocking device:', error);
      throw error;
    }
  }

  /**
   * Unblock a device (admin action)
   */
  static async unblockDevice(
    fingerprint: string,
    reason: string,
    unblockedBy: string
  ): Promise<void> {
    try {
      await DeviceFingerprint.updateOne(
        { fingerprint },
        {
          $set: {
            isBlocked: false,
            blockedReason: undefined,
            blockedAt: undefined,
          },
          $push: {
            notes: `Unblocked on ${new Date().toISOString()} by ${unblockedBy}: ${reason}`,
          },
        }
      );

      logger.info('Device unblocked', {
        fingerprint: fingerprint.substring(0, 8) + '...',
        reason,
        unblockedBy,
      });
    } catch (error) {
      logger.error('Error unblocking device:', error);
      throw error;
    }
  }

  /**
   * Check if IP should be blocked based on device activity
   */
  static async checkIPForBlocking(ip: string): Promise<void> {
    try {
      // Count devices from this IP that are blocked
      const blockedDevicesFromIP = await DeviceFingerprint.countDocuments({
        'network.ip': ip,
        isBlocked: true,
      });

      // Count total devices from this IP
      const totalDevicesFromIP = await DeviceFingerprint.countDocuments({
        'network.ip': ip,
      });

      // If more than 50% of devices from this IP are blocked, block the IP
      if (totalDevicesFromIP >= 3 && blockedDevicesFromIP / totalDevicesFromIP > 0.5) {
        await IPTracking.updateOne(
          { ip },
          {
            $set: {
              isBlacklisted: true,
              'fraudIndicators.multipleAccounts': true,
              riskLevel: 'CRITICAL',
              riskScore: 100,
            },
            $push: {
              actions: {
                type: 'BLACKLIST',
                reason: `Auto-blocked: ${blockedDevicesFromIP}/${totalDevicesFromIP} devices blocked`,
                performedBy: 'SYSTEM',
                timestamp: new Date(),
              },
            },
          },
          { upsert: true }
        );

        logger.warn('IP auto-blocked due to device activity', {
          ip,
          blockedDevices: blockedDevicesFromIP,
          totalDevices: totalDevicesFromIP,
        });
      }
    } catch (error) {
      logger.error('Error checking IP for blocking:', error);
    }
  }

  /**
   * Get device block statistics
   */
  static async getBlockStatistics(): Promise<{
    totalBlocked: number;
    blockedToday: number;
    topBlockReasons: Array<{ reason: string; count: number }>;
    recentBlocks: Array<{
      fingerprint: string;
      reason: string;
      blockedAt: Date;
      associatedUsers: number;
    }>;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalBlocked, blockedToday, recentBlocks] = await Promise.all([
        DeviceFingerprint.countDocuments({ isBlocked: true }),
        DeviceFingerprint.countDocuments({
          isBlocked: true,
          blockedAt: { $gte: today },
        }),
        DeviceFingerprint.find({ isBlocked: true })
          .sort({ blockedAt: -1 })
          .limit(20)
          .select('fingerprint blockedReason blockedAt associatedUsers'),
      ]);

      // Get top block reasons
      const reasonAggregation = await DeviceFingerprint.aggregate([
        { $match: { isBlocked: true, blockedReason: { $exists: true } } },
        { $group: { _id: '$blockedReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      const topBlockReasons = reasonAggregation.map(item => ({
        reason: item._id,
        count: item.count,
      }));

      return {
        totalBlocked,
        blockedToday,
        topBlockReasons,
        recentBlocks: recentBlocks.map(block => ({
          fingerprint: block.fingerprint.substring(0, 12) + '...',
          reason: block.blockedReason || 'Unknown',
          blockedAt: block.blockedAt || new Date(),
          associatedUsers: block.associatedUsers.length,
        })),
      };
    } catch (error) {
      logger.error('Error getting block statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old device fingerprints (optional maintenance)
   */
  static async cleanupOldDevices(daysOld: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await DeviceFingerprint.deleteMany({
        lastSeen: { $lt: cutoffDate },
        isBlocked: false,
        isFlagged: false,
        associatedUsers: { $size: 0 },
      });

      logger.info('Cleaned up old device fingerprints', {
        deletedCount: result.deletedCount,
        cutoffDate,
      });

      return result.deletedCount || 0;
    } catch (error) {
      logger.error('Error cleaning up old devices:', error);
      throw error;
    }
  }

  /**
   * Check for device fingerprint evasion attempts
   */
  static async detectEvasionAttempts(
    newFingerprint: string,
    ip: string
  ): Promise<{
    isEvasionAttempt: boolean;
    confidence: number;
    evidence: string[];
  }> {
    try {
      const evidence: string[] = [];
      let confidence = 0;

      // Check for recently blocked devices from same IP
      const recentBlockedFromIP = await DeviceFingerprint.find({
        'network.ip': ip,
        isBlocked: true,
        blockedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      });

      if (recentBlockedFromIP.length > 0) {
        evidence.push(`${recentBlockedFromIP.length} devices blocked from this IP in last 24h`);
        confidence += 40;
      }

      // Check for rapid device changes from same IP
      const recentDevicesFromIP = await DeviceFingerprint.find({
        'network.ip': ip,
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      });

      if (recentDevicesFromIP.length > 2) {
        evidence.push(`${recentDevicesFromIP.length} different devices from IP in last hour`);
        confidence += 30;
      }

      // Check for similar but slightly different fingerprints
      const similarFingerprints = await DeviceFingerprint.find({
        fingerprint: { $ne: newFingerprint },
        'network.ip': ip,
        $expr: {
          $gt: [
            {
              $strLenCP: {
                $reduce: {
                  input: { $range: [0, { $strLenCP: '$fingerprint' }] },
                  initialValue: '',
                  in: {
                    $cond: [
                      {
                        $eq: [
                          { $substrCP: ['$fingerprint', '$$this', 1] },
                          { $substrCP: [newFingerprint, '$$this', 1] },
                        ],
                      },
                      { $concat: ['$$value', 'x'] },
                      '$$value',
                    ],
                  },
                },
              },
            },
            50, // More than 50 characters match
          ],
        },
      });

      if (similarFingerprints.length > 0) {
        evidence.push(`${similarFingerprints.length} similar fingerprints detected`);
        confidence += 25;
      }

      return {
        isEvasionAttempt: confidence >= 50,
        confidence,
        evidence,
      };
    } catch (error) {
      logger.error('Error detecting evasion attempts:', error);
      return { isEvasionAttempt: false, confidence: 0, evidence: [] };
    }
  }
}
