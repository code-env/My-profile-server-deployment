import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { v4 as uuid } from 'uuid';
import * as maxmind from 'maxmind';
import { DetailedRequestInfo, GeoLocation } from '../utils/requestInfo';

export interface IRequestMetadata {
  ip: string;
  userId?: string;
  sessionId?: string;
  route?: string;
  statusCode?: number;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    ll?: [number, number];
  };
}
import { addToTrackingCache } from '../controllers/logs.controller';
import { logger } from '../utils/logger';
import { securityMonitoringService } from '../services/securityMonitoring.service';

let asnReader: maxmind.Reader<any>;

// Initialize MaxMind ASN database
(async () => {
  try {
    asnReader = await maxmind.open('./GeoLite2-ASN.mmdb');
  } catch (error) {
    logger.warn('Failed to load ASN database:', error);
  }
})();

const parser = new UAParser();

export const advancedTrackingMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Basic request info
  const ip = req.ip || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';

  // Parse user agent
  const ua = parser.setUA(userAgent).getResult();

  // Get geo info
  const geoData = geoip.lookup(ip);
  const geo: GeoLocation = {
    country: geoData?.country || '',
    region: geoData?.region || '',
    city: geoData?.city || '',
    ll: geoData?.ll || [0, 0],
    range: geoData?.range || [0, 0]
  };

  // Network info
  let networkInfo: any = {
    hostName: req.hostname
  };

  try {
    if (asnReader) {
      const asnData = asnReader.get(ip);
      if (asnData) {
        networkInfo = {
          ...networkInfo,
          asn: asnData.autonomous_system_number,
          organization: asnData.autonomous_system_organization,
          networkType: asnData.type
        };
      }
    }
  } catch (error) {
    logger.warn('Error getting ASN data:', error);
  }

  // Security checks
  const securityChecks = {
    threatScore: 0,
    isProxy: false,
    isTor: false,
    isVPN: false,
    suspiciousHeaders: [] as string[],
    responseCode: res.statusCode
  };

  // Check for proxy indicators
  const proxyHeaders = [
    'via',
    'x-forwarded-for',
    'forwarded',
    'client-ip',
    'x-real-ip',
    'proxy-connection'
  ];

  proxyHeaders.forEach(header => {
    if (req.headers[header]) {
      securityChecks.isProxy = true;
      securityChecks.threatScore += 10;
      securityChecks.suspiciousHeaders.push(header);
    }
  });

  // Check for VPN/Tor based on ASN and geo data
  if (networkInfo.organization) {
    const vpnKeywords = ['vpn', 'virtual', 'proxy', 'tor', 'exit', 'relay', 'cloud'];
    if (vpnKeywords.some(keyword =>
      networkInfo.organization.toLowerCase().includes(keyword)
    )) {
      securityChecks.isVPN = true;
      securityChecks.threatScore += 20;
    }
  }

  // Add threat score for various factors
  if (geo.country !== req.headers['cf-ipcountry']) {
    securityChecks.threatScore += 15;
  }

  if (req.headers['dnt'] === '1') {
    securityChecks.threatScore += 5;
  }

  // Device fingerprinting
  const fingerprint = {
    id: uuid(),
    userAgent,
    acceptHeaders: {
      language: acceptLanguage,
      encoding: req.headers['accept-encoding'] || '',
      mimeTypes: req.headers['accept'] || ''
    },
    screen: {
      colorDepth: req.headers['sec-ch-color-depth'] || '',
      width: req.headers['sec-ch-width'] || '',
      height: req.headers['sec-ch-height'] || ''
    },
    timezone: req.headers['sec-ch-timezone'] || '',
    platform: req.headers['sec-ch-platform'] || ''
  };

  // Convert headers to Record<string, string>
  const headers: Record<string, string> = {};
  Object.entries(req.headers).forEach(([key, value]) => {
    headers[key] = Array.isArray(value) ? value.join(', ') : (value || '');
  });

  // Convert cookies to Record<string, string>
  const cookies: Record<string, string> = {};
  Object.entries(req.cookies || {}).forEach(([key, value]) => {
    cookies[key] = typeof value === 'string' ? value : JSON.stringify(value);
  });

  // Construct detailed request info
  const requestInfo: DetailedRequestInfo = {
    timestamp: startTime,
    fingerprint: fingerprint.id,
    method: req.method,
    url: req.originalUrl,
    protocol: req.protocol,
    ip,
    ipVersion: ip.includes(':') ? 'IPv6' : 'IPv4',
    geo,
    network: networkInfo,
    browser: {
      name: ua.browser.name || 'Unknown',
      version: ua.browser.version || 'Unknown'
    },
    os: {
      name: ua.os.name || 'Unknown',
      version: ua.os.version || 'Unknown'
    },
    device: {
      type: ua.device.type || 'desktop',
      brand: ua.device.vendor,
      model: ua.device.model
    },
    language: acceptLanguage,
    headers,
    cookies,
    sessionID: req.sessionID,
    security: securityChecks
  };

  // Capture response info
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, callback?: any) {
    const responseTime = Date.now() - startTime;
    requestInfo.responseTime = responseTime;
    requestInfo.security.responseCode = res.statusCode;

    // Add to tracking cache
    addToTrackingCache(requestInfo);
     const user: any = req.user;
    // Send to security monitoring
    const metadata: IRequestMetadata = {
      ip: requestInfo.ip,
      userId: user?._id?.toString(),
      sessionId: requestInfo.sessionID,
      route: req.route?.path,
      statusCode: res.statusCode,
      geolocation: {
        ...requestInfo.geo,
        ll: requestInfo.geo.ll?.length >= 2 ? [requestInfo.geo.ll[0], requestInfo.geo.ll[1]] as [number, number] : undefined
      }
    };

    securityMonitoringService.analyzeRequest(metadata).catch(error => {
      logger.error('Error in security monitoring:', error);
    });

    // Broadcast to WebSocket clients if needed
    if (req.app.locals.wss) {
      req.app.locals.wss.clients.forEach((client: any) => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify(requestInfo));
        }
      });
    }

    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
};
