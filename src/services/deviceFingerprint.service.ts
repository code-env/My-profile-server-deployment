import { Request } from 'express';
import crypto from 'crypto';
import geoip from 'geoip-lite';
import { logger } from '../utils/logger';

export class DeviceFingerprintService {
  static generateFingerprint(req: Request): string {
    const components = [
      req.ip,
      req.headers['user-agent'],
      req.headers['accept-language'],
      req.headers['sec-ch-ua'],
      req.headers['sec-ch-ua-platform']
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  static async analyzeDevice(req: Request) {
    const fingerprint = this.generateFingerprint(req);
    const ip = req.ip as any
    const geo = geoip.lookup(ip);
    
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

    logger.info(`Device analysis completed for fingerprint: ${fingerprint}`);
    return deviceInfo;
  }

  private static async calculateRiskScore(req: Request, geo: any) {
    let score = 0;
    const ip = req.ip as any

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

  private static async isVPNorProxy(ip: string): Promise<boolean> {
    // Implement VPN/proxy detection logic
    return false;
  }

  private static isHighRiskCountry(country: string): boolean {
    const highRiskCountries = ['XX', 'YY']; // Add high-risk country codes
    return highRiskCountries.includes(country);
  }

  private static isBotLike(req: Request): boolean {
    const userAgent = req.headers['user-agent'] || '';
    return userAgent.toLowerCase().includes('bot') ||
           userAgent.toLowerCase().includes('crawler') ||
           !req.headers['accept-language'];
  }
}
