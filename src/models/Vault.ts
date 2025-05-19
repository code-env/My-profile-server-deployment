import { Schema, Types, model, Document } from 'mongoose';

// Separate collection for vault items
export interface IVaultItem extends Document {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  vaultId: Types.ObjectId;
  categoryId: Types.ObjectId;
  subcategoryId: Types.ObjectId;
  type?: string;
  category: string;
  title: string;
  description?: string;
  fileUrl?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  
  // Card Information
  card?: {
    number?: string;
    cvv?: string;
    pin?: string;
    expiryDate?: Date;
    issueDate?: Date;
    issuer?: string;
    holderName?: string;
    images?: IImages;
  };

  // Document Information
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
  };

  // Location Information
  location?: {
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    postalCode?: string;
  };

  // Identification Information
  identification?: {
    type?: string;
    number?: string;
    issueDate?: Date;
    expiryDate?: Date;
    issuingCountry?: string;
    issuingAuthority?: string;
    images?: IImages;
  };
}

// Separate collection for categories
export interface IVaultCategory extends Document {
  _id: Types.ObjectId;
  vaultId: Types.ObjectId;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Separate collection for subcategories
export interface IVaultSubcategory extends Document {
  _id: Types.ObjectId;
  vaultId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  order: number;
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
  subcategoryId: { type: Schema.Types.ObjectId, ref: 'VaultSubcategory', required: true },
  type: { type: String, required: false },
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  fileUrl: String,
  metadata: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  card: {
    number: { type: String },
    cvv: { type: String },
    pin: { type: String },
    expiryDate: { type: Date },
    issueDate: { type: Date },
    issuer: { type: String },
    holderName: { type: String },
    images: { type: ImagesSchema }
  },

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
    tags: [String],
    customFields: Schema.Types.Mixed,
    images: { type: ImagesSchema }
  },

  location: {
    country: { type: String },
    state: { type: String },
    city: { type: String },
    address: { type: String },
    postalCode: { type: String }
  },

  identification: {
    type: { type: String },
    number: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    issuingCountry: { type: String },
    issuingAuthority: { type: String },
    images: { type: ImagesSchema }
  }
});

// Vault Category Schema
const VaultCategorySchema = new Schema<IVaultCategory>({
  vaultId: { type: Schema.Types.ObjectId, ref: 'Vault', required: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Vault Subcategory Schema
const VaultSubcategorySchema = new Schema<IVaultSubcategory>({
  vaultId: { type: Schema.Types.ObjectId, ref: 'Vault', required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'VaultCategory', required: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Main Vault Schema
const VaultSchema = new Schema<IVault>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  storageUsed: { type: Number, default: 0 },
  storageLimit: { type: Number, default: 21474836480 }, // 20GB
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
VaultSchema.index({ userId: 1 });
VaultSchema.index({ profileId: 1 });

VaultCategorySchema.index({ vaultId: 1 });
VaultCategorySchema.index({ vaultId: 1, name: 1 }, { unique: true });

VaultSubcategorySchema.index({ vaultId: 1 });
VaultSubcategorySchema.index({ categoryId: 1 });
VaultSubcategorySchema.index({ vaultId: 1, categoryId: 1, name: 1 }, { unique: true });

VaultItemSchema.index({ vaultId: 1 });
VaultItemSchema.index({ categoryId: 1 });
VaultItemSchema.index({ subcategoryId: 1 });
VaultItemSchema.index({ profileId: 1 });
VaultItemSchema.index({ 'card.expiryDate': 1 });
VaultItemSchema.index({ 'document.expiryDate': 1 });
VaultItemSchema.index({ 'identification.expiryDate': 1 });
VaultItemSchema.index({ 'document.type': 1 });
VaultItemSchema.index({ 'document.status': 1 });
VaultItemSchema.index({ 'identification.type': 1 });

// Create models
export const Vault = model<IVault>('Vault', VaultSchema);
export const VaultCategory = model<IVaultCategory>('VaultCategory', VaultCategorySchema);
export const VaultSubcategory = model<IVaultSubcategory>('VaultSubcategory', VaultSubcategorySchema);
export const VaultItem = model<IVaultItem>('VaultItem', VaultItemSchema);

export default VaultSchema; 