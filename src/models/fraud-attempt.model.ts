import mongoose, { Document, Schema } from 'mongoose';

export interface IFraudAttempt extends Document {
  // Attempt details
  type: 'REGISTRATION_BLOCKED' | 'LOGIN_BLOCKED' | 'DEVICE_BLOCKED' | 'IP_BLOCKED';
  reason: string;
  riskScore: number;
  flags: string[];
  
  // Device information
  deviceFingerprint: string;
  ip: string;
  userAgent: string;
  
  // User attempt information
  attemptedEmail?: string;
  attemptedUsername?: string;
  attemptedFullName?: string;
  registrationMethod: 'email' | 'google' | 'facebook' | 'linkedin';
  
  // Existing device/IP information
  existingUsers: number;
  existingDeviceId?: mongoose.Types.ObjectId;
  existingIPId?: mongoose.Types.ObjectId;
  
  // Geographic and network info
  country?: string;
  city?: string;
  isVPN: boolean;
  isProxy: boolean;
  
  // Metadata
  timestamp: Date;
  sessionId?: string;
  referralCode?: string;
  
  // Admin actions
  reviewed: boolean;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  adminNotes?: string;
  status: 'PENDING' | 'REVIEWED' | 'ESCALATED' | 'DISMISSED';
}

const fraudAttemptSchema = new Schema<IFraudAttempt>({
  // Attempt details
  type: {
    type: String,
    enum: ['REGISTRATION_BLOCKED', 'LOGIN_BLOCKED', 'DEVICE_BLOCKED', 'IP_BLOCKED'],
    required: true,
    index: true
  },
  reason: { type: String, required: true },
  riskScore: { type: Number, required: true, min: 0, max: 100, index: true },
  flags: [String],
  
  // Device information
  deviceFingerprint: { type: String, required: true, index: true },
  ip: { type: String, required: true, index: true },
  userAgent: { type: String, required: true },
  
  // User attempt information
  attemptedEmail: { type: String, index: true },
  attemptedUsername: String,
  attemptedFullName: String,
  registrationMethod: {
    type: String,
    enum: ['email', 'google', 'facebook', 'linkedin'],
    required: true,
    index: true
  },
  
  // Existing device/IP information
  existingUsers: { type: Number, default: 0, index: true },
  existingDeviceId: { type: Schema.Types.ObjectId, ref: 'DeviceFingerprint' },
  existingIPId: { type: Schema.Types.ObjectId, ref: 'IPTracking' },
  
  // Geographic and network info
  country: String,
  city: String,
  isVPN: { type: Boolean, default: false, index: true },
  isProxy: { type: Boolean, default: false, index: true },
  
  // Metadata
  timestamp: { type: Date, default: Date.now, index: true },
  sessionId: String,
  referralCode: String,
  
  // Admin actions
  reviewed: { type: Boolean, default: false, index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  adminNotes: String,
  status: {
    type: String,
    enum: ['PENDING', 'REVIEWED', 'ESCALATED', 'DISMISSED'],
    default: 'PENDING',
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
fraudAttemptSchema.index({ timestamp: -1, type: 1 });
fraudAttemptSchema.index({ deviceFingerprint: 1, timestamp: -1 });
fraudAttemptSchema.index({ ip: 1, timestamp: -1 });
fraudAttemptSchema.index({ attemptedEmail: 1, timestamp: -1 });
fraudAttemptSchema.index({ reviewed: 1, status: 1 });
fraudAttemptSchema.index({ riskScore: -1, timestamp: -1 });

// TTL index to automatically clean up old attempts after 1 year
fraudAttemptSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const FraudAttempt = mongoose.model<IFraudAttempt>('FraudAttempt', fraudAttemptSchema);
