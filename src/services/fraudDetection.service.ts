import { Request } from 'express';
import { DeviceFingerprintService } from './deviceFingerprint.service';
import { DeviceFingerprint, IDeviceFingerprint } from '../models/device-fingerprint.model';
import { IPTracking, IIPTracking } from '../models/ip-tracking.model';
import { FraudAttempt } from '../models/fraud-attempt.model';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface FraudDetectionResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  recommendations: string[];
  shouldBlock: boolean;
  shouldFlag: boolean;
  shouldRequireVerification: boolean;
  deviceFingerprint: string;
  ipAddress: string;
  details: {
    deviceRisk: number;
    ipRisk: number;
    behavioralRisk: number;
    networkRisk: number;
    accountRisk: number;
  };
}

export interface AccountCreationContext {
  userId?: string;
  email: string;
  referralCode?: string;
  registrationData: any;
}

export class FraudDetectionService {
  private static readonly RISK_THRESHOLDS = {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 90,
  };

  private static readonly FRAUD_PATTERNS = {
    RAPID_ACCOUNT_CREATION: {
      timeWindow: 60 * 60 * 1000, // 1 hour
      maxAccounts: 3,
      riskScore: 40,
    },
    DEVICE_REUSE: {
      maxUsers: 1, // STRICT: Only 1 account per device
      riskScore: 100, // CRITICAL: Immediate block
    },
    IP_REUSE: {
      maxUsers: 3, // Reduced from 10 to 3 for stricter control
      riskScore: 50,
    },
    REFERRAL_ABUSE: {
      maxReferrals: 3, // Reduced from 5 to 3
      timeWindow: 24 * 60 * 60 * 1000, // 24 hours
      riskScore: 75,
    },
  };

  /**
   * Comprehensive fraud detection for account registration
   */
  static async analyzeAccountCreation(
    req: Request,
    context: AccountCreationContext,
    additionalData?: any
  ): Promise<FraudDetectionResult> {
    try {
      logger.info('Starting fraud detection analysis', {
        email: context.email,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 50),
      });

      // Generate enhanced device fingerprint
      const deviceFingerprint = await DeviceFingerprintService.generateFingerprint(req, additionalData);

      // CRITICAL: Perform fraud analysis BEFORE storing fingerprint
      // This allows us to check for existing devices before creating new records
      const analysis = await this.performFraudAnalysis(deviceFingerprint, req, context);

      // Only store device fingerprint if not blocked (risk score < 100)
      if (analysis.riskScore < 100) {
        await this.storeDeviceFingerprint(deviceFingerprint, context.userId);
        await this.updateIPTracking(req, context.userId);
      } else {
        // For blocked attempts, still log the attempt but don't store user association
        await this.logBlockedAttempt(deviceFingerprint, req, context, analysis);
      }

      logger.info('Fraud detection analysis completed', {
        email: context.email,
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        flags: analysis.flags.length,
      });

      return analysis;
    } catch (error) {
      logger.error('Error in fraud detection analysis:', error);

      // Return safe defaults on error
      return {
        riskScore: 50,
        riskLevel: 'MEDIUM',
        flags: ['ANALYSIS_ERROR'],
        recommendations: ['Manual review required due to analysis error'],
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
    }
  }

  /**
   * Store or update device fingerprint in database
   */
  private static async storeDeviceFingerprint(
    fingerprint: any,
    userId?: string
  ): Promise<IDeviceFingerprint> {
    try {
      const existingFingerprint = await DeviceFingerprint.findOne({
        fingerprint: fingerprint.fingerprint,
      });

      if (existingFingerprint) {
        // Update existing fingerprint
        existingFingerprint.lastSeen = new Date();
        existingFingerprint.seenCount += 1;

        // Add user association if provided
        if (userId && !existingFingerprint.associatedUsers.includes(new mongoose.Types.ObjectId(userId))) {
          existingFingerprint.associatedUsers.push(new mongoose.Types.ObjectId(userId));
        }

        // Update risk factors
        existingFingerprint.riskFactors = fingerprint.riskFactors;
        existingFingerprint.network.vpnDetection = fingerprint.network.vpnDetection;

        return await existingFingerprint.save();
      } else {
        // Create new fingerprint record
        const newFingerprint = new DeviceFingerprint({
          fingerprint: fingerprint.fingerprint,
          components: fingerprint.components,
          userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
          sessionId: fingerprint.sessionId,
          userAgent: fingerprint.userAgent,
          network: fingerprint.network,
          browser: fingerprint.browser,
          screen: fingerprint.screen,
          hardware: fingerprint.hardware,
          behavioral: fingerprint.behavioral,
          riskFactors: fingerprint.riskFactors,
          associatedUsers: userId ? [new mongoose.Types.ObjectId(userId)] : [],
          associatedSessions: fingerprint.sessionId ? [fingerprint.sessionId] : [],
        });

        return await newFingerprint.save();
      }
    } catch (error) {
      logger.error('Error storing device fingerprint:', error);
      throw error;
    }
  }



  /**
   * Update IP tracking information
   */
  private static async updateIPTracking(req: Request, userId?: string): Promise<IIPTracking> {
    try {
      const ip = req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || '';

      let ipRecord = await IPTracking.findOne({ ip });

      if (ipRecord) {
        // Update existing IP record
        ipRecord.usage.totalRequests += 1;
        ipRecord.usage.lastSeen = new Date();

        if (userId && !ipRecord.associatedUsers.includes(new mongoose.Types.ObjectId(userId))) {
          ipRecord.associatedUsers.push(new mongoose.Types.ObjectId(userId));
          ipRecord.usage.uniqueUsers += 1;
        }

        // Update behavioral patterns
        ipRecord.behavior.userAgentVariations = new Set([
          ...ipRecord.behavior.sessionPatterns,
          userAgent,
        ]).size;

        return await ipRecord.save();
      } else {
        // Create new IP record
        const deviceFingerprint = await DeviceFingerprintService.generateFingerprint(req);

        const newIPRecord = new IPTracking({
          ip,
          ipType: ip.includes(':') ? 'IPv6' : 'IPv4',
          geolocation: {
            country: deviceFingerprint.network.geolocation?.country,
            countryCode: deviceFingerprint.network.geolocation?.country,
            city: deviceFingerprint.network.geolocation?.city,
            latitude: deviceFingerprint.network.geolocation?.ll?.[0],
            longitude: deviceFingerprint.network.geolocation?.ll?.[1],
            timezone: deviceFingerprint.network.geolocation?.timezone,
          },
          threatIntel: {
            isVPN: deviceFingerprint.network.vpnDetection.isVPN,
            isProxy: deviceFingerprint.network.vpnDetection.isProxy,
            isTor: deviceFingerprint.network.vpnDetection.isTor,
            isHosting: deviceFingerprint.network.vpnDetection.isHosting,
            isMalicious: false,
            isBot: false,
            threatScore: deviceFingerprint.network.vpnDetection.riskScore,
            threatCategories: [],
            lastThreatCheck: new Date(),
            threatSources: ['internal'],
          },
          usage: {
            totalRequests: 1,
            uniqueUsers: userId ? 1 : 0,
            uniqueSessions: 1,
            firstSeen: new Date(),
            lastSeen: new Date(),
            peakHourlyRequests: 1,
            averageSessionDuration: 0,
            bounceRate: 0,
          },
          behavior: {
            requestFrequency: 1,
            userAgentVariations: 1,
            sessionPatterns: [userAgent],
            timeZoneConsistency: true,
            languageConsistency: true,
            suspiciousActivities: [],
          },
          associatedUsers: userId ? [new mongoose.Types.ObjectId(userId)] : [],
          associatedDevices: [deviceFingerprint.fingerprint],
          associatedSessions: [],
          riskScore: deviceFingerprint.riskFactors.score,
          riskLevel: deviceFingerprint.riskFactors.severity,
          riskFactors: deviceFingerprint.riskFactors.factors,
          reputation: {
            score: 50,
            sources: ['initial'],
            lastUpdated: new Date(),
          },
          fraudIndicators: {
            multipleAccounts: false,
            rapidRegistrations: false,
            suspiciousReferrals: false,
            botLikeActivity: false,
            vpnUsage: deviceFingerprint.network.vpnDetection.isVPN,
            geoInconsistency: false,
          },
          actions: [],
          tags: [],
          lastAnalyzed: new Date(),
          analysisVersion: '1.0',
        });

        return await newIPRecord.save();
      }
    } catch (error) {
      logger.error('Error updating IP tracking:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive fraud analysis
   */
  private static async performFraudAnalysis(
    deviceFingerprint: any,
    req: Request,
    context: AccountCreationContext
  ): Promise<FraudDetectionResult> {
    const flags: string[] = [];
    const recommendations: string[] = [];
    let totalRiskScore = 0;

    const details = {
      deviceRisk: 0,
      ipRisk: 0,
      behavioralRisk: 0,
      networkRisk: 0,
      accountRisk: 0,
    };

    // 1. Device-based risk analysis
    const deviceRisk = await this.analyzeDeviceRisk(deviceFingerprint, context);
    details.deviceRisk = deviceRisk.score;
    flags.push(...deviceRisk.flags);
    recommendations.push(...deviceRisk.recommendations);
    totalRiskScore += deviceRisk.score;

    // 2. IP-based risk analysis
    const ipRisk = await this.analyzeIPRisk(req, context);
    details.ipRisk = ipRisk.score;
    flags.push(...ipRisk.flags);
    recommendations.push(...ipRisk.recommendations);
    totalRiskScore += ipRisk.score;

    // 3. Network-based risk analysis
    const networkRisk = await this.analyzeNetworkRisk(deviceFingerprint);
    details.networkRisk = networkRisk.score;
    flags.push(...networkRisk.flags);
    recommendations.push(...networkRisk.recommendations);
    totalRiskScore += networkRisk.score;

    // 4. Behavioral risk analysis
    const behavioralRisk = await this.analyzeBehavioralRisk(deviceFingerprint, req);
    details.behavioralRisk = behavioralRisk.score;
    flags.push(...behavioralRisk.flags);
    recommendations.push(...behavioralRisk.recommendations);
    totalRiskScore += behavioralRisk.score;

    // 5. Account-specific risk analysis
    const accountRisk = await this.analyzeAccountRisk(context);
    details.accountRisk = accountRisk.score;
    flags.push(...accountRisk.flags);
    recommendations.push(...accountRisk.recommendations);
    totalRiskScore += accountRisk.score;

    // Calculate final risk score - use MAXIMUM risk for critical blocking conditions
    // If any category has a critical score (>=90), use that score directly
    const maxCategoryRisk = Math.max(
      details.deviceRisk,
      details.ipRisk,
      details.networkRisk,
      details.behavioralRisk,
      details.accountRisk
    );

    const finalRiskScore = maxCategoryRisk >= 90
      ? maxCategoryRisk  // Use maximum for critical conditions (device reuse, etc.)
      : Math.min(100, Math.round(totalRiskScore / 5)); // Use average for normal risk assessment

    // Debug logging for risk score calculation
    logger.debug('Risk score calculation debug', {
      deviceRisk: details.deviceRisk,
      ipRisk: details.ipRisk,
      networkRisk: details.networkRisk,
      behavioralRisk: details.behavioralRisk,
      accountRisk: details.accountRisk,
      maxCategoryRisk,
      totalRiskScore,
      averageScore: Math.round(totalRiskScore / 5),
      finalRiskScore,
      usedMaximum: maxCategoryRisk >= 90,
    });

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (finalRiskScore >= this.RISK_THRESHOLDS.CRITICAL) riskLevel = 'CRITICAL';
    else if (finalRiskScore >= this.RISK_THRESHOLDS.HIGH) riskLevel = 'HIGH';
    else if (finalRiskScore >= this.RISK_THRESHOLDS.MEDIUM) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    // Determine actions
    const shouldBlock = finalRiskScore >= this.RISK_THRESHOLDS.CRITICAL;
    const shouldFlag = finalRiskScore >= this.RISK_THRESHOLDS.HIGH;
    const shouldRequireVerification = finalRiskScore >= this.RISK_THRESHOLDS.MEDIUM;

    return {
      riskScore: finalRiskScore,
      riskLevel,
      flags: [...new Set(flags)], // Remove duplicates
      recommendations: [...new Set(recommendations)],
      shouldBlock,
      shouldFlag,
      shouldRequireVerification,
      deviceFingerprint: deviceFingerprint.fingerprint,
      ipAddress: req.ip || 'unknown',
      details,
    };
  }

  /**
   * Analyze device-based risk factors
   */
  private static async analyzeDeviceRisk(
    deviceFingerprint: any,
    _context: AccountCreationContext
  ): Promise<{ score: number; flags: string[]; recommendations: string[] }> {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    try {
      // STRICT: Check for ANY existing account on this device
      const existingDevice = await DeviceFingerprint.findOne({
        fingerprint: deviceFingerprint.fingerprint,
      });

      if (existingDevice && existingDevice.associatedUsers.length > 0) {
        // CRITICAL: Device already has an account - BLOCK immediately
        score = 100; // Maximum score to trigger immediate block
        flags.push(`DEVICE_ALREADY_REGISTERED`);
        flags.push(`EXISTING_USERS_${existingDevice.associatedUsers.length}`);
        recommendations.push('BLOCK: Device already has a registered account. Only one account per device is allowed.');

        logger.warn('Device reuse attempt blocked', {
          fingerprint: deviceFingerprint.fingerprint.substring(0, 8) + '...',
          existingUsers: existingDevice.associatedUsers.length,
          lastSeen: existingDevice.lastSeen,
        });

        return { score, flags, recommendations };
      }

      // ENHANCED: Check for highly similar devices (same IP + User Agent + Platform)
      // This catches cases where fingerprints differ slightly between auth flows
      const similarDevices = await DeviceFingerprint.find({
        $and: [
          { fingerprint: { $ne: deviceFingerprint.fingerprint } }, // Different fingerprint
          { 'network.ip': deviceFingerprint.network.ip }, // Same IP
          { 'userAgent.raw': deviceFingerprint.userAgent.raw }, // Same User Agent
          { 'browser.platform': deviceFingerprint.browser.platform }, // Same Platform
          { associatedUsers: { $exists: true, $not: { $size: 0 } } } // Has users
        ]
      }).limit(5);

      if (similarDevices.length > 0) {
        const totalExistingUsers = similarDevices.reduce((sum, device) => sum + device.associatedUsers.length, 0);

        // CRITICAL: Very similar device already has accounts - BLOCK
        score = 100; // Maximum score to trigger immediate block
        flags.push(`SIMILAR_DEVICE_WITH_ACCOUNTS`);
        flags.push(`SIMILAR_DEVICES_${similarDevices.length}`);
        flags.push(`TOTAL_EXISTING_USERS_${totalExistingUsers}`);
        recommendations.push('BLOCK: Highly similar device (same IP, User Agent, Platform) already has registered accounts. Possible fingerprint evasion.');

        logger.warn('Similar device with accounts detected - blocking', {
          newFingerprint: deviceFingerprint.fingerprint.substring(0, 8) + '...',
          similarDevices: similarDevices.length,
          totalExistingUsers,
          ip: deviceFingerprint.network.ip,
          userAgent: deviceFingerprint.userAgent.raw.substring(0, 50),
          platform: deviceFingerprint.browser.platform,
        });

        return { score, flags, recommendations };
      }

      // Additional device fingerprint similarity check (for spoofing detection)
      const spoofingDevices = await this.findSimilarDevices(deviceFingerprint);
      if (spoofingDevices.length > 0) {
        score += 80; // High risk for similar devices
        flags.push(`SIMILAR_DEVICE_DETECTED_${spoofingDevices.length}`);
        recommendations.push('Similar device fingerprint detected - possible device spoofing');
      }

      // Check device fingerprint risk factors
      score += deviceFingerprint.riskFactors.score * 0.8; // Weight device risk
      flags.push(...deviceFingerprint.riskFactors.factors);

      // Check for suspicious hardware characteristics
      if (!deviceFingerprint.hardware.touchSupport && deviceFingerprint.browser.platform.includes('Mobile')) {
        score += 15;
        flags.push('HARDWARE_INCONSISTENCY');
        recommendations.push('Hardware/platform inconsistency detected');
      }

      // Check for automation indicators
      if (deviceFingerprint.behavioral.mouseMovements?.length === 0) {
        score += 20;
        flags.push('NO_MOUSE_MOVEMENT');
        recommendations.push('No mouse movement detected - possible automation');
      }

    } catch (error) {
      logger.error('Error in device risk analysis:', error);
      score += 10; // Add moderate risk for analysis failure
      flags.push('DEVICE_ANALYSIS_ERROR');
    }

    return { score: Math.min(100, score), flags, recommendations };
  }

  /**
   * Analyze IP-based risk factors
   */
  private static async analyzeIPRisk(
    req: Request,
    _context: AccountCreationContext
  ): Promise<{ score: number; flags: string[]; recommendations: string[] }> {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    try {
      const ip = req.ip || 'unknown';

      // Check for IP reuse across multiple accounts
      const ipRecord = await IPTracking.findOne({ ip });
      if (ipRecord) {
        if (ipRecord.associatedUsers.length > this.FRAUD_PATTERNS.IP_REUSE.maxUsers) {
          score += this.FRAUD_PATTERNS.IP_REUSE.riskScore;
          flags.push(`IP_REUSE_${ipRecord.associatedUsers.length}_ACCOUNTS`);
          recommendations.push('IP address used by many accounts - monitor closely');
        }

        // Add threat intelligence score
        score += ipRecord.threatIntel.threatScore * 0.6;

        if (ipRecord.threatIntel.isVPN) {
          flags.push('VPN_DETECTED');
          recommendations.push('VPN usage detected - require additional verification');
        }

        if (ipRecord.threatIntel.isProxy) {
          flags.push('PROXY_DETECTED');
          recommendations.push('Proxy usage detected - high risk');
        }

        if (ipRecord.threatIntel.isMalicious) {
          score += 40;
          flags.push('MALICIOUS_IP');
          recommendations.push('IP flagged as malicious - block immediately');
        }

        // Check for rapid account creation from same IP
        const recentAccounts = await User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - this.FRAUD_PATTERNS.RAPID_ACCOUNT_CREATION.timeWindow) },
          // Note: You might need to add IP tracking to User model or use a different approach
        });

        if (recentAccounts > this.FRAUD_PATTERNS.RAPID_ACCOUNT_CREATION.maxAccounts) {
          score += this.FRAUD_PATTERNS.RAPID_ACCOUNT_CREATION.riskScore;
          flags.push(`RAPID_CREATION_${recentAccounts}_ACCOUNTS`);
          recommendations.push('Multiple accounts created rapidly from this IP');
        }
      }

    } catch (error) {
      logger.error('Error in IP risk analysis:', error);
      score += 10;
      flags.push('IP_ANALYSIS_ERROR');
    }

    return { score: Math.min(100, score), flags, recommendations };
  }

  /**
   * Analyze network-based risk factors
   */
  private static async analyzeNetworkRisk(
    deviceFingerprint: any
  ): Promise<{ score: number; flags: string[]; recommendations: string[] }> {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    try {
      const { network } = deviceFingerprint;

      // VPN/Proxy detection
      if (network.vpnDetection.isVPN) {
        score += 25;
        flags.push('VPN_USAGE');
        recommendations.push('VPN detected - require identity verification');
      }

      if (network.vpnDetection.isProxy) {
        score += 30;
        flags.push('PROXY_USAGE');
        recommendations.push('Proxy detected - high fraud risk');
      }

      if (network.vpnDetection.isTor) {
        score += 50;
        flags.push('TOR_USAGE');
        recommendations.push('Tor network detected - block or require extensive verification');
      }

      if (network.vpnDetection.isHosting) {
        score += 20;
        flags.push('HOSTING_IP');
        recommendations.push('Hosting provider IP - possible automation');
      }

      // Geographic risk assessment
      if (network.geolocation?.country) {
        const highRiskCountries = ['CN', 'RU', 'IR', 'KP', 'SY'];
        if (highRiskCountries.includes(network.geolocation.country)) {
          score += 15;
          flags.push(`HIGH_RISK_COUNTRY_${network.geolocation.country}`);
          recommendations.push('Registration from high-risk country');
        }
      }

    } catch (error) {
      logger.error('Error in network risk analysis:', error);
      score += 10;
      flags.push('NETWORK_ANALYSIS_ERROR');
    }

    return { score: Math.min(100, score), flags, recommendations };
  }

  /**
   * Analyze behavioral risk factors
   */
  private static async analyzeBehavioralRisk(
    deviceFingerprint: any,
    req: Request
  ): Promise<{ score: number; flags: string[]; recommendations: string[] }> {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    try {
      const { userAgent, browser, behavioral } = deviceFingerprint;

      // Check for bot-like user agents
      const botPatterns = [
        /bot/i, /crawler/i, /spider/i, /scraper/i, /headless/i,
        /phantom/i, /selenium/i, /puppeteer/i, /playwright/i
      ];

      if (botPatterns.some(pattern => pattern.test(userAgent.raw))) {
        score += 40;
        flags.push('BOT_USER_AGENT');
        recommendations.push('Bot-like user agent detected');
      }

      // Check for missing common headers
      const requiredHeaders = ['accept', 'accept-language', 'accept-encoding'];
      const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);

      if (missingHeaders.length > 0) {
        score += missingHeaders.length * 10;
        flags.push(`MISSING_HEADERS_${missingHeaders.join('_')}`);
        recommendations.push('Missing standard browser headers');
      }

      // Check for suspicious browser characteristics
      if (!browser.cookieEnabled) {
        score += 15;
        flags.push('COOKIES_DISABLED');
        recommendations.push('Cookies disabled - unusual for normal users');
      }

      // Check for automation indicators
      if (behavioral.mouseMovements && behavioral.mouseMovements.length === 0) {
        score += 25;
        flags.push('NO_MOUSE_INTERACTION');
        recommendations.push('No mouse interaction detected');
      }

      // Check for rapid form submission (if timing data available)
      if (behavioral.typingSpeed && behavioral.typingSpeed > 200) {
        score += 20;
        flags.push('RAPID_TYPING');
        recommendations.push('Unusually fast typing speed detected');
      }

    } catch (error) {
      logger.error('Error in behavioral risk analysis:', error);
      score += 10;
      flags.push('BEHAVIORAL_ANALYSIS_ERROR');
    }

    return { score: Math.min(100, score), flags, recommendations };
  }

  /**
   * Analyze account-specific risk factors
   */
  private static async analyzeAccountRisk(
    context: AccountCreationContext
  ): Promise<{ score: number; flags: string[]; recommendations: string[] }> {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for suspicious email patterns
      if (!context.email || typeof context.email !== 'string' || context.email.trim() === '') {
        // Skip email-based fraud checks if email is not available (e.g., during OAuth flows)
        logger.debug('Skipping account risk analysis - no email provided', {
          hasEmail: !!context.email,
          emailType: typeof context.email,
          emailValue: context.email
        });
        return { score, flags, recommendations };
      }
      const email = context.email.toLowerCase();

      // Temporary email services
      const tempEmailDomains = [
        '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
        'tempmail.org', 'yopmail.com', 'throwaway.email'
      ];

      const emailDomain = email.split('@')[1];
      if (tempEmailDomains.includes(emailDomain)) {
        score += 30;
        flags.push('TEMP_EMAIL_DOMAIN');
        recommendations.push('Temporary email service detected');
      }

      // Check for suspicious email patterns
      if (/\d{6,}/.test(email)) {
        score += 15;
        flags.push('NUMERIC_EMAIL_PATTERN');
        recommendations.push('Email contains long numeric sequence');
      }

      // Check for referral abuse patterns
      if (context.referralCode) {
        const referralAnalysis = await this.analyzeReferralRisk(context.referralCode);
        score += referralAnalysis.score;
        flags.push(...referralAnalysis.flags);
        recommendations.push(...referralAnalysis.recommendations);
      }

      // Check for similar existing accounts
      const similarAccounts = await User.find({
        email: { $regex: email.split('@')[0].substring(0, 5), $options: 'i' }
      }).limit(10);

      if (similarAccounts.length > 3) {
        score += 20;
        flags.push(`SIMILAR_ACCOUNTS_${similarAccounts.length}`);
        recommendations.push('Multiple accounts with similar email patterns');
      }

    } catch (error) {
      logger.error('Error in account risk analysis:', error);
      score += 10;
      flags.push('ACCOUNT_ANALYSIS_ERROR');
    }

    return { score: Math.min(100, score), flags, recommendations };
  }

  /**
   * Analyze referral-specific risk factors
   */
  private static async analyzeReferralRisk(
    referralCode: string
  ): Promise<{ score: number; flags: string[]; recommendations: string[] }> {
    let score = 0;
    const flags: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for rapid referrals from same source
      const recentReferrals = await User.countDocuments({
        tempReferralCode: referralCode,
        createdAt: { $gte: new Date(Date.now() - this.FRAUD_PATTERNS.REFERRAL_ABUSE.timeWindow) }
      });

      if (recentReferrals > this.FRAUD_PATTERNS.REFERRAL_ABUSE.maxReferrals) {
        score += this.FRAUD_PATTERNS.REFERRAL_ABUSE.riskScore;
        flags.push(`REFERRAL_ABUSE_${recentReferrals}_RECENT`);
        recommendations.push('Excessive referrals from same code in short time');
      }

      // Additional referral pattern analysis could be added here
      // e.g., checking if referred accounts show similar patterns

    } catch (error) {
      logger.error('Error in referral risk analysis:', error);
      score += 5;
      flags.push('REFERRAL_ANALYSIS_ERROR');
    }

    return { score: Math.min(100, score), flags, recommendations };
  }

  /**
   * Get fraud detection statistics for monitoring
   */
  static async getFraudStats(timeRange: number = 24 * 60 * 60 * 1000): Promise<any> {
    try {
      const since = new Date(Date.now() - timeRange);

      const [
        totalFingerprints,
        flaggedDevices,
        blockedIPs,
        highRiskIPs,
        recentAnalyses
      ] = await Promise.all([
        DeviceFingerprint.countDocuments({ createdAt: { $gte: since } }),
        DeviceFingerprint.countDocuments({ isFlagged: true, createdAt: { $gte: since } }),
        IPTracking.countDocuments({ isBlacklisted: true }),
        IPTracking.countDocuments({ riskLevel: { $in: ['HIGH', 'CRITICAL'] } }),
        DeviceFingerprint.find({ createdAt: { $gte: since } })
          .sort({ createdAt: -1 })
          .limit(100)
          .select('fingerprint riskFactors network.ip createdAt')
      ]);

      return {
        timeRange: timeRange / (60 * 60 * 1000), // Convert to hours
        totalFingerprints,
        flaggedDevices,
        blockedIPs,
        highRiskIPs,
        flaggedRate: totalFingerprints > 0 ? (flaggedDevices / totalFingerprints * 100).toFixed(2) : 0,
        recentAnalyses: recentAnalyses.map(fp => ({
          fingerprint: fp.fingerprint.substring(0, 8) + '...',
          riskScore: fp.riskFactors.score,
          severity: fp.riskFactors.severity,
          ip: fp.network.ip,
          timestamp: fp.firstSeen
        }))
      };
    } catch (error) {
      logger.error('Error getting fraud stats:', error);
      throw error;
    }
  }

  /**
   * Link user to device fingerprint after successful registration
   * This should be called AFTER user is created and saved
   */
  static async linkUserToDevice(
    deviceFingerprint: string,
    userId: string,
    email: string
  ): Promise<void> {
    try {
      // Update device fingerprint with user association
      const deviceRecord = await DeviceFingerprint.findOneAndUpdate(
        { fingerprint: deviceFingerprint },
        {
          $addToSet: { associatedUsers: new mongoose.Types.ObjectId(userId) },
          $set: { lastSeen: new Date() },
          $inc: { seenCount: 1 },
        },
        { new: true }
      );

      if (deviceRecord) {
        logger.info('User linked to device fingerprint', {
          userId,
          email,
          fingerprint: deviceFingerprint.substring(0, 8) + '...',
          totalUsers: deviceRecord.associatedUsers.length,
        });

        // If this device now has multiple users, flag it for review
        if (deviceRecord.associatedUsers.length > 1) {
          await DeviceFingerprint.updateOne(
            { fingerprint: deviceFingerprint },
            {
              $set: {
                isFlagged: true,
                flagReason: `Multiple users detected: ${deviceRecord.associatedUsers.length} accounts`,
                flaggedAt: new Date(),
              },
            }
          );

          logger.warn('Device flagged for multiple users', {
            fingerprint: deviceFingerprint.substring(0, 8) + '...',
            userCount: deviceRecord.associatedUsers.length,
            userId,
            email,
          });
        }
      }

      // Update IP tracking with user association
      const ipRecord = await IPTracking.findOne({
        associatedDevices: deviceFingerprint,
      });

      if (ipRecord) {
        await IPTracking.updateOne(
          { _id: ipRecord._id },
          {
            $addToSet: { associatedUsers: new mongoose.Types.ObjectId(userId) },
            $inc: { 'usage.uniqueUsers': 1 },
            $set: { 'usage.lastSeen': new Date() },
          }
        );

        logger.info('User linked to IP tracking', {
          userId,
          email,
          ip: ipRecord.ip,
          totalUsers: ipRecord.associatedUsers.length + 1,
        });
      }
    } catch (error) {
      logger.error('Error linking user to device:', error);
      throw error;
    }
  }

  /**
   * Log blocked registration attempts for monitoring and admin review
   */
  private static async logBlockedAttempt(
    deviceFingerprint: any,
    req: Request,
    context: AccountCreationContext,
    analysis: FraudDetectionResult
  ): Promise<void> {
    try {
      logger.warn('Registration attempt blocked by fraud detection', {
        email: context.email,
        ip: req.ip,
        fingerprint: deviceFingerprint.fingerprint.substring(0, 8) + '...',
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        flags: analysis.flags,
        reason: analysis.recommendations[0] || 'High risk detected',
        userAgent: req.headers['user-agent']?.substring(0, 100),
        timestamp: new Date().toISOString(),
      });

      // Store blocked attempts in database for admin review
      const registrationMethod = req.url?.includes('google') ? 'google' :
                                req.url?.includes('facebook') ? 'facebook' :
                                req.url?.includes('linkedin') ? 'linkedin' : 'email';

      // Find existing device and IP records for reference
      const existingDevice = await DeviceFingerprint.findOne({
        fingerprint: deviceFingerprint.fingerprint,
      });

      const existingIP = await IPTracking.findOne({
        ip: req.ip || 'unknown',
      });

      const fraudAttempt = new FraudAttempt({
        type: 'REGISTRATION_BLOCKED',
        reason: analysis.recommendations.join('; '),
        riskScore: analysis.riskScore,
        flags: analysis.flags,

        // Device information
        deviceFingerprint: deviceFingerprint.fingerprint,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',

        // User attempt information
        attemptedEmail: context.email,
        attemptedUsername: context.registrationData?.username,
        attemptedFullName: context.registrationData?.fullName,
        registrationMethod: registrationMethod as any,

        // Existing device/IP information
        existingUsers: existingDevice?.associatedUsers.length || 0,
        existingDeviceId: existingDevice?._id,
        existingIPId: existingIP?._id,

        // Geographic and network info
        country: deviceFingerprint.network.geolocation?.country,
        city: deviceFingerprint.network.geolocation?.city,
        isVPN: deviceFingerprint.network.vpnDetection.isVPN,
        isProxy: deviceFingerprint.network.vpnDetection.isProxy,

        // Metadata
        timestamp: new Date(),
        referralCode: context.referralCode,
        status: 'PENDING'
      });

      await fraudAttempt.save();

      logger.info('Fraud attempt stored for admin review', {
        attemptId: fraudAttempt._id,
        email: context.email,
        fingerprint: deviceFingerprint.fingerprint.substring(0, 8) + '...',
        riskScore: analysis.riskScore,
        existingUsers: existingDevice?.associatedUsers.length || 0
      });

    } catch (error) {
      logger.error('Error logging blocked attempt:', error);
      // Don't throw error here as it's just logging
    }
  }

  /**
   * Check if device should be blocked BEFORE registration
   */
  static async checkDeviceEligibility(deviceFingerprint: string): Promise<{
    isEligible: boolean;
    reason?: string;
    riskScore: number;
    existingUsers: number;
  }> {
    try {
      const existingDevice = await DeviceFingerprint.findOne({
        fingerprint: deviceFingerprint,
      });

      if (!existingDevice) {
        return {
          isEligible: true,
          riskScore: 0,
          existingUsers: 0,
        };
      }

      const existingUsers = existingDevice.associatedUsers.length;

      if (existingUsers > 0) {
        return {
          isEligible: false,
          reason: `Device already has ${existingUsers} registered account(s). Only one account per device is allowed.`,
          riskScore: 100,
          existingUsers,
        };
      }

      if (existingDevice.isBlocked) {
        return {
          isEligible: false,
          reason: existingDevice.blockedReason || 'Device is permanently blocked',
          riskScore: 100,
          existingUsers,
        };
      }

      return {
        isEligible: true,
        riskScore: existingDevice.riskFactors.score,
        existingUsers,
      };
    } catch (error) {
      logger.error('Error checking device eligibility:', error);
      return {
        isEligible: false,
        reason: 'Error checking device eligibility',
        riskScore: 50,
        existingUsers: 0,
      };
    }
  }

  /**
   * Find devices with similar fingerprints (possible spoofing attempts)
   */
  private static async findSimilarDevices(deviceFingerprint: any): Promise<any[]> {
    try {
      // Check for devices with similar advanced fingerprint components
      const similarDevices = await DeviceFingerprint.find({
        $and: [
          { fingerprint: { $ne: deviceFingerprint.fingerprint } }, // Exclude exact match
          {
            $or: [
              // Similar basic components but different advanced (possible spoofing)
              {
                'components.basic': deviceFingerprint.components.basic,
                'components.advanced': { $ne: deviceFingerprint.components.advanced }
              },
              // Same user agent and IP but different fingerprint
              {
                'userAgent.raw': deviceFingerprint.userAgent.raw,
                'network.ip': deviceFingerprint.network.ip,
                fingerprint: { $ne: deviceFingerprint.fingerprint }
              },
              // Same screen resolution and platform but different fingerprint
              {
                'screen.resolution': deviceFingerprint.screen.resolution,
                'browser.platform': deviceFingerprint.browser.platform,
                fingerprint: { $ne: deviceFingerprint.fingerprint }
              }
            ]
          }
        ]
      }).limit(10);

      return similarDevices;
    } catch (error) {
      logger.error('Error finding similar devices:', error);
      return [];
    }
  }
}
