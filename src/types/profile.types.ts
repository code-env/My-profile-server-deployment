import { Types } from 'mongoose';

export interface Name {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  title?: string;
  preferred?: string;
  nickname?: string;
  maidenName?: string;
}

export interface Gallery {
  name: string;
  description?: string;
  coverImage?: string;
  isPublic: boolean;
  items: {
    type: 'image' | 'video' | 'document';
    url: string;
    thumbnail?: string;
    title?: string;
    description?: string;
    metadata?: Record<string, any>;
    uploadedAt: Date;
  }[];
}

export interface KYCVerification {
  status: 'pending' | 'verified' | 'rejected';
  submittedAt?: Date;
  verifiedAt?: Date;
  rejectionReason?: string;
  documents: {
    type: string;
    url: string;
    status: 'pending' | 'verified' | 'rejected';
    submittedAt: Date;
    verifiedAt?: Date;
  }[];
}

export interface ConnectionPreferences {
  allowFollowers: boolean;
  allowEmployment: boolean;
  allowDonations: boolean;
  allowCollaboration: boolean;
  minimumDonation?: number;
  employmentTypes?: string[];
  collaborationTypes?: string[];
}

export interface ProfileStats {
  followers: number;
  donations: number;
  employmentRequests: number;
  collaborationRequests: number;
}

export interface SocialLinks {
  website?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
}

export interface ProfileSettings {
  visibility: 'public' | 'private' | 'restricted';
  allowComments: boolean;
  allowMessages: boolean;
  autoAcceptConnections: boolean;
}

export interface PersonalInfo {
  name?: Name;
  dateOfBirth?: Date;
  gender?: string;
  countryOfResidence?: string;
  about?: string;
  interests?: string[];
  inspirationalQuote?: string;
  website?: string;
  biography?: string;
  needs?: string[];
  partners?: string[];
  family?: {
    members?: {
      name: string;
      relationship: string;
    }[];
  };
  gallery?: {
    images: string[];
  };
}

export interface ProfileCard {
  images?: {
    main?: string;
    thumbnail?: string;
  };
  color?: {
    primary?: string;
    secondary?: string;
  };
  style?: {
    template?: string;
    layout?: string;
  };
}

export interface SocialInfo {
  socialMedia?: {
    platforms: {
      name: string;
      username: string;
      url: string;
    }[];
  };
  celebrations?: {
    dates: {
      occasion: string;
      date: string;
    }[];
  };
  insurance?: {
    provider: string;
    policyNumber: string;
    type: string;
  }[];
  paymentsAndPayout?: {
    preferredMethod: string;
    paymentDetails: Record<string, string>;
  };
  affiliations?: {
    organizations: {
      name: string;
      role: string;
      period: string;
    }[];
  };
}

export interface Profile {
  id: Types.ObjectId;
  userId: string;
  profileType: string;
  personalInfo: PersonalInfo;
  contactInfo: ContactInfo;
  socialInfo: SocialInfo;
  profileCard: ProfileCard;
  galleries: Gallery[];
  kycVerification: KYCVerification;
  connectionPreferences: ConnectionPreferences;
  stats: ProfileStats;
  socialLinks: SocialLinks;
  settings: ProfileSettings;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any; // Index signature added
}
