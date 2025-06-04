import express from 'express';
import { FraudDetectionService } from '../services/fraudDetection.service';
import { DeviceFingerprint } from '../models/device-fingerprint.model';
import { IPTracking } from '../models/ip-tracking.model';
import { FraudAttempt } from '../models/fraud-attempt.model';
import { User } from '../models/User';
import { authenticateToken } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';
import { flagDeviceForFraud, whitelistIP } from '../middleware/fraudDetection.middleware';

const router = express.Router();

// Middleware to check admin access
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = req.user as any;
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * Get fraud detection statistics
 * @route GET /api/fraud/stats
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const timeRange = parseInt(req.query.hours as string) || 24;
    const stats = await FraudDetectionService.getFraudStats(timeRange * 60 * 60 * 1000);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting fraud stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get fraud statistics'
    });
  }
});

/**
 * Get high-risk devices
 * @route GET /api/fraud/devices/high-risk
 */
router.get('/devices/high-risk', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const highRiskDevices = await DeviceFingerprint.find({
      $or: [
        { 'riskFactors.severity': { $in: ['HIGH', 'CRITICAL'] } },
        { 'riskFactors.score': { $gte: 70 } },
        { isFlagged: true }
      ]
    })
    .sort({ 'riskFactors.score': -1, lastSeen: -1 })
    .limit(limit)
    .select('fingerprint riskFactors network.ip associatedUsers isFlagged flagReason lastSeen createdAt');

    res.json({
      success: true,
      devices: highRiskDevices.map(device => ({
        id: device._id,
        fingerprint: device.fingerprint.substring(0, 12) + '...',
        riskScore: device.riskFactors.score,
        severity: device.riskFactors.severity,
        factors: device.riskFactors.factors,
        ip: device.network.ip,
        userCount: device.associatedUsers.length,
        isFlagged: device.isFlagged,
        flagReason: device.flagReason,
        lastSeen: device.lastSeen,
        firstSeen: device.firstSeen
      }))
    });
  } catch (error) {
    logger.error('Error getting high-risk devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get high-risk devices'
    });
  }
});

/**
 * Get suspicious IP addresses
 * @route GET /api/fraud/ips/suspicious
 */
router.get('/ips/suspicious', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const suspiciousIPs = await IPTracking.find({
      $or: [
        { riskLevel: { $in: ['HIGH', 'CRITICAL'] } },
        { 'threatIntel.isVPN': true },
        { 'threatIntel.isProxy': true },
        { 'fraudIndicators.multipleAccounts': true },
        { 'fraudIndicators.rapidRegistrations': true }
      ]
    })
    .sort({ riskScore: -1, 'usage.lastSeen': -1 })
    .limit(limit)
    .select('ip riskScore riskLevel threatIntel fraudIndicators usage.uniqueUsers geolocation isBlacklisted isWhitelisted');

    res.json({
      success: true,
      ips: suspiciousIPs.map(ip => ({
        id: ip._id,
        ip: ip.ip,
        riskScore: ip.riskScore,
        riskLevel: ip.riskLevel,
        userCount: ip.usage.uniqueUsers,
        country: ip.geolocation?.country,
        city: ip.geolocation?.city,
        isVPN: ip.threatIntel.isVPN,
        isProxy: ip.threatIntel.isProxy,
        multipleAccounts: ip.fraudIndicators.multipleAccounts,
        rapidRegistrations: ip.fraudIndicators.rapidRegistrations,
        isBlacklisted: ip.isBlacklisted,
        isWhitelisted: ip.isWhitelisted,
        lastSeen: ip.usage.lastSeen
      }))
    });
  } catch (error) {
    logger.error('Error getting suspicious IPs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suspicious IPs'
    });
  }
});

/**
 * Flag a device for fraud
 * @route POST /api/fraud/devices/:deviceId/flag
 */
router.post('/devices/:deviceId/flag', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { reason } = req.body;
    const user = req.user as any;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const device = await DeviceFingerprint.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    await flagDeviceForFraud(device.fingerprint, reason, user._id.toString());

    res.json({
      success: true,
      message: 'Device flagged successfully'
    });
  } catch (error) {
    logger.error('Error flagging device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag device'
    });
  }
});

/**
 * Whitelist an IP address
 * @route POST /api/fraud/ips/:ipId/whitelist
 */
router.post('/ips/:ipId/whitelist', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ipId } = req.params;
    const { reason } = req.body;
    const user = req.user as any;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const ipRecord = await IPTracking.findById(ipId);
    if (!ipRecord) {
      return res.status(404).json({
        success: false,
        message: 'IP record not found'
      });
    }

    await whitelistIP(ipRecord.ip, reason, user._id.toString());

    res.json({
      success: true,
      message: 'IP whitelisted successfully'
    });
  } catch (error) {
    logger.error('Error whitelisting IP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to whitelist IP'
    });
  }
});

/**
 * Blacklist an IP address
 * @route POST /api/fraud/ips/:ipId/blacklist
 */
router.post('/ips/:ipId/blacklist', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ipId } = req.params;
    const { reason } = req.body;
    const user = req.user as any;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const ipRecord = await IPTracking.findById(ipId);
    if (!ipRecord) {
      return res.status(404).json({
        success: false,
        message: 'IP record not found'
      });
    }

    await IPTracking.updateOne(
      { _id: ipId },
      {
        $set: {
          isBlacklisted: true,
          isWhitelisted: false,
        },
        $push: {
          actions: {
            type: 'BLACKLIST',
            reason,
            performedBy: user._id,
            timestamp: new Date(),
          },
        },
      }
    );

    logger.info('IP blacklisted', {
      ip: ipRecord.ip,
      reason,
      performedBy: user._id.toString()
    });

    res.json({
      success: true,
      message: 'IP blacklisted successfully'
    });
  } catch (error) {
    logger.error('Error blacklisting IP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to blacklist IP'
    });
  }
});

/**
 * Get device details
 * @route GET /api/fraud/devices/:deviceId
 */
router.get('/devices/:deviceId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await DeviceFingerprint.findById(deviceId)
      .populate('associatedUsers', 'email username fullName createdAt')
      .populate('flaggedBy', 'email username');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      device: {
        id: device._id,
        fingerprint: device.fingerprint,
        components: device.components,
        userAgent: device.userAgent,
        network: device.network,
        browser: device.browser,
        screen: device.screen,
        hardware: device.hardware,
        behavioral: device.behavioral,
        riskFactors: device.riskFactors,
        associatedUsers: device.associatedUsers,
        seenCount: device.seenCount,
        firstSeen: device.firstSeen,
        lastSeen: device.lastSeen,
        isFlagged: device.isFlagged,
        flagReason: device.flagReason,
        flaggedAt: device.flaggedAt,
        flaggedBy: device.flaggedBy,
        isBlocked: device.isBlocked,
        tags: device.tags,
        notes: device.notes
      }
    });
  } catch (error) {
    logger.error('Error getting device details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get device details'
    });
  }
});

/**
 * Get all devices with pagination and filtering
 * @route GET /api/fraud/devices
 */
router.get('/devices', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Apply filters
    if (req.query.riskLevel) {
      filter['riskFactors.severity'] = req.query.riskLevel;
    }
    if (req.query.isFlagged === 'true') {
      filter.isFlagged = true;
    }
    if (req.query.isBlocked === 'true') {
      filter.isBlocked = true;
    }
    if (req.query.search) {
      filter.$or = [
        { fingerprint: { $regex: req.query.search, $options: 'i' } },
        { 'network.ip': { $regex: req.query.search, $options: 'i' } },
        { 'userAgent.raw': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [devices, total] = await Promise.all([
      DeviceFingerprint.find(filter)
        .sort({ lastSeen: -1 })
        .skip(skip)
        .limit(limit)
        .populate('associatedUsers', 'email username fullName')
        .select('fingerprint riskFactors network.ip associatedUsers isFlagged isBlocked lastSeen firstSeen seenCount userAgent.browser'),
      DeviceFingerprint.countDocuments(filter)
    ]);

    res.json({
      success: true,
      devices: devices.map(device => ({
        id: device._id,
        fingerprint: device.fingerprint.substring(0, 12) + '...',
        fullFingerprint: device.fingerprint,
        riskScore: device.riskFactors.score,
        riskLevel: device.riskFactors.severity,
        ip: device.network.ip,
        userCount: device.associatedUsers.length,
        users: device.associatedUsers,
        browser: device.userAgent.browser?.name || 'Unknown',
        isFlagged: device.isFlagged,
        isBlocked: device.isBlocked,
        lastSeen: device.lastSeen,
        firstSeen: device.firstSeen,
        seenCount: device.seenCount
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get devices'
    });
  }
});

/**
 * Get all IP addresses with pagination and filtering
 * @route GET /api/fraud/ips
 */
router.get('/ips', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Apply filters
    if (req.query.riskLevel) {
      filter.riskLevel = req.query.riskLevel;
    }
    if (req.query.isWhitelisted === 'true') {
      filter.isWhitelisted = true;
    }
    if (req.query.isBlacklisted === 'true') {
      filter.isBlacklisted = true;
    }
    if (req.query.isVPN === 'true') {
      filter['threatIntel.isVPN'] = true;
    }
    if (req.query.search) {
      filter.$or = [
        { ip: { $regex: req.query.search, $options: 'i' } },
        { 'geolocation.country': { $regex: req.query.search, $options: 'i' } },
        { 'geolocation.city': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [ips, total] = await Promise.all([
      IPTracking.find(filter)
        .sort({ 'usage.lastSeen': -1 })
        .skip(skip)
        .limit(limit)
        .populate('associatedUsers', 'email username fullName')
        .select('ip riskScore riskLevel threatIntel fraudIndicators usage geolocation isWhitelisted isBlacklisted associatedUsers'),
      IPTracking.countDocuments(filter)
    ]);

    res.json({
      success: true,
      ips: ips.map(ip => ({
        id: ip._id,
        ip: ip.ip,
        riskScore: ip.riskScore,
        riskLevel: ip.riskLevel,
        userCount: ip.usage.uniqueUsers,
        users: ip.associatedUsers,
        country: ip.geolocation?.country || 'Unknown',
        city: ip.geolocation?.city || 'Unknown',
        isVPN: ip.threatIntel.isVPN,
        isProxy: ip.threatIntel.isProxy,
        isMalicious: ip.threatIntel.isMalicious,
        multipleAccounts: ip.fraudIndicators.multipleAccounts,
        rapidRegistrations: ip.fraudIndicators.rapidRegistrations,
        isWhitelisted: ip.isWhitelisted,
        isBlacklisted: ip.isBlacklisted,
        lastSeen: ip.usage.lastSeen,
        firstSeen: ip.usage.firstSeen,
        totalRequests: ip.usage.totalRequests
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting IPs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IPs'
    });
  }
});

/**
 * Get IP details
 * @route GET /api/fraud/ips/:ipId
 */
router.get('/ips/:ipId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ipId } = req.params;

    const ip = await IPTracking.findById(ipId)
      .populate('associatedUsers', 'email username fullName createdAt')
      .populate('actions.performedBy', 'email username');

    if (!ip) {
      return res.status(404).json({
        success: false,
        message: 'IP record not found'
      });
    }

    res.json({
      success: true,
      ip: {
        id: ip._id,
        ip: ip.ip,
        ipType: ip.ipType,
        geolocation: ip.geolocation,
        threatIntel: ip.threatIntel,
        usage: ip.usage,
        behavior: ip.behavior,
        associatedUsers: ip.associatedUsers,
        associatedDevices: ip.associatedDevices,
        riskScore: ip.riskScore,
        riskLevel: ip.riskLevel,
        riskFactors: ip.riskFactors,
        reputation: ip.reputation,
        fraudIndicators: ip.fraudIndicators,
        isWhitelisted: ip.isWhitelisted,
        isBlacklisted: ip.isBlacklisted,
        isMonitored: ip.isMonitored,
        actions: ip.actions,
        notes: ip.notes,
        tags: ip.tags,
        lastAnalyzed: ip.lastAnalyzed
      }
    });
  } catch (error) {
    logger.error('Error getting IP details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IP details'
    });
  }
});

/**
 * Block a device
 * @route POST /api/fraud/devices/:deviceId/block
 */
router.post('/devices/:deviceId/block', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { reason } = req.body;
    const user = req.user as any;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const device = await DeviceFingerprint.findByIdAndUpdate(
      deviceId,
      {
        $set: {
          isBlocked: true,
          blockedAt: new Date(),
          blockedReason: reason,
          isFlagged: true,
          flagReason: reason,
          flaggedAt: new Date(),
          flaggedBy: user._id
        }
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    logger.info('Device blocked', {
      deviceId,
      fingerprint: device.fingerprint.substring(0, 8) + '...',
      reason,
      blockedBy: user._id.toString()
    });

    res.json({
      success: true,
      message: 'Device blocked successfully'
    });
  } catch (error) {
    logger.error('Error blocking device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block device'
    });
  }
});

/**
 * Unblock a device
 * @route POST /api/fraud/devices/:deviceId/unblock
 */
router.post('/devices/:deviceId/unblock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const device = await DeviceFingerprint.findByIdAndUpdate(
      deviceId,
      {
        $set: {
          isBlocked: false,
          blockedAt: undefined,
          blockedReason: undefined
        }
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    logger.info('Device unblocked', {
      deviceId,
      fingerprint: device.fingerprint.substring(0, 8) + '...',
      reason
    });

    res.json({
      success: true,
      message: 'Device unblocked successfully'
    });
  } catch (error) {
    logger.error('Error unblocking device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock device'
    });
  }
});

/**
 * Whitelist an IP
 * @route POST /api/fraud/ips/:ipId/whitelist
 */
router.post('/ips/:ipId/whitelist', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ipId } = req.params;
    const { reason } = req.body;
    const user = req.user as any;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const ip = await IPTracking.findByIdAndUpdate(
      ipId,
      {
        $set: {
          isWhitelisted: true,
          isBlacklisted: false
        },
        $push: {
          actions: {
            type: 'WHITELIST',
            reason,
            performedBy: user._id,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!ip) {
      return res.status(404).json({
        success: false,
        message: 'IP record not found'
      });
    }

    logger.info('IP whitelisted', {
      ipId,
      ip: ip.ip,
      reason,
      whitelistedBy: user._id.toString()
    });

    res.json({
      success: true,
      message: 'IP whitelisted successfully'
    });
  } catch (error) {
    logger.error('Error whitelisting IP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to whitelist IP'
    });
  }
});

/**
 * Blacklist an IP
 * @route POST /api/fraud/ips/:ipId/blacklist
 */
router.post('/ips/:ipId/blacklist', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ipId } = req.params;
    const { reason } = req.body;
    const user = req.user as any;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const ip = await IPTracking.findByIdAndUpdate(
      ipId,
      {
        $set: {
          isBlacklisted: true,
          isWhitelisted: false
        },
        $push: {
          actions: {
            type: 'BLACKLIST',
            reason,
            performedBy: user._id,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!ip) {
      return res.status(404).json({
        success: false,
        message: 'IP record not found'
      });
    }

    logger.info('IP blacklisted', {
      ipId,
      ip: ip.ip,
      reason,
      blacklistedBy: user._id.toString()
    });

    res.json({
      success: true,
      message: 'IP blacklisted successfully'
    });
  } catch (error) {
    logger.error('Error blacklisting IP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to blacklist IP'
    });
  }
});

/**
 * Get fraud analytics dashboard data
 * @route GET /api/fraud/analytics
 */
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '7d';
    let startDate: Date;

    switch (timeRange) {
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const [
      totalDevices,
      flaggedDevices,
      blockedDevices,
      totalIPs,
      blacklistedIPs,
      vpnIPs,
      recentDevices,
      riskDistribution,
      topCountries,
      fraudTrends
    ] = await Promise.all([
      DeviceFingerprint.countDocuments(),
      DeviceFingerprint.countDocuments({ isFlagged: true }),
      DeviceFingerprint.countDocuments({ isBlocked: true }),
      IPTracking.countDocuments(),
      IPTracking.countDocuments({ isBlacklisted: true }),
      IPTracking.countDocuments({ 'threatIntel.isVPN': true }),
      DeviceFingerprint.find({ firstSeen: { $gte: startDate } }).countDocuments(),
      DeviceFingerprint.aggregate([
        {
          $group: {
            _id: '$riskFactors.severity',
            count: { $sum: 1 }
          }
        }
      ]),
      IPTracking.aggregate([
        {
          $group: {
            _id: '$geolocation.country',
            count: { $sum: 1 },
            riskScore: { $avg: '$riskScore' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      DeviceFingerprint.aggregate([
        {
          $match: {
            firstSeen: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$firstSeen'
              }
            },
            devices: { $sum: 1 },
            flagged: {
              $sum: { $cond: ['$isFlagged', 1, 0] }
            },
            blocked: {
              $sum: { $cond: ['$isBlocked', 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      success: true,
      analytics: {
        overview: {
          totalDevices,
          flaggedDevices,
          blockedDevices,
          totalIPs,
          blacklistedIPs,
          vpnIPs,
          recentDevices,
          flaggedRate: totalDevices > 0 ? ((flaggedDevices / totalDevices) * 100).toFixed(1) : '0',
          blockedRate: totalDevices > 0 ? ((blockedDevices / totalDevices) * 100).toFixed(1) : '0'
        },
        riskDistribution: riskDistribution.reduce((acc, item) => {
          acc[item._id || 'UNKNOWN'] = item.count;
          return acc;
        }, {}),
        topCountries: topCountries.map(country => ({
          country: country._id || 'Unknown',
          count: country.count,
          avgRiskScore: Math.round(country.riskScore || 0)
        })),
        fraudTrends: fraudTrends.map(trend => ({
          date: trend._id,
          devices: trend.devices,
          flagged: trend.flagged,
          blocked: trend.blocked
        }))
      }
    });
  } catch (error) {
    logger.error('Error getting fraud analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get fraud analytics'
    });
  }
});

/**
 * Get recent fraud activities
 * @route GET /api/fraud/activities
 */
router.get('/activities', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Get recent device activities
    const recentDevices = await DeviceFingerprint.find({
      $or: [
        { isFlagged: true },
        { isBlocked: true },
        { 'riskFactors.score': { $gte: 70 } }
      ]
    })
      .sort({ lastSeen: -1 })
      .skip(skip)
      .limit(limit)
      .populate('associatedUsers', 'email username')
      .populate('flaggedBy', 'email username')
      .select('fingerprint riskFactors network.ip associatedUsers isFlagged isBlocked flagReason flaggedAt flaggedBy lastSeen');

    // Get recent IP actions
    const recentIPActions = await IPTracking.find({
      'actions.0': { $exists: true }
    })
      .sort({ 'actions.timestamp': -1 })
      .limit(20)
      .populate('actions.performedBy', 'email username')
      .select('ip actions riskLevel');

    const activities = [
      ...recentDevices.map(device => ({
        type: 'device',
        id: device._id,
        timestamp: device.flaggedAt || device.lastSeen,
        action: device.isBlocked ? 'blocked' : device.isFlagged ? 'flagged' : 'high_risk',
        details: {
          fingerprint: device.fingerprint.substring(0, 12) + '...',
          ip: device.network.ip,
          riskScore: device.riskFactors.score,
          riskLevel: device.riskFactors.severity,
          userCount: device.associatedUsers.length,
          users: device.associatedUsers,
          reason: device.flagReason,
          flaggedBy: device.flaggedBy
        }
      })),
      ...recentIPActions.flatMap(ip =>
        ip.actions.slice(-3).map(action => ({
          type: 'ip',
          id: ip._id,
          timestamp: action.timestamp,
          action: action.type.toLowerCase(),
          details: {
            ip: ip.ip,
            riskLevel: ip.riskLevel,
            reason: action.reason,
            performedBy: action.performedBy
          }
        }))
      )
    ];

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      activities: activities.slice(0, limit),
      pagination: {
        page,
        limit,
        total: activities.length
      }
    });
  } catch (error) {
    logger.error('Error getting fraud activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get fraud activities'
    });
  }
});

// Get fraud attempts (blocked registration attempts)
router.get('/attempts', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter: any = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.riskLevel) {
      if (req.query.riskLevel === 'HIGH') {
        filter.riskScore = { $gte: 70 };
      } else if (req.query.riskLevel === 'MEDIUM') {
        filter.riskScore = { $gte: 40, $lt: 70 };
      } else if (req.query.riskLevel === 'LOW') {
        filter.riskScore = { $lt: 40 };
      }
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      filter.$or = [
        { attemptedEmail: searchRegex },
        { ip: searchRegex },
        { deviceFingerprint: searchRegex }
      ];
    }

    // Get attempts with pagination
    const [attempts, total] = await Promise.all([
      FraudAttempt.find(filter)
        .populate('existingDeviceId', 'fingerprint associatedUsers')
        .populate('existingIPId', 'ip associatedUsers')
        .populate('reviewedBy', 'email username')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FraudAttempt.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.json({
      success: true,
      attempts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev
      }
    });

  } catch (error) {
    logger.error('Error getting fraud attempts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get fraud attempts'
    });
  }
});

// Update fraud attempt status
router.patch('/attempts/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const adminUserId = (req as any).user.id;

    const attempt = await FraudAttempt.findByIdAndUpdate(
      id,
      {
        status,
        adminNotes,
        reviewed: true,
        reviewedBy: adminUserId,
        reviewedAt: new Date()
      },
      { new: true }
    ).populate('reviewedBy', 'email username');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Fraud attempt not found'
      });
    }

    logger.info('Fraud attempt reviewed', {
      attemptId: id,
      status,
      reviewedBy: (req as any).user.email,
      adminNotes: adminNotes?.substring(0, 100)
    });

    res.json({
      success: true,
      attempt
    });

  } catch (error) {
    logger.error('Error reviewing fraud attempt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review fraud attempt'
    });
  }
});

export default router;
