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

interface ITelegramNotificationPreferences {
  enabled: boolean;
  username: string;
  telegramId?: string;
  preferences: {
    transactions: boolean;
    transactionUpdates: boolean;
    purchaseConfirmations: boolean;
    saleConfirmations: boolean;
    security: boolean;
    connectionRequests: boolean;
    messages: boolean;
  };
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
  deviceFingerprint?: string;
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
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
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
  signupType: 'email' | 'google' | 'facebook' | 'linkedin';
  googleId?: string;
  facebookId?: string;
  linkedinId?: string;
  role: 'superadmin' | 'admin' | 'user';
  subscription: ISubscription;
  profileId?: string;
  mpts: number;
  profileImage?: string;
  profiles: mongoose.Types.ObjectId[];
  activeProfile?: mongoose.Types.ObjectId;
  referrals: mongoose.Types.ObjectId[];
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
  biometricAuth: IBiometricAuth;
  devices: IDevice[];
  notifications: INotificationPreferences;
  telegramNotifications?: ITelegramNotificationPreferences;
  social: {
    followers: mongoose.Types.ObjectId[];
    following: mongoose.Types.ObjectId[];
    blockedUsers: mongoose.Types.ObjectId[];
  };
  otpData: IOTPData;
  referralCode?: string;
  tempReferralCode?: string; // Field for storing referral code entered during registration
  referredBy?: mongoose.Types.ObjectId;
  referralRewards: IReferralRewards;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  formattedPhoneNumber?: string;
  isProfileComplete?: boolean; // Track if user has completed their profile (especially for social auth)
  // Admin management fields
  isBanned: boolean;
  banReason?: string;
  banDate?: Date;
  isAccountLocked: boolean;
  lockReason?: string;
  lockDate?: Date;
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

    firstName: {
      type: String,
    },

    lastName: {
      type: String,
    },

    dateOfBirth: {
      type: Date,
      required: function() {
        // Only required if not a social login or if social login is complete
        return !(this.signupType === 'google' || this.signupType === 'facebook' || this.signupType === 'linkedin');
      },
    },
    countryOfResidence: {
      type: String,
      required: function() {
        // Only required if not a social login or if social login is complete
        return !(this.signupType === 'google' || this.signupType === 'facebook' || this.signupType === 'linkedin');
      },
    },
    phoneNumber: {
      type: String,
      required: function() {
        // Only required if not a social login or if social login is complete
        return !(this.signupType === 'google' || this.signupType === 'facebook' || this.signupType === 'linkedin');
      },
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
      deviceFingerprint: String,
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
    linkedinId: String,
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
    activeProfile: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      sparse: true,
    },
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
    telegramNotifications: {
      enabled: { type: Boolean, default: false },
      username: { type: String, default: '' },
      telegramId: { type: String }, // No default value - will be set during verification
      preferences: {
        transactions: { type: Boolean, default: true },
        transactionUpdates: { type: Boolean, default: true },
        purchaseConfirmations: { type: Boolean, default: true },
        saleConfirmations: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
        connectionRequests: { type: Boolean, default: false },
        messages: { type: Boolean, default: false }
      }
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
      sparse: true
      // Removed unique constraint to allow storing other users' referral codes
    },
    tempReferralCode: {
      type: String,
      sparse: true
      // This field stores the referral code entered during registration
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
    verificationTokenExpiry: Date,
    formattedPhoneNumber: String,
    isProfileComplete: {
      type: Boolean,
      default: function(this: IUser) {
        // Regular email users complete profile during registration
        // Social auth users need to complete it separately
        return this.signupType === 'email';
      }
    },
    // Admin management fields
    isBanned: {
      type: Boolean,
      default: false,
    },
    banReason: {
      type: String,
      required: function(this: IUser) {
        return this.isBanned;
      },
    },
    banDate: {
      type: Date,
      required: function(this: IUser) {
        return this.isBanned;
      },
    },
    isAccountLocked: {
      type: Boolean,
      default: false,
    },
    lockReason: {
      type: String,
      required: function(this: IUser) {
        return this.isAccountLocked;
      },
    },
    lockDate: {
      type: Date,
      required: function(this: IUser) {
        return this.isAccountLocked;
      },
    },
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

    // Generate a personal referral code if this is a new user
    // We only generate a code for new users, not when they're entering someone else's code
    if (this.isNew && !this.referralCode) {
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

    // Auto-update profile completion status when profile fields change
    if (this.isModified('dateOfBirth') || this.isModified('countryOfResidence') || this.isModified('phoneNumber') || this.isNew) {
      // Log phone number changes for debugging
      if (this.isModified('phoneNumber')) {
        logger.debug(`Phone number modified for user ${this.email || this._id} - new: ${this.phoneNumber}`);
      }

      const hasAllRequiredFields = !!this.dateOfBirth &&
                                   !!this.countryOfResidence &&
                                   !!this.phoneNumber &&
                                   this.countryOfResidence.trim() !== '' &&
                                   (this.phoneNumber ? this.phoneNumber.trim() !== '' : false);

      const previousCompletionStatus = this.isProfileComplete;
      this.isProfileComplete = hasAllRequiredFields;

      if (previousCompletionStatus !== this.isProfileComplete) {
        logger.info(`Auto-updated profile completion status for user ${this.email}: ${previousCompletionStatus} -> ${this.isProfileComplete}`);
        if (this.isProfileComplete) {
          logger.info(`Profile completion criteria met - dateOfBirth: ${!!this.dateOfBirth}, countryOfResidence: ${!!this.countryOfResidence}, phoneNumber: ${!!this.phoneNumber}`);
        } else {
          logger.info(`Profile incomplete - missing fields: ${
            !this.dateOfBirth ? 'dateOfBirth ' : ''
          }${!this.countryOfResidence || this.countryOfResidence.trim() === '' ? 'countryOfResidence ' : ''
          }${!this.phoneNumber || this.phoneNumber.trim() === '' ? 'phoneNumber ' : ''}`);
        }
      }
    }

    // Removed automatic role elevation based on profile count
    // This was a security issue that automatically made users admins if they had multiple profiles

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
userSchema.index({ phoneNumber: 1 }, { sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ facebookId: 1 }, { sparse: true });
userSchema.index({ linkedinId: 1 }, { sparse: true });
userSchema.index({ verificationToken: 1 }, { sparse: true });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });
userSchema.index({ otpData: 1 }, { sparse: true });
userSchema.index({ isBanned: 1 });
userSchema.index({ isAccountLocked: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isEmailVerified: 1 });
userSchema.index({ isPhoneVerified: 1 });
userSchema.index({ createdAt: 1 });

logger.info('User model indexes created successfully');

export const User = mongoose.model<IUser>('User', userSchema);
