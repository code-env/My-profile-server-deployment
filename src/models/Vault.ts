import { Schema, Types, model, Document } from 'mongoose';

// Separate collection for vault items
export interface IVaultItem extends Document {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  vaultId: Types.ObjectId;
  categoryId: Types.ObjectId;
  subcategoryId: Types.ObjectId;
  type?: string;
  status?: string;
  category: string;
  title: string;
  description?: string;
  fileUrl?: string;
  fileSize?: number;
  isEncrypted?: boolean;
  isFavorite: boolean;
  tags?: string[];
  metadata: Record<string, any>;
  
  // Enhanced Security & Access Control
  accessLevel: 'private' | 'shared' | 'public';
  sharedWith?: Types.ObjectId[];
  pinRequired?: boolean;
  biometricRequired?: boolean;
  
  // OCR & Document Intelligence
  extractedText?: string;
  ocrConfidence?: number;
  processingStatus?: 'pending' | 'completed' | 'failed';
  
  createdAt: Date;
  updatedAt: Date;
  
  // Card Information with enhanced features
  card?: {
    number?: string;
    cvv?: string;
    pin?: string;
    expiryDate?: Date;
    issueDate?: Date;
    issuer?: string;
    holderName?: string;
    cardNetwork?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
    lastFourDigits?: string;
    isActive?: boolean;
    isExpired?: boolean;
    nfcCardId?: Types.ObjectId;
    images?: IImages;
  };

  // Document Information with enhanced features
  document?: {
    type?: string;
    status?: string;
    class?: string;
    category?: string;
    subcategory?: string;
    version?: string;
    authority?: string;
    number?: string;
    issueDate?: Date;
    expiryDate?: Date;
    location?: string;
    notes?: string;
    tags?: string[];
    fileUrl?: string;
    customFields?: Record<string, any>;
    images?: IImages;
    // Enhanced document features
    relatedScanId?: Types.ObjectId;
    isVerified?: boolean;
    verificationDate?: Date;
  };

  // Location Information if type is location
  location?: {
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    postalCode?: string;
  };

  // Identification Information with enhanced features
  identification?: {
    type?: string;
    number?: string;
    issueDate?: Date;
    expiryDate?: Date;
    issuingCountry?: string;
    issuingAuthority?: string;
    images?: IImages;
    // Enhanced identification features
    isVerified?: boolean;
    verificationMethod?: string;
    verificationDate?: Date;
  };

  // Media Information (new)
  media?: {
    albumId?: Types.ObjectId;
    isProfilePicture?: boolean;
    isCoverPhoto?: boolean;
    cloudinaryPublicId?: string;
    dimensions?: { width: number; height: number };
    thumbnailUrl?: string;
    originalFilename?: string;
  };
}

// Separate collection for categories
export interface IVaultCategory extends Document {
  _id: Types.ObjectId;
  vaultId: Types.ObjectId;
  name: string;
  status?: string;  // 'active' or 'archived' 
  order: number;
  // Enhanced category features
  icon?: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Separate collection for subcategories
export interface IVaultSubcategory extends Document {
  _id: Types.ObjectId;
  vaultId: Types.ObjectId;
  categoryId: Types.ObjectId;
  parentId?: Types.ObjectId;  // Reference to parent subcategory for nesting
  name: string;
  order: number;
  status?: string;  // 'active' or 'archived'
  // Enhanced subcategory features
  icon?: string;
  color?: string;
  description?: string;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Main vault document
export interface IVault extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  profileId: Types.ObjectId;
  storageUsed: number;
  storageLimit: number;
  // Enhanced vault features
  settings?: {
    autoLock?: boolean;
    autoLockTimeout?: number; // minutes
    requireBiometric?: boolean;
    allowSharing?: boolean;
    backupEnabled?: boolean;
    encryptionLevel?: 'standard' | 'high';
  };
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface IImageMetadata {
  url: string;
  storageId?: string;
  storageProvider?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: Date;
  metadata?: Record<string, any>;
  // Enhanced image features
  cloudinaryPublicId?: string;
  thumbnailUrl?: string;
  dimensions?: { width: number; height: number };
  isProcessed?: boolean;
}

interface IAdditionalImage extends IImageMetadata {
  description?: string;
}

interface IImages {
  front?: IImageMetadata;
  back?: IImageMetadata;
  additional?: IAdditionalImage[];
}

const ImageSchema = new Schema({
  url: { type: String, required: true },
  storageId: String,
  storageProvider: String,
  mimeType: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now },
  metadata: Schema.Types.Mixed
});

const AdditionalImageSchema = new Schema({
  url: { type: String, required: true },
  storageId: String,
  storageProvider: String,
  mimeType: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now },
  description: String,
  metadata: Schema.Types.Mixed
});

const ImagesSchema = new Schema({
  front: ImageSchema,
  back: ImageSchema,
  additional: [AdditionalImageSchema]
});

// Vault Item Schema
const VaultItemSchema = new Schema<IVaultItem>({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  vaultId: { type: Schema.Types.ObjectId, ref: 'Vault', required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'VaultCategory', required: true },
  subcategoryId: { type: Schema.Types.ObjectId, ref: 'VaultSubcategory' },
  type: { type: String },
  status: { type: String, default: 'active' },
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  fileUrl: { type: String },
  fileSize: { type: Number },
  isEncrypted: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
  tags: [{ type: String }],
  metadata: { type: Schema.Types.Mixed, default: {} },
  
  // Enhanced Security & Access Control
  accessLevel: { 
    type: String, 
    enum: ['private', 'shared', 'public'], 
    default: 'private' 
  },
  sharedWith: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
  pinRequired: { type: Boolean, default: false },
  biometricRequired: { type: Boolean, default: false },
  
  // OCR & Document Intelligence
  extractedText: { type: String },
  ocrConfidence: { type: Number, min: 0, max: 100 },
  processingStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  
  // Card Information with enhanced features
  card: {
    number: { type: String },
    cvv: { type: String },
    pin: { type: String },
    expiryDate: { type: Date },
    issueDate: { type: Date },
    issuer: { type: String },
    holderName: { type: String },
    cardNetwork: { 
      type: String, 
      enum: ['visa', 'mastercard', 'amex', 'discover', 'other'] 
    },
    lastFourDigits: { type: String },
    isActive: { type: Boolean, default: true },
    isExpired: { type: Boolean, default: false },
    nfcCardId: { type: Schema.Types.ObjectId },
    images: ImagesSchema
  },

  // Document Information with enhanced features
  document: {
    type: { type: String },
    status: { type: String },
    class: { type: String },
    category: { type: String },
    subcategory: { type: String },
    version: { type: String },
    authority: { type: String },
    number: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    location: { type: String },
    notes: { type: String },
    tags: [{ type: String }],
    fileUrl: { type: String },
    customFields: { type: Schema.Types.Mixed },
    images: ImagesSchema,
    relatedScanId: { type: Schema.Types.ObjectId },
    isVerified: { type: Boolean, default: false },
    verificationDate: { type: Date }
  },

  // Location Information if type is location
  location: {
    country: { type: String },
    state: { type: String },
    city: { type: String },
    address: { type: String },
    postalCode: { type: String }
  },

  // Identification Information with enhanced features
  identification: {
    type: { type: String },
    number: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    issuingCountry: { type: String },
    issuingAuthority: { type: String },
    images: ImagesSchema,
    isVerified: { type: Boolean, default: false },
    verificationMethod: { type: String },
    verificationDate: { type: Date }
  },

  // Media Information (new)
  media: {
    albumId: { type: Schema.Types.ObjectId, ref: 'Album' },
    isProfilePicture: { type: Boolean, default: false },
    isCoverPhoto: { type: Boolean, default: false },
    cloudinaryPublicId: { type: String },
    dimensions: {
      width: { type: Number },
      height: { type: Number }
    },
    thumbnailUrl: { type: String },
    originalFilename: { type: String }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Vault Category Schema
const VaultCategorySchema = new Schema<IVaultCategory>({
  vaultId: { type: Schema.Types.ObjectId, ref: 'Vault', required: true },
  name: { type: String, required: true },
  status: { type: String, default: 'active' },
  order: { type: Number, default: 0 },
  // Enhanced category features
  icon: { type: String },
  color: { type: String },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Vault Subcategory Schema
const VaultSubcategorySchema = new Schema<IVaultSubcategory>({
  vaultId: { type: Schema.Types.ObjectId, ref: 'Vault', required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'VaultCategory', required: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'VaultSubcategory' },  // Optional parent reference
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
  // Enhanced subcategory features
  icon: { type: String },
  color: { type: String },
  description: { type: String },
  archivedAt: { type: Date },
  archivedBy: { type: Schema.Types.ObjectId, ref: 'Profile' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Main Vault Schema
const VaultSchema = new Schema<IVault>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  storageUsed: { type: Number, default: 0 },
  storageLimit: { type: Number, default: 21474836480 }, // 20GB
  // Enhanced vault features
  settings: {
    autoLock: { type: Boolean, default: false },
    autoLockTimeout: { type: Number, default: 15 }, // minutes
    requireBiometric: { type: Boolean, default: false },
    allowSharing: { type: Boolean, default: true },
    backupEnabled: { type: Boolean, default: true },
    encryptionLevel: { 
      type: String, 
      enum: ['standard', 'high'], 
      default: 'standard' 
    }
  },
  lastAccessedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
VaultSchema.index({ userId: 1 });
VaultSchema.index({ profileId: 1 });
VaultSchema.index({ lastAccessedAt: 1 });

VaultCategorySchema.index({ vaultId: 1 });
VaultCategorySchema.index({ vaultId: 1, name: 1 });
VaultCategorySchema.index({ vaultId: 1, status: 1 });

VaultSubcategorySchema.index({ vaultId: 1 });
VaultSubcategorySchema.index({ categoryId: 1 });
VaultSubcategorySchema.index({ vaultId: 1, categoryId: 1, parentId: 1, name: 1 });
VaultSubcategorySchema.index({ vaultId: 1, status: 1 });

VaultItemSchema.index({ vaultId: 1 });
VaultItemSchema.index({ categoryId: 1 });
VaultItemSchema.index({ subcategoryId: 1 });
VaultItemSchema.index({ profileId: 1 });
VaultItemSchema.index({ accessLevel: 1 });
VaultItemSchema.index({ sharedWith: 1 });
VaultItemSchema.index({ processingStatus: 1 });
VaultItemSchema.index({ 'card.expiryDate': 1 });
VaultItemSchema.index({ 'card.isExpired': 1 });
VaultItemSchema.index({ 'card.cardNetwork': 1 });
VaultItemSchema.index({ 'document.expiryDate': 1 });
VaultItemSchema.index({ 'document.type': 1 });
VaultItemSchema.index({ 'document.status': 1 });
VaultItemSchema.index({ 'document.isVerified': 1 });
VaultItemSchema.index({ 'identification.type': 1 });
VaultItemSchema.index({ 'identification.expiryDate': 1 });
VaultItemSchema.index({ 'identification.isVerified': 1 });
VaultItemSchema.index({ 'media.albumId': 1 });
VaultItemSchema.index({ extractedText: 'text' }); // Text search index

// New Activity Logging Interface
export interface IVaultActivity extends Document {
  _id: Types.ObjectId;
  vaultId: Types.ObjectId;
  profileId: Types.ObjectId;
  itemId?: Types.ObjectId;
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'shared' | 'downloaded' | 'restored';
  details?: Record<string, any>;
  // Enhanced activity tracking
  ipAddress?: string;
  userAgent?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  createdAt: Date;
}

// Enhanced Activity Schema
const VaultActivitySchema = new Schema<IVaultActivity>({
  vaultId: { type: Schema.Types.ObjectId, ref: 'Vault', required: true },
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  itemId: { type: Schema.Types.ObjectId, ref: 'VaultItem' },
  action: { 
    type: String, 
    required: true,
    enum: ['created', 'updated', 'deleted', 'viewed', 'shared', 'downloaded', 'restored']
  },
  details: { type: Schema.Types.Mixed },
  // Enhanced activity tracking
  ipAddress: { type: String },
  userAgent: { type: String },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String }
  },
  createdAt: { type: Date, default: Date.now }
});

// Pre-save middleware for business logic
VaultItemSchema.pre('save', function(next) {
  // Auto-extract last four digits for cards
  if (this.card?.number && !this.card.lastFourDigits) {
    this.card.lastFourDigits = this.card.number.slice(-4);
  }
  
  // Check if card is expired
  if (this.card?.expiryDate) {
    this.card.isExpired = new Date() > this.card.expiryDate;
  }
  
  // Check if document is expired
  if (this.document?.expiryDate) {
    const isExpired = new Date() > this.document.expiryDate;
    if (isExpired && this.document.status !== 'expired') {
      this.document.status = 'expired';
    }
  }
  
  // Check if identification is expired
  if (this.identification?.expiryDate) {
    const isExpired = new Date() > this.identification.expiryDate;
    // You might want to add an isExpired field to identification
  }
  
  this.updatedAt = new Date();
  next();
});

// Update lastAccessedAt on vault access
VaultSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function() {
  this.set({ lastAccessedAt: new Date() });
});

// Enhanced Indexes for better query performance
VaultActivitySchema.index({ vaultId: 1 });
VaultActivitySchema.index({ profileId: 1 });
VaultActivitySchema.index({ itemId: 1 });
VaultActivitySchema.index({ action: 1 });
VaultActivitySchema.index({ createdAt: -1 });

// Create models
export const Vault = model<IVault>('Vault', VaultSchema);
export const VaultCategory = model<IVaultCategory>('VaultCategory', VaultCategorySchema);
export const VaultSubcategory = model<IVaultSubcategory>('VaultSubcategory', VaultSubcategorySchema);
export const VaultItem = model<IVaultItem>('VaultItem', VaultItemSchema);
export const VaultActivity = model<IVaultActivity>('VaultActivity', VaultActivitySchema);

export default VaultSchema; 