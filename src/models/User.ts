import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { generateReferralCode } from '../utils/crypto';

interface ISubscription {
  plan: 'free' | 'premium' | 'business';
  features: string[];
  limitations: {
    maxProfiles: number;
    maxGalleryItems: number;
    maxFollowers: number;
  };
  startDate: Date;
}

interface IBiometricAuth {
  enabled: boolean;
  methods: ('fingerprint' | 'faceId')[];
  lastUsed: Date;
  devices: string[];
}

interface IDevice {
  id: string;
  name: string;
  type: 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'other';
  lastActive: Date;
  biometricEnabled: boolean;
  trusted: boolean;
  pushToken?: string;
}

interface INotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
}

export interface IOTPData {
  hash?: string;
  expiry?: Date;
  attempts: number;
  purpose?: 'registration' | 'login' | 'reset_password' | 'change_email';
  channel?: 'email' | 'sms';
}

interface IReferralReward {
  type: 'signup' | 'verification' | 'first_purchase';
  amount: number;
  status: 'pending' | 'completed';
  date: Date;
}

interface IReferralHistory {
  referredUser: mongoose.Types.ObjectId;
  date: Date;
  status: 'pending' | 'completed';
  rewards: IReferralReward[];
}

interface IReferralRewards {
  earnedPoints: number;
  pendingPoints: number;
  totalReferrals: number;
  successfulReferrals: number;
  referralHistory: IReferralHistory[];
}

interface IVerificationData {
  otp?: string;
  otpExpiry?: Date;
  attempts: number;
  lastAttempt?: Date;
}

export interface ISession {
  refreshToken: string;
  deviceInfo: {
    userAgent?: string;
    ip?: string;
    deviceType?: string;
  };
  lastUsed: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface IUser extends Document {
  email: string;
  password: string;
  fullName: string;
  username: string;
  dateOfBirth: Date;
  countryOfResidence: string;
  phoneNumber: string;
  accountType: 'MYSELF' | 'SOMEONE_ELSE';
  accountCategory: 'PRIMARY_ACCOUNT' | 'SECONDARY_ACCOUNT';
  verificationMethod: 'PHONE' | 'EMAIL';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  registrationStep: 'INITIAL' | 'BASIC_INFO' | 'ELIGIBILITY' | 'CONTACT' | 'SECURITY' | 'VERIFICATION';
  verificationData: IVerificationData;
  refreshTokens: string[];  // Deprecated - will be replaced with sessions
  sessions: ISession[];     // New field for better session management
  lastLogin?: Date;
  failedLoginAttempts: number;
  lockUntil: Date;
  signupType: 'email' | 'google' | 'facebook';
  googleId?: string;
  facebookId?: string;
  role: 'superadmin' | 'admin' | 'user';
  subscription: ISubscription;
  profileId?: string;
  mpts: number;
  profileImage?: string;
  profiles: mongoose.Types.ObjectId[];
  referrals: mongoose.Types.ObjectId[];
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
  biometricAuth: IBiometricAuth;
  devices: IDevice[];
  notifications: INotificationPreferences;
  social: {
    followers: mongoose.Types.ObjectId[];
    following: mongoose.Types.ObjectId[];
    blockedUsers: mongoose.Types.ObjectId[];
  };
  otpData: IOTPData;
  referralCode?: string;
  referredBy?: mongoose.Types.ObjectId;
  referralRewards: IReferralRewards;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    countryOfResidence: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      sparse: true,
    },
    accountType: {
      type: String,
      enum: ['MYSELF', 'SOMEONE_ELSE'],
      required: true,
    },
    signupType: {
      type: String,
      enum: ['email', 'google', 'facebook'],
      default: 'email',
    },
    accountCategory: {
      type: String,
      enum: ['PRIMARY_ACCOUNT', 'SECONDARY_ACCOUNT'],
      required: true,
    },
    verificationMethod: {
      type: String,
      enum: ['PHONE', 'EMAIL'],
      required: true,
      default: 'EMAIL',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    verificationData: {
      otp: String,
      otpExpiry: Date,
      attempts: {
        type: Number,
        default: 0,
      },
      lastAttempt: Date,
    },
    refreshTokens: [String],
    sessions: [{
      refreshToken: String,
      deviceInfo: {
        userAgent: String,
        ip: String,
        deviceType: String,
      },
      lastUsed: Date,
      createdAt: Date,
      isActive: Boolean,
    }],
    lastLogin: Date,
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    googleId: String,
    facebookId: String,
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'user'],
      default: 'user',
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'premium', 'basic'],
        default: 'free',
      },
      features: [String],
      limitations: {
        maxProfiles: { type: Number, default: 1 },
        maxGalleryItems: { type: Number, default: 10 },
        maxFollowers: { type: Number, default: 100 },
      },
      startDate: { type: Date, default: Date.now },
    },
    profileId: String,
    mpts: {
      type: Number,
      default: 0,
    },
    profileImage: String,
    profiles: [{
      type: Schema.Types.ObjectId,
      ref: 'Profile',
    }],
    referrals: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    twoFactorSecret: String,
    isTwoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    biometricAuth: {
      enabled: { type: Boolean, default: false },
      methods: [{ 
        type: String,
        enum: ['fingerprint', 'faceId']
      }],
      lastUsed: Date,
      devices: [String],
    },
    devices: [{
      id: String,
      name: String,
      type: {
        type: String,
        enum: ['smartphone', 'tablet', 'laptop', 'desktop', 'other'],
      },
      lastActive: Date,
      biometricEnabled: Boolean,
      trusted: Boolean,
      pushToken: String,
    }],
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
    },
    social: {
      followers: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
      }],
      following: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
      }],
      blockedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
      }],
    },
    otpData: {
      hash: { type: String },
      expiry: { type: Date },
      attempts: { type: Number, default: 0 },
      purpose: { 
        type: String, 
        enum: ['registration', 'login', 'reset_password', 'change_email']
      },
      channel: {
        type: String,
        enum: ['email', 'sms']
      }
    },
    referralCode: {
      type: String,
      sparse: true,
      unique: true
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    referralRewards: {
      earnedPoints: { type: Number, default: 0 },
      pendingPoints: { type: Number, default: 0 },
      totalReferrals: { type: Number, default: 0 },
      successfulReferrals: { type: Number, default: 0 },
      referralHistory: [{
        referredUser: { type: Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
        status: { 
          type: String, 
          enum: ['pending', 'completed'],
          default: 'pending'
        },
        rewards: [{
          type: { 
            type: String,
            enum: ['signup', 'verification', 'first_purchase']
          },
          amount: Number,
          status: {
            type: String,
            enum: ['pending', 'completed'],
            default: 'pending'
          },
          date: { type: Date, default: Date.now }
        }]
      }]
    },
    verificationToken: String,
    verificationTokenExpiry: Date
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware
userSchema.pre('save', async function(next) {
  try {
    logger.debug(`Processing user save for ${this.email}`);

    // Only hash password if it has been modified or is new
    if (this.isModified('password')) {
      logger.info(`Password modified for user ${this.email} - hashing new password`);
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    // Generate referral code if it doesn't exist
    if (!this.referralCode) {
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!isUnique && attempts < maxAttempts) {
        const code = generateReferralCode();
        // Check if the code already exists
        const existingUser = await (this.constructor as any).findOne({ referralCode: code });
        if (!existingUser) {
          this.referralCode = code;
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        logger.error('Failed to generate unique referral code after maximum attempts');
        throw new Error('Failed to generate unique referral code');
      }
    }

    // Check failed login attempts
    if (this.isModified('failedLoginAttempts') && this.failedLoginAttempts >= 5) {
      logger.warn(`Account locked for user ${this.email} due to multiple failed login attempts`);
      this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }

    // Check profiles and update role if necessary
    if (this.profiles && this.profiles.length > 1) {
      logger.info(`User ${this.email} role updated to admin due to multiple profiles`);
      this.role = 'admin';
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    if (!isMatch) {
      logger.warn(`Failed login attempt for user ${this.email}`);
      this.failedLoginAttempts += 1;
      await this.save();
    } else if (this.failedLoginAttempts > 0) {
      logger.info(`Successful login after failed attempts for user ${this.email} - resetting counter`);
      this.failedLoginAttempts = 0;
      this.lockUntil = undefined;
      await this.save();
    }
    return isMatch;
  } catch (error) {
    logger.error(`Error comparing password for user ${this.email}:`, error);
    return false;
  }
};

// Create indexes
// userSchema.index({ phoneNumber: 1 }, { sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ facebookId: 1 }, { sparse: true });
userSchema.index({ verificationToken: 1 }, { sparse: true });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });
userSchema.index({ otpData: 1 }, { sparse: true });

logger.info('User model indexes created successfully');

export const User = mongoose.model<IUser>('Users', userSchema);
