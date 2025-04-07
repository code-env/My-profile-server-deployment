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
    formattedPhoneNumber: {
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
        sparse: true,
        unique: true
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
    verificationTokenExpiry: Date
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
        // Generate referral code if it doesn't exist
        if (!this.referralCode) {
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
        // Check profiles and update role if necessary
        if (this.profiles && this.profiles.length > 1) {
            logger_1.logger.info(`User ${this.email} role updated to admin due to multiple profiles`);
            this.role = 'admin';
        }
        next();
    }
    catch (error) {
        next(error);
    }
});
// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        const isMatch = await bcryptjs_1.default.compare(candidatePassword, this.password);
        if (!isMatch) {
            logger_1.logger.warn(`Failed login attempt for user ${this.email}`);
            this.failedLoginAttempts += 1;
            await this.save();
        }
        else if (this.failedLoginAttempts > 0) {
            logger_1.logger.info(`Successful login after failed attempts for user ${this.email} - resetting counter`);
            this.failedLoginAttempts = 0;
            this.lockUntil = undefined;
            await this.save();
        }
        return isMatch;
    }
    catch (error) {
        logger_1.logger.error(`Error comparing password for user ${this.email}:`, error);
        return false;
    }
};
// Create indexes
// userSchema.index({ phoneNumber: 1 }, { sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ facebookId: 1 }, { sparse: true });
userSchema.index({ linkedinId: 1 }, { sparse: true });
userSchema.index({ verificationToken: 1 }, { sparse: true });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });
userSchema.index({ otpData: 1 }, { sparse: true });
logger_1.logger.info('User model indexes created successfully');
exports.User = mongoose_1.default.model('Users', userSchema);
