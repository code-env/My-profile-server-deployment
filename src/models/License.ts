import mongoose, { Document, Schema } from 'mongoose';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import os from 'os';

export interface IHardwareFingerprint {
  cpu: string;
  totalMemory: number;
  hostname: string;
  platform: string;
  osRelease: string;
  macAddress: string;
  hash: string;
}

export interface ILicense extends Document {
  key: string;
  employeeId: mongoose.Types.ObjectId;
  employeeName: string;
  employeeEmail: string;
  department: string;
  issuedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  lastValidated: Date;
  hardwareFingerprint: IHardwareFingerprint;
  encryptionMetadata: {
    iv: string;
  };
  validationHistory: {
    timestamp: Date;
    deviceId: string;
    ipAddress: string;
    hardwareHash: string;
    status: 'success' | 'failed';
    reason?: string;
  }[];
  validateLicenseKey(key: string, hardwareHash: string): Promise<boolean>;
  validateHardwareFingerprint(fingerprint: IHardwareFingerprint): boolean;
}

const hardwareFingerprintSchema = new Schema<IHardwareFingerprint>({
  cpu: String,
  totalMemory: Number,
  hostname: String,
  platform: String,
  osRelease: String,
  macAddress: String,
  hash: String,
});

const licenseSchema = new Schema<ILicense>({
  key: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
  },
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  employeeName: {
    type: String,
    required: true,
  },
  employeeEmail: {
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
  },
  issuedAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastValidated: {
    type: Date,
  },
  hardwareFingerprint: {
    type: hardwareFingerprintSchema,
    required: true,
  },
  encryptionMetadata: {
    iv: {
      type: String,
      required: true,
    },
  },
  validationHistory: [{
    timestamp: {
      type: Date,
      default: Date.now,
    },
    deviceId: String,
    ipAddress: String,
    hardwareHash: String,
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
    },
    reason: String,
  }],
});

// Method to validate hardware fingerprint
licenseSchema.methods.validateHardwareFingerprint = function(fingerprint: IHardwareFingerprint): boolean {
  // Check if hardware hash matches
  if (fingerprint.hash !== this.hardwareFingerprint.hash) {
    logger.warn(`Hardware fingerprint mismatch for employee ${this.employeeEmail}`);
    return false;
  }

  // Additional checks for hardware components
  const tolerance = 0.1; // 10% tolerance for memory changes
  const memoryDiff = Math.abs(fingerprint.totalMemory - this.hardwareFingerprint.totalMemory) / this.hardwareFingerprint.totalMemory;

  if (
    fingerprint.cpu !== this.hardwareFingerprint.cpu ||
    memoryDiff > tolerance ||
    fingerprint.platform !== this.hardwareFingerprint.platform ||
    fingerprint.macAddress !== this.hardwareFingerprint.macAddress
  ) {
    logger.warn(`Hardware components mismatch for employee ${this.employeeEmail}`);
    return false;
  }

  return true;
};

// Method to validate license key
licenseSchema.methods.validateLicenseKey = async function(key: string, hardwareHash: string): Promise<boolean> {
  if (key !== this.key) {
    logger.warn(`Invalid license key attempt for employee ${this.employeeEmail}`);
    return false;
  }

  if (!this.isActive) {
    logger.warn(`Inactive license key used by employee ${this.employeeEmail}`);
    return false;
  }

  if (new Date() > this.expiresAt) {
    this.isActive = false;
    await this.save();
    logger.warn(`Expired license key used by employee ${this.employeeEmail}`);
    return false;
  }

  if (hardwareHash !== this.hardwareFingerprint.hash) {
    logger.warn(`Hardware hash mismatch for employee ${this.employeeEmail}`);
    return false;
  }

  return true;
};

// Pre-save middleware
licenseSchema.pre('save', function(next) {
  if (this.isNew) {
    logger.info(`New hardware-locked license created for employee ${this.employeeEmail}`);
  }
  next();
});

// Indexes
licenseSchema.index({ key: 1 }, { unique: true });
licenseSchema.index({ employeeId: 1 });
licenseSchema.index({ expiresAt: 1 });
licenseSchema.index({ 'hardwareFingerprint.hash': 1 });

export const License = mongoose.model<ILicense>('License', licenseSchema);
