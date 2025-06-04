import { Request } from 'express';
import crypto from 'crypto';
import geoip from 'geoip-lite';
import * as UAParser from 'ua-parser-js';
import axios from 'axios';
import { logger } from '../utils/logger';

// Real-world VPN/Proxy detection services
interface VPNDetectionResult {
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  riskScore: number;
  provider?: string;
}

interface DeviceFingerprint {
  fingerprint: string;
  components: {
    basic: string;
    advanced: string;
    canvas?: string;
    webgl?: string;
    audio?: string;
  };
  userAgent: {
    raw: string;
    parsed: UAParser.IResult;
  };
  network: {
    ip: string;
    realIP?: string;
    vpnDetection: VPNDetectionResult;
    geolocation: any;
    timezone?: string;
    connectionType?: string;
  };
  browser: {
    language: string;
    languages: string[];
    platform: string;
    cookieEnabled: boolean;
    doNotTrack: boolean;
    plugins: string[];
    mimeTypes: string[];
  };
  screen: {
    resolution?: string;
    colorDepth?: number;
    pixelRatio?: number;
  };
  hardware: {
    cores?: number;
    memory?: number;
    touchSupport: boolean;
  };
  behavioral: {
    mouseMovements?: number[];
    keyboardPattern?: string;
    scrollBehavior?: string;
  };
  riskFactors: {
    score: number;
    factors: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  timestamp: Date;
  sessionId?: string;
}

export class DeviceFingerprintService {
  private static readonly VPN_API_KEYS = {
    // Free tier APIs for VPN detection
    IPAPI: process.env.IPAPI_KEY,
    VPNAPI: process.env.VPNAPI_KEY,
    PROXYCHECK: process.env.PROXYCHECK_KEY,
  };

  private static readonly HIGH_RISK_COUNTRIES = [
    'CN', 'RU', 'IR', 'KP', 'SY', 'AF', 'IQ', 'LY', 'SO', 'SD',
    'YE', 'MM', 'BY', 'CU', 'VE', 'ZW'
  ];

  private static readonly BOT_PATTERNS = [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /headless/i,
    /phantom/i, /selenium/i, /puppeteer/i, /playwright/i,
    /curl/i, /wget/i, /python/i, /java/i, /go-http/i
  ];

  /**
   * Generate comprehensive device fingerprint
   */
  static async generateFingerprint(req: Request, additionalData?: any): Promise<DeviceFingerprint> {
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser.UAParser(userAgent);
    const parsedUA = parser.getResult();
    const ip = this.extractRealIP(req);

    // Helper function to safely get header value as string
    const getHeaderString = (headerValue: string | string[] | undefined): string => {
      if (!headerValue) return '';
      return Array.isArray(headerValue) ? headerValue[0] || '' : headerValue;
    };

    // Basic fingerprint components - ULTRA STABLE across ALL authentication flows
    // Only include headers that are guaranteed to be consistent
    const basicComponents = [
      ip,
      userAgent,
      // Use only the primary language (before comma) to avoid header variations
      getHeaderString(req.headers['accept-language']).split(',')[0].trim(),
      // Use only core encoding types that are always present
      getHeaderString(req.headers['accept-encoding']).includes('gzip') ? 'gzip' : 'none',
      // Simplified platform detection - only use the core platform info
      getHeaderString(req.headers['sec-ch-ua-platform']).replace(/"/g, '') || parsedUA.os.name || '',
      getHeaderString(req.headers['sec-ch-ua-mobile']) || '?0',
    ];

    // Debug logging to identify header differences
    logger.debug('Fingerprint components debug', {
      ip,
      userAgent: userAgent.substring(0, 50),
      primaryLanguage: getHeaderString(req.headers['accept-language']).split(',')[0].trim(),
      hasGzip: getHeaderString(req.headers['accept-encoding']).includes('gzip'),
      platform: getHeaderString(req.headers['sec-ch-ua-platform']).replace(/"/g, '') || parsedUA.os.name || '',
      mobile: getHeaderString(req.headers['sec-ch-ua-mobile']) || '?0',
      basicComponentsJoined: basicComponents.join('|').substring(0, 100) + '...',
      fullAcceptLanguage: getHeaderString(req.headers['accept-language']) || 'MISSING',
      fullAcceptEncoding: getHeaderString(req.headers['accept-encoding']) || 'MISSING',
    });

    // Advanced fingerprint components - EXCLUDE flow-specific headers
    const advancedComponents = [
      ...basicComponents,
      getHeaderString(req.headers['upgrade-insecure-requests']) || '',
      getHeaderString(req.headers['connection']) || '',
      getHeaderString(req.headers['host']) || '',
      // REMOVED: sec-fetch-* headers (vary by auth flow)
      // REMOVED: cache-control, pragma (vary by auth flow)
      // REMOVED: origin, referer (vary by auth flow)
      // REMOVED: header keys list (varies by auth flow)

      // Add stable browser characteristics instead
      getHeaderString(req.headers['sec-ch-ua-arch']) || '',
      getHeaderString(req.headers['sec-ch-ua-bitness']) || '',
      getHeaderString(req.headers['sec-ch-ua-model']) || '',
      getHeaderString(req.headers['dnt']) || '',
    ];

    const basicFingerprint = crypto
      .createHash('sha256')
      .update(basicComponents.join('|'))
      .digest('hex');

    const advancedFingerprint = crypto
      .createHash('sha256')
      .update(advancedComponents.join('|'))
      .digest('hex');

    // Get geolocation and VPN detection
    const geo = geoip.lookup(ip);
    const vpnDetection = await this.detectVPNProxy(ip);

    // Parse browser information
    const languages = this.parseAcceptLanguage(req.headers['accept-language'] || '');

    const fingerprint: DeviceFingerprint = {
      fingerprint: basicFingerprint,
      components: {
        basic: basicFingerprint,
        advanced: advancedFingerprint,
        canvas: additionalData?.canvas,
        webgl: additionalData?.webgl,
        audio: additionalData?.audio,
      },
      userAgent: {
        raw: userAgent,
        parsed: parsedUA,
      },
      network: {
        ip,
        realIP: this.extractRealIP(req),
        vpnDetection,
        geolocation: geo,
        timezone: req.headers['x-timezone'] as string,
        connectionType: req.headers['connection-type'] as string,
      },
      browser: {
        language: getHeaderString(req.headers['accept-language']).split(',')[0] || '',
        languages,
        platform: getHeaderString(req.headers['sec-ch-ua-platform']).replace(/"/g, '') || '',
        cookieEnabled: req.headers['cookie'] ? true : false,
        doNotTrack: getHeaderString(req.headers['dnt']) === '1',
        plugins: additionalData?.plugins || [],
        mimeTypes: additionalData?.mimeTypes || [],
      },
      screen: {
        resolution: additionalData?.screenResolution,
        colorDepth: additionalData?.colorDepth,
        pixelRatio: additionalData?.pixelRatio,
      },
      hardware: {
        cores: additionalData?.hardwareConcurrency,
        memory: additionalData?.deviceMemory,
        touchSupport: getHeaderString(req.headers['sec-ch-ua-mobile']) === '?1',
      },
      behavioral: {
        mouseMovements: additionalData?.mouseMovements,
        keyboardPattern: additionalData?.keyboardPattern,
        scrollBehavior: additionalData?.scrollBehavior,
      },
      riskFactors: await this.calculateRiskScore(req, geo, vpnDetection, parsedUA),
      timestamp: new Date(),
      sessionId: additionalData?.sessionId,
    };

    logger.info(`Enhanced device fingerprint generated: ${basicFingerprint.substring(0, 8)}...`, {
      ip,
      userAgent: userAgent.substring(0, 50),
      riskScore: fingerprint.riskFactors.score,
      vpnDetected: vpnDetection.isVPN,
      cookieEnabled: fingerprint.browser.cookieEnabled,
      // Debug info for fingerprint consistency
      basicComponentsCount: basicComponents.length,
      advancedComponentsCount: advancedComponents.length,
    });

    return fingerprint;
  }

  /**
   * Extract real IP address from request (handles proxies, load balancers)
   */
  private static extractRealIP(req: Request): string {
    // Check various headers for real IP
    const possibleIPs = [
      req.headers['cf-connecting-ip'], // Cloudflare
      req.headers['x-real-ip'], // Nginx
      req.headers['x-forwarded-for'], // Standard proxy header
      req.headers['x-client-ip'], // Apache
      req.headers['x-forwarded'], // General
      req.headers['forwarded-for'], // RFC 7239
      req.headers['forwarded'], // RFC 7239
      req.socket?.remoteAddress,
      req.ip,
    ].filter(Boolean);

    for (const ipHeader of possibleIPs) {
      if (typeof ipHeader === 'string') {
        // Handle comma-separated IPs (x-forwarded-for can have multiple IPs)
        const ips = ipHeader.split(',').map(ip => ip.trim());
        for (const ip of ips) {
          if (this.isValidIP(ip) && !this.isPrivateIP(ip)) {
            return ip;
          }
        }
      }
    }

    // Fallback to request IP
    return req.ip || 'unknown';
  }

  /**
   * Validate IP address format
   */
  private static isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is private/internal
   */
  private static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^127\./, // 127.0.0.0/8 (localhost)
      /^169\.254\./, // 169.254.0.0/16 (link-local)
      /^::1$/, // IPv6 localhost
      /^fc00:/, // IPv6 unique local
      /^fe80:/, // IPv6 link-local
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Parse Accept-Language header
   */
  private static parseAcceptLanguage(acceptLanguage: string): string[] {
    if (!acceptLanguage) return [];

    return acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim())
      .filter(Boolean);
  }

  /**
   * Comprehensive VPN/Proxy detection using multiple services
   */
  private static async detectVPNProxy(ip: string): Promise<VPNDetectionResult> {
    const result: VPNDetectionResult = {
      isVPN: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      riskScore: 0,
    };

    try {
      // Method 1: Check against known VPN/Proxy IP ranges (free)
      const basicCheck = await this.basicVPNCheck(ip);
      Object.assign(result, basicCheck);

      // Method 2: Use external API services (if API keys available)
      if (this.VPN_API_KEYS.PROXYCHECK) {
        const proxyCheckResult = await this.proxyCheckAPI(ip);
        result.isVPN = result.isVPN || (proxyCheckResult.isVPN ?? false);
        result.isProxy = result.isProxy || (proxyCheckResult.isProxy ?? false);
        result.riskScore = Math.max(result.riskScore, proxyCheckResult.riskScore ?? 0);
      }

      if (this.VPN_API_KEYS.IPAPI) {
        const ipapiResult = await this.ipapiCheck(ip);
        result.isVPN = result.isVPN || (ipapiResult.isVPN ?? false);
        result.isProxy = result.isProxy || (ipapiResult.isProxy ?? false);
        result.riskScore = Math.max(result.riskScore, ipapiResult.riskScore ?? 0);
      }

      // Method 3: Hosting provider detection
      const hostingCheck = await this.detectHostingProvider(ip);
      result.isHosting = hostingCheck.isHosting;
      result.provider = hostingCheck.provider;

      // Calculate final risk score
      if (result.isVPN) result.riskScore += 30;
      if (result.isProxy) result.riskScore += 25;
      if (result.isTor) result.riskScore += 50;
      if (result.isHosting) result.riskScore += 15;

    } catch (error) {
      logger.error('Error in VPN/Proxy detection:', error);
      result.riskScore = 10; // Assign moderate risk if detection fails
    }

    return result;
  }

  /**
   * Basic VPN/Proxy detection using known patterns
   */
  private static async basicVPNCheck(ip: string): Promise<Partial<VPNDetectionResult>> {
    // Known VPN/Proxy indicators
    const vpnKeywords = ['vpn', 'proxy', 'tor', 'tunnel', 'anonymous'];

    try {
      // Reverse DNS lookup for VPN indicators
      const dns = require('dns').promises;
      const hostnames = await dns.reverse(ip).catch(() => []);

      const hasVPNKeyword = hostnames.some((hostname: string) =>
        vpnKeywords.some(keyword => hostname.toLowerCase().includes(keyword))
      );

      return {
        isVPN: hasVPNKeyword,
        isProxy: hasVPNKeyword,
        riskScore: hasVPNKeyword ? 20 : 0,
      };
    } catch (error) {
      return { isVPN: false, isProxy: false, riskScore: 0 };
    }
  }

  /**
   * ProxyCheck.io API integration
   */
  private static async proxyCheckAPI(ip: string): Promise<Partial<VPNDetectionResult>> {
    try {
      const response = await axios.get(
        `https://proxycheck.io/v2/${ip}?key=${this.VPN_API_KEYS.PROXYCHECK}&vpn=1&asn=1`,
        { timeout: 5000 }
      );

      const data = response.data[ip];
      return {
        isVPN: data?.proxy === 'yes' || data?.type === 'VPN',
        isProxy: data?.proxy === 'yes',
        riskScore: data?.risk || 0,
        provider: data?.provider,
      };
    } catch (error) {
      logger.warn('ProxyCheck API error:', error);
      return { isVPN: false, isProxy: false, riskScore: 0 };
    }
  }

  /**
   * IP-API.com integration
   */
  private static async ipapiCheck(ip: string): Promise<Partial<VPNDetectionResult>> {
    try {
      const response = await axios.get(
        `http://ip-api.com/json/${ip}?fields=proxy,hosting,mobile,query,isp`,
        { timeout: 5000 }
      );

      const data = response.data;
      return {
        isVPN: data.proxy || data.hosting,
        isProxy: data.proxy,
        isHosting: data.hosting,
        riskScore: (data.proxy ? 25 : 0) + (data.hosting ? 15 : 0),
        provider: data.isp,
      };
    } catch (error) {
      logger.warn('IP-API error:', error);
      return { isVPN: false, isProxy: false, riskScore: 0 };
    }
  }

  /**
   * Detect hosting providers (cloud services, VPS, etc.)
   */
  private static async detectHostingProvider(ip: string): Promise<{ isHosting: boolean; provider?: string }> {
    try {
      const geo = geoip.lookup(ip);
      if (!geo) return { isHosting: false };

      // Known hosting provider ASN ranges and patterns
      const hostingProviders = [
        'amazon', 'aws', 'google', 'microsoft', 'azure', 'digitalocean',
        'linode', 'vultr', 'ovh', 'hetzner', 'cloudflare', 'fastly',
        'akamai', 'rackspace', 'godaddy', 'namecheap', 'hostgator'
      ];

      const orgName = (geo as any).org?.toLowerCase() || '';
      const isHosting = hostingProviders.some(provider => orgName.includes(provider));

      return {
        isHosting,
        provider: isHosting ? (geo as any).org : undefined,
      };
    } catch (error) {
      return { isHosting: false };
    }
  }

  /**
   * Calculate comprehensive risk score
   */
  private static async calculateRiskScore(
    req: Request,
    geo: any,
    vpnDetection: VPNDetectionResult,
    parsedUA: UAParser.IResult
  ): Promise<{ score: number; factors: string[]; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> {
    let score = 0;
    const factors: string[] = [];

    // VPN/Proxy factors
    if (vpnDetection.isVPN) {
      score += 30;
      factors.push('VPN detected');
    }
    if (vpnDetection.isProxy) {
      score += 25;
      factors.push('Proxy detected');
    }
    if (vpnDetection.isTor) {
      score += 50;
      factors.push('Tor network detected');
    }
    if (vpnDetection.isHosting) {
      score += 15;
      factors.push('Hosting provider IP');
    }

    // Geographic factors
    if (geo && this.HIGH_RISK_COUNTRIES.includes(geo.country)) {
      score += 20;
      factors.push(`High-risk country: ${geo.country}`);
    }

    // Bot detection
    if (this.isBotLike(req)) {
      score += 30;
      factors.push('Bot-like behavior detected');
    }

    // Browser/Device factors
    if (!req.headers['accept-language']) {
      score += 10;
      factors.push('Missing language headers');
    }

    if (!req.headers['accept']) {
      score += 10;
      factors.push('Missing accept headers');
    }

    // Suspicious user agent patterns
    if (this.hasSuspiciousUserAgent(parsedUA)) {
      score += 20;
      factors.push('Suspicious user agent');
    }

    // Missing common headers
    if (!req.headers['sec-ch-ua'] && !req.headers['user-agent']?.includes('Mobile')) {
      score += 15;
      factors.push('Missing security headers');
    }

    // Determine severity
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (score >= 80) severity = 'CRITICAL';
    else if (score >= 50) severity = 'HIGH';
    else if (score >= 25) severity = 'MEDIUM';
    else severity = 'LOW';

    return { score, factors, severity };
  }

  /**
   * Check for bot-like behavior
   */
  private static isBotLike(req: Request): boolean {
    const userAgent = req.headers['user-agent'] || '';

    // Check against bot patterns
    if (this.BOT_PATTERNS.some(pattern => pattern.test(userAgent))) {
      return true;
    }

    // Check for missing headers that real browsers typically send
    const requiredHeaders = ['accept', 'accept-language', 'accept-encoding'];
    const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);

    return missingHeaders.length >= 2;
  }

  /**
   * Check for suspicious user agent patterns
   */
  private static hasSuspiciousUserAgent(parsedUA: UAParser.IResult): boolean {
    const { browser, os, device } = parsedUA;

    // Check for inconsistencies
    if (browser.name === 'Chrome' && os.name === 'Windows' && device.type === 'mobile') {
      return true; // Inconsistent combination
    }

    // Check for outdated browsers (potential automation)
    if (browser.name && browser.version) {
      const version = parseInt(browser.version.split('.')[0]);
      if (browser.name === 'Chrome' && version < 90) return true;
      if (browser.name === 'Firefox' && version < 85) return true;
      if (browser.name === 'Safari' && version < 14) return true;
    }

    return false;
  }

  /**
   * Legacy method for backward compatibility
   */
  static async analyzeDevice(req: Request, additionalData?: any) {
    const fingerprint = await this.generateFingerprint(req, additionalData);

    return {
      fingerprint: fingerprint.fingerprint,
      userAgent: fingerprint.userAgent.raw,
      ip: fingerprint.network.ip,
      location: fingerprint.network.geolocation,
      platform: fingerprint.browser.platform,
      browser: fingerprint.userAgent.parsed.browser.name,
      language: fingerprint.browser.language,
      timestamp: fingerprint.timestamp,
      riskScore: fingerprint.riskFactors.score,
      vpnDetected: fingerprint.network.vpnDetection.isVPN,
      enhanced: fingerprint, // Include full enhanced data
    };
  }
}
