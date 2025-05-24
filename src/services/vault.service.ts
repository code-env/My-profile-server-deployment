/**
 * @file vault.service.ts
 * @description Vault Service Layer for Digital Asset Management
 * =========================================================
 *
 * This service handles all business logic for the Vault system,
 * including CRUD operations, encryption, analytics, and integrations.
 *
 * @version 1.0.0
 * @author My Profile Server
 */

import { Types } from 'mongoose';
import crypto from 'crypto';
import {
  VaultItemModel,
  WalletItemModel,
  DocumentItemModel,
  MediaItemModel,
  AlbumModel,
  VaultActivityModel,
  IVaultItemBase,
  IWalletItem,
  IDocumentItem,
  IMediaItem,
  IAlbum,
  IVaultActivity,
  IVaultStats,
  WalletSubcategory,
  DocumentSubcategory,
  MediaSubcategory
} from '../models/vault.model';
import CloudinaryService from './cloudinary.service';

// Create cloudinary service instance
const cloudinaryService = new CloudinaryService();

export class VaultService {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.VAULT_ENCRYPTION_KEY || 'default-key-for-development';
  }

  // ===========================
  // ENCRYPTION UTILITIES
  // ===========================

  private encrypt(text: string): string {
    if (!text) return text;
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedText;
    }
  }

  // ===========================
  // GENERAL VAULT OPERATIONS
  // ===========================

  async getVaultItems(
    profileId: string,
    options: {
      category?: 'wallet' | 'documents' | 'media';
      subcategory?: string;
      tags?: string[];
      search?: string;
      isFavorite?: boolean;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const query: any = { profileId: new Types.ObjectId(profileId) };

    // Apply filters
    if (options.category) query.category = options.category;
    if (options.subcategory) query.subcategory = options.subcategory;
    if (options.isFavorite !== undefined) query.isFavorite = options.isFavorite;
    if (options.tags && options.tags.length > 0) {
      query.tags = { $in: options.tags };
    }

    // Text search
    if (options.search) {
      query.$or = [
        { name: { $regex: options.search, $options: 'i' } },
        { description: { $regex: options.search, $options: 'i' } },
        { tags: { $in: [new RegExp(options.search, 'i')] } }
      ];
    }

    // Build sort object
    const sort: any = {};
    if (options.sortBy) {
      sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    const items = await VaultItemModel
      .find(query)
      .sort(sort)
      .limit(options.limit || 50)
      .skip(options.offset || 0)
      .populate('albumId', 'name description')
      .populate('nfcCardId', 'cardId isActive')
      .populate('relatedScanId', 'scanType fileName createdAt');

    // Decrypt sensitive data for wallet items
    const decryptedItems = items.map(item => {
      if (item.category === 'wallet' && item.isEncrypted) {
        const walletItem = item as unknown as IWalletItem;
        if (walletItem.cardNumber) {
          walletItem.cardNumber = this.decrypt(walletItem.cardNumber);
        }
        if (walletItem.documentNumber) {
          walletItem.documentNumber = this.decrypt(walletItem.documentNumber);
        }
      }
      return item;
    });

    return decryptedItems;
  }

  async getVaultItem(profileId: string, itemId: string) {
    const item = await VaultItemModel
      .findOne({
        _id: new Types.ObjectId(itemId),
        profileId: new Types.ObjectId(profileId)
      })
      .populate('albumId', 'name description')
      .populate('nfcCardId', 'cardId isActive')
      .populate('relatedScanId', 'scanType fileName createdAt');

    if (!item) {
      throw new Error('Vault item not found');
    }

    // Log view activity
    await this.logActivity(profileId, itemId, 'viewed');

    // Decrypt sensitive data if needed
    if (item.category === 'wallet' && item.isEncrypted) {
      const walletItem = item as unknown as IWalletItem;
      if (walletItem.cardNumber) {
        walletItem.cardNumber = this.decrypt(walletItem.cardNumber);
      }
      if (walletItem.documentNumber) {
        walletItem.documentNumber = this.decrypt(walletItem.documentNumber);
      }
    }

    return item;
  }

  async deleteVaultItem(profileId: string, itemId: string) {
    const item = await VaultItemModel.findOne({
      _id: new Types.ObjectId(itemId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!item) {
      throw new Error('Vault item not found');
    }

    // Delete associated files from Cloudinary
    if (item.category === 'documents') {
      const docItem = item as unknown as IDocumentItem;
      if (docItem.fileUrl) {
        await this.deleteCloudinaryFile(docItem.fileUrl);
      }
    } else if (item.category === 'media') {
      const mediaItem = item as unknown as IMediaItem;
      if (mediaItem.fileUrl) {
        await this.deleteCloudinaryFile(mediaItem.fileUrl);
      }
      if (mediaItem.thumbnailUrl) {
        await this.deleteCloudinaryFile(mediaItem.thumbnailUrl);
      }
    } else if (item.category === 'wallet') {
      const walletItem = item as unknown as IWalletItem;
      if (walletItem.frontImage) {
        await this.deleteCloudinaryFile(walletItem.frontImage);
      }
      if (walletItem.backImage) {
        await this.deleteCloudinaryFile(walletItem.backImage);
      }
    }

    // Log deletion activity
    await this.logActivity(profileId, itemId, 'deleted', {
      itemName: item.name,
      category: item.category
    });

    await VaultItemModel.findByIdAndDelete(itemId);

    return { success: true, message: 'Vault item deleted successfully' };
  }

  // ===========================
  // WALLET OPERATIONS
  // ===========================

  async createWalletItem(profileId: string, data: Partial<IWalletItem>) {
    // Validate required fields
    if (!data.name || !data.subcategory || !data.cardType) {
      throw new Error('Name, subcategory, and cardType are required for wallet items');
    }

    // Encrypt sensitive data
    const walletData = { ...data };
    if (walletData.isEncrypted) {
      if (walletData.cardNumber) {
        walletData.cardNumber = this.encrypt(walletData.cardNumber);
      }
      if (walletData.documentNumber) {
        walletData.documentNumber = this.encrypt(walletData.documentNumber);
      }
    }

    // Extract last four digits if card number provided
    if (data.cardNumber && !walletData.lastFourDigits) {
      walletData.lastFourDigits = data.cardNumber.slice(-4);
    }

    const walletItem = new WalletItemModel({
      ...walletData,
      profileId: new Types.ObjectId(profileId),
      category: 'wallet'
    });

    await walletItem.save();

    // Log creation activity
    await this.logActivity(profileId, walletItem._id.toString(), 'created', {
      subcategory: walletItem.subcategory,
      cardType: walletItem.cardType
    });

    return walletItem;
  }

  async updateWalletItem(profileId: string, itemId: string, updates: Partial<IWalletItem>) {
    const item = await WalletItemModel.findOne({
      _id: new Types.ObjectId(itemId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!item) {
      throw new Error('Wallet item not found');
    }

    // Handle encryption for sensitive fields
    const updateData = { ...updates };
    if (updateData.cardNumber && item.isEncrypted) {
      updateData.cardNumber = this.encrypt(updateData.cardNumber);
      updateData.lastFourDigits = updates.cardNumber!.slice(-4);
    }
    if (updateData.documentNumber && item.isEncrypted) {
      updateData.documentNumber = this.encrypt(updateData.documentNumber);
    }

    Object.assign(item, updateData);
    await item.save();

    // Log update activity
    await this.logActivity(profileId, itemId, 'updated', {
      updatedFields: Object.keys(updates)
    });

    return item;
  }

  async uploadCardImage(
    profileId: string,
    itemId: string,
    file: Express.Multer.File,
    side: 'front' | 'back'
  ) {
    const item = await WalletItemModel.findOne({
      _id: new Types.ObjectId(itemId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!item) {
      throw new Error('Wallet item not found');
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinaryService.uploadAndReturnAllInfo(file.buffer, {
      folder: `vault/wallet/${profileId}`,
      resourceType: 'image'
    });

    // Delete old image if exists
    const oldImageField = side === 'front' ? 'frontImage' : 'backImage';
    if (item[oldImageField]) {
      await this.deleteCloudinaryFile(item[oldImageField] as string);
    }

    // Update item with new image URL
    item[oldImageField] = uploadResult.secure_url;
    await item.save();

    return { imageUrl: uploadResult.secure_url };
  }

  // ===========================
  // DOCUMENT OPERATIONS
  // ===========================

  async createDocumentItem(
    profileId: string,
    data: Partial<IDocumentItem>,
    file?: Express.Multer.File
  ) {
    if (!data.name || !data.subcategory) {
      throw new Error('Name and subcategory are required for document items');
    }

    let fileUrl = '';
    let fileName = '';
    let fileType = '';
    let fileSize = 0;

    if (file) {
      const uploadResult = await cloudinaryService.uploadAndReturnAllInfo(file.buffer, {
        folder: `vault/documents/${profileId}`,
        resourceType: 'auto'
      });

      fileUrl = uploadResult.secure_url;
      fileName = file.originalname;
      fileType = file.mimetype;
      fileSize = file.size;
    } else if (data.fileUrl) {
      fileUrl = data.fileUrl;
      fileName = data.fileName || 'unknown';
      fileType = data.fileType || 'application/octet-stream';
      fileSize = data.fileSize || 0;
    } else {
      throw new Error('Either file upload or fileUrl is required');
    }

    const documentItem = new DocumentItemModel({
      ...data,
      profileId: new Types.ObjectId(profileId),
      category: 'documents',
      fileUrl,
      fileName,
      fileType,
      fileSize
    });

    await documentItem.save();

    // Log creation activity
    await this.logActivity(profileId, documentItem._id.toString(), 'created', {
      subcategory: documentItem.subcategory,
      documentType: documentItem.documentType,
      fileSize: documentItem.fileSize
    });

    return documentItem;
  }

  async updateDocumentItem(profileId: string, itemId: string, updates: Partial<IDocumentItem>) {
    const item = await DocumentItemModel.findOne({
      _id: new Types.ObjectId(itemId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!item) {
      throw new Error('Document item not found');
    }

    // Handle version control if content changes
    if (updates.fileUrl && updates.fileUrl !== item.fileUrl) {
      item.previousVersions.push(item._id);
      item.version += 1;
    }

    Object.assign(item, updates);
    await item.save();

    // Log update activity
    await this.logActivity(profileId, itemId, 'updated', {
      updatedFields: Object.keys(updates),
      newVersion: item.version
    });

    return item;
  }

  async linkDocumentToScan(profileId: string, itemId: string, scanId: string) {
    const item = await DocumentItemModel.findOne({
      _id: new Types.ObjectId(itemId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!item) {
      throw new Error('Document item not found');
    }

    item.relatedScanId = new Types.ObjectId(scanId);
    await item.save();

    return item;
  }

  // ===========================
  // MEDIA OPERATIONS
  // ===========================

  async createMediaItem(
    profileId: string,
    data: Partial<IMediaItem>,
    file: Express.Multer.File
  ) {
    if (!data.name || !data.subcategory || !data.mediaType) {
      throw new Error('Name, subcategory, and mediaType are required for media items');
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinaryService.uploadAndReturnAllInfo(file.buffer, {
      folder: `vault/media/${profileId}`,
      resourceType: data.mediaType === 'video' ? 'video' : 'auto'
    });

    // Generate thumbnail for videos
    let thumbnailUrl;
    if (data.mediaType === 'video') {
      // Cloudinary automatically generates video thumbnails
      thumbnailUrl = uploadResult.secure_url.replace('/video/upload/', '/video/upload/so_0/');
    }

    const mediaItem = new MediaItemModel({
      ...data,
      profileId: new Types.ObjectId(profileId),
      category: 'media',
      fileUrl: uploadResult.secure_url,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      cloudinaryPublicId: uploadResult.public_id,
      thumbnailUrl,
      dimensions: uploadResult.width && uploadResult.height ? {
        width: uploadResult.width,
        height: uploadResult.height
      } : undefined,
      duration: uploadResult.duration || undefined,
      processingStatus: 'completed'
    });

    await mediaItem.save();

    // Update album media count if assigned to album
    if (data.albumId) {
      await AlbumModel.findByIdAndUpdate(
        data.albumId,
        { $inc: { mediaCount: 1 } }
      );
    }

    // Log creation activity
    await this.logActivity(profileId, mediaItem._id.toString(), 'created', {
      subcategory: mediaItem.subcategory,
      mediaType: mediaItem.mediaType,
      fileSize: mediaItem.fileSize
    });

    return mediaItem;
  }

  async updateMediaItem(profileId: string, itemId: string, updates: Partial<IMediaItem>) {
    const item = await MediaItemModel.findOne({
      _id: new Types.ObjectId(itemId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!item) {
      throw new Error('Media item not found');
    }

    // Handle album changes
    const oldAlbumId = item.albumId;
    const newAlbumId = updates.albumId;

    Object.assign(item, updates);
    await item.save();

    // Update album counts
    if (oldAlbumId && oldAlbumId.toString() !== newAlbumId?.toString()) {
      await AlbumModel.findByIdAndUpdate(oldAlbumId, { $inc: { mediaCount: -1 } });
    }
    if (newAlbumId && newAlbumId.toString() !== oldAlbumId?.toString()) {
      await AlbumModel.findByIdAndUpdate(newAlbumId, { $inc: { mediaCount: 1 } });
    }

    // Log update activity
    await this.logActivity(profileId, itemId, 'updated', {
      updatedFields: Object.keys(updates)
    });

    return item;
  }

  // ===========================
  // ALBUM OPERATIONS
  // ===========================

  async createAlbum(profileId: string, data: Partial<IAlbum>) {
    if (!data.name) {
      throw new Error('Album name is required');
    }

    const album = new AlbumModel({
      ...data,
      profileId: new Types.ObjectId(profileId)
    });

    await album.save();
    return album;
  }

  async getAlbums(profileId: string) {
    return AlbumModel.find({ profileId: new Types.ObjectId(profileId) })
      .sort({ sortOrder: 1, createdAt: -1 })
      .populate('coverImageId', 'fileUrl thumbnailUrl');
  }

  async updateAlbum(profileId: string, albumId: string, updates: Partial<IAlbum>) {
    const album = await AlbumModel.findOne({
      _id: new Types.ObjectId(albumId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!album) {
      throw new Error('Album not found');
    }

    Object.assign(album, updates);
    await album.save();
    return album;
  }

  async deleteAlbum(profileId: string, albumId: string) {
    const album = await AlbumModel.findOne({
      _id: new Types.ObjectId(albumId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!album) {
      throw new Error('Album not found');
    }

    // Remove album reference from media items
    await MediaItemModel.updateMany(
      { albumId: new Types.ObjectId(albumId) },
      { $unset: { albumId: 1 } }
    );

    await AlbumModel.findByIdAndDelete(albumId);
    return { success: true, message: 'Album deleted successfully' };
  }

  // ===========================
  // ANALYTICS & STATISTICS
  // ===========================

  async getVaultStats(profileId: string): Promise<IVaultStats> {
    const stats = await VaultItemModel.aggregate([
      { $match: { profileId: new Types.ObjectId(profileId) } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          walletItems: {
            $sum: { $cond: [{ $eq: ['$category', 'wallet'] }, 1, 0] }
          },
          documentItems: {
            $sum: { $cond: [{ $eq: ['$category', 'documents'] }, 1, 0] }
          },
          mediaItems: {
            $sum: { $cond: [{ $eq: ['$category', 'media'] }, 1, 0] }
          },
          encryptedItems: {
            $sum: { $cond: ['$isEncrypted', 1, 0] }
          }
        }
      }
    ]);

    // Calculate storage used for documents and media
    const storageStats = await VaultItemModel.aggregate([
      {
        $match: {
          profileId: new Types.ObjectId(profileId),
          category: { $in: ['documents', 'media'] }
        }
      },
      {
        $group: {
          _id: null,
          totalStorage: { $sum: '$fileSize' }
        }
      }
    ]);

    // Get last activity
    const lastActivity = await VaultActivityModel.findOne(
      { profileId: new Types.ObjectId(profileId) },
      {},
      { sort: { createdAt: -1 } }
    );

    const result = stats[0] || {
      totalItems: 0,
      walletItems: 0,
      documentItems: 0,
      mediaItems: 0,
      encryptedItems: 0
    };

    return {
      ...result,
      storageUsed: storageStats[0]?.totalStorage || 0,
      lastActivity: lastActivity?.createdAt || new Date()
    };
  }

  async getVaultActivity(
    profileId: string,
    options: {
      itemId?: string;
      action?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const query: any = { profileId: new Types.ObjectId(profileId) };

    if (options.itemId) {
      query.itemId = new Types.ObjectId(options.itemId);
    }
    if (options.action) {
      query.action = options.action;
    }

    return VaultActivityModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .skip(options.offset || 0)
      .populate('itemId', 'name category subcategory');
  }

  // ===========================
  // SHARING & ACCESS CONTROL
  // ===========================

  async shareVaultItem(
    profileId: string,
    itemId: string,
    shareWithProfileIds: string[],
    accessLevel: 'shared' | 'public' = 'shared'
  ) {
    const item = await VaultItemModel.findOne({
      _id: new Types.ObjectId(itemId),
      profileId: new Types.ObjectId(profileId)
    });

    if (!item) {
      throw new Error('Vault item not found');
    }

    // Update sharing settings
    item.accessLevel = accessLevel;
    if (accessLevel === 'shared') {
      item.sharedWith = shareWithProfileIds.map(id => new Types.ObjectId(id));
    } else {
      item.sharedWith = [];
    }

    await item.save();

    // Log sharing activity
    await this.logActivity(profileId, itemId, 'shared', {
      accessLevel,
      sharedWithCount: shareWithProfileIds.length
    });

    return item;
  }

  async getSharedItems(profileId: string) {
    return VaultItemModel.find({
      $or: [
        { sharedWith: new Types.ObjectId(profileId) },
        { accessLevel: 'public' }
      ]
    }).populate('profileId', 'firstName lastName profilePicture');
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  private async logActivity(
    profileId: string,
    itemId: string,
    action: IVaultActivity['action'],
    details: Record<string, any> = {}
  ) {
    const activity = new VaultActivityModel({
      profileId: new Types.ObjectId(profileId),
      itemId: new Types.ObjectId(itemId),
      action,
      details
    });

    await activity.save();
  }

  private async deleteCloudinaryFile(fileUrl: string) {
    try {
      await cloudinaryService.delete(fileUrl);
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }
  }

  // Search functionality
  async searchVault(profileId: string, query: string, filters: {
    categories?: string[];
    tags?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  } = {}) {
    const searchQuery: any = {
      profileId: new Types.ObjectId(profileId),
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };

    if (filters.categories && filters.categories.length > 0) {
      searchQuery.category = { $in: filters.categories };
    }

    if (filters.tags && filters.tags.length > 0) {
      searchQuery.tags = { $in: filters.tags };
    }

    if (filters.dateFrom || filters.dateTo) {
      searchQuery.createdAt = {};
      if (filters.dateFrom) searchQuery.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) searchQuery.createdAt.$lte = filters.dateTo;
    }

    // For document items, also search in extracted text
    const documentResults = await DocumentItemModel.find({
      ...searchQuery,
      extractedText: { $regex: query, $options: 'i' }
    });

    const generalResults = await VaultItemModel.find(searchQuery);

    // Combine and deduplicate results
    const allResults = [...generalResults, ...documentResults];
    const uniqueResults = allResults.filter((item, index, self) =>
      index === self.findIndex(t => t._id.toString() === item._id.toString())
    );

    return uniqueResults;
  }
}

export const vaultService = new VaultService();
export default vaultService;
