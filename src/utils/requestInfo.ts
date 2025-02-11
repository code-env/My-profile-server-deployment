import { Request } from 'express';
import { Session } from 'express-session';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import { detect } from 'detect-browser';
import Bowser from 'bowser';
import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';

const dnsResolve = promisify(dns.resolve);

interface GeoIPData {
  range?: [number, number];
  country?: string;
  region?: string;
  eu?: string;
  timezone?: string;
  city?: string;
  ll?: [number, number];
  metro?: number;
  area?: number;
}

interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  ll?: [number, number];
  timezone?: string;
}

interface SecurityMetrics {
  isProxy: boolean;
  isTor: boolean;
  isVPN: boolean;
  threatScore: number;
  securityFlags: string[];
}

interface NetworkInfo {
  asn?: string;
  isp?: string;
  connectionType?: string;
  hostName?: string;
  autonomousSystem?: string;
}

interface BrowserCapabilities {
  cookies: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  webGL: boolean;
  webRTC: boolean;
  canvas: boolean;
  audio: boolean;
}

interface DeviceMetrics {
  screenResolution?: string;
  colorDepth?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  devicePixelRatio?: number;
  maxTouchPoints?: number;
}

export interface DetailedRequestInfo {
  // Basic Info
  timestamp: number;
  method: string;
  url: string;
  protocol: string;
  responseTime?: number;

  // IP and Network
  ip: string;
  ipVersion: string;
  realIP?: string;
  proxyIPs?: string[];
  network: NetworkInfo;

  // Geolocation
  geo: GeoLocation;

  // Device Info
  os: {
    name: string;
    version: string;
    platform: string;
  };
  device: {
    type?: string;
    brand?: string;
    model?: string;
    metrics: DeviceMetrics;
  };

  // Browser Info
  browser: {
    name: string;
    version: string;
    engine: string;
    capabilities: BrowserCapabilities;
  };

  // Security
  security: SecurityMetrics;

  // Headers and Fingerprint
  headers: Record<string, string>;
  fingerprint: string;

  // Session
  sessionID?: string;
  referrer?: string;
  language?: string;
}

async function checkTorExit(ip: string): Promise<boolean> {
  try {
    const torExits = await dnsResolve('exitlist.torproject.org', 'A');
    return torExits.includes(ip);
  } catch {
    return false;
  }
}

function calculateThreatScore(info: Partial<DetailedRequestInfo>): number {
  let score = 0;

  if (info.security?.isProxy) score += 20;
  if (info.security?.isTor) score += 30;
  if (info.security?.isVPN) score += 15;

  // Suspicious headers
  if (info.headers?.['x-forwarded-for']?.includes(',')) score += 10;
  if (!info.headers?.['accept-language']) score += 5;

  // Geolocation mismatch
  if (info.geo?.country && info.headers?.['accept-language']) {
    const langCountry = info.headers['accept-language'].split(',')[0].split('-')[1];
    if (langCountry && langCountry.toLowerCase() !== info.geo.country.toLowerCase()) {
      score += 15;
    }
  }

  return Math.min(score, 100);
}

function generateFingerprint(req: Request, deviceInfo: any): string {
  const components = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    deviceInfo.screenResolution,
    deviceInfo.colorDepth,
    deviceInfo.deviceMemory,
    deviceInfo.hardwareConcurrency,
    req.ip
  ];

  return crypto
    .createHash('sha256')
    .update(components.filter(Boolean).join('::'))
    .digest('hex');
}

export const getRequestInfo = async (req: Request & { session?: Session }): Promise<DetailedRequestInfo> => {
  // Parse user agent
  const uaParser = new UAParser(req.headers['user-agent']);
  const browser = detect(req.headers['user-agent']);
  const bowser = Bowser.parse(req.headers['user-agent'] || '');

  // Get IPs
  const ip = req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.headers['x-forwarded-for']?.toString().split(',')[0];

  const proxyIPs = req.headers['x-forwarded-for']?.toString().split(',').map(ip => ip.trim());

  // Get geo information
  const geo = geoip.lookup(ip || '') as GeoIPData || {};

  // Device metrics (some values may be undefined on server-side)
  const deviceMetrics: DeviceMetrics = {
    screenResolution: req.headers['sec-ch-viewport-width']
      ? `${req.headers['sec-ch-viewport-width']}x${req.headers['sec-ch-viewport-height']}`
      : undefined,
    colorDepth: parseInt(req.headers['sec-ch-color-depth'] as string) || undefined,
    deviceMemory: parseInt(req.headers['device-memory'] as string) || undefined,
    hardwareConcurrency: parseInt(req.headers['sec-ch-ua-platform-version'] as string) || undefined,
    devicePixelRatio: parseFloat(req.headers['sec-ch-dpr'] as string) || undefined,
    maxTouchPoints: parseInt(req.headers['sec-ch-ua-mobile'] as string) || undefined
  };

  // Generate security metrics
  const isTor = await checkTorExit(ip || '');
  const security: SecurityMetrics = {
    isProxy: Boolean(proxyIPs?.length),
    isTor,
    isVPN: false, // Would need external VPN detection service
    threatScore: 0,
    securityFlags: []
  };

  const requestInfo: DetailedRequestInfo = {
    // Basic Info
    timestamp: Date.now(),
    method: req.method,
    url: req.url,
    protocol: req.protocol,

    // IP and Network
    ip: ip || 'unknown',
    ipVersion: ip?.includes(':') ? 'IPv6' : 'IPv4',
    realIP: req.headers['x-real-ip']?.toString(),
    proxyIPs,
    network: {
      asn: req.headers['cf-ipcountry']?.toString(), // If using Cloudflare
      isp: undefined, // Would need external ISP detection service
      connectionType: req.headers['sec-ch-ua-mobile'] === '?1' ? 'mobile' : 'desktop',
      hostName: req.hostname,
    },

    // Geolocation
    geo: {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      ll: geo.ll,
      timezone: geo.timezone
    },

    // Device Info
    os: {
      name: uaParser.getOS().name || 'unknown',
      version: uaParser.getOS().version || 'unknown',
      platform: bowser.platform.type || 'unknown'
    },
    device: {
      type: uaParser.getDevice().type,
      brand: uaParser.getDevice().vendor,
      model: uaParser.getDevice().model,
      metrics: deviceMetrics
    },

    // Browser Info
    browser: {
      name: browser?.name || 'unknown',
      version: browser?.version || 'unknown',
      engine: uaParser.getEngine().name || 'unknown',
      capabilities: {
        cookies: 'cookie' in req.headers,
        localStorage: true, // Determined client-side
        sessionStorage: true, // Determined client-side
        webGL: true, // Determined client-side
        webRTC: true, // Determined client-side
        canvas: true, // Determined client-side
        audio: true // Determined client-side
      }
    },

    // Security metrics
    security,

    // Headers and Fingerprint
    headers: req.headers as Record<string, string>,
    fingerprint: generateFingerprint(req, deviceMetrics),

    // Session
    sessionID: req.session?.id,
    referrer: req.headers.referer,
    language: req.headers['accept-language']
  };

  // Calculate final threat score
  requestInfo.security.threatScore = calculateThreatScore(requestInfo);

  return requestInfo;
};
