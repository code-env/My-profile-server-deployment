import { Request, Response, NextFunction } from 'express';
import { FraudDetectionService, FraudDetectionResult } from '../services/fraudDetection.service';
import { DeviceBlockingService } from '../services/deviceBlocking.service';
import { logger } from '../utils/logger';

// Extend Request interface to include fraud detection results
declare global {
  namespace Express {
    interface Request {
      fraudDetection?: FraudDetectionResult;
      deviceFingerprint?: any;
    }
  }
}

export interface FraudDetectionOptions {
  skipForWhitelistedIPs?: boolean;
  blockOnCritical?: boolean;
  requireVerificationOnHigh?: boolean;
  logAllAttempts?: boolean;
  customThresholds?: {
    block?: number;
    flag?: number;
    verify?: number;
  };
}

/**
 * Middleware for fraud detection during account registration
 */
export const fraudDetectionMiddleware = (options: FraudDetectionOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract registration context from request body
      // For OAuth flows, email might not be available in req.body
      const context = {
        email: req.body.email || undefined, // Will be undefined for OAuth flows
        referralCode: req.body.referralCode,
        registrationData: req.body,
      };

      // Debug logging for OAuth flows
      if (!context.email) {
        logger.debug('Fraud detection middleware - no email in context', {
          url: req.url,
          method: req.method,
          hasBody: !!req.body,
          bodyKeys: Object.keys(req.body || {}),
          isOAuthFlow: req.url.includes('callback') || req.url.includes('oauth')
        });
      }

      // Skip fraud detection for whitelisted IPs if configured
      if (options.skipForWhitelistedIPs && req.ip && await isWhitelistedIP(req.ip)) {
        logger.info('Skipping fraud detection for whitelisted IP', { ip: req.ip });
        return next();
      }

      // CRITICAL: Check device eligibility BEFORE any processing
      if (req.deviceFingerprint?.fingerprint) {
        const eligibilityCheck = await FraudDetectionService.checkDeviceEligibility(req.deviceFingerprint.fingerprint);

        if (!eligibilityCheck.isEligible) {
          logger.warn('Device registration blocked - not eligible', {
            email: context.email,
            ip: req.ip,
            fingerprint: req.deviceFingerprint.fingerprint.substring(0, 8) + '...',
            reason: eligibilityCheck.reason,
            existingUsers: eligibilityCheck.existingUsers,
            riskScore: eligibilityCheck.riskScore,
          });

          return res.status(403).json({
            success: false,
            error: {
              code: 'DEVICE_ALREADY_REGISTERED',
              message: eligibilityCheck.reason || 'This device is not eligible for registration.',
              riskScore: eligibilityCheck.riskScore,
              existingUsers: eligibilityCheck.existingUsers,
              deviceBlocked: true,
              requiresManualReview: true,
            },
          });
        }

        // Also check if device is permanently blocked
        const blockResult = await DeviceBlockingService.isDeviceBlocked(req.deviceFingerprint.fingerprint);
        if (blockResult.isBlocked) {
          logger.warn('Blocked device attempted registration', {
            email: context.email,
            ip: req.ip,
            fingerprint: req.deviceFingerprint.fingerprint.substring(0, 8) + '...',
            reason: blockResult.reason,
          });

          return res.status(403).json({
            success: false,
            error: {
              code: 'DEVICE_PERMANENTLY_BLOCKED',
              message: 'This device has been permanently blocked from creating accounts. Please contact support if you believe this is an error.',
              reason: blockResult.reason,
              blockedAt: blockResult.blockedAt,
              canAppeal: blockResult.canAppeal,
            },
          });
        }
      }

      // Perform fraud detection analysis
      const fraudResult = await FraudDetectionService.analyzeAccountCreation(
        req,
        context,
        req.body.deviceData // Additional device data from client
      );

      // Attach fraud detection result to request
      req.fraudDetection = fraudResult;

      // Log the fraud detection result
      if (options.logAllAttempts || fraudResult.riskLevel !== 'LOW') {
        logger.info('Fraud detection completed', {
          email: context.email,
          ip: req.ip,
          riskScore: fraudResult.riskScore,
          riskLevel: fraudResult.riskLevel,
          flags: fraudResult.flags,
          deviceFingerprint: fraudResult.deviceFingerprint.substring(0, 8) + '...',
        });
      }

      // Apply custom thresholds if provided
      const blockThreshold = options.customThresholds?.block || 90;
      const flagThreshold = options.customThresholds?.flag || 75;
      const verifyThreshold = options.customThresholds?.verify || 50;

      // Handle critical risk - block registration
      if (fraudResult.riskScore >= blockThreshold && options.blockOnCritical !== false) {
        logger.warn('Blocking registration due to high fraud risk', {
          email: context.email,
          ip: req.ip,
          riskScore: fraudResult.riskScore,
          flags: fraudResult.flags,
        });

        // Check if this is a device reuse attempt
        const isDeviceReuse = fraudResult.flags.includes('DEVICE_ALREADY_REGISTERED') ||
                             fraudResult.flags.includes('SIMILAR_DEVICE_WITH_ACCOUNTS');

        // Set fraud detection result for OAuth flows to check
        req.fraudDetection = {
          ...fraudResult,
          shouldBlock: true,
          shouldFlag: true,
          shouldRequireVerification: true,
          deviceFingerprint: req.deviceFingerprint?.fingerprint || 'unknown',
          ipAddress: req.ip || 'unknown',
        };

        // Check if this is an OAuth callback (should let the route handler decide how to respond)
        const isOAuthFlow = req.url.includes('callback') || req.url.includes('oauth') || req.url.includes('/auth/google');

        if (isOAuthFlow) {
          // For OAuth flows, set the flag and let the route handler decide how to respond
          logger.info('OAuth flow blocked by fraud detection - letting route handler decide response', {
            riskScore: fraudResult.riskScore,
            flags: fraudResult.flags,
          });
          return next(); // Continue to route handler which will check req.fraudDetection.shouldBlock
        } else {
          // For API calls, return JSON response immediately
          return res.status(403).json({
            success: false,
            error: {
              code: isDeviceReuse ? 'DEVICE_ALREADY_REGISTERED' : 'REGISTRATION_BLOCKED',
              message: isDeviceReuse
                ? 'This device already has a registered account. Only one account per device is allowed. Please use your existing account or contact support.'
                : 'Registration cannot be completed due to security concerns. Please contact support if you believe this is an error.',
              riskLevel: fraudResult.riskLevel,
              riskScore: fraudResult.riskScore,
              flags: fraudResult.flags,
              requiresManualReview: true,
              deviceBlocked: isDeviceReuse,
            },
          });
        }
      }

      // Handle high risk - require additional verification
      if (fraudResult.riskScore >= verifyThreshold && options.requireVerificationOnHigh !== false) {
        // Add verification requirements to the response
        req.body.requireAdditionalVerification = true;
        req.body.verificationReason = 'Enhanced security verification required';
        req.body.fraudFlags = fraudResult.flags;
      }

      // Handle medium-high risk - flag for monitoring
      if (fraudResult.riskScore >= flagThreshold) {
        req.body.flagForMonitoring = true;
        req.body.monitoringReason = fraudResult.flags.join(', ');
      }

      // Continue with registration process
      next();
    } catch (error) {
      logger.error('Error in fraud detection middleware:', error);

      // Don't block registration on fraud detection errors, but log them
      req.fraudDetection = {
        riskScore: 50,
        riskLevel: 'MEDIUM',
        flags: ['FRAUD_DETECTION_ERROR'],
        recommendations: ['Manual review recommended due to analysis error'],
        shouldBlock: false,
        shouldFlag: true,
        shouldRequireVerification: true,
        deviceFingerprint: 'unknown',
        ipAddress: req.ip || 'unknown',
        details: {
          deviceRisk: 0,
          ipRisk: 0,
          behavioralRisk: 0,
          networkRisk: 0,
          accountRisk: 50,
        },
      };

      next();
    }
  };
};

/**
 * Middleware to check if IP is whitelisted
 */
async function isWhitelistedIP(ip: string): Promise<boolean> {
  try {
    const { IPTracking } = require('../models/ip-tracking.model');
    const ipRecord = await IPTracking.findOne({ ip, isWhitelisted: true });
    return !!ipRecord;
  } catch (error) {
    logger.error('Error checking IP whitelist:', error);
    return false;
  }
}

/**
 * Middleware for device fingerprinting (can be used independently)
 */
export const deviceFingerprintMiddleware = () => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { DeviceFingerprintService } = require('../services/deviceFingerprint.service');

      // Generate device fingerprint
      const fingerprint = await DeviceFingerprintService.generateFingerprint(
        req,
        req.body.deviceData
      );

      // Attach to request for use in other middleware/controllers
      req.deviceFingerprint = fingerprint;

      next();
    } catch (error) {
      logger.error('Error in device fingerprint middleware:', error);
      next(); // Continue without fingerprint
    }
  };
};

/**
 * Middleware for rate limiting based on device fingerprint
 */
export const deviceBasedRateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use device fingerprint if available, fallback to IP
      const identifier = req.deviceFingerprint?.fingerprint || req.ip;
      const now = Date.now();

      // Clean up old entries
      for (const [key, data] of requestCounts.entries()) {
        if (data.resetTime < now) {
          requestCounts.delete(key);
        }
      }

      // Get or create request count for this identifier
      let requestData = requestCounts.get(identifier);
      if (!requestData || requestData.resetTime < now) {
        requestData = { count: 0, resetTime: now + options.windowMs };
        requestCounts.set(identifier, requestData);
      }

      // Check if limit exceeded
      if (requestData.count >= options.maxRequests) {
        logger.warn('Rate limit exceeded', {
          identifier: identifier.substring(0, 8) + '...',
          count: requestData.count,
          limit: options.maxRequests,
        });

        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
          },
        });
      }

      // Increment request count
      requestData.count++;

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': (options.maxRequests - requestData.count).toString(),
        'X-RateLimit-Reset': new Date(requestData.resetTime).toISOString(),
      });

      next();
    } catch (error) {
      logger.error('Error in device-based rate limiting:', error);
      next(); // Continue without rate limiting
    }
  };
};

/**
 * Middleware to log suspicious activities
 */
export const suspiciousActivityLogger = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log after response is sent
    res.on('finish', () => {
      if (req.fraudDetection && req.fraudDetection.riskLevel !== 'LOW') {
        logger.warn('Suspicious activity detected', {
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          riskScore: req.fraudDetection.riskScore,
          riskLevel: req.fraudDetection.riskLevel,
          flags: req.fraudDetection.flags,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString(),
        });
      }
    });

    next();
  };
};

/**
 * Utility function to manually flag a device/IP for fraud
 */
export async function flagDeviceForFraud(
  deviceFingerprint: string,
  reason: string,
  flaggedBy: string
): Promise<void> {
  try {
    const { DeviceFingerprint } = require('../models/device-fingerprint.model');

    await DeviceFingerprint.updateOne(
      { fingerprint: deviceFingerprint },
      {
        $set: {
          isFlagged: true,
          flagReason: reason,
          flaggedAt: new Date(),
          flaggedBy: flaggedBy,
        },
      }
    );

    logger.info('Device flagged for fraud', {
      deviceFingerprint: deviceFingerprint.substring(0, 8) + '...',
      reason,
      flaggedBy,
    });
  } catch (error) {
    logger.error('Error flagging device for fraud:', error);
    throw error;
  }
}

/**
 * Utility function to whitelist an IP address
 */
export async function whitelistIP(
  ip: string,
  reason: string,
  performedBy: string
): Promise<void> {
  try {
    const { IPTracking } = require('../models/ip-tracking.model');

    await IPTracking.updateOne(
      { ip },
      {
        $set: {
          isWhitelisted: true,
          isBlacklisted: false,
        },
        $push: {
          actions: {
            type: 'WHITELIST',
            reason,
            performedBy,
            timestamp: new Date(),
          },
        },
      },
      { upsert: true }
    );

    logger.info('IP whitelisted', { ip, reason, performedBy });
  } catch (error) {
    logger.error('Error whitelisting IP:', error);
    throw error;
  }
}
