import mongoose, { Document } from 'mongoose';
import { IMyPts } from './my-pts.interface';


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

export interface ISkill {
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
export interface IProfileMethods {
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
  // MyPts methods
  getMyPts(): Promise<IMyPts>;
  getMyPtsValue(currency?: string): Promise<{
    balance: number;
    valuePerPts: number;
    currency: string;
    symbol: string;
    totalValue: number;
    formattedValue: string;
  }>;
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
  accessToken?: string;
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
  // MyPts related fields
  myPtsBalance?: number; // Quick access to points balance
  // Link to new profile model
  newProfileId?: mongoose.Types.ObjectId; // Reference to the new profile model
}
