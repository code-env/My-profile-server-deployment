export interface BrowserCapabilities {
  javascript: boolean;
  cookies: boolean;
  localStorage: boolean;
  webSockets: boolean;
}

export interface Browser {
  name: string;
  version: string;
  engine: string;
  capabilities: BrowserCapabilities;
}

export interface OSInfo {
  name: string;
  version: string;
  platform: string;
}

export interface DeviceMetrics {
  screenSize: string;
  viewport: string;
  pixelRatio: number;
}

export interface Device {
  type?: string;
  brand?: string;
  model?: string;
  metrics: DeviceMetrics;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  ll: number[];
  range: number[];
}

export interface NetworkInfo {
  asn?: number;
  organization?: string;
  networkType?: string;
  hostName: string;
}

export interface SecurityMetrics {
  threatScore: number;
  isProxy: boolean;
  isTor: boolean;
  isVPN: boolean;
  suspiciousHeaders: string[];
  responseCode: number;
}

export interface DetailedRequestInfo {
  timestamp: number;
  fingerprint: string;
  method: string;
  url: string;
  protocol: string;
  ip: string;
  ipVersion: 'IPv4' | 'IPv6';
  geo: GeoLocation;
  network: NetworkInfo;
  browser: {
    name: string;
    version: string;
  };
  os: {
    name: string;
    version: string;
  };
  device: {
    type?: string;
    brand?: string;
    model?: string;
  };
  language: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  sessionID?: string;
  security: SecurityMetrics;
  responseTime?: number;
}
