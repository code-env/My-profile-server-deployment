import { Document } from 'mongoose';
import { IUser } from '../models/User';
import { ProfileDocument } from '../models/profile.model';

/**
 * Interface for combined user and profile data
 * Used for admin views where both user and profile information is needed
 */
export interface ICombinedUserProfile {
  // User information
  user: {
    _id: string;
    email: string;
    fullName: string;
    username: string;
    dateOfBirth: Date;
    countryOfResidence: string;
    phoneNumber: string;
    formattedPhoneNumber?: string;
    accountType: 'MYSELF' | 'SOMEONE_ELSE';
    accountCategory: 'PRIMARY_ACCOUNT' | 'SECONDARY_ACCOUNT';
    verificationMethod: 'PHONE' | 'EMAIL';
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    signupType: 'email' | 'google' | 'facebook' | 'linkedin';
    role: 'superadmin' | 'admin' | 'user';
    subscription: {
      plan: string;
      features: string[];
      limitations: {
        maxProfiles: number;
        maxGalleryItems: number;
        maxFollowers: number;
      };
      startDate: Date;
    };
    mpts: number;
    profileImage?: string;
    referralCode?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  
  // Profile information
  profile: {
    _id: string;
    secondaryId?: string;
    profileCategory: string;
    profileType: string;
    profileInformation: {
      username: string;
      profileLink: string;
      title?: string;
      creator: string;
      connectLink: string;
      followLink: string;
      createdAt: Date;
      updatedAt: Date;
    };
    ProfileFormat: {
      profileImage?: string;
      customization?: {
        theme?: {
          primaryColor?: string;
          secondaryColor?: string;
          accent?: string;
          background?: string;
          text?: string;
          font?: string;
        };
      };
      updatedAt: Date;
    };
    profileLocation?: {
      country?: string;
      countryCode?: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
    verificationStatus?: {
      isVerified: boolean;
      badge: string;
    };
    ProfileMypts?: {
      currentBalance: number;
      lifetimeMypts: number;
    };
    ProfileReferal?: {
      referalLink?: string;
      referals: number;
    };
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Interface for combined user and profile data with pagination
 */
export interface ICombinedUserProfileResponse {
  success: boolean;
  data: ICombinedUserProfile[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
