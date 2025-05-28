// Profile type definitions
import { Document } from 'mongoose';

// Base Profile Interface
interface BaseProfile {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  visibility: 'public' | 'private' | 'connections' | 'family';
}

// Individual Profile
export interface IndividualProfile extends BaseProfile {
  type: 'individual';
  personalInfo: {
    name: {
      first: string;
      last: string;
      middle?: string;
      preferred?: string;
    };
    dateOfBirth?: Date;
    gender?: string;
    biography?: string;
    interests?: string[];
  };
  professional?: {
    title?: string;
    company?: string;
    skills?: string[];
    experience?: {
      company: string;
      title: string;
      period: {
        start: Date;
        end?: Date;
      };
      description?: string;
    }[];
  };
}

// Family Profile
export interface FamilyProfile extends BaseProfile {
  type: 'family';
  familyName: string;
  members: {
    profileId: string;
    role: 'parent' | 'child' | 'spouse' | 'sibling' | 'other';
    permissions: ('view' | 'edit' | 'admin')[];
  }[];
  events: {
    id: string;
    type: 'birthday' | 'anniversary' | 'custom';
    date: Date;
    description: string;
  }[];
  traditions?: string[];
  familyPhotos?: {
    id: string;
    url: string;
    caption?: string;
    date: Date;
  }[];
}

// Community Profile
export interface CommunityProfile extends BaseProfile {
  type: 'community';
  name: string;
  description: string;
  category: string;
  members: {
    profileId: string;
    role: 'admin' | 'moderator' | 'member';
    joinedAt: Date;
  }[];
  rules?: string[];
  events?: {
    id: string;
    title: string;
    description: string;
    date: Date;
    location?: string;
  }[];
  discussions?: {
    id: string;
    title: string;
    content: string;
    author: string;
    createdAt: Date;
    comments?: {
      id: string;
      content: string;
      author: string;
      createdAt: Date;
    }[];
  }[];
}

// Group Profile
export interface GroupProfile extends BaseProfile {
  type: 'group';
  name: string;
  purpose: string;
  members: {
    profileId: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Date;
  }[];
  projects?: {
    id: string;
    name: string;
    description: string;
    status: 'planned' | 'active' | 'completed';
    members: string[];
  }[];
  resources?: {
    id: string;
    type: 'document' | 'link' | 'media';
    title: string;
    url: string;
    uploadedBy: string;
    uploadedAt: Date;
  }[];
}

// Biometric Authentication
export interface BiometricData {
  id: string;
  userId: string;
  type: 'fingerprint' | 'face' | 'voice';
  data: string; // encrypted biometric data
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

// Activity Audit Log
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: 'profile' | 'document' | 'message' | 'connection' | 'group' | 'community';
  entityId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

// Real-time Features
export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  attachments?: {
    id: string;
    type: 'image' | 'document' | 'voice';
    url: string;
  }[];
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'connection' | 'mention' | 'event' | 'system';
  title: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  action?: {
    type: string;
    url: string;
  };
}

// Analytics
export interface ProfileAnalytics {
  profileId: string;
  views: {
    total: number;
    unique: number;
    byDate: {
      date: Date;
      count: number;
    }[];
  };
  connections: {
    total: number;
    pending: number;
    byIndustry?: {
      industry: string;
      count: number;
    }[];
  };
  engagement: {
    messages: number;
    reactions: number;
    comments: number;
    shares: number;
  };
  demographics?: {
    locations: {
      country: string;
      count: number;
    }[];
    industries: {
      name: string;
      count: number;
    }[];
  };
}

// Document Sharing
export interface SharedDocument {
  id: string;
  ownerId: string;
  type: 'document' | 'presentation' | 'spreadsheet' | 'image' | 'other';
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  lastModified: Date;
  permissions: {
    profileId: string;
    access: 'view' | 'edit' | 'comment';
    grantedAt: Date;
    grantedBy: string;
  }[];
  version: number;
  versions?: {
    number: number;
    url: string;
    modifiedAt: Date;
    modifiedBy: string;
  }[];
}

export interface ProfileFilter {
  country?: string;
  city?: string;
  stateOrProvince?: string;
  town?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // in kilometers
  profileType?: string;      // e.g. 'academic', 'professional', 'interest', etc.
  accessType?: string;       // e.g. 'private', 'free', 'paid'
  createdBy?: string;        // user or profile ID
  viewed?: 'viewed' | 'not_viewed';
  tag?: string;              // e.g. 'social', 'digital', 'formal', etc.
  verificationStatus?: 'verified' | 'not_verified';
  creationDate?: 'last_24_hours' | 'last_7_days' | 'last_30_days' | 'last_365_days';
  groupId?: string;
  memberId?: string;
  keyword?: string;
  sortBy?: 'name' | 'createdAt' | 'members' | 'groups';
  sortOrder?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}
