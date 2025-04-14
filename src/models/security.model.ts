import mongoose, { Document, Schema } from 'mongoose';

export interface ISecurityDocument extends Document {
  userId: mongoose.Types.ObjectId;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  biometricEnabled: boolean;
  biometricData?: {
    fingerprint?: {
      hash: string;
      lastVerified: Date;
    };
    faceId?: {
      hash: string;
      lastVerified: Date;
    };
    voicePrint?: {
      hash: string;
      lastVerified: Date;
    };
  };
  lastLogin?: Date;
  lastPasswordChange?: Date;
  passwordHistory: string[];
  securityQuestions: {
    question: string;
    answer: string;
  }[];
  ipWhitelist?: string[];
  deviceWhitelist?: {
    deviceId: string;
    deviceName: string;
    lastUsed: Date;
  }[];
  loginAttempts: number;
  lockoutUntil?: Date;
  auditLog: {
    action: string;
    timestamp: Date;
    ip?: string;
    deviceId?: string;
    success: boolean;
    details?: Record<string, any>;
  }[];
}

const securitySchema = new Schema<ISecurityDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    twoFactorBackupCodes: [String],
    biometricEnabled: { type: Boolean, default: false },
    biometricData: {
      fingerprint: {
        hash: String,
        lastVerified: Date,
      },
      faceId: {
        hash: String,
        lastVerified: Date,
      },
      voicePrint: {
        hash: String,
        lastVerified: Date,
      },
    },
    lastLogin: Date,
    lastPasswordChange: Date,
    passwordHistory: [String],
    securityQuestions: [{
      question: String,
      answer: String,
    }],
    ipWhitelist: [String],
    deviceWhitelist: [{
      deviceId: String,
      deviceName: String,
      lastUsed: Date,
    }],
    loginAttempts: { type: Number, default: 0 },
    lockoutUntil: Date,
    auditLog: [{
      action: String,
      timestamp: Date,
      ip: String,
      deviceId: String,
      success: Boolean,
      details: Schema.Types.Mixed,
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
securitySchema.index({ userId: 1 }, { unique: true });
securitySchema.index({ 'deviceWhitelist.deviceId': 1 });
securitySchema.index({ lockoutUntil: 1 });

export const Security = mongoose.model<ISecurityDocument>('Security', securitySchema);
