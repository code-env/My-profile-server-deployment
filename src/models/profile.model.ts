import mongoose, { Document, Schema, Model } from 'mongoose';
import QRCode from 'qrcode';
import { config } from '../config/config';

// Define ProfileDocument type
export type ProfileDocument = IProfile & Document;

// Base interfaces without Document extension
interface IVerificationStatus {
  isVerified: boolean;
  badge: 'blue_tick' | 'gold_tick' | 'none';
  verifiedAt?: Date;
}

interface IKYCDocument {
  type: 'government_id' | 'proof_of_address' | 'business_registration';
  subType: string;
  documentNumber?: string;
  issuingCountry?: string;
  documentUrl: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: Date;
  verifiedAt?: Date;
}

interface IKYCVerification {
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: Date;
  verifiedAt?: Date;
  expiresAt?: Date;
  documents: IKYCDocument[];
  verificationLevel: 'basic' | 'full' | 'enhanced';
  rejectionReason?: string;
}

interface ILinkedDevice {
  deviceId: string;
  permissions: Array<'view' | 'edit' | 'share'>;
  addedAt: Date;
  healthMetrics?: {
    enabled: boolean;
    syncFrequency: 'realtime' | 'hourly' | 'daily';
    lastSync: Date;
    metrics: string[];
  };
}

interface IGalleryItem {
  type: 'image' | 'video' | 'document';
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
  uploadedAt: Date;
}

interface IGallery {
  name: string;
  description?: string;
  coverImage?: string;
  isPublic: boolean;
  items: IGalleryItem[];
}

interface IContact {
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    country: string;
    verified: boolean;
    verifiedAt?: Date;
  };
  socialLinks: Record<string, string>;
}

interface ISkill {
  name: string;
  level: 'beginner' | 'intermediate' | 'expert';
  endorsements: number;
}

interface IAvailability {
  status: 'available' | 'busy' | 'away';
  bookingLink?: string;
  workHours: Record<string, string[]>;
}

interface IAnalytics {
  views: number;
  connections: number;
  engagement: number;
}

interface ISecurity {
  twoFactorRequired: boolean;
  ipWhitelist: string[];
  lastSecurityAudit: Date;
}

interface IStats {
  followers: number;
  following: number;
  donations: number;
  employmentRequests: number;
  collaborationRequests: number;
  totalViews: number;
  monthlyViews: number;
  engagement: number;
}

interface ISocialLinks {
  website?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  github?: string;
  youtube?: string;
  tiktok?: string;
}

interface IConnectionPreferences {
  allowFollowers: boolean;
  allowEmployment: boolean;
  allowDonations: boolean;
  allowCollaboration: boolean;
  minimumDonation?: number;
  employmentTypes?: string[];
  collaborationTypes?: string[];
  connectionPrivacy: 'public' | 'private' | 'mutual';
  connectionApproval: 'automatic' | 'manual' | 'verified-only';
}

interface ISettings {
  visibility: 'public' | 'private' | 'connections';
  allowComments: boolean;
  allowMessages: boolean;
  autoAcceptConnections: boolean;
  emailNotifications: {
    connections: boolean;
    messages: boolean;
    comments: boolean;
    mentions: boolean;
    updates: boolean;
  };
  language: string;
  theme: 'light' | 'dark' | 'system';
  accessibility: {
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
    reduceMotion: boolean;
  };
}

interface IBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date;
  category: string;
}

interface IVerifications {
  email: boolean;
  phone: boolean;
  identity: boolean;
  professional: boolean;
  social: Array<{
    platform: string;
    verified: boolean;
    verifiedAt?: Date;
  }>;
}

interface ICustomization {
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    customCSS?: string;
  };
  layout: {
    sections: Array<{
      id: string;
      type: string;
      order: number;
      visible: boolean;
      customization?: Record<string, any>;
    }>;
    widgets: Array<{
      id: string;
      type: string;
      position: 'sidebar' | 'main' | 'header' | 'footer';
      config: Record<string, any>;
      visible: boolean;
    }>;
  };
}

// Define interface for instance methods
interface IProfileMethods {
  generateQRCode(): Promise<string>;
  isVerified(): boolean;
  calculateEngagement(): number;
  getPublicProfile(): Partial<IProfile>;
  getAvailableSlots(startDate: Date, endDate: Date): Promise<Array<{ start: Date; end: Date }>>;
  checkAvailability(startTime: Date, endTime: Date): Promise<boolean>;
  getFeaturedProjects(limit?: number): Promise<any[]>;
  getSkillsByCategory(): Promise<Record<string, ISkill[]>>;
  calculateEarnings(startDate: Date, endDate: Date): Promise<{
    total: number;
    breakdown: {
      services: number;
      products: number;
      subscriptions: number;
      donations: number;
    };
  }>;
  checkServiceAvailability(serviceId: string, date: Date): Promise<{
    available: boolean;
    nextAvailable?: Date;
    slots?: Array<{ start: Date; end: Date }>;
  }>;
  generateThemeCSS(): string;
  trackPageView(country: string, device: string): Promise<void>;
  validateServiceBooking(serviceId: string, date: Date, options: Record<string, any>): boolean;
  addEndorsement(skillId: string, userId: mongoose.Types.ObjectId, comment?: string): Promise<boolean>;
  addRecurringEvent(eventData: any): Promise<boolean>;
}

export interface IProfile extends Document, IProfileMethods {
  name: string;
  description?: string;
  profileType: 'personal' | 'business' | 'medical' | 'academic';
  profileCategory:'Functional' | 'Individual' | 'Group',
  owner: mongoose.Types.ObjectId;
  managers: mongoose.Types.ObjectId[];
  claimPhrase?: string;
  claimed: boolean;
  claimedBy?: mongoose.Types.ObjectId;
  claimedAt?: Date;
  claimExpiresAt?: Date;
  profileImage?: string;
  coverImage?: string;
  qrCode?: string;
  connectLink: string;
  verificationStatus: IVerificationStatus;
  kycVerification: IKYCVerification;
  linkedDevices: ILinkedDevice[];
  galleries: IGallery[];
  // Core fields that apply to all profiles
  analytics: IAnalytics;
  security: ISecurity;
  stats: IStats;
  settings: ISettings;
  badges: IBadge[];
  verifications: IVerifications;
  customization: ICustomization;
  connections: {
    connected: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastConnections: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      connectionType: String,
      connectedAt: { type: Date, default: Date }
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
}

// Create the Mongoose schema with discriminator key
const profileSchema = new Schema<IProfile>(
  {
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
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    managers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    claimPhrase: { type: String, sparse: true, unique: true },
    claimed: { type: Boolean, default: false, index: true },
    claimedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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
        metadata: Schema.Types.Mixed,
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
          config: Schema.Types.Mixed,
          visible: { type: Boolean, default: true },
        }],
      },
    },
    connections: {
      connected: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      lastConnections: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

  },
  {
    timestamps: true,
    discriminatorKey: 'profileType'
  }
);

// Indexes for better query performance
profileSchema.index({ name: 'text', description: 'text' });
profileSchema.index({ 'stats.followers': -1 });
profileSchema.index({ 'stats.engagement': -1 });
profileSchema.index({ createdAt: -1 });
profileSchema.index({ 'verifications.email': 1, 'verifications.phone': 1 });

// Instance methods
profileSchema.methods.generateQRCode = async function(): Promise<string> {
  if (!this.connectLink) {
    throw new Error('Connect link is required to generate QR code');
  }
  try {
    this.qrCode = await QRCode.toDataURL(this.connectLink);
    return this.qrCode;
  } catch (error:any) {
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
};

profileSchema.methods.isVerified = function(): boolean {
  return this.verificationStatus.isVerified;
};

profileSchema.methods.calculateEngagement = function(): number {
  const views = this.stats.totalViews || 0;
  const connections = this.stats.followers || 0;
  const interactions = (this.stats.employmentRequests || 0) + (this.stats.collaborationRequests || 0);

  // Simple engagement calculation formula
  return Math.round((views + connections * 2 + interactions * 3) / 100);
};

profileSchema.methods.getPublicProfile = function(): Partial<IProfile> {
  const publicProfile = this.toObject();

  // Remove sensitive information
  delete publicProfile.security;
  delete publicProfile.kycVerification;
  delete publicProfile.claimPhrase;
  delete publicProfile.settings.emailNotifications;

  return publicProfile;
};

profileSchema.methods.getAvailableSlots = async function(startDate: Date, endDate: Date): Promise<Array<{ start: Date; end: Date }>> {
  // TO DO: implement logic to get available slots
  return [];
};

profileSchema.methods.checkAvailability = async function(startTime: Date, endTime: Date): Promise<boolean> {
  // TO DO: implement logic to check availability
  return true;
};

profileSchema.methods.getFeaturedProjects = async function(limit?: number): Promise<any[]> {
  // TO DO: implement logic to get featured projects
  return [];
};

profileSchema.methods.getSkillsByCategory = async function(): Promise<Record<string, ISkill[]>> {
  // TO DO: implement logic to get skills by category
  return {};
};

profileSchema.methods.calculateEarnings = async function(startDate: Date, endDate: Date): Promise<{
  total: number;
  breakdown: {
    services: number;
    products: number;
    subscriptions: number;
    donations: number;
  };
}> {
  // TO DO: implement logic to calculate earnings
  return { total: 0, breakdown: { services: 0, products: 0, subscriptions: 0, donations: 0 } };
};

profileSchema.methods.checkServiceAvailability = async function(serviceId: string, date: Date): Promise<{
  available: boolean;
  nextAvailable?: Date;
  slots?: Array<{ start: Date; end: Date }>;
}> {
  // TO DO: implement logic to check service availability
  return { available: true };
};

profileSchema.methods.generateThemeCSS = function(): string {
  // TO DO: implement logic to generate theme CSS
  return '';
};

profileSchema.methods.trackPageView = async function(country: string, device: string): Promise<void> {
  // TO DO: implement logic to track page view
};

profileSchema.methods.validateServiceBooking = function(serviceId: string, date: Date, options: Record<string, any>): boolean {
  // TO DO: implement logic to validate service booking
  return true;
};

profileSchema.methods.addEndorsement = async function(skillId: string, userId: mongoose.Types.ObjectId, comment?: string): Promise<boolean> {
  // TO DO: implement logic to add endorsement
  return true;
};

profileSchema.methods.addRecurringEvent = async function(eventData: any): Promise<boolean> {
  // TO DO: implement logic to add recurring event
  return true;
};

// Middleware
profileSchema.pre('save', async function(next) {
  if (this.isModified('connectLink')) {
    try {
      await this.generateQRCode();
    } catch (error: unknown) {
      // Explicitly handle the error and pass a valid error type
      if (error instanceof Error) {
        next(error);
      } else {
        next(new Error('Unknown error occurred while generating QR code'));
      }
    }
  }
  next();
});

// Define interface for model type
export interface IProfileModel extends Model<IProfile, {}, IProfileMethods> {}


// Create the base model
export const ProfileModel = mongoose.model<IProfile, IProfileModel>('Profile', profileSchema);

// Create discriminator model types
export type PersonalProfileModel = Model<IProfile & {subtype: 'Personal'}>;
export type BusinessProfileModel = Model<IProfile & {subtype: 'Business'}>;
export type MedicalProfileModel = Model<IProfile & {subtype: 'Medical'}>;
export type AcademicProfileModel = Model<IProfile & {subtype: 'Academic'}>;


// Register discriminators for different profile types
import PersonalProfileSchema from './profile-types/personal-profile';
import BusinessProfileSchema from './profile-types/business-profile';
import MedicalProfileSchema from './profile-types/medical-profile';
import AcademicProfileSchema from './profile-types/academic-profile';
import { IProfile, ISkill, IProfileMethods } from '../interfaces/profile.interface';

// Create and export discriminator models
export const PersonalProfile = ProfileModel.discriminator<IProfile & {subtype: 'Personal'}>('personal', PersonalProfileSchema) as PersonalProfileModel;
export const BusinessProfile = ProfileModel.discriminator<IProfile & {subtype: 'Business'}>('business', BusinessProfileSchema) as BusinessProfileModel;
export const MedicalProfile = ProfileModel.discriminator<IProfile & {subtype: 'Medical'}>('medical', MedicalProfileSchema) as MedicalProfileModel;
export const AcademicProfile = ProfileModel.discriminator<IProfile & {subtype: 'Academic'}>('academic', AcademicProfileSchema) as AcademicProfileModel;
