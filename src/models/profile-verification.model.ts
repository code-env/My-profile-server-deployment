import mongoose, { Document, Schema } from 'mongoose';

// Verification document interface
export interface IVerificationDocument {
  type: 'government_id' | 'passport' | 'drivers_license' | 'proof_of_address' | 'business_registration';
  subType?: string; // e.g., 'national_id', 'utility_bill', etc.
  documentNumber?: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  documentUrl: string;
  thumbnailUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  expiryDate?: Date;
  metadata?: {
    fileSize?: number;
    mimeType?: string;
    originalName?: string;
    ocrText?: string;
    ocrConfidence?: number;
  };
}

// Email verification interface
export interface IEmailVerification {
  email: string;
  status: 'pending' | 'verified' | 'failed';
  verificationToken?: string;
  tokenExpiry?: Date;
  otp?: string;
  otpExpiry?: Date;
  verifiedAt?: Date;
  attempts: number;
  lastAttemptAt?: Date;
}

// Phone verification interface
export interface IPhoneVerification {
  phoneNumber: string;
  formattedPhoneNumber: string;
  countryCode: string;
  status: 'pending' | 'verified' | 'failed';
  otp?: string;
  otpExpiry?: Date;
  verifiedAt?: Date;
  attempts: number;
  lastAttemptAt?: Date;
}

// KYC verification interface
export interface IKYCVerification {
  status: 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected';
  level: 'basic' | 'standard' | 'premium';
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  documents: IVerificationDocument[];
  requiredDocuments: string[]; // List of required document types
  expiresAt?: Date; // KYC expiration date
  riskScore?: number; // 0-100 risk assessment
  complianceNotes?: string;
}

// Main profile verification document interface
export interface IProfileVerification extends Document {
  profileId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Overall verification status
  overallStatus: 'unverified' | 'partially_verified' | 'fully_verified' | 'expired';
  verificationLevel: 'none' | 'basic' | 'standard' | 'premium';

  // Individual verification components
  emailVerification: IEmailVerification;
  phoneVerification: IPhoneVerification;
  kycVerification: IKYCVerification;

  // Verification permissions and restrictions
  canWithdraw: boolean;
  canReceiveDonations: boolean;
  canCreateBusinessProfile: boolean;
  withdrawalLimit?: number; // Daily withdrawal limit based on verification level

  // Tracking and audit
  createdAt: Date;
  updatedAt: Date;
  lastVerificationUpdate: Date;
  verificationHistory: {
    action: string;
    status: string;
    timestamp: Date;
    performedBy?: mongoose.Types.ObjectId;
    notes?: string;
  }[];

  // Admin notes and flags
  adminNotes?: string;
  flagged: boolean;
  flagReason?: string;
  flaggedBy?: mongoose.Types.ObjectId;
  flaggedAt?: Date;

  // Methods
  updateOverallStatus(): void;
  addHistoryEntry(action: string, status: string, performedBy?: mongoose.Types.ObjectId, notes?: string): void;
  setWithdrawalLimits(): void;
}

// Verification document schema
const verificationDocumentSchema = new Schema<IVerificationDocument>({
  type: {
    type: String,
    enum: ['government_id', 'passport', 'drivers_license', 'proof_of_address', 'business_registration'],
    required: true
  },
  subType: String,
  documentNumber: String,
  issuingCountry: String,
  issuingAuthority: String,
  documentUrl: { type: String, required: true },
  thumbnailUrl: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
  expiryDate: Date,
  metadata: {
    fileSize: Number,
    mimeType: String,
    originalName: String,
    ocrText: String,
    ocrConfidence: Number
  }
}, { _id: false });

// Email verification schema
const emailVerificationSchema = new Schema<IEmailVerification>({
  email: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },
  verificationToken: String,
  tokenExpiry: Date,
  otp: String,
  otpExpiry: Date,
  verifiedAt: Date,
  attempts: { type: Number, default: 0 },
  lastAttemptAt: Date
}, { _id: false });

// Phone verification schema
const phoneVerificationSchema = new Schema<IPhoneVerification>({
  phoneNumber: { type: String, required: true },
  formattedPhoneNumber: { type: String, required: true },
  countryCode: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },
  otp: String,
  otpExpiry: Date,
  verifiedAt: Date,
  attempts: { type: Number, default: 0 },
  lastAttemptAt: Date
}, { _id: false });

// KYC verification schema
const kycVerificationSchema = new Schema<IKYCVerification>({
  status: {
    type: String,
    enum: ['not_started', 'pending', 'under_review', 'approved', 'rejected'],
    default: 'not_started'
  },
  level: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: 'basic'
  },
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectionReason: String,
  documents: [verificationDocumentSchema],
  requiredDocuments: [String],
  expiresAt: Date,
  riskScore: { type: Number, min: 0, max: 100 },
  complianceNotes: String
}, { _id: false });

// Main profile verification schema
const profileVerificationSchema = new Schema<IProfileVerification>({
  profileId: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true,
    unique: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  overallStatus: {
    type: String,
    enum: ['unverified', 'partially_verified', 'fully_verified', 'expired'],
    default: 'unverified'
  },
  verificationLevel: {
    type: String,
    enum: ['none', 'basic', 'standard', 'premium'],
    default: 'none'
  },

  emailVerification: { type: emailVerificationSchema, required: true },
  phoneVerification: { type: phoneVerificationSchema, required: true },
  kycVerification: { type: kycVerificationSchema, required: true },

  canWithdraw: { type: Boolean, default: false },
  canReceiveDonations: { type: Boolean, default: true },
  canCreateBusinessProfile: { type: Boolean, default: false },
  withdrawalLimit: Number,

  lastVerificationUpdate: { type: Date, default: Date.now },
  verificationHistory: [{
    action: { type: String, required: true },
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: String
  }],

  adminNotes: String,
  flagged: { type: Boolean, default: false },
  flagReason: String,
  flaggedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  flaggedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
profileVerificationSchema.index({ profileId: 1 });
profileVerificationSchema.index({ userId: 1 });
profileVerificationSchema.index({ overallStatus: 1 });
profileVerificationSchema.index({ verificationLevel: 1 });
profileVerificationSchema.index({ 'kycVerification.status': 1 });
profileVerificationSchema.index({ flagged: 1 });
profileVerificationSchema.index({ createdAt: -1 });

// Virtual for checking if verification is expired
profileVerificationSchema.virtual('isExpired').get(function() {
  if (this.kycVerification.expiresAt) {
    return new Date() > this.kycVerification.expiresAt;
  }
  return false;
});

// Method to update overall status based on individual verifications
profileVerificationSchema.methods.updateOverallStatus = function() {
  const emailVerified = this.emailVerification.status === 'verified';
  const phoneVerified = this.phoneVerification.status === 'verified';
  const kycApproved = this.kycVerification.status === 'approved';

  if (this.isExpired) {
    this.overallStatus = 'expired';
    this.canWithdraw = false;
  } else if (emailVerified && phoneVerified && kycApproved) {
    this.overallStatus = 'fully_verified';
    this.canWithdraw = true;
  } else if (emailVerified || phoneVerified) {
    this.overallStatus = 'partially_verified';
    this.canWithdraw = false;
  } else {
    this.overallStatus = 'unverified';
    this.canWithdraw = false;
  }

  this.lastVerificationUpdate = new Date();
};

// Method to add verification history entry
profileVerificationSchema.methods.addHistoryEntry = function(
  action: string,
  status: string,
  performedBy?: mongoose.Types.ObjectId,
  notes?: string
) {
  this.verificationHistory.push({
    action,
    status,
    timestamp: new Date(),
    performedBy,
    notes
  });
};

// Method to set withdrawal limits based on verification level
profileVerificationSchema.methods.setWithdrawalLimits = function() {
  switch (this.verificationLevel) {
    case 'basic':
      this.withdrawalLimit = 100; // $100 daily limit
      break;
    case 'standard':
      this.withdrawalLimit = 1000; // $1000 daily limit
      break;
    case 'premium':
      this.withdrawalLimit = 10000; // $10000 daily limit
      break;
    default:
      this.withdrawalLimit = 0; // No withdrawals allowed
  }
};

// Pre-save middleware to update overall status
profileVerificationSchema.pre('save', function(next) {
  this.updateOverallStatus();
  this.setWithdrawalLimits();
  next();
});

export const ProfileVerification = mongoose.model<IProfileVerification>('ProfileVerification', profileVerificationSchema);
