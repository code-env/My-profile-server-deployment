"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_1 = require("../utils/logger");
const crypto_1 = require("../utils/crypto");
const userSchema = new mongoose_1.Schema({
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
        required: function () {
            // Only required if not a social login or if social login is complete
            return !(this.signupType === 'google' || this.signupType === 'facebook' || this.signupType === 'linkedin');
        },
    },
    countryOfResidence: {
        type: String,
        required: function () {
            // Only required if not a social login or if social login is complete
            return !(this.signupType === 'google' || this.signupType === 'facebook' || this.signupType === 'linkedin');
        },
    },
    phoneNumber: {
        type: String,
        required: function () {
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
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Profile',
        }],
    activeProfile: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Profile',
        sparse: true,
    },
    referrals: [{
            type: mongoose_1.Schema.Types.ObjectId,
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
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'User',
            }],
        following: [{
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'User',
            }],
        blockedUsers: [{
                type: mongoose_1.Schema.Types.ObjectId,
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        sparse: true
    },
    referralRewards: {
        earnedPoints: { type: Number, default: 0 },
        pendingPoints: { type: Number, default: 0 },
        totalReferrals: { type: Number, default: 0 },
        successfulReferrals: { type: Number, default: 0 },
        referralHistory: [{
                referredUser: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
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
        default: function () {
            // Regular email users complete profile during registration
            // Social auth users need to complete it separately
            return this.signupType === 'email';
        }
    }
}, {
    timestamps: true,
});
// Pre-save middleware
userSchema.pre('save', async function (next) {
    try {
        logger_1.logger.debug(`Processing user save for ${this.email}`);
        // Only hash password if it has been modified or is new
        if (this.isModified('password')) {
            logger_1.logger.info(`Password modified for user ${this.email} - hashing new password`);
            const salt = await bcryptjs_1.default.genSalt(10);
            this.password = await bcryptjs_1.default.hash(this.password, salt);
        }
        // Generate a personal referral code if this is a new user
        // We only generate a code for new users, not when they're entering someone else's code
        if (this.isNew && !this.referralCode) {
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 5;
            while (!isUnique && attempts < maxAttempts) {
                const code = (0, crypto_1.generateReferralCode)();
                // Check if the code already exists
                const existingUser = await this.constructor.findOne({ referralCode: code });
                if (!existingUser) {
                    this.referralCode = code;
                    isUnique = true;
                }
                attempts++;
            }
            if (!isUnique) {
                logger_1.logger.error('Failed to generate unique referral code after maximum attempts');
                throw new Error('Failed to generate unique referral code');
            }
        }
        // Check failed login attempts
        if (this.isModified('failedLoginAttempts') && this.failedLoginAttempts >= 5) {
            logger_1.logger.warn(`Account locked for user ${this.email} due to multiple failed login attempts`);
            this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        }
        // Auto-update profile completion status when profile fields change
        if (this.isModified('dateOfBirth') || this.isModified('countryOfResidence') || this.isModified('phoneNumber') || this.isNew) {
            // Log phone number changes for debugging
            if (this.isModified('phoneNumber')) {
                logger_1.logger.debug(`Phone number modified for user ${this.email || this._id} - new: ${this.phoneNumber}`);
            }
            const hasAllRequiredFields = !!this.dateOfBirth &&
                !!this.countryOfResidence &&
                !!this.phoneNumber &&
                this.countryOfResidence.trim() !== '' &&
                (this.phoneNumber ? this.phoneNumber.trim() !== '' : false);
            const previousCompletionStatus = this.isProfileComplete;
            this.isProfileComplete = hasAllRequiredFields;
            if (previousCompletionStatus !== this.isProfileComplete) {
                logger_1.logger.info(`Auto-updated profile completion status for user ${this.email}: ${previousCompletionStatus} -> ${this.isProfileComplete}`);
                if (this.isProfileComplete) {
                    logger_1.logger.info(`Profile completion criteria met - dateOfBirth: ${!!this.dateOfBirth}, countryOfResidence: ${!!this.countryOfResidence}, phoneNumber: ${!!this.phoneNumber}`);
                }
                else {
                    logger_1.logger.info(`Profile incomplete - missing fields: ${!this.dateOfBirth ? 'dateOfBirth ' : ''}${!this.countryOfResidence || this.countryOfResidence.trim() === '' ? 'countryOfResidence ' : ''}${!this.phoneNumber || this.phoneNumber.trim() === '' ? 'phoneNumber ' : ''}`);
                }
            }
        }
        // Removed automatic role elevation based on profile count
        // This was a security issue that automatically made users admins if they had multiple profiles
        next();
    }
    catch (error) {
        next(error);
    }
});
// Create indexes
userSchema.index({ phoneNumber: 1 }, { sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ facebookId: 1 }, { sparse: true });
userSchema.index({ linkedinId: 1 }, { sparse: true });
userSchema.index({ verificationToken: 1 }, { sparse: true });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });
userSchema.index({ otpData: 1 }, { sparse: true });
logger_1.logger.info('User model indexes created successfully');
exports.User = mongoose_1.default.model('Users', userSchema);
