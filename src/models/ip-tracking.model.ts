import mongoose, { Document, Schema } from 'mongoose';

export interface IIPGeolocation {
  country?: string;
  countryCode?: string;
  region?: string;
  regionCode?: string;
  city?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  asn?: string;
  asnOrg?: string;
}

export interface IIPThreatIntel {
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  isMalicious: boolean;
  isBot: boolean;
  threatScore: number;
  threatCategories: string[];
  lastThreatCheck: Date;
  threatSources: string[];
}

export interface IIPUsageStats {
  totalRequests: number;
  uniqueUsers: number;
  uniqueSessions: number;
  firstSeen: Date;
  lastSeen: Date;
  peakHourlyRequests: number;
  averageSessionDuration: number;
  bounceRate: number;
}

export interface IIPBehaviorPattern {
  requestFrequency: number; // requests per minute
  userAgentVariations: number;
  sessionPatterns: string[];
  timeZoneConsistency: boolean;
  languageConsistency: boolean;
  suspiciousActivities: string[];
}

export interface IIPTracking extends Document {
  // Core IP information
  ip: string;
  ipType: 'IPv4' | 'IPv6';
  
  // Geolocation data
  geolocation: IIPGeolocation;
  
  // Threat intelligence
  threatIntel: IIPThreatIntel;
  
  // Usage statistics
  usage: IIPUsageStats;
  
  // Behavioral analysis
  behavior: IIPBehaviorPattern;
  
  // Associated data
  associatedUsers: mongoose.Types.ObjectId[];
  associatedDevices: string[]; // Device fingerprints
  associatedSessions: string[];
  
  // Risk assessment
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  
  // Reputation data
  reputation: {
    score: number; // 0-100, higher is better
    sources: string[];
    lastUpdated: Date;
  };
  
  // Fraud indicators
  fraudIndicators: {
    multipleAccounts: boolean;
    rapidRegistrations: boolean;
    suspiciousReferrals: boolean;
    botLikeActivity: boolean;
    vpnUsage: boolean;
    geoInconsistency: boolean;
  };
  
  // Administrative actions
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  isMonitored: boolean;
  
  // Action history
  actions: {
    type: 'WHITELIST' | 'BLACKLIST' | 'MONITOR' | 'FLAG' | 'UNFLAG';
    reason: string;
    performedBy: mongoose.Types.ObjectId;
    timestamp: Date;
  }[];
  
  // Notes and tags
  notes?: string;
  tags: string[];
  
  // Metadata
  lastAnalyzed: Date;
  analysisVersion: string;
}

const geolocationSchema = new Schema<IIPGeolocation>({
  country: String,
  countryCode: String,
  region: String,
  regionCode: String,
  city: String,
  zipCode: String,
  latitude: Number,
  longitude: Number,
  timezone: String,
  isp: String,
  org: String,
  asn: String,
  asnOrg: String,
}, { _id: false });

const threatIntelSchema = new Schema<IIPThreatIntel>({
  isVPN: { type: Boolean, default: false },
  isProxy: { type: Boolean, default: false },
  isTor: { type: Boolean, default: false },
  isHosting: { type: Boolean, default: false },
  isMalicious: { type: Boolean, default: false },
  isBot: { type: Boolean, default: false },
  threatScore: { type: Number, default: 0, min: 0, max: 100 },
  threatCategories: [String],
  lastThreatCheck: { type: Date, default: Date.now },
  threatSources: [String],
}, { _id: false });

const usageStatsSchema = new Schema<IIPUsageStats>({
  totalRequests: { type: Number, default: 0 },
  uniqueUsers: { type: Number, default: 0 },
  uniqueSessions: { type: Number, default: 0 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  peakHourlyRequests: { type: Number, default: 0 },
  averageSessionDuration: { type: Number, default: 0 },
  bounceRate: { type: Number, default: 0 },
}, { _id: false });

const behaviorPatternSchema = new Schema<IIPBehaviorPattern>({
  requestFrequency: { type: Number, default: 0 },
  userAgentVariations: { type: Number, default: 0 },
  sessionPatterns: [String],
  timeZoneConsistency: { type: Boolean, default: true },
  languageConsistency: { type: Boolean, default: true },
  suspiciousActivities: [String],
}, { _id: false });

const reputationSchema = new Schema({
  score: { type: Number, default: 50, min: 0, max: 100 },
  sources: [String],
  lastUpdated: { type: Date, default: Date.now },
}, { _id: false });

const fraudIndicatorsSchema = new Schema({
  multipleAccounts: { type: Boolean, default: false },
  rapidRegistrations: { type: Boolean, default: false },
  suspiciousReferrals: { type: Boolean, default: false },
  botLikeActivity: { type: Boolean, default: false },
  vpnUsage: { type: Boolean, default: false },
  geoInconsistency: { type: Boolean, default: false },
}, { _id: false });

const actionSchema = new Schema({
  type: {
    type: String,
    enum: ['WHITELIST', 'BLACKLIST', 'MONITOR', 'FLAG', 'UNFLAG'],
    required: true,
  },
  reason: { type: String, required: true },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const ipTrackingSchema = new Schema<IIPTracking>({
  // Core IP information
  ip: { type: String, required: true, unique: true, index: true },
  ipType: { type: String, enum: ['IPv4', 'IPv6'], required: true },
  
  // Geolocation data
  geolocation: geolocationSchema,
  
  // Threat intelligence
  threatIntel: threatIntelSchema,
  
  // Usage statistics
  usage: usageStatsSchema,
  
  // Behavioral analysis
  behavior: behaviorPatternSchema,
  
  // Associated data
  associatedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  associatedDevices: [String],
  associatedSessions: [String],
  
  // Risk assessment
  riskScore: { type: Number, default: 0, min: 0, max: 100, index: true },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW',
    index: true,
  },
  riskFactors: [String],
  
  // Reputation data
  reputation: reputationSchema,
  
  // Fraud indicators
  fraudIndicators: fraudIndicatorsSchema,
  
  // Administrative actions
  isWhitelisted: { type: Boolean, default: false, index: true },
  isBlacklisted: { type: Boolean, default: false, index: true },
  isMonitored: { type: Boolean, default: false, index: true },
  
  // Action history
  actions: [actionSchema],
  
  // Notes and tags
  notes: String,
  tags: [String],
  
  // Metadata
  lastAnalyzed: { type: Date, default: Date.now },
  analysisVersion: { type: String, default: '1.0' },
}, {
  timestamps: true,
});

// Indexes for efficient queries
ipTrackingSchema.index({ ip: 1 }, { unique: true });
ipTrackingSchema.index({ 'geolocation.country': 1 });
ipTrackingSchema.index({ 'geolocation.countryCode': 1 });
ipTrackingSchema.index({ 'threatIntel.isVPN': 1 });
ipTrackingSchema.index({ 'threatIntel.isProxy': 1 });
ipTrackingSchema.index({ 'threatIntel.isMalicious': 1 });
ipTrackingSchema.index({ 'threatIntel.threatScore': -1 });
ipTrackingSchema.index({ riskScore: -1, riskLevel: 1 });
ipTrackingSchema.index({ 'usage.lastSeen': -1 });
ipTrackingSchema.index({ associatedUsers: 1 });
ipTrackingSchema.index({ isWhitelisted: 1, isBlacklisted: 1 });
ipTrackingSchema.index({ 'fraudIndicators.multipleAccounts': 1 });
ipTrackingSchema.index({ 'fraudIndicators.rapidRegistrations': 1 });

// Compound indexes for complex queries
ipTrackingSchema.index({ 
  'threatIntel.isVPN': 1, 
  'fraudIndicators.multipleAccounts': 1,
  riskLevel: 1 
});

ipTrackingSchema.index({
  'geolocation.countryCode': 1,
  'threatIntel.threatScore': -1,
  'usage.lastSeen': -1
});

// TTL index for automatic cleanup (optional - keep IPs for 2 years)
ipTrackingSchema.index({ 'usage.lastSeen': 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

export const IPTracking = mongoose.model<IIPTracking>('IPTracking', ipTrackingSchema);
