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

export interface IProfile extends Document {
  name: string;
  description?: string;
  profileType: 'personal' | 'group' | 'community' | 'school' | 'business' | 'social';
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
  contact: IContact;
  skills: ISkill[];
  availability: IAvailability;
  analytics: IAnalytics;
  security: ISecurity;
  stats: IStats;
  socialLinks: ISocialLinks;
  connectionPreferences: IConnectionPreferences;
  settings: ISettings;
  badges: IBadge[];
  verifications: IVerifications;
  customization: ICustomization;
  calendar: {
    events: {
      id: string;
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      allDay: boolean;
      recurring?: {
        pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
        interval: number;
        endAfter?: number;
        endDate?: Date;
      };
      location?: {
        name: string;
        address: string;
        coordinates?: {
          lat: number;
          lng: number;
        };
        virtual?: boolean;
        meetingLink?: string;
      };
      attendees?: {
        userId: mongoose.Types.ObjectId;
        status: 'pending' | 'accepted' | 'declined';
        role: 'organizer' | 'attendee' | 'optional';
      }[];
      reminders: {
        type: 'email' | 'notification' | 'sms';
        before: number; // minutes
      }[];
      category?: string;
      visibility: 'public' | 'private' | 'connections';
    }[];
    availability: {
      workingHours: {
        day: number; // 0-6 for Sunday-Saturday
        start: string; // HH:mm format
        end: string;
        available: boolean;
      }[];
      timeZone: string;
      bufferTime: number; // minutes between meetings
      defaultMeetingDuration: number; // minutes
    };
  };
  portfolio: {
    projects: {
      id: string;
      title: string;
      description: string;
      shortDescription: string;
      thumbnail: string;
      images: string[];
      videos?: string[];
      category: string;
      tags: string[];
      technologies: string[];
      url?: string;
      githubUrl?: string;
      startDate: Date;
      endDate?: Date;
      status: 'in-progress' | 'completed' | 'on-hold';
      visibility: 'public' | 'private' | 'connections';
      collaborators?: {
        userId: mongoose.Types.ObjectId;
        role: string;
        contribution: string;
      }[];
      metrics?: {
        views: number;
        likes: number;
        shares: number;
      };
      featured: boolean;
    }[];
    skills: {
      category: string;
      name: string;
      level: number; // 1-5
      yearsOfExperience: number;
      certifications?: {
        name: string;
        issuer: string;
        date: Date;
        expiryDate?: Date;
        credentialUrl?: string;
        verified: boolean;
      }[];
      endorsements?: {
        userId: mongoose.Types.ObjectId;
        comment?: string;
        date: Date;
      }[];
    }[];
    resume: {
      education: {
        institution: string;
        degree: string;
        field: string;
        startDate: Date;
        endDate?: Date;
        grade?: string;
        activities?: string[];
        achievements?: string[];
        verified: boolean;
      }[];
      experience: {
        company: string;
        position: string;
        location: string;
        startDate: Date;
        endDate?: Date;
        current: boolean;
        description: string;
        achievements: string[];
        skills: string[];
        references?: {
          name: string;
          position: string;
          company: string;
          contact: string;
          verified: boolean;
        }[];
      }[];
      publications: {
        title: string;
        publisher: string;
        date: Date;
        url?: string;
        doi?: string;
        authors: string[];
        citations?: number;
        verified: boolean;
      }[];
    };
  };
  monetization: {
    services: {
      id: string;
      name: string;
      description: string;
      price: number;
      currency: string;
      duration?: number; // minutes
      availability: number; // slots available
      bookingWindow: {
        min: number; // minimum hours before
        max: number; // maximum days ahead
      };
      cancellationPolicy: {
        allowedUntil: number; // hours before
        refundPercentage: number;
      };
      requirements?: string[];
      tags: string[];
      category: string;
      visibility: 'public' | 'private' | 'connections';
    }[];
    products: {
      id: string;
      name: string;
      description: string;
      price: number;
      currency: string;
      inventory?: number;
      digital: boolean;
      downloadUrl?: string;
      shipping?: {
        weight: number;
        dimensions: {
          length: number;
          width: number;
          height: number;
        };
        restrictions?: string[];
      };
      variations?: {
        name: string;
        options: {
          name: string;
          price: number;
          inventory?: number;
        }[];
      }[];
    }[];
    subscriptions: {
      id: string;
      name: string;
      description: string;
      price: number;
      currency: string;
      interval: 'monthly' | 'yearly';
      features: string[];
      trialDays?: number;
      active: boolean;
    }[];
    donations: {
      enabled: boolean;
      suggestedAmounts: number[];
      minimumAmount: number;
      currency: string;
      goals?: {
        id: string;
        title: string;
        description: string;
        amount: number;
        currentAmount: number;
        deadline?: Date;
        completed: boolean;
      }[];
    };
  };
  personalInfo?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    languages?: string[];
  };
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
  };
  socialInfo?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  professionalInfo?: {
    title?: string;
    company?: string;
    industry?: string;
    skills?: string[];
    experience?: string;
  };
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

// Create the Mongoose schema
const profileSchema = new Schema<IProfile>(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    profileType: {
      type: String,
      required: true,
      enum: ['personal', 'group', 'community', 'school', 'business', 'social'],
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
    contact: {
      email: String,
      phone: String,
      address: {
        street: String,
        city: String,
        country: String,
        verified: { type: Boolean, default: false },
        verifiedAt: Date,
      },
      socialLinks: { type: Map, of: String },
    },
    skills: [{
      name: String,
      level: {
        type: String,
        enum: ['beginner', 'intermediate', 'expert'],
      },
      endorsements: { type: Number, default: 0 },
    }],
    availability: {
      status: {
        type: String,
        enum: ['available', 'busy', 'away'],
        default: 'available',
      },
      bookingLink: String,
      workHours: { type: Map, of: [String] },
    },
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
      },
    },
    socialLinks: {
      website: String,
      facebook: String,
      twitter: String,
      instagram: String,
      linkedin: String,
      github: String,
      youtube: String,
      tiktok: String,
    },
    connectionPreferences: {
      allowFollowers: { type: Boolean, default: true },
      allowEmployment: { type: Boolean, default: true },
      allowDonations: { type: Boolean, default: false },
      allowCollaboration: { type: Boolean, default: true },
      minimumDonation: Number,
      employmentTypes: [String],
      collaborationTypes: [String],
      connectionPrivacy: {
        type: String,
        enum: ['public', 'private', 'mutual'],
        default: 'public',
      },
      connectionApproval: {
        type: String,
        enum: ['automatic', 'manual', 'verified-only'],
        default: 'automatic',
      },
    },
    settings: {
      visibility: {
        type: String,
        enum: ['public', 'private', 'connections'],
        default: 'public',
      },
      allowComments: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: true },
      autoAcceptConnections: { type: Boolean, default: false },
      emailNotifications: {
        connections: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        comments: { type: Boolean, default: true },
        mentions: { type: Boolean, default: true },
        updates: { type: Boolean, default: true },
      },
      language: { type: String, default: 'en' },
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      accessibility: {
        highContrast: { type: Boolean, default: false },
        fontSize: {
          type: String,
          enum: ['small', 'medium', 'large'],
          default: 'medium',
        },
        reduceMotion: { type: Boolean, default: false },
      },
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
    personalInfo: {
      firstName: String,
      lastName: String,
      dateOfBirth: String,
      gender: String,
      nationality: String,
      languages: [String],
    },
    contactInfo: {
      email: String,
      phone: String,
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
      },
    },
    socialInfo: {
      linkedin: String,
      twitter: String,
      website: String,
    },
    professionalInfo: {
      title: String,
      company: String,
      industry: String,
      skills: [String],
      experience: String,
    },
   
  },
  {
    timestamps: true,
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

// Create and export the model
export const ProfileModel = mongoose.model<IProfile>('Profile', profileSchema);
