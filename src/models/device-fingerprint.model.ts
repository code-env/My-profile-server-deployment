import mongoose, { Document, Schema } from 'mongoose';

// Device fingerprint interfaces
export interface IVPNDetection {
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  riskScore: number;
  provider?: string;
  detectionMethod?: string;
  lastChecked: Date;
}

export interface IDeviceComponents {
  basic: string;
  advanced: string;
  canvas?: string;
  webgl?: string;
  audio?: string;
}

export interface IUserAgentInfo {
  raw: string;
  browser: {
    name?: string;
    version?: string;
    major?: string;
  };
  os: {
    name?: string;
    version?: string;
  };
  device: {
    type?: string;
    model?: string;
    vendor?: string;
  };
  engine: {
    name?: string;
    version?: string;
  };
}

export interface INetworkInfo {
  ip: string;
  realIP?: string;
  vpnDetection: IVPNDetection;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    ll?: [number, number];
    timezone?: string;
  };
  timezone?: string;
  connectionType?: string;
  isp?: string;
  asn?: string;
}

export interface IBrowserInfo {
  language: string;
  languages: string[];
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: boolean;
  plugins: string[];
  mimeTypes: string[];
}

export interface IScreenInfo {
  resolution?: string;
  colorDepth?: number;
  pixelRatio?: number;
  availableResolution?: string;
}

export interface IHardwareInfo {
  cores?: number;
  memory?: number;
  touchSupport: boolean;
  maxTouchPoints?: number;
}

export interface IBehavioralInfo {
  mouseMovements?: number[];
  keyboardPattern?: string;
  scrollBehavior?: string;
  clickPattern?: string;
  typingSpeed?: number;
}

export interface IRiskFactors {
  score: number;
  factors: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastUpdated: Date;
}

export interface IDeviceFingerprint extends Document {
  // Core identification
  fingerprint: string;
  components: IDeviceComponents;
  
  // User and session info
  userId?: mongoose.Types.ObjectId;
  sessionId?: string;
  
  // Device details
  userAgent: IUserAgentInfo;
  network: INetworkInfo;
  browser: IBrowserInfo;
  screen: IScreenInfo;
  hardware: IHardwareInfo;
  behavioral: IBehavioralInfo;
  
  // Risk assessment
  riskFactors: IRiskFactors;
  
  // Tracking info
  firstSeen: Date;
  lastSeen: Date;
  seenCount: number;
  
  // Associated accounts (for fraud detection)
  associatedUsers: mongoose.Types.ObjectId[];
  associatedSessions: string[];
  
  // Fraud flags
  isFlagged: boolean;
  flagReason?: string;
  flaggedAt?: Date;
  flaggedBy?: mongoose.Types.ObjectId;
  
  // Status
  isBlocked: boolean;
  blockedAt?: Date;
  blockedReason?: string;
  
  // Metadata
  notes?: string;
  tags: string[];
}

const vpnDetectionSchema = new Schema<IVPNDetection>({
  isVPN: { type: Boolean, default: false },
  isProxy: { type: Boolean, default: false },
  isTor: { type: Boolean, default: false },
  isHosting: { type: Boolean, default: false },
  riskScore: { type: Number, default: 0 },
  provider: String,
  detectionMethod: String,
  lastChecked: { type: Date, default: Date.now },
}, { _id: false });

const deviceComponentsSchema = new Schema<IDeviceComponents>({
  basic: { type: String, required: true },
  advanced: { type: String, required: true },
  canvas: String,
  webgl: String,
  audio: String,
}, { _id: false });

const userAgentSchema = new Schema<IUserAgentInfo>({
  raw: { type: String, required: true },
  browser: {
    name: String,
    version: String,
    major: String,
  },
  os: {
    name: String,
    version: String,
  },
  device: {
    type: String,
    model: String,
    vendor: String,
  },
  engine: {
    name: String,
    version: String,
  },
}, { _id: false });

const networkSchema = new Schema<INetworkInfo>({
  ip: { type: String, required: true, index: true },
  realIP: String,
  vpnDetection: vpnDetectionSchema,
  geolocation: {
    country: String,
    region: String,
    city: String,
    ll: [Number],
    timezone: String,
  },
  timezone: String,
  connectionType: String,
  isp: String,
  asn: String,
}, { _id: false });

const browserSchema = new Schema<IBrowserInfo>({
  language: String,
  languages: [String],
  platform: String,
  cookieEnabled: Boolean,
  doNotTrack: Boolean,
  plugins: [String],
  mimeTypes: [String],
}, { _id: false });

const screenSchema = new Schema<IScreenInfo>({
  resolution: String,
  colorDepth: Number,
  pixelRatio: Number,
  availableResolution: String,
}, { _id: false });

const hardwareSchema = new Schema<IHardwareInfo>({
  cores: Number,
  memory: Number,
  touchSupport: Boolean,
  maxTouchPoints: Number,
}, { _id: false });

const behavioralSchema = new Schema<IBehavioralInfo>({
  mouseMovements: [Number],
  keyboardPattern: String,
  scrollBehavior: String,
  clickPattern: String,
  typingSpeed: Number,
}, { _id: false });

const riskFactorsSchema = new Schema<IRiskFactors>({
  score: { type: Number, default: 0, index: true },
  factors: [String],
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW',
    index: true,
  },
  lastUpdated: { type: Date, default: Date.now },
}, { _id: false });

const deviceFingerprintSchema = new Schema<IDeviceFingerprint>({
  // Core identification
  fingerprint: { type: String, required: true, unique: true, index: true },
  components: deviceComponentsSchema,
  
  // User and session info
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  sessionId: { type: String, index: true },
  
  // Device details
  userAgent: userAgentSchema,
  network: networkSchema,
  browser: browserSchema,
  screen: screenSchema,
  hardware: hardwareSchema,
  behavioral: behavioralSchema,
  
  // Risk assessment
  riskFactors: riskFactorsSchema,
  
  // Tracking info
  firstSeen: { type: Date, default: Date.now, index: true },
  lastSeen: { type: Date, default: Date.now, index: true },
  seenCount: { type: Number, default: 1 },
  
  // Associated accounts (for fraud detection)
  associatedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  associatedSessions: [String],
  
  // Fraud flags
  isFlagged: { type: Boolean, default: false, index: true },
  flagReason: String,
  flaggedAt: Date,
  flaggedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  
  // Status
  isBlocked: { type: Boolean, default: false, index: true },
  blockedAt: Date,
  blockedReason: String,
  
  // Metadata
  notes: String,
  tags: [String],
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
deviceFingerprintSchema.index({ fingerprint: 1, userId: 1 });
deviceFingerprintSchema.index({ 'network.ip': 1, userId: 1 });
deviceFingerprintSchema.index({ 'riskFactors.score': -1, 'riskFactors.severity': 1 });
deviceFingerprintSchema.index({ isFlagged: 1, isBlocked: 1 });
deviceFingerprintSchema.index({ lastSeen: -1 });
deviceFingerprintSchema.index({ associatedUsers: 1 });

// TTL index to automatically clean up old fingerprints (optional)
deviceFingerprintSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // 1 year

export const DeviceFingerprint = mongoose.model<IDeviceFingerprint>('DeviceFingerprint', deviceFingerprintSchema);
