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
exports.AcademicProfile = exports.MedicalProfile = exports.BusinessProfile = exports.PersonalProfile = exports.ProfileModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const qrcode_1 = __importDefault(require("qrcode"));
// Base interfaces without Document extension
// Create the Mongoose schema with discriminator key
const profileSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    profileType: {
        type: String,
        required: true,
        enum: ['personal', 'business', 'medical', 'academic'],
        index: true,
    },
    profileCategory: {
        type: String,
        required: true,
        enum: ['Functional', 'Group', 'Individual', 'academic',],
        index: true,
    },
    owner: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    managers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    claimPhrase: { type: String, sparse: true, unique: true },
    claimed: { type: Boolean, default: false, index: true },
    claimedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    claimedAt: { type: Date },
    claimExpiresAt: { type: Date },
    profileImage: String,
    coverImage: String,
    qrCode: String,
    connectLink: { type: String, required: true, unique: true, index: true },
    verificationStatus: {
        isVerified: { type: Boolean, default: false },
        badge: {
            type: String,
            enum: ['blue_tick', 'gold_tick', 'none'],
            default: 'none',
        },
        verifiedAt: Date,
    },
    kycVerification: {
        status: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending',
        },
        submittedAt: Date,
        verifiedAt: Date,
        expiresAt: Date,
        documents: [{
                type: {
                    type: String,
                    enum: ['government_id', 'proof_of_address', 'business_registration'],
                },
                subType: String,
                documentNumber: String,
                issuingCountry: String,
                documentUrl: String,
                status: {
                    type: String,
                    enum: ['pending', 'verified', 'rejected'],
                    default: 'pending',
                },
                submittedAt: Date,
                verifiedAt: Date,
            }],
        verificationLevel: {
            type: String,
            enum: ['basic', 'full', 'enhanced'],
            default: 'basic',
        },
        rejectionReason: String,
    },
    linkedDevices: [{
            deviceId: String,
            permissions: [{
                    type: String,
                    enum: ['view', 'edit', 'share'],
                }],
            addedAt: Date,
            healthMetrics: {
                enabled: { type: Boolean, default: false },
                syncFrequency: {
                    type: String,
                    enum: ['realtime', 'hourly', 'daily'],
                    default: 'daily',
                },
                lastSync: Date,
                metrics: [String],
            },
        }],
    galleries: [{
            name: { type: String, required: true },
            description: String,
            coverImage: String,
            isPublic: { type: Boolean, default: false },
            items: [{
                    type: {
                        type: String,
                        enum: ['image', 'video', 'document'],
                        required: true,
                    },
                    url: { type: String, required: true },
                    thumbnail: String,
                    title: String,
                    description: String,
                    metadata: mongoose_1.Schema.Types.Mixed,
                    uploadedAt: { type: Date, default: Date.now },
                }],
        }],
    analytics: {
        views: { type: Number, default: 0 },
        connections: { type: Number, default: 0 },
        engagement: { type: Number, default: 0 },
    },
    security: {
        twoFactorRequired: { type: Boolean, default: false },
        ipWhitelist: [String],
        lastSecurityAudit: Date,
    },
    stats: {
        type: {
            followers: { type: Number, default: 0 },
            following: { type: Number, default: 0 },
            donations: { type: Number, default: 0 },
            employmentRequests: { type: Number, default: 0 },
            collaborationRequests: { type: Number, default: 0 },
            totalViews: { type: Number, default: 0 },
            monthlyViews: { type: Number, default: 0 },
            engagement: { type: Number, default: 0 },
        },
        default: {
            followers: 0,
            following: 0,
            donations: 0,
            employmentRequests: 0,
            collaborationRequests: 0,
            totalViews: 0,
            monthlyViews: 0,
            engagement: 0,
        }
    },
    badges: [{
            id: String,
            name: String,
            description: String,
            icon: String,
            earnedAt: Date,
            category: String,
        }],
    verifications: {
        email: { type: Boolean, default: false },
        phone: { type: Boolean, default: false },
        identity: { type: Boolean, default: false },
        professional: { type: Boolean, default: false },
        social: [{
                platform: String,
                verified: { type: Boolean, default: false },
                verifiedAt: Date,
            }],
    },
    customization: {
        theme: {
            primary: String,
            secondary: String,
            accent: String,
            background: String,
            text: String,
        },
        layout: {
            sections: [{
                    id: String,
                    type: String,
                    order: Number,
                    visible: { type: Boolean, default: true },
                }],
            widgets: [{
                    id: String,
                    type: String,
                    position: {
                        type: String,
                        enum: ['sidebar', 'main', 'header', 'footer'],
                    },
                    config: mongoose_1.Schema.Types.Mixed,
                    visible: { type: Boolean, default: true },
                }],
        },
    },
    connections: {
        connected: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' }],
        followers: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' }],
        following: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' }],
        lastConnections: [{
                user: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
                connectionType: String,
                connectedAt: { type: Date, default: Date.now }
            }],
    },
    privacySettings: {
        visibility: {
            type: String,
            enum: ['public', 'private', 'connections'],
            default: 'public'
        },
        searchable: {
            type: Boolean,
            default: true
        },
        showContactInfo: {
            type: Boolean,
            default: false
        },
        showSocialLinks: {
            type: Boolean,
            default: true
        }
    },
}, {
    timestamps: true,
    discriminatorKey: 'profileType'
});
// Indexes for better query performance
profileSchema.index({ name: 'text', description: 'text' });
profileSchema.index({ 'stats.followers': -1 });
profileSchema.index({ 'stats.engagement': -1 });
profileSchema.index({ createdAt: -1 });
profileSchema.index({ 'verifications.email': 1, 'verifications.phone': 1 });
// Instance methods
profileSchema.methods.generateQRCode = async function () {
    if (!this.connectLink) {
        throw new Error('Connect link is required to generate QR code');
    }
    try {
        this.qrCode = await qrcode_1.default.toDataURL(this.connectLink);
        return this.qrCode;
    }
    catch (error) {
        throw new Error(`Failed to generate QR code: ${error.message}`);
    }
};
profileSchema.methods.isVerified = function () {
    return this.verificationStatus.isVerified;
};
profileSchema.methods.calculateEngagement = function () {
    const views = this.stats.totalViews || 0;
    const connections = this.stats.followers || 0;
    const interactions = (this.stats.employmentRequests || 0) + (this.stats.collaborationRequests || 0);
    // Simple engagement calculation formula
    return Math.round((views + connections * 2 + interactions * 3) / 100);
};
profileSchema.methods.getPublicProfile = function () {
    const publicProfile = this.toObject();
    // Remove sensitive information
    delete publicProfile.security;
    delete publicProfile.kycVerification;
    delete publicProfile.claimPhrase;
    delete publicProfile.settings.emailNotifications;
    return publicProfile;
};
profileSchema.methods.getAvailableSlots = async function (startDate, endDate) {
    // TO DO: implement logic to get available slots
    return [];
};
profileSchema.methods.checkAvailability = async function (startTime, endTime) {
    // TO DO: implement logic to check availability
    return true;
};
profileSchema.methods.getFeaturedProjects = async function (limit) {
    // TO DO: implement logic to get featured projects
    return [];
};
profileSchema.methods.getSkillsByCategory = async function () {
    // TO DO: implement logic to get skills by category
    return {};
};
profileSchema.methods.calculateEarnings = async function (startDate, endDate) {
    // TO DO: implement logic to calculate earnings
    return { total: 0, breakdown: { services: 0, products: 0, subscriptions: 0, donations: 0 } };
};
profileSchema.methods.checkServiceAvailability = async function (serviceId, date) {
    // TO DO: implement logic to check service availability
    return { available: true };
};
profileSchema.methods.generateThemeCSS = function () {
    // TO DO: implement logic to generate theme CSS
    return '';
};
profileSchema.methods.trackPageView = async function (country, device) {
    // TO DO: implement logic to track page view
};
profileSchema.methods.validateServiceBooking = function (serviceId, date, options) {
    // TO DO: implement logic to validate service booking
    return true;
};
profileSchema.methods.addEndorsement = async function (skillId, userId, comment) {
    // TO DO: implement logic to add endorsement
    return true;
};
profileSchema.methods.addRecurringEvent = async function (eventData) {
    // TO DO: implement logic to add recurring event
    return true;
};
// Middleware
profileSchema.pre('save', async function (next) {
    if (this.isModified('connectLink')) {
        try {
            await this.generateQRCode();
        }
        catch (error) {
            // Explicitly handle the error and pass a valid error type
            if (error instanceof Error) {
                next(error);
            }
            else {
                next(new Error('Unknown error occurred while generating QR code'));
            }
        }
    }
    next();
});
// Create the base model
exports.ProfileModel = mongoose_1.default.model('Profile', profileSchema);
// Register discriminators for different profile types
const personal_profile_1 = __importDefault(require("./profile-types/personal-profile"));
const business_profile_1 = __importDefault(require("./profile-types/business-profile"));
const medical_profile_1 = __importDefault(require("./profile-types/medical-profile"));
const academic_profile_1 = __importDefault(require("./profile-types/academic-profile"));
// Create and export discriminator models
exports.PersonalProfile = exports.ProfileModel.discriminator('personal', personal_profile_1.default);
exports.BusinessProfile = exports.ProfileModel.discriminator('business', business_profile_1.default);
exports.MedicalProfile = exports.ProfileModel.discriminator('medical', medical_profile_1.default);
exports.AcademicProfile = exports.ProfileModel.discriminator('academic', academic_profile_1.default);
