/**
 * @file vault.model.ts
 * @description Vault System Models for Digital Asset Management
 * ========================================================
 *
 * This module defines the comprehensive Vault system that organizes
 * digital assets into three main categories:
 * 1. Wallet - Cards and financial instruments
 * 2. Documents - Files, receipts, forms, vouchers
 * 3. Media - Photos, videos, audio files
 *
 * @version 1.0.0
 * @author My Profile Server
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Base interfaces for vault items
export interface IVaultItemBase {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  category: 'wallet' | 'documents' | 'media';
  subcategory: string;
  name: string;
  description?: string;
  tags: string[];
  isEncrypted: boolean;
  isFavorite: boolean;
  accessLevel: 'private' | 'shared' | 'public';
  sharedWith: Types.ObjectId[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Wallet Item Types
export type WalletSubcategory =
  | 'identity-card'
  | 'residency-medical'
  | 'financial-cards'
  | 'myprofile-cards'
  | 'membership-loyalty'
  | 'passes-tickets'
  | 'discount-receipts'
  | 'other';

export type IdentityCardType = 'drivers-license' | 'passport' | 'identity-card' | 'other';
export type ResidencyMedicalType = 'resident-permit' | 'medical-card' | 'insurance-card' | 'other';
export type FinancialCardType = 'credit-card' | 'debit-card' | 'gift-card' | 'other';
export type MembershipType = 'loyalty-card' | 'membership-card' | 'business-card' | 'other';
export type PassTicketType = 'qrcode-card' | 'generic-pass' | 'boarding-pass' | 'event-ticket' | 'other';
export type DiscountType = 'voucher' | 'coupon' | 'receipt' | 'promo-code' | 'other';

export interface IWalletItem extends IVaultItemBase {
  category: 'wallet';
  subcategory: WalletSubcategory;
  cardType: IdentityCardType | ResidencyMedicalType | FinancialCardType | MembershipType | PassTicketType | DiscountType;

  // Card details
  cardNumber?: string; // Encrypted
  expiryDate?: Date;
  issuer?: string;
  holderName?: string;

  // Digital files
  frontImage?: string; // Cloudinary URL
  backImage?: string; // Cloudinary URL
  qrCode?: string; // For passes/tickets

  // Financial card specific
  cardNetwork?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFourDigits?: string;

  // Identity card specific
  documentNumber?: string; // Encrypted
  issuingCountry?: string;
  issuingAuthority?: string;

  // NFC Integration
  nfcCardId?: Types.ObjectId; // Links to NFC card if applicable

  // Status
  isActive: boolean;
  isExpired: boolean;

  // Security
  pinRequired: boolean;
  biometricRequired: boolean;
}

// Document Item Types
export type DocumentSubcategory = 'documents' | 'receipts' | 'forms' | 'vouchers' | 'other';

export interface IDocumentItem extends IVaultItemBase {
  category: 'documents';
  subcategory: DocumentSubcategory;

  // File information
  fileUrl: string; // Cloudinary URL
  fileName: string;
  fileType: string; // MIME type
  fileSize: number;

  // Document classification
  documentType: string; // 'contract', 'invoice', 'certificate', etc.
  issuedBy?: string;
  issuedDate?: Date;
  expiryDate?: Date;

  // OCR and searchable content
  extractedText?: string;
  ocrConfidence?: number;

  // Links to scans
  relatedScanId?: Types.ObjectId; // Links to existing scan records

  // Voucher/Promo specific
  promoCode?: string;
  discountValue?: string;
  discountType?: 'percentage' | 'fixed' | 'other';
  validUntil?: Date;

  // Status
  isUsed: boolean; // For vouchers/coupons
  usedAt?: Date;

  // Version control
  version: number;
  previousVersions: Types.ObjectId[];
}

// Media Item Types
export type MediaSubcategory = 'gallery' | 'videos' | 'audio' | 'other';
export type MediaType = 'image' | 'video' | 'audio';

export interface IMediaItem extends IVaultItemBase {
  category: 'media';
  subcategory: MediaSubcategory;
  mediaType: MediaType;

  // File information
  fileUrl: string; // Cloudinary URL
  fileName: string;
  fileType: string; // MIME type
  fileSize: number;

  // Media specific metadata
  duration?: number; // For video/audio in seconds
  dimensions?: {
    width: number;
    height: number;
  };

  // Thumbnail for videos
  thumbnailUrl?: string;

  // Location and time
  capturedAt?: Date;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  // Organization
  albumId?: Types.ObjectId;
  isProfilePicture: boolean;
  isCoverPhoto: boolean;

  // Processing status
  processingStatus: 'pending' | 'completed' | 'failed';
  cloudinaryPublicId: string;
}

// Vault Statistics
export interface IVaultStats {
  totalItems: number;
  walletItems: number;
  documentItems: number;
  mediaItems: number;
  encryptedItems: number;
  storageUsed: number; // in bytes
  lastActivity: Date;
}

// Schemas
const VaultItemBaseSchema = new Schema({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
  category: { type: String, enum: ['wallet', 'documents', 'media'], required: true, index: true },
  subcategory: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  tags: [{ type: String, trim: true }],
  isEncrypted: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
  accessLevel: {
    type: String,
    enum: ['private', 'shared', 'public'],
    default: 'private',
    index: true
  },
  sharedWith: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  discriminatorKey: 'category'
});

// Indexes for performance
VaultItemBaseSchema.index({ profileId: 1, category: 1, subcategory: 1 });
VaultItemBaseSchema.index({ profileId: 1, isFavorite: 1 });
VaultItemBaseSchema.index({ tags: 1 });
VaultItemBaseSchema.index({ createdAt: -1 });

// Base model
export const VaultItemModel = mongoose.model<IVaultItemBase>('VaultItem', VaultItemBaseSchema);

// Wallet Item Schema
const WalletItemSchema = new Schema({
  cardType: { type: String, required: true },
  cardNumber: { type: String }, // Will be encrypted
  expiryDate: { type: Date },
  issuer: { type: String, trim: true },
  holderName: { type: String, trim: true },
  frontImage: { type: String }, // Cloudinary URL
  backImage: { type: String }, // Cloudinary URL
  qrCode: { type: String },
  cardNetwork: {
    type: String,
    enum: ['visa', 'mastercard', 'amex', 'discover', 'other']
  },
  lastFourDigits: { type: String, maxlength: 4 },
  documentNumber: { type: String }, // Will be encrypted
  issuingCountry: { type: String, length: 2 }, // ISO country code
  issuingAuthority: { type: String, trim: true },
  nfcCardId: { type: Schema.Types.ObjectId, ref: 'NFCCard' },
  isActive: { type: Boolean, default: true },
  isExpired: { type: Boolean, default: false },
  pinRequired: { type: Boolean, default: false },
  biometricRequired: { type: Boolean, default: false }
});

// Document Item Schema
const DocumentItemSchema = new Schema({
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true, trim: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true, min: 0 },
  documentType: { type: String, trim: true },
  issuedBy: { type: String, trim: true },
  issuedDate: { type: Date },
  expiryDate: { type: Date },
  extractedText: { type: String },
  ocrConfidence: { type: Number, min: 0, max: 1 },
  relatedScanId: { type: Schema.Types.ObjectId, ref: 'Scan' },
  promoCode: { type: String, trim: true, uppercase: true },
  discountValue: { type: String },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'other']
  },
  validUntil: { type: Date },
  isUsed: { type: Boolean, default: false },
  usedAt: { type: Date },
  version: { type: Number, default: 1 },
  previousVersions: [{ type: Schema.Types.ObjectId, ref: 'VaultItem' }]
});

// Media Item Schema
const MediaItemSchema = new Schema({
  mediaType: {
    type: String,
    enum: ['image', 'video', 'audio'],
    required: true
  },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true, trim: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true, min: 0 },
  duration: { type: Number, min: 0 }, // seconds
  dimensions: {
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 }
  },
  thumbnailUrl: { type: String },
  capturedAt: { type: Date },
  location: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    address: { type: String, trim: true }
  },
  albumId: { type: Schema.Types.ObjectId, ref: 'Album' },
  isProfilePicture: { type: Boolean, default: false },
  isCoverPhoto: { type: Boolean, default: false },
  processingStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  cloudinaryPublicId: { type: String, required: true }
});

// Pre-save middleware for wallet items
WalletItemSchema.pre('save', function(this: IWalletItem) {
  // Check if card is expired
  if (this.expiryDate && this.expiryDate < new Date()) {
    this.isExpired = true;
  }

  // Extract last four digits if card number is provided
  if (this.cardNumber && !this.lastFourDigits) {
    this.lastFourDigits = this.cardNumber.slice(-4);
  }
});

// Pre-save middleware for document items
DocumentItemSchema.pre('save', function(this: IDocumentItem) {
  // Check if voucher/coupon is expired
  if (this.validUntil && this.validUntil < new Date() && this.subcategory === 'vouchers') {
    this.isUsed = true;
  }
});

// Create discriminator models
export const WalletItemModel = VaultItemModel.discriminator<IWalletItem>('wallet', WalletItemSchema);
export const DocumentItemModel = VaultItemModel.discriminator<IDocumentItem>('documents', DocumentItemSchema);
export const MediaItemModel = VaultItemModel.discriminator<IMediaItem>('media', MediaItemSchema);

// Album model for media organization
const AlbumSchema = new Schema({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  coverImageId: { type: Schema.Types.ObjectId, ref: 'VaultItem' },
  mediaCount: { type: Number, default: 0 },
  isPrivate: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, {
  timestamps: true
});

export interface IAlbum extends Document {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  name: string;
  description?: string;
  coverImageId?: Types.ObjectId;
  mediaCount: number;
  isPrivate: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export const AlbumModel = mongoose.model<IAlbum>('Album', AlbumSchema);

// Vault activity log
const VaultActivitySchema = new Schema({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: 'VaultItem', required: true },
  action: {
    type: String,
    enum: ['created', 'updated', 'deleted', 'viewed', 'shared', 'downloaded'],
    required: true
  },
  details: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String }
  }
}, {
  timestamps: true
});

VaultActivitySchema.index({ profileId: 1, createdAt: -1 });
VaultActivitySchema.index({ itemId: 1, createdAt: -1 });

export interface IVaultActivity extends Document {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  itemId: Types.ObjectId;
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'shared' | 'downloaded';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const VaultActivityModel = mongoose.model<IVaultActivity>('VaultActivity', VaultActivitySchema);

export default {
  VaultItemModel,
  WalletItemModel,
  DocumentItemModel,
  MediaItemModel,
  AlbumModel,
  VaultActivityModel
};
