import { Vault, VaultCategory, VaultSubcategory, VaultItem, VaultActivity, IVaultItem, IVaultSubcategory, IVaultActivity } from '../models/Vault';
import { Types } from 'mongoose';
import CloudinaryService from '../services/cloudinary.service';
import { User } from '../models/User';
import createHttpError from 'http-errors';
import { SettingsService } from './settings.service';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';
import { Connection } from '../models/Connection';
import { ProfileConnectionModel } from '../models/profile-connection.model';
import { VaultAuditLog } from '../models/VaultAuditLog';
import { VaultVersion } from '../models/VaultVersion';

interface ISubcategoryWithChildren {
  _id: Types.ObjectId;
  name: string;
  order: number;
  hasChildren: boolean;
  count: number;
  items: any[];
  subcategories: ISubcategoryWithChildren[];
}

interface SearchCriteria {
  query?: string;
  categories?: string[];
  subcategories?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  tags?: string[];
  metadata?: Record<string, any>;
  accessLevel?: 'private' | 'shared' | 'public';
  isEncrypted?: boolean;
  isFavorite?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  // Enhanced search criteria
  extractedText?: string;
  processingStatus?: 'pending' | 'completed' | 'failed';
  cardNetwork?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  isVerified?: boolean;
  isExpired?: boolean;
}

// Enhanced activity tracking interface
interface ActivityContext {
  ipAddress?: string;
  userAgent?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
}

class VaultService {
  private cloudinaryService: CloudinaryService;
  private settingsService: SettingsService;

  constructor() {
    this.cloudinaryService = new CloudinaryService();
    this.settingsService = new SettingsService();
  }

  // Enhanced activity logging using the new VaultActivity model
  private async logActivity(
    vaultId: Types.ObjectId,
    profileId: Types.ObjectId,
    action: 'created' | 'updated' | 'deleted' | 'viewed' | 'shared' | 'downloaded' | 'restored',
    itemId?: Types.ObjectId,
    details?: Record<string, any>,
    context?: ActivityContext
  ): Promise<void> {
    try {
      await VaultActivity.create({
        vaultId,
        profileId,
        itemId,
        action,
        details,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        location: context?.location,
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Failed to log vault activity:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  // Enhanced OCR text extraction method
  private async extractTextFromImage(imageUrl: string): Promise<{ extractedText: string; confidence: number }> {
    try {
      // This would integrate with an OCR service like Google Vision API, AWS Textract, etc.
      // For now, returning mock data
      return {
        extractedText: '',
        confidence: 0
      };
    } catch (error) {
      logger.error('OCR extraction failed:', error);
      return {
        extractedText: '',
        confidence: 0
      };
    }
  }

  // Enhanced image upload with processing status
  private async uploadImageWithProcessing(
    fileData: string,
    folder: string,
    resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'
  ): Promise<{
    url: string;
    storageId: string;
    size: number;
    cloudinaryPublicId: string;
    dimensions?: { width: number; height: number };
    thumbnailUrl: string;
    isProcessed: boolean;
  }> {
    try {
      const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(fileData, {
        folder,
        resourceType
      });
      
      // Generate thumbnail for images using Cloudinary URL transformation
      let thumbnailUrl = uploadResult.secure_url;
      if (resourceType === 'image') {
        // Create thumbnail URL by inserting transformation parameters
        const transformationParams = 'w_200,h_200,c_fill,f_auto,q_auto';
        thumbnailUrl = uploadResult.secure_url.replace('/upload/', `/upload/${transformationParams}/`);
      }

      return {
        url: uploadResult.secure_url,
        storageId: uploadResult.public_id,
        size: uploadResult.bytes,
        cloudinaryPublicId: uploadResult.public_id,
        dimensions: uploadResult.width && uploadResult.height ? 
          { width: uploadResult.width, height: uploadResult.height } : undefined,
        thumbnailUrl,
        isProcessed: true
      };
    } catch (error) {
      logger.error('Image upload failed:', error);
      throw error;
    }
  }

  // Enhanced method to check access permissions
  private async checkItemAccessPermissions(
    requestingProfileId: string,
    item: any
  ): Promise<{ allowed: boolean; reason?: string }> {
    // If item is private, only owner can access
    if (item.accessLevel === 'private' && item.profileId.toString() !== requestingProfileId) {
      return { allowed: false, reason: 'Item is private' };
    }

    // If item is shared, check if requesting profile is in sharedWith list
    if (item.accessLevel === 'shared') {
      if (item.profileId.toString() === requestingProfileId) {
        return { allowed: true }; // Owner always has access
      }
      
      const isSharedWith = item.sharedWith?.some((sharedProfileId: Types.ObjectId) => 
        sharedProfileId.toString() === requestingProfileId
      );
      
      if (!isSharedWith) {
        return { allowed: false, reason: 'Item not shared with you' };
      }
    }

    // Public items are accessible to all (if vault allows sharing)
    return { allowed: true };
  }

  private getDefaultCategories() {
    return [
      {
        name: 'Wallet',
        subcategories: [
          { name: 'MyProfile' },
          { name: 'Personal ID'},
          { name: 'Professional ID'},
          { name: 'Finance'},
          { name: 'Insurance'},
          { name: 'Medical'},
          { name: 'Loyalty'},
          { name: 'Pass'},
        ]
      },
      {
        name: 'Documents',
        subcategories: [
          { name: 'Documents' },
          { name: 'Receipts' },
          { name: 'Forms' },
          { name: 'Vouchers' }
        ]
      },
      {
        name: 'Media',
        subcategories: [
          { name: 'Photos' },
          { name: 'Videos' },
          { name: 'Audio' }
        ]
      }
    ];
  }

  async getUserVault(profileId: string, requestingProfileId?: string) {
    // Check permissions if requesting profile is different from vault owner
    if (requestingProfileId && requestingProfileId !== profileId) {
      const permissionCheck = await this.checkVaultAccessPermissions(requestingProfileId, profileId);
      if (!permissionCheck.allowed) {
        throw createHttpError(403, permissionCheck.reason || 'Access denied to vault');
      }

      // Log vault access activity
      const targetProfile = await ProfileModel.findById(profileId);
      if (targetProfile) {
        await this.logVaultActivity(
          (targetProfile as any).profileInformation.creator.toString(),
          profileId,
          'vault_accessed',
          {
            requestingProfileId,
            accessType: 'full_vault',
            timestamp: new Date()
          }
        );
      }
    }

    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      return null;
    }

    // Get user settings to apply storage and display preferences
    const profile = await ProfileModel.findById(profileId);
    const settings = profile ? await this.settingsService.getSettings(
      (profile as any).profileInformation.creator.toString(), 
      profileId
    ) : null;

    // Apply storage limit from settings if available
    let storageLimit = vault.storageLimit;
    if (settings?.specificSettings?.vaultStorageLimit) {
      storageLimit = settings.specificSettings.vaultStorageLimit;
    }

    // Get categories with their subcategories
    const categories = await VaultCategory.find({ vaultId: vault._id })
      .sort({ order: 1 });

    const categoriesWithSubcategories = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await VaultSubcategory.find({ 
          vaultId: vault._id,
          categoryId: category._id 
        }).sort({ order: 1 });

        return {
          _id: category._id,
          name: category.name,
          order: category.order,
          subcategories: subcategories.map(sub => ({
            _id: sub._id,
            name: sub.name,
            order: sub.order
          }))
        };
      })
    );

    return {
      _id: vault._id,
      profileId: vault.profileId,
      storageUsed: vault.storageUsed,
      storageLimit: storageLimit,
      storageUsedFormatted: this.formatStorageSize(vault.storageUsed, settings),
      storageLimitFormatted: this.formatStorageSize(storageLimit, settings),
      storagePercentage: Math.round((vault.storageUsed / storageLimit) * 100),
      categories: categoriesWithSubcategories,
      settings: {
        autoBackup: settings?.dataSettings?.autoDataBackup ?? true,
        compressionEnabled: settings?.specificSettings?.vaultCompressionEnabled ?? true,
        encryptionEnabled: settings?.specificSettings?.vaultEncryptionEnabled ?? false,
        maxFileSize: settings?.specificSettings?.vaultMaxFileSize ?? 104857600, // 100MB default
        allowedFileTypes: settings?.specificSettings?.vaultAllowedFileTypes ?? ['*'],
        autoDeleteOldFiles: settings?.specificSettings?.vaultAutoDeleteOldFiles ?? false,
        autoDeleteDays: settings?.specificSettings?.vaultAutoDeleteDays ?? 365
      }
    };
  }

  async getItems(profileId: string, filters: any) {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) return null;

    const query: any = { 
      vaultId: vault._id,
      status: { $ne: 'archived' }  // Exclude archived items
    };
    
    if (filters) {
      if (filters.categoryId) {
        // Handle both category ID and name
        if (Types.ObjectId.isValid(filters.categoryId)) {
          query.categoryId = new Types.ObjectId(filters.categoryId);
        } else {
          // If it's a name, find the category ID first
          const category = await VaultCategory.findOne({
            vaultId: vault._id,
            name: { $regex: new RegExp(`^${filters.categoryId}$`, 'i') }
          });
          if (!category) {
            // If category not found, return empty result
            return {
              items: []
            };
          }
          query.categoryId = category._id;
        }
      }
      if (filters.subcategoryId) {
        // Handle both subcategory ID and name
        if (Types.ObjectId.isValid(filters.subcategoryId)) {
          query.subcategoryId = new Types.ObjectId(filters.subcategoryId);
        } else {
          // If it's a name, find the subcategory ID first
          const subcategory = await VaultSubcategory.findOne({
            vaultId: vault._id,
            name: { $regex: new RegExp(`^${filters.subcategoryId}$`, 'i') }
          });
          if (!subcategory) {
            // If subcategory not found, return empty result
            return {
              items: []
            };
          }
          query.subcategoryId = subcategory._id;
        }
      }
      if (filters.type) {
        query.type = filters.type;
      }
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }
    }

    const items = await VaultItem.find(query)
      .sort({ createdAt: -1 });

    // If we're filtering by subcategory, we don't need to group by category
    if (filters?.subcategoryId) {
      const subcategory = await VaultSubcategory.findById(filters.subcategoryId);
      const category = subcategory ? await VaultCategory.findById(subcategory.categoryId) : null;
      
      // Get child subcategories
      const childSubcategories = await VaultSubcategory.find({
        vaultId: vault._id,
        categoryId: subcategory?.categoryId,
        parentId: subcategory?._id,
        status: { $ne: 'archived' }
      }).sort({ order: 1 });

      // Get items for child subcategories
      const childSubcategoriesWithItems = await Promise.all(
        childSubcategories.map(async (childSub) => {
          const [childCount, childItems] = await Promise.all([
            VaultItem.countDocuments({
              vaultId: vault._id,
              subcategoryId: childSub._id,
              status: { $ne: 'archived' }
            }),
            VaultItem.find({
              vaultId: vault._id,
              subcategoryId: childSub._id,
              status: { $ne: 'archived' }
            }).sort({ createdAt: -1 })
          ]);

          return {
            _id: childSub._id,
            name: childSub.name,
            order: childSub.order,
            hasChildren: false, // We're not loading deeper levels
            count: childCount,
            status: childSub.status,
            items: childItems.map(item => ({
              _id: item._id,
              title: item.title,
              type: item.type,
              createdAt: item.createdAt
            })),
            subcategories: []
          };
        })
      );

      return {
        items: [{
          _id: category?._id,
          name: category?.name,
          count: items.length + childSubcategoriesWithItems.reduce((sum, child) => sum + child.count, 0),
          subcategories: [{
            _id: subcategory?._id,
            name: subcategory?.name,
            count: items.length + childSubcategoriesWithItems.reduce((sum, child) => sum + child.count, 0),
            status: subcategory?.status || 'active',
            items: items.map(item => {
              const itemObj = item.toObject() as Record<string, any>;
              const typeData = itemObj[itemObj.type] || {};
              delete itemObj[itemObj.type];

              // Remove empty document field if it exists
              if (itemObj.document && (!itemObj.document.tags || itemObj.document.tags.length === 0)) {
                delete itemObj.document;
              }

              const finalItem = {
                ...itemObj,
                categoryName: category?.name,
                subcategoryName: subcategory?.name,
                status: itemObj.status || 'active'
              };

              // Only include type data if it's not empty
              if (Object.keys(typeData).length > 0) {
                Object.assign(finalItem, typeData);
              }

              return finalItem;
            }),
            subcategories: childSubcategoriesWithItems
          }]
        }]
      };
    }

    // Get categories and subcategories based on the query
    let categories;
    if (filters?.categoryId) {
      // If category filter is provided, only get that category
      const categoryId = Types.ObjectId.isValid(filters.categoryId) 
        ? new Types.ObjectId(filters.categoryId)
        : (await VaultCategory.findOne({
            vaultId: vault._id,
            name: { $regex: new RegExp(`^${filters.categoryId}$`, 'i') }
          }))?._id;
      
      categories = categoryId ? [await VaultCategory.findById(categoryId)] : [];
    } else {
      // If no category filter, get all categories
      categories = await VaultCategory.find({ vaultId: vault._id });
    }

    // Get subcategories for the selected categories
    const subcategories = await VaultSubcategory.find({
      vaultId: vault._id,
      categoryId: { $in: categories.filter((cat): cat is NonNullable<typeof cat> => cat !== null).map(cat => cat._id) }
    });

    // Create lookup maps
    const categoryMap = new Map(categories.filter((cat): cat is NonNullable<typeof cat> => cat !== null).map(cat => [cat._id.toString(), cat.name]));
    const subcategoryMap = new Map(subcategories.map(sub => [sub._id.toString(), sub.name]));

    // Group items by category and subcategory
    const groupedItems = new Map();

    // Initialize the structure only for the categories we have
    categories.filter((cat): cat is NonNullable<typeof cat> => cat !== null).forEach(category => {
      const categorySubcategories = subcategories.filter(sub => 
        sub.categoryId.toString() === category._id.toString()
      );
      
      groupedItems.set(category.name, {
        _id: category._id,
        name: category.name,
        count: 0,
        subcategories: new Map(
          categorySubcategories.map(sub => [
            sub.name,
            {
              _id: sub._id,
              name: sub.name,
              count: 0,
              items: []
            }
          ])
        )
      });
    });

    // Add items to their respective groups
    items.forEach(item => {
      const itemObj = item.toObject() as Record<string, any>;
      const typeData = itemObj[itemObj.type] || {};
      delete itemObj[itemObj.type];

      // Remove empty document field if it exists
      if (itemObj.document && (!itemObj.document.tags || itemObj.document.tags.length === 0)) {
        delete itemObj.document;
      }

      const categoryName = categoryMap.get(itemObj.categoryId.toString());
      const subcategoryName = subcategoryMap.get(itemObj.subcategoryId.toString());

      if (categoryName && subcategoryName) {
        const categoryGroup = groupedItems.get(categoryName);
        if (categoryGroup) {
          categoryGroup.count++;
          const subcategoryGroup = categoryGroup.subcategories.get(subcategoryName);
          if (subcategoryGroup) {
            subcategoryGroup.count++;
            // Only include type data if it's not empty
            const finalItem = {
              ...itemObj,
              categoryName,
              subcategoryName
            };
            if (Object.keys(typeData).length > 0) {
              Object.assign(finalItem, typeData);
            }
            subcategoryGroup.items.push(finalItem);
          }
        }
      }
    });

    // Convert the Map structure to the final response format
    const groupedResponse = Array.from(groupedItems.values()).map(category => ({
      _id: category._id,
      name: category.name,
      count: category.count,
      subcategories: Array.from(category.subcategories.values() as unknown as Array<{ _id: Types.ObjectId; name: string; count: number; items: any[] }>).map(sub => ({
        _id: sub._id,
        name: sub.name,
        count: sub.count,
        items: sub.items
      }))
    }));

    return {
      items: groupedResponse
    };
  }

  async addItem(userId: string, profileId: string, category: string, subcategoryId: string, item: any, context?: ActivityContext) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate required parameters
    if (!category || !subcategoryId || !item || !item.title) {
      throw new Error('Missing required parameters: category, subcategoryId, item, and item.title are required');
    }

    let vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
      
    if (!vault) {
      vault = await Vault.create({
        userId: new Types.ObjectId(userId),
        profileId: new Types.ObjectId(profileId),
        storageUsed: 0,
        storageLimit: 21474836480 // 20GB default
      });
    }

    // Get user settings
    const settings = await this.settingsService.getSettings(userId, profileId);
    await this.validateFileUpload(userId, profileId, item, settings);

    let fileSize = 0;
    let uploadedImages: any = {};

    // Get or create category
    let categoryDoc = await VaultCategory.findOne({ 
      vaultId: vault._id,
      name: category 
    });
    if (!categoryDoc) {
      categoryDoc = await VaultCategory.create({
        vaultId: vault._id,
        name: category,
        order: await VaultCategory.countDocuments({ vaultId: vault._id })
      });
    }

    // Verify subcategory exists and belongs to the correct category
    const subcategoryDoc = await VaultSubcategory.findOne({
      vaultId: vault._id,
      categoryId: categoryDoc._id,
      _id: new Types.ObjectId(subcategoryId)
    });

    if (!subcategoryDoc) {
      throw new Error('Subcategory not found or does not belong to the specified category');
    }

    // Enhanced: Set default access level and security settings
    const accessLevel = item.accessLevel || 'private';
    const sharedWith = item.sharedWith || [];
    const pinRequired = item.pinRequired || false;
    const biometricRequired = item.biometricRequired || false;

    // Apply compression and encryption settings
    const compressionEnabled = settings?.specificSettings?.vaultCompressionEnabled ?? true;
    const encryptionEnabled = settings?.specificSettings?.vaultEncryptionEnabled ?? false;

    // Enhanced: Handle main file upload with processing status
    let extractedText = '';
    let ocrConfidence = 0;
    let processingStatus: 'pending' | 'completed' | 'failed' = 'completed';

    if (item.fileData) {
      try {
        processingStatus = 'pending';
        
      const uploadOptions = {
        folder: `vault/${profileId}/${category}/${subcategoryDoc.name}`,
        resourceType: this.getResourceTypeFromCategory(category),
        tags: [`vault-${category}`, `vault-${subcategoryDoc.name}`],
        transformation: compressionEnabled ? [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ] : undefined
      };

        const uploadResult = await this.uploadImageWithProcessing(
          item.fileData,
          uploadOptions.folder,
          uploadOptions.resourceType
        );
        
        item.fileUrl = uploadResult.url;
        fileSize = uploadResult.size;
      item.fileSize = fileSize;
        item.publicId = uploadResult.storageId;

        // Enhanced: OCR processing for documents and images
        if (uploadOptions.resourceType === 'image' && (category === 'Documents' || item.type === 'document')) {
          try {
            const ocrResult = await this.extractTextFromImage(uploadResult.url);
            extractedText = ocrResult.extractedText;
            ocrConfidence = ocrResult.confidence;
          } catch (error) {
            logger.warn('OCR processing failed:', error);
          }
        }

        processingStatus = 'completed';
      
      // Add encryption metadata if enabled
      if (encryptionEnabled) {
        item.metadata = {
          ...item.metadata,
          encrypted: true,
          encryptionMethod: 'AES-256'
        };
      }
      
      delete item.fileData;
      } catch (error) {
        processingStatus = 'failed';
        logger.error('File upload failed:', error);
        throw error;
      }
    }

    // Enhanced: Handle card images with new image processing
    if (item.card?.images) {
      const cardImages = item.card.images;
      
      if (cardImages.front?.fileData) {
        const uploadResult = await this.uploadImageWithProcessing(
          cardImages.front.fileData,
          `vault/${profileId}/${category}/${subcategoryDoc.name}/card/front`,
          'image'
        );
        uploadedImages.front = {
          url: uploadResult.url,
          storageId: uploadResult.storageId,
          storageProvider: 'cloudinary',
          mimeType: 'image/jpeg',
          size: uploadResult.size,
          uploadedAt: new Date(),
          cloudinaryPublicId: uploadResult.cloudinaryPublicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
          dimensions: uploadResult.dimensions,
          isProcessed: uploadResult.isProcessed
        };
        fileSize += uploadResult.size;
        delete cardImages.front.fileData;
      }

      if (cardImages.back?.fileData) {
        const uploadResult = await this.uploadImageWithProcessing(
          cardImages.back.fileData,
          `vault/${profileId}/${category}/${subcategoryDoc.name}/card/back`,
          'image'
        );
        uploadedImages.back = {
          url: uploadResult.url,
          storageId: uploadResult.storageId,
          storageProvider: 'cloudinary',
          mimeType: 'image/jpeg',
          size: uploadResult.size,
          uploadedAt: new Date(),
          cloudinaryPublicId: uploadResult.cloudinaryPublicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
          dimensions: uploadResult.dimensions,
          isProcessed: uploadResult.isProcessed
        };
        fileSize += uploadResult.size;
        delete cardImages.back.fileData;
      }

      if (cardImages.additional?.length) {
        uploadedImages.additional = await Promise.all(
          cardImages.additional.map(async (img: any) => {
            if (img.fileData) {
              const uploadResult = await this.uploadImageWithProcessing(
                img.fileData,
                `vault/${profileId}/${category}/${subcategoryDoc.name}/card/additional`,
                'image'
              );
              fileSize += uploadResult.size;
              delete img.fileData;
              return {
                url: uploadResult.url,
                storageId: uploadResult.storageId,
                storageProvider: 'cloudinary',
                mimeType: 'image/jpeg',
                size: uploadResult.size,
                uploadedAt: new Date(),
                cloudinaryPublicId: uploadResult.cloudinaryPublicId,
                thumbnailUrl: uploadResult.thumbnailUrl,
                dimensions: uploadResult.dimensions,
                isProcessed: uploadResult.isProcessed,
                description: img.description
              };
            }
            return img;
          })
        );
      }
      item.card.images = uploadedImages;
    }

    // Enhanced: Handle document images with OCR
    if (item.document?.images) {
      const docImages = item.document.images;
      let documentText = '';
      
      if (docImages.front?.fileData) {
        const uploadResult = await this.uploadImageWithProcessing(
          docImages.front.fileData,
          `vault/${profileId}/${category}/${subcategoryDoc.name}/document/front`,
          'image'
        );
        
        // OCR processing for document front image
        try {
          const ocrResult = await this.extractTextFromImage(uploadResult.url);
          documentText += ocrResult.extractedText + ' ';
          if (ocrResult.confidence > ocrConfidence) {
            ocrConfidence = ocrResult.confidence;
          }
        } catch (error) {
          logger.warn('OCR processing failed for document front:', error);
        }

        uploadedImages.front = {
          url: uploadResult.url,
          storageId: uploadResult.storageId,
          storageProvider: 'cloudinary',
          mimeType: 'image/jpeg',
          size: uploadResult.size,
          uploadedAt: new Date(),
          cloudinaryPublicId: uploadResult.cloudinaryPublicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
          dimensions: uploadResult.dimensions,
          isProcessed: uploadResult.isProcessed
        };
        fileSize += uploadResult.size;
        delete docImages.front.fileData;
      }

      if (docImages.back?.fileData) {
        const uploadResult = await this.uploadImageWithProcessing(
          docImages.back.fileData,
          `vault/${profileId}/${category}/${subcategoryDoc.name}/document/back`,
          'image'
        );
        
        // OCR processing for document back image
        try {
          const ocrResult = await this.extractTextFromImage(uploadResult.url);
          documentText += ocrResult.extractedText + ' ';
          if (ocrResult.confidence > ocrConfidence) {
            ocrConfidence = ocrResult.confidence;
          }
        } catch (error) {
          logger.warn('OCR processing failed for document back:', error);
        }

        uploadedImages.back = {
          url: uploadResult.url,
          storageId: uploadResult.storageId,
          storageProvider: 'cloudinary',
          mimeType: 'image/jpeg',
          size: uploadResult.size,
          uploadedAt: new Date(),
          cloudinaryPublicId: uploadResult.cloudinaryPublicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
          dimensions: uploadResult.dimensions,
          isProcessed: uploadResult.isProcessed
        };
        fileSize += uploadResult.size;
        delete docImages.back.fileData;
      }

      // Update extracted text with document content
      if (documentText.trim()) {
        extractedText = (extractedText + ' ' + documentText).trim();
      }

      item.document.images = uploadedImages;
    }

    // Enhanced: Handle identification images with OCR
    if (item.identification?.images) {
      const idImages = item.identification.images;
      let identificationText = '';
      
      if (idImages.front?.fileData) {
        const uploadResult = await this.uploadImageWithProcessing(
          idImages.front.fileData,
          `vault/${profileId}/${category}/${subcategoryDoc.name}/identification/front`,
          'image'
        );
        
        // OCR processing for ID front
        try {
          const ocrResult = await this.extractTextFromImage(uploadResult.url);
          identificationText += ocrResult.extractedText + ' ';
          if (ocrResult.confidence > ocrConfidence) {
            ocrConfidence = ocrResult.confidence;
          }
        } catch (error) {
          logger.warn('OCR processing failed for ID front:', error);
        }

        uploadedImages.front = {
          url: uploadResult.url,
          storageId: uploadResult.storageId,
          storageProvider: 'cloudinary',
          mimeType: 'image/jpeg',
          size: uploadResult.size,
          uploadedAt: new Date(),
          cloudinaryPublicId: uploadResult.cloudinaryPublicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
          dimensions: uploadResult.dimensions,
          isProcessed: uploadResult.isProcessed
        };
        fileSize += uploadResult.size;
        delete idImages.front.fileData;
      }

      if (idImages.back?.fileData) {
        const uploadResult = await this.uploadImageWithProcessing(
          idImages.back.fileData,
          `vault/${profileId}/${category}/${subcategoryDoc.name}/identification/back`,
          'image'
        );
        
        // OCR processing for ID back
        try {
          const ocrResult = await this.extractTextFromImage(uploadResult.url);
          identificationText += ocrResult.extractedText + ' ';
          if (ocrResult.confidence > ocrConfidence) {
            ocrConfidence = ocrResult.confidence;
          }
        } catch (error) {
          logger.warn('OCR processing failed for ID back:', error);
        }

        uploadedImages.back = {
          url: uploadResult.url,
          storageId: uploadResult.storageId,
          storageProvider: 'cloudinary',
          mimeType: 'image/jpeg',
          size: uploadResult.size,
          uploadedAt: new Date(),
          cloudinaryPublicId: uploadResult.cloudinaryPublicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
          dimensions: uploadResult.dimensions,
          isProcessed: uploadResult.isProcessed
        };
        fileSize += uploadResult.size;
        delete idImages.back.fileData;
      }

      // Update extracted text with identification content
      if (identificationText.trim()) {
        extractedText = (extractedText + ' ' + identificationText).trim();
      }

      item.identification.images = uploadedImages;
    }

    // Create vault item with enhanced features
    const vaultItem = await VaultItem.create({
      profileId: new Types.ObjectId(profileId),
      vaultId: vault._id,
      categoryId: categoryDoc._id,
      subcategoryId: subcategoryDoc._id,
      category,
      title: item.title,
      description: item.description,
      type: item.type,
      status: item.status || 'active',
      fileUrl: item.fileUrl,
      fileSize: item.fileSize,
      isEncrypted: encryptionEnabled,
      isFavorite: item.isFavorite || false,
      tags: item.tags || [],
      metadata: item.metadata || {},
      
      // Enhanced security features
      accessLevel,
      sharedWith: sharedWith.map((id: string) => new Types.ObjectId(id)),
      pinRequired,
      biometricRequired,
      
      // Enhanced intelligence features
      extractedText: extractedText || undefined,
      ocrConfidence: ocrConfidence > 0 ? ocrConfidence : undefined,
      processingStatus,
      
      // Type-specific data
      card: item.card,
      document: item.document,
      location: item.location,
      identification: item.identification,
      media: item.media
    });

    // Update vault storage
    await Vault.findByIdAndUpdate(vault._id, {
      $inc: { storageUsed: fileSize },
      lastAccessedAt: new Date()
    });

    // Create audit log entry for item creation
    await this.trackAccess(profileId, vaultItem._id.toString(), 'create', {
      category,
      subcategory: subcategoryDoc.name,
      title: item.title,
      fileSize,
      accessLevel,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    });

    // Schedule backup if enabled
    if (settings?.dataSettings?.autoDataBackup) {
      await this.scheduleItemBackup(vaultItem._id.toString(), userId);
    }

    return {
      item: vaultItem,
      message: 'Item added successfully',
      storageUsed: vault.storageUsed + fileSize,
      processingStatus,
      ocrConfidence: ocrConfidence > 0 ? ocrConfidence : undefined,
      extractedText: extractedText || undefined
    };
  }

  async updateItem(userId: string, profileId: string, itemId: string, updates: any) {
    const item = await VaultItem.findOne({
      _id: new Types.ObjectId(itemId),
      profileId: new Types.ObjectId(profileId)
    });

      if (!item) {
        throw new Error('Item not found');
      }

    // Create a version before updating
    const currentVersion = new VaultVersion({
      itemId: item._id,
      versionNumber: (await VaultVersion.countDocuments({ itemId: item._id })) + 1,
      data: item.toObject(),
      metadata: {
        changedBy: profileId,
        changeReason: updates.changeReason || 'Item updated'
      }
    });

    await currentVersion.save();

    let fileSize = 0;
    const uploadedImages: any = {};

    // Get category and subcategory names
    const category = await VaultCategory.findById(item.categoryId);
    const subcategory = await VaultSubcategory.findById(item.subcategoryId);

    // Handle main file update if present
    if (updates.fileData) {
      // Delete old file if it exists
      if (item.fileUrl) {
        await this.cloudinaryService.delete(item.metadata?.publicId);
      }

      const uploadOptions = {
        folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}`,
        resourceType: this.getResourceTypeFromCategory(category?.name || ''),
        tags: [`vault-${category?.name}`, `vault-${subcategory?.name}`]
      };

      const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(updates.fileData, uploadOptions);
      updates.fileUrl = uploadResult.secure_url;
      updates.fileSize = uploadResult.bytes;
      updates.metadata = {
        ...updates.metadata,
        publicId: uploadResult.public_id,
        fileSize: uploadResult.bytes
      };
      fileSize += uploadResult.bytes;
      delete updates.fileData;
    }

    // Handle card images update if present
    if (updates.card?.images) {
      const cardImages = updates.card.images;
      if (cardImages.front?.fileData) {
        // Delete old front image if exists
        if (item.card?.images?.front?.storageId) {
          await this.cloudinaryService.delete(item.card.images.front.storageId);
        }
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(cardImages.front.fileData, {
          folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/card/front`,
          resourceType: 'image'
        });
        uploadedImages.front = {
          url: uploadResult.secure_url,
          storageId: uploadResult.public_id,
          storageProvider: 'cloudinary',
          mimeType: uploadResult.format,
          size: uploadResult.bytes,
          uploadedAt: new Date(),
          metadata: {
            originalFormat: uploadResult.format,
            resourceType: uploadResult.resource_type
          }
        };
        fileSize += uploadResult.bytes;
        delete cardImages.front.fileData;
      }
      if (cardImages.back?.fileData) {
        // Delete old back image if exists
        if (item.card?.images?.back?.storageId) {
          await this.cloudinaryService.delete(item.card.images.back.storageId);
        }
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(cardImages.back.fileData, {
          folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/card/back`,
          resourceType: 'image'
        });
        uploadedImages.back = {
          url: uploadResult.secure_url,
          storageId: uploadResult.public_id,
          storageProvider: 'cloudinary',
          mimeType: uploadResult.format,
          size: uploadResult.bytes,
          uploadedAt: new Date(),
          metadata: {
            originalFormat: uploadResult.format,
            resourceType: uploadResult.resource_type
          }
        };
        fileSize += uploadResult.bytes;
        delete cardImages.back.fileData;
      }
      if (cardImages.additional?.length) {
        uploadedImages.additional = await Promise.all(
          cardImages.additional.map(async (img: any, index: number) => {
            if (img.fileData) {
              const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(img.fileData, {
                folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/card/additional`,
                resourceType: 'image'
              });
              fileSize += uploadResult.bytes;
              delete img.fileData;
              return {
                url: uploadResult.secure_url,
                storageId: uploadResult.public_id,
                storageProvider: 'cloudinary',
                mimeType: uploadResult.format,
                size: uploadResult.bytes,
                uploadedAt: new Date(),
                description: img.description,
                metadata: {
                  originalFormat: uploadResult.format,
                  resourceType: uploadResult.resource_type
                }
              };
            }
            return img;
          })
        );
      }
      updates.card.images = uploadedImages;
    }

    // Handle document images update if present
    if (updates.document?.images) {
      const docImages = updates.document.images;
      if (docImages.front?.fileData) {
        // Delete old front image if exists
        if (item.document?.images?.front?.storageId) {
          await this.cloudinaryService.delete(item.document.images.front.storageId);
        }
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(docImages.front.fileData, {
          folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/document/front`,
          resourceType: 'image'
        });
        uploadedImages.front = {
          url: uploadResult.secure_url,
          storageId: uploadResult.public_id,
          storageProvider: 'cloudinary',
          mimeType: uploadResult.format,
          size: uploadResult.bytes,
          uploadedAt: new Date(),
          metadata: {
            originalFormat: uploadResult.format,
            resourceType: uploadResult.resource_type
          }
        };
        fileSize += uploadResult.bytes;
        delete docImages.front.fileData;
      }
      if (docImages.back?.fileData) {
        // Delete old back image if exists
        if (item.document?.images?.back?.storageId) {
          await this.cloudinaryService.delete(item.document.images.back.storageId);
        }
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(docImages.back.fileData, {
          folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/document/back`,
          resourceType: 'image'
        });
        uploadedImages.back = {
          url: uploadResult.secure_url,
          storageId: uploadResult.public_id,
          storageProvider: 'cloudinary',
          mimeType: uploadResult.format,
          size: uploadResult.bytes,
          uploadedAt: new Date(),
          metadata: {
            originalFormat: uploadResult.format,
            resourceType: uploadResult.resource_type
          }
        };
        fileSize += uploadResult.bytes;
        delete docImages.back.fileData;
      }
      if (docImages.additional?.length) {
        uploadedImages.additional = await Promise.all(
          docImages.additional.map(async (img: any, index: number) => {
            if (img.fileData) {
              const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(img.fileData, {
                folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/document/additional`,
                resourceType: 'image'
              });
              fileSize += uploadResult.bytes;
              delete img.fileData;
              return {
                url: uploadResult.secure_url,
                storageId: uploadResult.public_id,
                storageProvider: 'cloudinary',
                mimeType: uploadResult.format,
                size: uploadResult.bytes,
                uploadedAt: new Date(),
                description: img.description,
                metadata: {
                  originalFormat: uploadResult.format,
                  resourceType: uploadResult.resource_type
                }
              };
            }
            return img;
          })
        );
      }
      updates.document.images = uploadedImages;
    }

    // Handle identification images update if present
    if (updates.identification?.images) {
      const idImages = updates.identification.images;
      if (idImages.front?.fileData) {
        // Delete old front image if exists
        if (item.identification?.images?.front?.storageId) {
          await this.cloudinaryService.delete(item.identification.images.front.storageId);
        }
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(idImages.front.fileData, {
          folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/identification/front`,
          resourceType: 'image'
        });
        uploadedImages.front = {
          url: uploadResult.secure_url,
          storageId: uploadResult.public_id,
          storageProvider: 'cloudinary',
          mimeType: uploadResult.format,
          size: uploadResult.bytes,
          uploadedAt: new Date(),
          metadata: {
            originalFormat: uploadResult.format,
            resourceType: uploadResult.resource_type
          }
        };
        fileSize += uploadResult.bytes;
        delete idImages.front.fileData;
      }
      if (idImages.back?.fileData) {
        // Delete old back image if exists
        if (item.identification?.images?.back?.storageId) {
          await this.cloudinaryService.delete(item.identification.images.back.storageId);
        }
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(idImages.back.fileData, {
          folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/identification/back`,
          resourceType: 'image'
        });
        uploadedImages.back = {
          url: uploadResult.secure_url,
          storageId: uploadResult.public_id,
          storageProvider: 'cloudinary',
          mimeType: uploadResult.format,
          size: uploadResult.bytes,
          uploadedAt: new Date(),
          metadata: {
            originalFormat: uploadResult.format,
            resourceType: uploadResult.resource_type
          }
        };
        fileSize += uploadResult.bytes;
        delete idImages.back.fileData;
      }
      if (idImages.additional?.length) {
        uploadedImages.additional = await Promise.all(
          idImages.additional.map(async (img: any, index: number) => {
            if (img.fileData) {
              const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(img.fileData, {
                folder: `vault/${item.profileId}/${category?.name}/${subcategory?.name}/identification/additional`,
                resourceType: 'image'
              });
              fileSize += uploadResult.bytes;
              delete img.fileData;
              return {
                url: uploadResult.secure_url,
                storageId: uploadResult.public_id,
                storageProvider: 'cloudinary',
                mimeType: uploadResult.format,
                size: uploadResult.bytes,
                uploadedAt: new Date(),
                description: img.description,
                metadata: {
                  originalFormat: uploadResult.format,
                  resourceType: uploadResult.resource_type
                }
              };
            }
            return img;
          })
        );
      }
      updates.identification.images = uploadedImages;
    }

    // Update vault storage
    const vault = await Vault.findById(item.vaultId);
    if (vault) {
      vault.storageUsed = (vault.storageUsed || 0) - (item.metadata?.fileSize || 0) + fileSize;
      await vault.save();
    }

    // Apply updates
    Object.assign(item, updates);
    
    // Ensure fileSize is set if we uploaded a file
    if (updates.fileSize) {
      item.fileSize = updates.fileSize;
    }
    
    await item.save();

    // Create audit log entry for item update
    await this.trackAccess(profileId, itemId, 'update', {
      updatedFields: Object.keys(updates),
      fileUpdated: !!updates.fileData || !!(updates.card?.images || updates.document?.images || updates.identification?.images),
      userId
    });

    return item;
  }

  async deleteItem(profileId: string, itemId: string) {
    const item = await VaultItem.findById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    // Delete file if it exists
    if (item.fileUrl) {
      await this.cloudinaryService.delete(item.metadata?.publicId);
    }

    // Update vault storage
    const vault = await Vault.findById(item.vaultId);
    if (vault) {
      vault.storageUsed = Math.max(0, (vault.storageUsed || 0) - (item.metadata?.fileSize || 0));
      await vault.save();
    }

    // Delete the item
    await VaultItem.findByIdAndDelete(itemId);
  }

  private getResourceTypeFromCategory(category: string): 'image' | 'video' | 'raw' | 'auto' {
    switch (category.toLowerCase()) {
      case 'media':
        return 'image';
      case 'documents':
        return 'raw';
      default:
        return 'auto';
    }
  }

  async getCategories(profileId: string) {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      return this.getDefaultCategories();
    }

    // Get existing categories
    const existingCategories = await VaultCategory.find({ vaultId: vault._id })
      .sort({ order: 1 });

    // Get default categories
    const defaultCategories = this.getDefaultCategories();

    // Check which default categories are missing
    for (const defaultCat of defaultCategories) {
      const existingCategory = existingCategories.find(cat => cat.name === defaultCat.name);
      
      if (!existingCategory) {
        // Create the missing default category
        const category = await VaultCategory.create({
          vaultId: vault._id,
          name: defaultCat.name,
          order: existingCategories.length
        });

        // Create its subcategories
        await Promise.all(
          defaultCat.subcategories.map(async (sub, index) => {
            return VaultSubcategory.create({
              vaultId: vault._id,
              categoryId: category._id,
              name: sub.name,
              order: index
            });
          })
        );

        existingCategories.push(category);
      } else {
        // Check for missing subcategories in existing category
        const existingSubcategories = await VaultSubcategory.find({
          vaultId: vault._id,
          categoryId: existingCategory._id
        });

        // Find missing subcategories
        const missingSubcategories = defaultCat.subcategories.filter(
          defaultSub => !existingSubcategories.some(existingSub => existingSub.name === defaultSub.name)
        );

        // Create missing subcategories
        if (missingSubcategories.length > 0) {
          await Promise.all(
            missingSubcategories.map(async (sub, index) => {
              return VaultSubcategory.create({
                vaultId: vault._id,
                categoryId: existingCategory._id,
                name: sub.name,
                order: existingSubcategories.length + index
              });
            })
          );
        }
      }
    }

    // Return all categories with their subcategories
    return Promise.all(
      existingCategories.map(async (category) => {
        const subcategories = await VaultSubcategory.find({
          vaultId: vault._id,
          categoryId: category._id
        }).sort({ order: 1 });

        return {
          _id: category._id,
          name: category.name,
          order: category.order,
          subcategories: subcategories.map(sub => ({
            _id: sub._id,
            name: sub.name,
            order: sub.order
          }))
        };
      })
    );
  }

  async createCategory(profileId: string, categoryName: string, subcategories: string[]) {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw new Error('Vault not found');
    }

    // Check if category already exists
    const existingCategory = await VaultCategory.findOne({
      vaultId: vault._id,
      name: categoryName
    });
    if (existingCategory) {
      throw new Error('Category already exists');
    }

    // Create new category
    const category = await VaultCategory.create({
      vaultId: vault._id,
      name: categoryName,
      order: await VaultCategory.countDocuments({ vaultId: vault._id })
    });

    // Create subcategories
    const subcategoryDocs = await Promise.all(
      subcategories.map(async (name, index) => {
        return VaultSubcategory.create({
          vaultId: vault._id,
          categoryId: category._id,
          name,
          order: index
        });
      })
    );

    return {
      _id: category._id,
      name: category.name,
      order: category.order,
      subcategories: subcategoryDocs.map(sub => ({
        _id: sub._id,
        name: sub.name,
        order: sub.order
      }))
    };
  }

  async createSubcategory(profileId: string, categoryName: string, subcategoryName: string, parentId?: string) {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw new Error('Vault not found');
    }

    const category = await VaultCategory.findOne({
      vaultId: vault._id,
      name: categoryName
    });
    if (!category) {
      throw new Error('Category not found');
    }

    // If parentId is provided, verify it exists
    if (parentId) {
      const parentSubcategory = await VaultSubcategory.findOne({
        vaultId: vault._id,
        categoryId: category._id,
        _id: new Types.ObjectId(parentId)
      });
      if (!parentSubcategory) {
        throw new Error('Parent subcategory not found');
      }
    }

    const existingSubcategory = await VaultSubcategory.findOne({
      vaultId: vault._id,
      categoryId: category._id,
      parentId: parentId ? new Types.ObjectId(parentId) : { $exists: false },
      name: subcategoryName
    });
    if (existingSubcategory) {
      throw new Error('Subcategory already exists in this location');
    }

    const subcategory = await VaultSubcategory.create({
      vaultId: vault._id,
      categoryId: category._id,
      parentId: parentId ? new Types.ObjectId(parentId) : undefined,
      name: subcategoryName,
      order: await VaultSubcategory.countDocuments({
        vaultId: vault._id,
        categoryId: category._id,
        parentId: parentId ? new Types.ObjectId(parentId) : { $exists: false }
      })
    });

    return {
      _id: subcategory._id,
      name: subcategory.name,
      order: subcategory.order,
      parentId: subcategory.parentId
    };
  }

  async getItemById(profileId: string, itemId: string) {
    const item = await VaultItem.findById(itemId);
    if (!item) return null;

    const category = await VaultCategory.findById(item.categoryId);
    const subcategory = await VaultSubcategory.findById(item.subcategoryId);

    const itemObj = item.toObject() as Record<string, any>;
    const typeData = itemObj[itemObj.type] || {};
    delete itemObj[itemObj.type];

    // Remove empty document field if it exists
    if (itemObj.document && (!itemObj.document.tags || itemObj.document.tags.length === 0)) {
      delete itemObj.document;
    }

    const result = {
      ...itemObj,
      categoryName: category?.name,
      subcategoryName: subcategory?.name
    };

    // Only include type data if it's not empty
    if (Object.keys(typeData).length > 0) {
      Object.assign(result, typeData);
    }

    return result;
  }

  async uploadAndAddToVault(
    userId: string,
    profileId: string,
    fileData: string,
    category: string,
    subcategory: string,
    metadata: any = {}
  ) {
    const uploadOptions = {
      folder: `vault/${profileId}/${category}/${subcategory}`,
      resourceType: this.getResourceTypeFromCategory(category),
      tags: [`vault-${category}`, `vault-${subcategory}`]
    };

    const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(fileData, uploadOptions);
    
    // Find or create subcategory by name
    let vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      // log error
      console.error('Vault not found');

      // create vault with userId
      vault = await Vault.create({
        userId: new Types.ObjectId(userId),
        profileId: new Types.ObjectId(profileId),
        storageLimit: 1000000000,
        storageUsed: 0
      });

      // Create default categories when vault is created
      const defaultCategories = this.getDefaultCategories();
      await Promise.all(
        defaultCategories.map(async (defaultCat) => {
          const categoryDoc = await VaultCategory.create({
            vaultId: vault?._id,
            name: defaultCat.name,
            order: 0
          });

          // Create subcategories
          return Promise.all(
            defaultCat.subcategories.map(async (sub, index) => {
              return VaultSubcategory.create({
                vaultId: vault?._id,
                categoryId: categoryDoc._id,
                name: sub.name,
                order: index
              });
            })
          );
        })
      );
    }

    // Find category by name
    const categoryDoc = await VaultCategory.findOne({
      vaultId: vault._id,
      name: { $regex: new RegExp(`^${category}$`, 'i') }
    });

    if (!categoryDoc) {
      throw new Error(`Category '${category}' not found`);
    }

    // Find or create subcategory by name
    let subcategoryDoc = await VaultSubcategory.findOne({
      vaultId: vault._id,
      categoryId: categoryDoc._id,
      name: { $regex: new RegExp(`^${subcategory}$`, 'i') }
    });

    if (!subcategoryDoc) {
      // Create the subcategory if it doesn't exist
      subcategoryDoc = new VaultSubcategory({
        vaultId: vault._id,
        categoryId: categoryDoc._id,
        name: subcategory,
        order: await VaultSubcategory.countDocuments({
          vaultId: vault._id,
          categoryId: categoryDoc._id
        })
      });
      await subcategoryDoc.save();
    }
    
    // Add to vault using subcategory ID
    const item = {
      type: 'document',
      category,
      title: uploadResult.original_filename || `file-${Date.now()}`,
      description: metadata.description || '',
      fileUrl: uploadResult.secure_url,
      fileSize: uploadResult.bytes,
      publicId: uploadResult.public_id,
      metadata: {
        ...metadata,
        originalFormat: uploadResult.format,
        resourceType: uploadResult.resource_type
      }
    };

    await this.addItem(userId, profileId, category, subcategoryDoc._id.toString(), item);
    return uploadResult;
  }

  async getSubcategories(profileId: string, categoryIdentifier: string, parentId?: string): Promise<ISubcategoryWithChildren[]> {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw new Error('Vault not found');
    }

    let category;
    if (Types.ObjectId.isValid(categoryIdentifier)) {
      category = await VaultCategory.findOne({
        vaultId: vault._id,
        _id: new Types.ObjectId(categoryIdentifier)
      });
    } else {
      const escapedIdentifier = categoryIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      category = await VaultCategory.findOne({
        vaultId: vault._id,
        name: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') }
      });
    }

    if (!category) {
      throw new Error('Category not found');
    }

    // Query for immediate children only
    const query: any = {
      vaultId: vault._id,
      categoryId: category._id,
      status: { $ne: 'archived' }  // Exclude archived subcategories
    };

    if (parentId) {
      query.parentId = new Types.ObjectId(parentId);
    } else {
      query.parentId = { $exists: false }; // Get only top-level subcategories
    }

    const subcategories = await VaultSubcategory.find(query).sort({ order: 1 });

    // Get item counts and items for each subcategory
    const subcategoriesWithChildren = await Promise.all(
      subcategories.map(async (sub) => {
        // Check if subcategory has children
        const hasChildren = await VaultSubcategory.exists({
          vaultId: vault._id,
          categoryId: category._id,
          parentId: sub._id,
          status: { $ne: 'archived' }  // Exclude archived children
        });

        // Get item count and items for this subcategory
        const [count, items] = await Promise.all([
          VaultItem.countDocuments({
            vaultId: vault._id,
            subcategoryId: sub._id,
            status: { $ne: 'archived' }  // Exclude archived items
          }),
          VaultItem.find({
            vaultId: vault._id,
            subcategoryId: sub._id,
            status: { $ne: 'archived' }  // Exclude archived items
          }).sort({ createdAt: -1 })
        ]);

        // Get child subcategories
        const childSubcategories = await VaultSubcategory.find({
          vaultId: vault._id,
          categoryId: category._id,
          parentId: sub._id,
          status: { $ne: 'archived' }  // Exclude archived children
        }).sort({ order: 1 });

        // Get items for child subcategories
        const childSubcategoriesWithItems = await Promise.all(
          childSubcategories.map(async (childSub) => {
            const [childCount, childItems] = await Promise.all([
              VaultItem.countDocuments({
                vaultId: vault._id,
                subcategoryId: childSub._id
              }),
              VaultItem.find({
                vaultId: vault._id,
                subcategoryId: childSub._id
              }).sort({ createdAt: -1 })
            ]);

            return {
              _id: childSub._id,
              name: childSub.name,
              order: childSub.order,
              hasChildren: false, // We're not loading deeper levels
              count: childCount,
              status: childSub.status,
              items: childItems.map(item => ({
                _id: item._id,
                title: item.title,
                type: item.type,
                createdAt: item.createdAt
              })),
              subcategories: []
            };
          })
        );

        return {
          _id: sub._id,
          name: sub.name,
          order: sub.order,
          hasChildren: !!hasChildren,
          count: count + childSubcategoriesWithItems.reduce((sum, child) => sum + child.count, 0),
          status: sub.status,
          items: items.map(item => ({
            _id: item._id,
            title: item.title,
            type: item.type,
            createdAt: item.createdAt
          })),
          subcategories: childSubcategoriesWithItems
        };
      })
    );

    return subcategoriesWithChildren;
  }

  async getNestedSubcategories(profileId: string, subcategoryId: string): Promise<ISubcategoryWithChildren[]> {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw createHttpError(404, 'Vault not found');
    }

    const parentSubcategory = await VaultSubcategory.findOne({
      vaultId: vault._id,
      _id: new Types.ObjectId(subcategoryId),
      status: { $ne: 'archived' }  // Exclude archived parent subcategory
    });

    if (!parentSubcategory) {
      throw createHttpError(404, 'Subcategory not found');
    }

    // Get immediate children
    const subcategories = await VaultSubcategory.find({
      vaultId: vault._id,
      categoryId: parentSubcategory.categoryId,
      parentId: parentSubcategory._id,
      status: { $ne: 'archived' }  // Exclude archived subcategories
    }).sort({ order: 1 });

    // Get item counts and items for each subcategory
    const subcategoriesWithChildren = await Promise.all(
      subcategories.map(async (sub) => {
        // Check if subcategory has children
        const hasChildren = await VaultSubcategory.exists({
          vaultId: vault._id,
          categoryId: parentSubcategory.categoryId,
          parentId: sub._id,
          status: { $ne: 'archived' }  // Exclude archived children
        });

        // Get item count and items for this subcategory
        const [count, items] = await Promise.all([
          VaultItem.countDocuments({
            vaultId: vault._id,
            subcategoryId: sub._id,
            status: { $ne: 'archived' }  // Exclude archived items
          }),
          VaultItem.find({
            vaultId: vault._id,
            subcategoryId: sub._id,
            status: { $ne: 'archived' }  // Exclude archived items
          }).sort({ createdAt: -1 })
        ]);

        // Get child subcategories
        const childSubcategories = await VaultSubcategory.find({
          vaultId: vault._id,
          categoryId: parentSubcategory.categoryId,
          parentId: sub._id,
          status: { $ne: 'archived' }  // Exclude archived children
        }).sort({ order: 1 });

        // Get items for child subcategories
        const childSubcategoriesWithItems = await Promise.all(
          childSubcategories.map(async (childSub) => {
            const [childCount, childItems] = await Promise.all([
              VaultItem.countDocuments({
                vaultId: vault._id,
                subcategoryId: childSub._id,
                status: { $ne: 'archived' }  // Exclude archived items
              }),
              VaultItem.find({
                vaultId: vault._id,
                subcategoryId: childSub._id,
                status: { $ne: 'archived' }  // Exclude archived items
              }).sort({ createdAt: -1 })
            ]);

            return {
              _id: childSub._id,
              name: childSub.name,
              order: childSub.order,
              hasChildren: false, // We're not loading deeper levels
              count: childCount,
              status: childSub.status,
              items: childItems.map(item => ({
                _id: item._id,
                title: item.title,
                type: item.type,
                createdAt: item.createdAt
              })),
              subcategories: []
            };
          })
        );

        return {
          _id: sub._id,
          name: sub.name,
          order: sub.order,
          hasChildren: !!hasChildren,
          count: count + childSubcategoriesWithItems.reduce((sum, child) => sum + child.count, 0),
          status: sub.status,
          items: items.map(item => ({
            _id: item._id,
            title: item.title,
            type: item.type,
            createdAt: item.createdAt
          })),
          subcategories: childSubcategoriesWithItems
        };
      })
    );

    return subcategoriesWithChildren;
  }

  async clearAllVaultItems(profileId: string) {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw new Error('Vault not found');
    }

    // Get all items
    const items = await VaultItem.find({ vaultId: vault._id });

    // Delete all files from cloudinary
    for (const item of items) {
      // Delete main file if exists
      if (item.fileUrl) {
        await this.cloudinaryService.delete(item.metadata?.publicId);
      }

      // Delete card images
      if (item.card?.images) {
        if (item.card.images.front?.storageId) {
          await this.cloudinaryService.delete(item.card.images.front.storageId);
        }
        if (item.card.images.back?.storageId) {
          await this.cloudinaryService.delete(item.card.images.back.storageId);
        }
        if (item.card.images.additional) {
          for (const img of item.card.images.additional) {
            if (img.storageId) {
              await this.cloudinaryService.delete(img.storageId);
            }
          }
        }
      }

      // Delete document images
      if (item.document?.images) {
        if (item.document.images.front?.storageId) {
          await this.cloudinaryService.delete(item.document.images.front.storageId);
        }
        if (item.document.images.back?.storageId) {
          await this.cloudinaryService.delete(item.document.images.back.storageId);
        }
        if (item.document.images.additional) {
          for (const img of item.document.images.additional) {
            if (img.storageId) {
              await this.cloudinaryService.delete(img.storageId);
            }
          }
        }
      }

      // Delete identification images
      if (item.identification?.images) {
        if (item.identification.images.front?.storageId) {
          await this.cloudinaryService.delete(item.identification.images.front.storageId);
        }
        if (item.identification.images.back?.storageId) {
          await this.cloudinaryService.delete(item.identification.images.back.storageId);
        }
        if (item.identification.images.additional) {
          for (const img of item.identification.images.additional) {
            if (img.storageId) {
              await this.cloudinaryService.delete(img.storageId);
            }
          }
        }
      }
    }

    // Delete all items
    await VaultItem.deleteMany({ vaultId: vault._id });

    // Delete all subcategories
    await VaultSubcategory.deleteMany({ vaultId: vault._id });

    // Delete all categories
    await VaultCategory.deleteMany({ vaultId: vault._id });

    // Reset vault storage
    vault.storageUsed = 0;
    await vault.save();

    return { message: 'All vault items, categories, and subcategories cleared successfully' };
  }

  async moveSubcategory(profileId: string, subcategoryId: string, newParentId?: string) {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(profileId)) {
      throw new Error('Invalid profile ID format');
    }
    if (!Types.ObjectId.isValid(subcategoryId)) {
      throw new Error('Subcategory not found');
    }
    if (newParentId && !Types.ObjectId.isValid(newParentId)) {
      throw new Error('Invalid parent subcategory ID format');
    }

    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw new Error('Vault not found');
    }

    const subcategory = await VaultSubcategory.findOne({
      vaultId: vault._id,
      _id: new Types.ObjectId(subcategoryId)
    });
    if (!subcategory) {
      throw new Error('Subcategory not found');
    }

    // Prevent circular references
    if (newParentId) {
      // Start from the new parent and traverse upward
      let currentParent = await VaultSubcategory.findById(newParentId);
      
      while (currentParent) {
        // If we encounter the subcategory we're trying to move in the ancestry chain, it's circular
        if (currentParent._id.toString() === subcategoryId) {
          throw new Error('Cannot move subcategory to its own descendant');
        }
        // Move up to the next parent
        currentParent = currentParent.parentId ? await VaultSubcategory.findById(currentParent.parentId) : null;
      }
    }

    // Update the subcategory
    subcategory.parentId = newParentId ? new Types.ObjectId(newParentId) : undefined;
    await subcategory.save();

    return {
      _id: subcategory._id,
      name: subcategory.name,
      order: subcategory.order,
      parentId: subcategory.parentId
    };
  }

  async deleteSubcategory(profileId: string, subcategoryId: string): Promise<void> {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(profileId)) {
      throw createHttpError(400, 'Invalid profile ID format');
    }
    if (!Types.ObjectId.isValid(subcategoryId)) {
      throw createHttpError(404, 'Subcategory not found');
    }

    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw createHttpError(404, 'Vault not found');
    }

    // Find the subcategory
    const subcategory = await VaultSubcategory.findOne({
      vaultId: vault._id,
      _id: new Types.ObjectId(subcategoryId)
    });

    if (!subcategory) {
      throw createHttpError(404, 'Subcategory not found');
    }

    // Get all child subcategory IDs recursively
    const childSubcategoryIds = await this.getAllChildSubcategoryIds(subcategory);

    // Get all items to be archived
    const items = await VaultItem.find({
      vaultId: vault._id,
      subcategoryId: { $in: [new Types.ObjectId(subcategoryId), ...childSubcategoryIds.map(id => new Types.ObjectId(id))] }
    });

    // Archive items instead of deleting
    for (const item of items) {
      // Move files to archive folder in cloudinary if they exist
      if (item.fileUrl) {
        await this.cloudinaryService.moveToArchive(item.metadata?.publicId);
      }

      // Handle card images
      if (item.card?.images) {
        if (item.card.images.front?.storageId) {
          await this.cloudinaryService.moveToArchive(item.card.images.front.storageId);
        }
        if (item.card.images.back?.storageId) {
          await this.cloudinaryService.moveToArchive(item.card.images.back.storageId);
        }
        if (item.card.images.additional) {
          for (const img of item.card.images.additional) {
            if (img.storageId) {
              await this.cloudinaryService.moveToArchive(img.storageId);
            }
          }
        }
      }

      // Handle document images
      if (item.document?.images) {
        if (item.document.images.front?.storageId) {
          await this.cloudinaryService.moveToArchive(item.document.images.front.storageId);
        }
        if (item.document.images.back?.storageId) {
          await this.cloudinaryService.moveToArchive(item.document.images.back.storageId);
        }
        if (item.document.images.additional) {
          for (const img of item.document.images.additional) {
            if (img.storageId) {
              await this.cloudinaryService.moveToArchive(img.storageId);
            }
          }
        }
      }

      // Handle identification images
      if (item.identification?.images) {
        if (item.identification.images.front?.storageId) {
          await this.cloudinaryService.moveToArchive(item.identification.images.front.storageId);
        }
        if (item.identification.images.back?.storageId) {
          await this.cloudinaryService.moveToArchive(item.identification.images.back.storageId);
        }
        if (item.identification.images.additional) {
          for (const img of item.identification.images.additional) {
            if (img.storageId) {
              await this.cloudinaryService.moveToArchive(img.storageId);
            }
          }
        }
      }

      // Mark item as archived
      await VaultItem.findByIdAndUpdate(item._id, {
        $set: {
          status: 'archived',
          archivedAt: new Date(),
          archivedBy: new Types.ObjectId(profileId)
        }
      });
    }

    // Archive subcategories instead of deleting
    await VaultSubcategory.updateMany(
      {
        vaultId: vault._id,
        _id: { $in: [new Types.ObjectId(subcategoryId), ...childSubcategoryIds.map(id => new Types.ObjectId(id))] }
      },
      {
        $set: {
          status: 'archived',
          archivedAt: new Date(),
          archivedBy: new Types.ObjectId(profileId)
        }
      }
    );
  }

  private async getAllChildSubcategoryIds(subcategory: IVaultSubcategory): Promise<string[]> {
    const ids: string[] = [subcategory._id.toString()];
    
    const children = await VaultSubcategory.find({
      vaultId: subcategory.vaultId,
      parentId: subcategory._id
    });

    for (const child of children) {
      ids.push(...await this.getAllChildSubcategoryIds(child));
    }
    
    return ids;
  }

  /**
   * Check if a profile can access another profile's vault based on privacy settings
   */
  private async checkVaultAccessPermissions(
    requestingProfileId: string,
    targetProfileId: string,
    vaultCategory?: 'wallet' | 'documents' | 'media'
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Get target profile
      const targetProfile = await ProfileModel.findById(targetProfileId);
      if (!targetProfile) {
        return { allowed: false, reason: 'Target profile not found' };
      }

      // If requesting profile is the same as target, always allow
      if (requestingProfileId === targetProfileId) {
        return { allowed: true };
      }

      // Get target profile's settings
      const targetSettings = await this.settingsService.getSettings((targetProfile as any).profileInformation.creator.toString(), targetProfileId);
      if (!targetSettings) {
        return { allowed: false, reason: 'Target profile settings not found' };
      }

      // Check if requesting profile is blocked
      if (targetSettings.blockingSettings?.blockedProfiles?.includes(requestingProfileId)) {
        return { allowed: false, reason: 'You are blocked by this profile' };
      }

      // Check general vault visibility
      const vaultVisibility = targetSettings.privacy?.Visibility?.profile?.vault;
      if (!vaultVisibility) {
        return { allowed: false, reason: 'Vault visibility settings not configured' };
      }

      // Check category-specific visibility if specified
      let categoryVisibility = vaultVisibility;
      if (vaultCategory && targetSettings.privacy?.Visibility?.vault?.[vaultCategory]) {
        categoryVisibility = targetSettings.privacy.Visibility.vault[vaultCategory];
      }

      // Apply visibility rules
      switch (categoryVisibility.level) {
        case 'Public':
          return { allowed: true };
        
        case 'OnlyMe':
          return { allowed: false, reason: 'Vault is private' };
        
        case 'ConnectionsOnly':
          // Check if profiles are connected
          const areConnected = await this.checkIfProfilesConnected(requestingProfileId, targetProfileId);
          if (!areConnected) {
            return { allowed: false, reason: 'Vault access limited to connections only' };
          }
          return { allowed: true };
        
        case 'Custom':
          if (categoryVisibility.customUsers?.includes(requestingProfileId)) {
            return { allowed: true };
          }
          return { allowed: false, reason: 'You do not have custom access to this vault' };
        
        default:
          return { allowed: false, reason: 'Invalid visibility setting' };
      }
    } catch (error) {
      logger.error('Error checking vault access permissions:', error);
      return { allowed: false, reason: 'Error checking permissions' };
    }
  }

  /**
   * Check if a profile can perform specific actions on vault items (share, export, download)
   */
  private async checkVaultActionPermissions(
    requestingProfileId: string,
    targetProfileId: string,
    action: 'share' | 'export' | 'download'
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Get target profile
      const targetProfile = await ProfileModel.findById(targetProfileId);
      if (!targetProfile) {
        return { allowed: false, reason: 'Target profile not found' };
      }

      // If requesting profile is the same as target, always allow
      if (requestingProfileId === targetProfileId) {
        return { allowed: true };
      }

      // Get target profile's settings
      const actionTargetSettings = await this.settingsService.getSettings((targetProfile as any).profileInformation.creator.toString(), targetProfileId);
      if (!actionTargetSettings) {
        return { allowed: false, reason: 'Target profile settings not found' };
      }

      // Check if requesting profile is blocked
      if (actionTargetSettings.blockingSettings?.blockedProfiles?.includes(requestingProfileId)) {
        return { allowed: false, reason: 'You are blocked by this profile' };
      }

      // Check action-specific permissions
      const actionPermission = actionTargetSettings.privacy?.permissions?.[action];
      if (!actionPermission) {
        return { allowed: false, reason: `${action} permission not configured` };
      }

      // Apply permission rules
      switch (actionPermission.level) {
        case 'Public':
          return { allowed: true };
        
        case 'NoOne':
          return { allowed: false, reason: `${action} is disabled for all profiles` };
        
        case 'ConnectionsOnly':
          const areConnected = await this.checkIfProfilesConnected(requestingProfileId, targetProfileId);
          if (!areConnected) {
            return { allowed: false, reason: `${action} limited to connections only` };
          }
          return { allowed: true };
        
        case 'Custom':
          if (actionPermission.customUsers?.includes(requestingProfileId)) {
            return { allowed: true };
          }
          return { allowed: false, reason: `You do not have custom ${action} access` };
        
        default:
          return { allowed: false, reason: `Invalid ${action} permission setting` };
      }
    } catch (error) {
      logger.error(`Error checking vault ${action} permissions:`, error);
      return { allowed: false, reason: 'Error checking permissions' };
    }
  }

  /**
   * Check if activity logging should be enabled for vault operations
   */
  private async shouldLogVaultActivity(userId: string, profileId: string): Promise<boolean> {
    try {
      const settings = await this.settingsService.getSettings(userId, profileId);
      return settings?.dataSettings?.activityLogsEnabled ?? true; // Default to true
    } catch (error) {
      logger.error('Error checking activity logging setting:', error);
      return true; // Default to logging on error
    }
  }

  /**
   * Check if profiles are connected through various connection types
   */
  private async checkIfProfilesConnected(profileId1: string, profileId2: string): Promise<boolean> {
    try {
      // Check if profiles are the same (always connected to self)
      if (profileId1 === profileId2) {
        return true;
      }

      // Method 1: Check Connection model for accepted connections
      const connectionExists = await Connection.findOne({
        $or: [
          { fromProfile: profileId1, toProfile: profileId2, status: 'accepted' },
          { fromProfile: profileId2, toProfile: profileId1, status: 'accepted' }
        ]
      });

      if (connectionExists) {
        return true;
      }

      // Method 2: Check ProfileConnectionModel for accepted connections
      const profileConnectionExists = await ProfileConnectionModel.findOne({
        $or: [
          { requesterId: profileId1, receiverId: profileId2, status: 'ACCEPTED' },
          { requesterId: profileId2, receiverId: profileId1, status: 'ACCEPTED' }
        ]
      });

      if (profileConnectionExists) {
        return true;
      }

      // Method 3: Check profile arrays for direct connections
      const profile1 = await ProfileModel.findById(profileId1);
      const profile2 = await ProfileModel.findById(profileId2);

      if (profile1 && profile2) {
        // Check if they are in each other's connected profiles
        const profile1Connected = profile1.profileInformation?.connectedProfiles?.some(
          (id: any) => id.toString() === profileId2
        );
        const profile2Connected = profile2.profileInformation?.connectedProfiles?.some(
          (id: any) => id.toString() === profileId1
        );

        if (profile1Connected || profile2Connected) {
          return true;
        }

        // Check if they are following each other (mutual follow = connection)
        const profile1Following = profile1.profileInformation?.following?.some(
          (id: any) => id.toString() === profileId2
        );
        const profile2Following = profile2.profileInformation?.following?.some(
          (id: any) => id.toString() === profileId1
        );

        // Consider mutual following as a connection
        if (profile1Following && profile2Following) {
          return true;
        }

        // Check if they are affiliated
        const profile1Affiliated = profile1.profileInformation?.affiliatedProfiles?.some(
          (id: any) => id.toString() === profileId2
        );
        const profile2Affiliated = profile2.profileInformation?.affiliatedProfiles?.some(
          (id: any) => id.toString() === profileId1
        );

        if (profile1Affiliated || profile2Affiliated) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking if profiles are connected:', error);
      // Default to false on error for security
      return false;
    }
  }

  /**
   * Check if a profile can share vault items from another profile
   */
  async canShareVaultItems(requestingProfileId: string, targetProfileId: string): Promise<{ allowed: boolean; reason?: string }> {
    return this.checkVaultActionPermissions(requestingProfileId, targetProfileId, 'share');
  }

  /**
   * Check if a profile can export vault items from another profile
   */
  async canExportVaultItems(requestingProfileId: string, targetProfileId: string): Promise<{ allowed: boolean; reason?: string }> {
    return this.checkVaultActionPermissions(requestingProfileId, targetProfileId, 'export');
  }

  /**
   * Check if a profile can download vault items from another profile
   */
  async canDownloadVaultItems(requestingProfileId: string, targetProfileId: string): Promise<{ allowed: boolean; reason?: string }> {
    return this.checkVaultActionPermissions(requestingProfileId, targetProfileId, 'download');
  }

  /**
   * Check if a profile can access a specific vault category
   */
  async canAccessVaultCategory(
    requestingProfileId: string, 
    targetProfileId: string, 
    category: 'wallet' | 'documents' | 'media'
  ): Promise<{ allowed: boolean; reason?: string }> {
    return this.checkVaultAccessPermissions(requestingProfileId, targetProfileId, category);
  }

  /**
   * Log vault activity if enabled in settings
   */
  private async logVaultActivity(
    userId: string,
    profileId: string,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const shouldLog = await this.shouldLogVaultActivity(userId, profileId);
      if (shouldLog) {
        logger.info('Vault activity:', {
          userId,
          profileId,
          action,
          details,
          timestamp: new Date()
        });
        
        // You could also save this to a dedicated activity log collection
        // await ActivityLog.create({ userId, profileId, action, details });
      }
    } catch (error) {
      logger.error('Error logging vault activity:', error);
    }
  }

  /**
   * Get vault access summary for a profile
   */
  async getVaultAccessSummary(requestingProfileId: string, targetProfileId: string): Promise<{
    canAccess: boolean;
    canAccessWallet: boolean;
    canAccessDocuments: boolean;
    canAccessMedia: boolean;
    canShare: boolean;
    canExport: boolean;
    canDownload: boolean;
    connectionStatus: 'connected' | 'not_connected' | 'same_profile';
  }> {
    try {
      const [
        generalAccess,
        walletAccess,
        documentsAccess,
        mediaAccess,
        shareAccess,
        exportAccess,
        downloadAccess,
        isConnected
      ] = await Promise.all([
        this.checkVaultAccessPermissions(requestingProfileId, targetProfileId),
        this.checkVaultAccessPermissions(requestingProfileId, targetProfileId, 'wallet'),
        this.checkVaultAccessPermissions(requestingProfileId, targetProfileId, 'documents'),
        this.checkVaultAccessPermissions(requestingProfileId, targetProfileId, 'media'),
        this.checkVaultActionPermissions(requestingProfileId, targetProfileId, 'share'),
        this.checkVaultActionPermissions(requestingProfileId, targetProfileId, 'export'),
        this.checkVaultActionPermissions(requestingProfileId, targetProfileId, 'download'),
        this.checkIfProfilesConnected(requestingProfileId, targetProfileId)
      ]);

      let connectionStatus: 'connected' | 'not_connected' | 'same_profile';
      if (requestingProfileId === targetProfileId) {
        connectionStatus = 'same_profile';
      } else if (isConnected) {
        connectionStatus = 'connected';
      } else {
        connectionStatus = 'not_connected';
      }

      return {
        canAccess: generalAccess.allowed,
        canAccessWallet: walletAccess.allowed,
        canAccessDocuments: documentsAccess.allowed,
        canAccessMedia: mediaAccess.allowed,
        canShare: shareAccess.allowed,
        canExport: exportAccess.allowed,
        canDownload: downloadAccess.allowed,
        connectionStatus
      };
    } catch (error) {
      logger.error('Error getting vault access summary:', error);
      return {
        canAccess: false,
        canAccessWallet: false,
        canAccessDocuments: false,
        canAccessMedia: false,
        canShare: false,
        canExport: false,
        canDownload: false,
        connectionStatus: 'not_connected'
      };
    }
  }

  /**
   * Validate file upload against user settings and limits
   */
  private async validateFileUpload(userId: string, profileId: string, item: any, settings: any): Promise<void> {
    // Check file size limits
    const maxFileSize = settings?.specificSettings?.vaultMaxFileSize ?? 104857600; // 100MB default
    if (item.fileData && item.fileSize > maxFileSize) {
      throw createHttpError(413, `File size exceeds limit of ${this.formatStorageSize(maxFileSize, settings)}`);
    }

    // Check allowed file types
    const allowedFileTypes = settings?.specificSettings?.vaultAllowedFileTypes ?? ['*'];
    if (allowedFileTypes[0] !== '*' && item.fileType) {
      const isAllowed = allowedFileTypes.some((type: string) => 
        item.fileType.toLowerCase().includes(type.toLowerCase())
      );
      if (!isAllowed) {
        throw createHttpError(415, `File type ${item.fileType} is not allowed`);
      }
    }

    // Check storage quota
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (vault) {
      const storageLimit = settings?.specificSettings?.vaultStorageLimit ?? vault.storageLimit;
      const estimatedNewSize = (vault.storageUsed || 0) + (item.fileSize || 0);
      
      if (estimatedNewSize > storageLimit) {
        throw createHttpError(507, `Storage limit exceeded. Available: ${this.formatStorageSize(storageLimit - vault.storageUsed, settings)}`);
      }
    }

    // // Check if storage permission is enabled
    // if (!settings?.general?.appSystem?.permissions?.storage) {
    //   throw createHttpError(403, 'Storage permission is disabled in settings');
    // }
  }

  /**
   * Format storage size according to user's regional settings
   */
  private formatStorageSize(bytes: number, settings: any): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // Use user's number format preference
    const numberFormat = settings?.general?.regional?.numberFormat ?? 'dot';
    const formattedSize = numberFormat === 'comma' 
      ? size.toFixed(2).replace('.', ',')
      : size.toFixed(2);

    return `${formattedSize} ${units[unitIndex]}`;
  }

  /**
   * Send vault-related notifications based on user preferences
   */
  private async sendVaultNotification(userId: string, profileId: string, action: string, details: any): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings(userId, profileId);
      
      // Check if notifications are enabled
      if (!settings?.general?.appSystem?.allowNotifications) {
        return;
      }

      // Check specific vault notification preferences
      const vaultNotifications = settings?.notifications?.Account?.storageLevel;
      if (!vaultNotifications) {
        return;
      }

      const notificationData = {
        userId,
        profileId,
        action,
        details,
        timestamp: new Date()
      };

      // Send notifications based on enabled channels
      if (vaultNotifications.push) {
        // Send push notification
        logger.info('Sending vault push notification:', notificationData);
      }

      if (vaultNotifications.email) {
        // Send email notification
        logger.info('Sending vault email notification:', notificationData);
      }

      if (vaultNotifications.inApp) {
        // Send in-app notification
        logger.info('Sending vault in-app notification:', notificationData);
      }

      if (vaultNotifications.text) {
        // Send SMS notification
        logger.info('Sending vault SMS notification:', notificationData);
      }
    } catch (error) {
      logger.error('Error sending vault notification:', error);
    }
  }

  /**
   * Schedule automatic backup for vault item
   */
  private async scheduleItemBackup(itemId: string, userId: string): Promise<void> {
    try {
      // This would integrate with a job queue system like Bull or Agenda
      logger.info(`Scheduling backup for vault item ${itemId} for user ${userId}`);
      
      // Example: Add to backup queue
      // await backupQueue.add('backup-vault-item', { itemId, userId }, {
      //   delay: 60000, // 1 minute delay
      //   attempts: 3
      // });
    } catch (error) {
      logger.error('Error scheduling item backup:', error);
    }
  }

  /**
   * Get vault settings for a profile
   */
  async getVaultSettings(userId: string, profileId: string): Promise<any> {
    const settings = await this.settingsService.getSettings(userId, profileId);
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });

    return {
      storage: {
        used: vault?.storageUsed || 0,
        limit: settings?.specificSettings?.vaultStorageLimit ?? vault?.storageLimit ?? 21474836480,
        usedFormatted: this.formatStorageSize(vault?.storageUsed || 0, settings),
        limitFormatted: this.formatStorageSize(
          settings?.specificSettings?.vaultStorageLimit ?? vault?.storageLimit ?? 21474836480, 
          settings
        ),
        percentage: vault ? Math.round(((vault.storageUsed || 0) / (settings?.specificSettings?.vaultStorageLimit ?? vault.storageLimit)) * 100) : 0
      },
      preferences: {
        autoBackup: settings?.dataSettings?.autoDataBackup ?? true,
        compressionEnabled: settings?.specificSettings?.vaultCompressionEnabled ?? true,
        encryptionEnabled: settings?.specificSettings?.vaultEncryptionEnabled ?? false,
        maxFileSize: settings?.specificSettings?.vaultMaxFileSize ?? 104857600,
        allowedFileTypes: settings?.specificSettings?.vaultAllowedFileTypes ?? ['*'],
        autoDeleteOldFiles: settings?.specificSettings?.vaultAutoDeleteOldFiles ?? false,
        autoDeleteDays: settings?.specificSettings?.vaultAutoDeleteDays ?? 365
      },
      notifications: {
        enabled: settings?.general?.appSystem?.allowNotifications ?? true,
        channels: settings?.notifications?.Account?.storageLevel ?? {
          push: true,
          email: true,
          inApp: true,
          text: false
        }
      },
      privacy: {
        vault: settings?.privacy?.Visibility?.profile?.vault ?? { level: 'OnlyMe' },
        wallet: settings?.privacy?.Visibility?.vault?.wallet ?? { level: 'OnlyMe' },
        documents: settings?.privacy?.Visibility?.vault?.documents ?? { level: 'OnlyMe' },
        media: settings?.privacy?.Visibility?.vault?.media ?? { level: 'ConnectionsOnly' }
      },
      permissions: {
        share: settings?.privacy?.permissions?.share ?? { level: 'ConnectionsOnly' },
        export: settings?.privacy?.permissions?.export ?? { level: 'ConnectionsOnly' },
        download: settings?.privacy?.permissions?.download ?? { level: 'ConnectionsOnly' }
      },
      regional: {
        dateFormat: settings?.general?.regional?.dateFormat ?? 'MM/DD/YYYY',
        numberFormat: settings?.general?.regional?.numberFormat ?? 'dot',
        currency: settings?.general?.regional?.currency ?? 'USD',
        language: settings?.general?.regional?.language ?? 'en'
      }
    };
  }

  /**
   * Update vault-specific settings
   */
  async updateVaultSettings(userId: string, profileId: string, updates: any): Promise<any> {
    const currentSettings = await this.settingsService.getSettings(userId, profileId);
    
    const vaultUpdates: any = {};

    // Update vault-specific settings
    if (updates.storage?.limit) {
      vaultUpdates['specificSettings.vaultStorageLimit'] = updates.storage.limit;
    }

    if (updates.preferences) {
      if (updates.preferences.compressionEnabled !== undefined) {
        vaultUpdates['specificSettings.vaultCompressionEnabled'] = updates.preferences.compressionEnabled;
      }
      if (updates.preferences.encryptionEnabled !== undefined) {
        vaultUpdates['specificSettings.vaultEncryptionEnabled'] = updates.preferences.encryptionEnabled;
      }
      if (updates.preferences.maxFileSize !== undefined) {
        vaultUpdates['specificSettings.vaultMaxFileSize'] = updates.preferences.maxFileSize;
      }
      if (updates.preferences.allowedFileTypes !== undefined) {
        vaultUpdates['specificSettings.vaultAllowedFileTypes'] = updates.preferences.allowedFileTypes;
      }
      if (updates.preferences.autoDeleteOldFiles !== undefined) {
        vaultUpdates['specificSettings.vaultAutoDeleteOldFiles'] = updates.preferences.autoDeleteOldFiles;
      }
      if (updates.preferences.autoDeleteDays !== undefined) {
        vaultUpdates['specificSettings.vaultAutoDeleteDays'] = updates.preferences.autoDeleteDays;
      }
      if (updates.preferences.autoBackup !== undefined) {
        vaultUpdates['dataSettings.autoDataBackup'] = updates.preferences.autoBackup;
      }
    }

    // Update privacy settings
    if (updates.privacy) {
      if (updates.privacy.vault) {
        vaultUpdates['privacy.Visibility.profile.vault'] = updates.privacy.vault;
      }
      if (updates.privacy.wallet) {
        vaultUpdates['privacy.Visibility.vault.wallet'] = updates.privacy.wallet;
      }
      if (updates.privacy.documents) {
        vaultUpdates['privacy.Visibility.vault.documents'] = updates.privacy.documents;
      }
      if (updates.privacy.media) {
        vaultUpdates['privacy.Visibility.vault.media'] = updates.privacy.media;
      }
    }

    // Update permission settings
    if (updates.permissions) {
      if (updates.permissions.share) {
        vaultUpdates['privacy.permissions.share'] = updates.permissions.share;
      }
      if (updates.permissions.export) {
        vaultUpdates['privacy.permissions.export'] = updates.permissions.export;
      }
      if (updates.permissions.download) {
        vaultUpdates['privacy.permissions.download'] = updates.permissions.download;
      }
    }

    // Update notification settings
    if (updates.notifications?.channels) {
      vaultUpdates['notifications.Account.storageLevel'] = updates.notifications.channels;
    }

    // Apply updates
    const updatedSettings = await this.settingsService.updateSettings(userId, profileId, vaultUpdates);

    // Update vault storage limit if changed
    if (updates.storage?.limit) {
      await Vault.updateOne(
        { profileId: new Types.ObjectId(profileId) },
        { storageLimit: updates.storage.limit }
      );
    }

    return this.getVaultSettings(userId, profileId);
  }

  /**
   * Delete the vault document itself
   */
  async deleteVault(profileId: string): Promise<void> {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (vault) {
      await Vault.findByIdAndDelete(vault._id);
    }
  }

  /**
   * Advanced search functionality for vault items
   */
  async advancedSearch(profileId: string, criteria: SearchCriteria) {
    const query: any = { profileId: new Types.ObjectId(profileId) };

    // Text search
    if (criteria.query) {
      query.$or = [
        { title: { $regex: criteria.query, $options: 'i' } },
        { description: { $regex: criteria.query, $options: 'i' } },
        { tags: { $regex: criteria.query, $options: 'i' } }
      ];
    }

    // Category and subcategory filters
    if (criteria.categories?.length) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { category: { $in: criteria.categories } },
          { tags: { $in: criteria.categories } }
        ]
      });
    }
    if (criteria.subcategories?.length) {
      query.subcategoryId = { $in: criteria.subcategories.map(id => new Types.ObjectId(id)) };
    }

    // Date range filter
    if (criteria.dateRange) {
      query.createdAt = {};
      if (criteria.dateRange.from) {
        query.createdAt.$gte = new Date(criteria.dateRange.from);
      }
      if (criteria.dateRange.to) {
        query.createdAt.$lte = new Date(criteria.dateRange.to);
      }
    }

    // Tags filter - check for items that have the specified tags
    if (criteria.tags?.length) {
      query.$and = query.$and || [];
      query.$and.push({ tags: { $in: criteria.tags } });
    }

    // Metadata filter
    if (criteria.metadata) {
      Object.entries(criteria.metadata).forEach(([key, value]) => {
        query[`metadata.${key}`] = value;
      });
    }

    // Access level filter
    if (criteria.accessLevel) {
      query.accessLevel = criteria.accessLevel;
    }

    // Boolean filters
    if (criteria.isEncrypted !== undefined) {
      query.isEncrypted = criteria.isEncrypted;
    }
    if (criteria.isFavorite !== undefined) {
      query.isFavorite = criteria.isFavorite;
    }

    // Build sort options
    const sortOptions: any = {};
    if (criteria.sortBy) {
      sortOptions[criteria.sortBy] = criteria.sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions.createdAt = -1; // Default sort by creation date
    }

    // Execute search with pagination
    const items = await VaultItem.find(query)
      .sort(sortOptions)
      .skip(criteria.offset || 0)
      .limit(criteria.limit || 50)
      .populate('categoryId')
      .populate('subcategoryId');

    // Get total count for pagination
    const total = await VaultItem.countDocuments(query);

    return {
      items,
      total,
      hasMore: total > (criteria.offset || 0) + (criteria.limit || 50)
    };
  }

  /**
   * Get vault analytics and statistics
   */
  async getVaultAnalytics(profileId: string) {
    const stats = await VaultItem.aggregate([
      { $match: { profileId: new Types.ObjectId(profileId) } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalStorage: { $sum: { $ifNull: ['$fileSize', 0] } },
          encryptedItems: {
            $sum: { $cond: [{ $eq: ['$isEncrypted', true] }, 1, 0] }
          },
          favoriteItems: {
            $sum: { $cond: [{ $eq: ['$isFavorite', true] }, 1, 0] }
          }
        }
      }
    ]);

    // Get recent activity
    const recentActivity = await VaultItem.find({ profileId: new Types.ObjectId(profileId) })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('title category updatedAt');

    // Get storage usage by category
    const storageByCategory = await VaultItem.aggregate([
      { $match: { profileId: new Types.ObjectId(profileId) } },
      {
        $group: {
          _id: '$category',
          storageUsed: { $sum: { $ifNull: ['$fileSize', 0] } },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          storageUsed: 1,
          count: 1,
          _id: 0
        }
      }
    ]);

    return {
      stats: stats[0] || {
        totalItems: 0,
        totalStorage: 0,
        encryptedItems: 0,
        favoriteItems: 0
      },
      recentActivity,
      storageByCategory
    };
  }

  /**
   * Track vault item access and create audit log
   */
  async trackAccess(profileId: string, itemId: string, action: string, metadata: any = {}) {
    const auditLog = new VaultAuditLog({
      profileId: new Types.ObjectId(profileId),
      itemId: new Types.ObjectId(itemId),
      action,
      metadata,
      timestamp: new Date()
    });

    await auditLog.save();
    return auditLog;
  }

  /**
   * Get audit trail for a vault item
   */
  async getAuditTrail(profileId: string, itemId: string, options: { limit?: number; offset?: number } = {}) {
    const query = {
      profileId: new Types.ObjectId(profileId),
      itemId: new Types.ObjectId(itemId)
    };

    const logs = await VaultAuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(options.offset || 0)
      .limit(options.limit || 50);

    const total = await VaultAuditLog.countDocuments(query);

    return {
      logs,
      total,
      hasMore: total > (options.offset || 0) + (options.limit || 50)
    };
  }

  async createVersion(
    profileId: string,
    itemId: string,
    changes: { field: string; oldValue: any; newValue: any }[],
    metadata: { changedBy: string; changeReason?: string; ipAddress?: string; userAgent?: string }
  ) {
    const item = await VaultItem.findOne({ _id: itemId, profileId });
    if (!item) {
      throw new Error('Vault item not found');
    }

    // Get the latest version number
    const latestVersion = await VaultVersion.findOne({ itemId })
      .sort({ versionNumber: -1 })
      .select('versionNumber');

    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Create a snapshot of the current item state
    const { _id, __v, ...snapshot } = item.toObject();

    const version = await VaultVersion.create({
      itemId,
      versionNumber,
      data: snapshot,
      metadata: {
        changedBy: metadata.changedBy,
        changeReason: metadata.changeReason
      }
    });

    return version;
  }

  async getVersions(profileId: string, itemId: string, options: { limit?: number; offset?: number } = {}) {
    const query = { itemId: new Types.ObjectId(itemId) };
    const versions = await VaultVersion.find(query)
      .sort({ versionNumber: -1 })
      .skip(options.offset || 0)
      .limit(options.limit || 10);

    const total = await VaultVersion.countDocuments(query);

    return {
      versions,
      total,
      hasMore: total > (options.offset || 0) + versions.length
    };
  }

  async restoreVersion(profileId: string, itemId: string, version: number) {
    const versionDoc = await VaultVersion.findOne({ 
      itemId: new Types.ObjectId(itemId), 
      versionNumber: version 
    });
    if (!versionDoc) {
      throw new Error('Version not found');
    }

    const item = await VaultItem.findOne({ 
      _id: new Types.ObjectId(itemId), 
      profileId: new Types.ObjectId(profileId) 
    });
    if (!item) {
      throw new Error('Vault item not found');
    }

    // Create a new version before restoring
    const currentVersion = new VaultVersion({
      itemId: item._id,
      versionNumber: (await VaultVersion.countDocuments({ itemId: item._id })) + 1,
      data: item.toObject(),
      metadata: {
        changedBy: profileId,
        changeReason: `Restored to version ${version}`
      }
    });
    await currentVersion.save();

    // Restore the item to the version state
    Object.assign(item, versionDoc.data);
    await item.save();

    return item;
  }

  async batchUpdate(profileId: string, updates: Array<{ itemId: string; updates: any }>) {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ itemId: string; error: string }>
    };

    for (const { itemId, updates: itemUpdates } of updates) {
      try {
        // Validate item exists
        const item = await VaultItem.findOne({ 
          _id: new Types.ObjectId(itemId), 
          profileId: new Types.ObjectId(profileId) 
        });
        if (!item) {
          throw new Error('Item not found');
        }

        // Validate card data if present
        if (itemUpdates.card) {
          if (itemUpdates.card.number && !/^\d{13,19}$/.test(itemUpdates.card.number)) {
            throw new Error('Invalid card number format');
          }
          if (itemUpdates.card.cvv && !/^\d{3,4}$/.test(itemUpdates.card.cvv)) {
            throw new Error('Invalid CVV format');
          }
        }

        // Validate document data if present
        if (itemUpdates.document) {
          if (itemUpdates.document.expiryDate && new Date(itemUpdates.document.expiryDate) < new Date()) {
            throw new Error('Document expiry date cannot be in the past');
          }
        }

        // Validate identification data if present
        if (itemUpdates.identification) {
          if (itemUpdates.identification.expiryDate && new Date(itemUpdates.identification.expiryDate) < new Date()) {
            throw new Error('Identification expiry date cannot be in the past');
          }
        }

        // Create a version before updating
        const currentVersion = new VaultVersion({
          itemId: item._id,
          versionNumber: (await VaultVersion.countDocuments({ itemId: item._id })) + 1,
          data: item.toObject(),
          metadata: {
            changedBy: profileId,
            changeReason: 'Batch update'
          }
        });
        await currentVersion.save();

        // Update the item
        Object.assign(item, itemUpdates);
        await item.save();

        results.successful.push(itemId);
      } catch (error: any) {
        results.failed.push({
          itemId,
          error: error.message
        });
      }
    }

    return results;
  }

  async batchDelete(profileId: string, itemIds: string[]) {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ itemId: string; error: string }>
    };

    for (const itemId of itemIds) {
      try {
        const item = await VaultItem.findOne({ _id: itemId, profileId });
        if (!item) {
          throw new Error('Item not found');
        }

        // Create a final version entry before deletion
        await this.createVersion(profileId, itemId, [{
          field: 'deletion',
          oldValue: item.toObject(),
          newValue: null
        }], {
          changedBy: profileId,
          changeReason: 'Batch deletion'
        });

        await item.deleteOne();
        results.successful.push(itemId);
      } catch (error) {
        results.failed.push({
          itemId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  async batchMove(profileId: string, items: Array<{ itemId: string; categoryId: string; subcategoryId: string }>) {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ itemId: string; error: string }>
    };

    for (const { itemId, categoryId, subcategoryId } of items) {
      try {
        const item = await VaultItem.findOne({ _id: itemId, profileId });
        if (!item) {
          throw new Error('Item not found');
        }

        // Track changes for versioning
        const changes = [
          {
            field: 'categoryId',
            oldValue: item.categoryId,
            newValue: categoryId
          },
          {
            field: 'subcategoryId',
            oldValue: item.subcategoryId,
            newValue: subcategoryId
          }
        ];

        // Update the item
        item.categoryId = new Types.ObjectId(categoryId);
        item.subcategoryId = new Types.ObjectId(subcategoryId);
        await item.save();

        // Create version entry
        await this.createVersion(profileId, itemId, changes, {
          changedBy: profileId,
          changeReason: 'Batch move'
        });

        results.successful.push(itemId);
      } catch (error) {
        results.failed.push({
          itemId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}

export const vaultService = new VaultService();