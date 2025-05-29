import { Vault, VaultCategory, VaultSubcategory, VaultItem, IVaultItem, IVaultSubcategory } from '../models/Vault';
import { Types } from 'mongoose';
import CloudinaryService from '../services/cloudinary.service';
import { User } from '../models/User';
import createHttpError from 'http-errors';
import { SettingsService } from './settings.service';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';
import { Connection } from '../models/Connection';
import { ProfileConnectionModel } from '../models/profile-connection.model';

interface ISubcategoryWithChildren {
  _id: Types.ObjectId;
  name: string;
  order: number;
  hasChildren: boolean;
  count: number;
  items: any[];
  subcategories: ISubcategoryWithChildren[];
}

class VaultService {
  private cloudinaryService: CloudinaryService;
  private settingsService: SettingsService;

  constructor() {
    this.cloudinaryService = new CloudinaryService();
    this.settingsService = new SettingsService();
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
      storageLimit: vault.storageLimit,
      categories: categoriesWithSubcategories
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
            hasChildren: false,
            count: childCount,
            status: childSub.status,
            items: childItems.map(item => {
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
                subcategoryName: childSub.name,
                status: itemObj.status || 'active'
              };

              // Only include type data if it's not empty
              if (Object.keys(typeData).length > 0) {
                Object.assign(finalItem, typeData);
              }

              return finalItem;
            }),
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

  async addItem(userId: string, profileId: string, category: string, subcategoryId: string, item: any) {
    let fileSize = 0;
    const uploadedImages: any = {};

    // Get or create vault
    let vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      vault = await Vault.create({
        userId: new Types.ObjectId(userId),
        profileId: new Types.ObjectId(profileId),
        storageUsed: fileSize
      });
    }

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

    // Handle main file upload if present
    if (item.fileData) {
      const uploadOptions = {
        folder: `vault/${profileId}/${category}/${subcategoryDoc.name}`,
        resourceType: this.getResourceTypeFromCategory(category),
        tags: [`vault-${category}`, `vault-${subcategoryDoc.name}`]
      };

      const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(item.fileData, uploadOptions);
      item.fileUrl = uploadResult.secure_url;
      fileSize = uploadResult.bytes;
      item.fileSize = fileSize;
      item.publicId = uploadResult.public_id;
      delete item.fileData;
    }

    // Handle card images if present
    if (item.card?.images) {
      const cardImages = item.card.images;
      if (cardImages.front?.fileData) {
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(cardImages.front.fileData, {
          folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/card/front`,
          resourceType: 'image'
        });
        uploadedImages.front = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          uploadedAt: new Date(),
          size: uploadResult.bytes
        };
        fileSize += uploadResult.bytes;
        delete cardImages.front.fileData;
      }
      if (cardImages.back?.fileData) {
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(cardImages.back.fileData, {
          folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/card/back`,
          resourceType: 'image'
        });
        uploadedImages.back = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          uploadedAt: new Date(),
          size: uploadResult.bytes
        };
        fileSize += uploadResult.bytes;
        delete cardImages.back.fileData;
      }
      if (cardImages.additional?.length) {
        uploadedImages.additional = await Promise.all(
          cardImages.additional.map(async (img: any, index: number) => {
            if (img.fileData) {
              const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(img.fileData, {
                folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/card/additional`,
                resourceType: 'image'
              });
              fileSize += uploadResult.bytes;
              delete img.fileData;
              return {
                url: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                uploadedAt: new Date(),
                size: uploadResult.bytes,
                description: img.description
              };
            }
            return img;
          })
        );
      }
      item.card.images = uploadedImages;
    }

    // Handle document images if present
    if (item.document?.images) {
      const docImages = item.document.images;
      if (docImages.front?.fileData) {
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(docImages.front.fileData, {
          folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/document/front`,
          resourceType: 'image'
        });
        uploadedImages.front = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          uploadedAt: new Date(),
          size: uploadResult.bytes
        };
        fileSize += uploadResult.bytes;
        delete docImages.front.fileData;
      }
      if (docImages.back?.fileData) {
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(docImages.back.fileData, {
          folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/document/back`,
          resourceType: 'image'
        });
        uploadedImages.back = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          uploadedAt: new Date(),
          size: uploadResult.bytes
        };
        fileSize += uploadResult.bytes;
        delete docImages.back.fileData;
      }
      if (docImages.additional?.length) {
        uploadedImages.additional = await Promise.all(
          docImages.additional.map(async (img: any, index: number) => {
            if (img.fileData) {
              const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(img.fileData, {
                folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/document/additional`,
                resourceType: 'image'
              });
              fileSize += uploadResult.bytes;
              delete img.fileData;
              return {
                url: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                uploadedAt: new Date(),
                size: uploadResult.bytes,
                description: img.description
              };
            }
            return img;
          })
        );
      }
      item.document.images = uploadedImages;
    }

    // Handle identification images if present
    if (item.identification?.images) {
      const idImages = item.identification.images;
      if (idImages.front?.fileData) {
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(idImages.front.fileData, {
          folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/identification/front`,
          resourceType: 'image'
        });
        uploadedImages.front = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          uploadedAt: new Date(),
          size: uploadResult.bytes
        };
        fileSize += uploadResult.bytes;
        delete idImages.front.fileData;
      }
      if (idImages.back?.fileData) {
        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(idImages.back.fileData, {
          folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/identification/back`,
          resourceType: 'image'
        });
        uploadedImages.back = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          uploadedAt: new Date(),
          size: uploadResult.bytes
        };
        fileSize += uploadResult.bytes;
        delete idImages.back.fileData;
      }
      if (idImages.additional?.length) {
        uploadedImages.additional = await Promise.all(
          idImages.additional.map(async (img: any, index: number) => {
            if (img.fileData) {
              const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(img.fileData, {
                folder: `vault/${profileId}/${category}/${subcategoryDoc.name}/identification/additional`,
                resourceType: 'image'
              });
              fileSize += uploadResult.bytes;
              delete img.fileData;
              return {
                url: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                uploadedAt: new Date(),
                size: uploadResult.bytes,
                description: img.description
              };
            }
            return img;
          })
        );
      }
      item.identification.images = uploadedImages;
    }

    // Update vault storage
    vault.storageUsed = (vault.storageUsed || 0) + fileSize;
    await vault.save();

    // Create the item
    const newItem = await VaultItem.create({
      vaultId: vault._id,
      profileId: new Types.ObjectId(profileId),
      categoryId: categoryDoc._id,
      subcategoryId: subcategoryDoc._id,
      type: item.type,
      category: category,
      title: item.title,
      description: item.description || '',
      fileUrl: item.fileUrl,
      fileSize: fileSize,
      publicId: item.publicId,
      metadata: item.metadata || {},
      card: item.card,
      document: item.document ? {
        ...item.document,
        issueDate: item.document.issueDate ? new Date(item.document.issueDate) : undefined,
        expiryDate: item.document.expiryDate ? new Date(item.document.expiryDate) : undefined
      } : undefined,
      location: item.location,
      identification: item.identification
    });

    return newItem;
  }

  async updateItem(userId: string, itemId: string, updates: any) {
    const item = await VaultItem.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

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
      updates.publicId = uploadResult.public_id;
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

    // Update vault storage
    const vault = await Vault.findById(item.vaultId);
    if (vault) {
      vault.storageUsed = (vault.storageUsed || 0) - (item.metadata?.fileSize || 0) + fileSize;
      await vault.save();
    }

    return VaultItem.findByIdAndUpdate(
      itemId,
      { $set: updates },
      { new: true }
    );
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
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw new Error('Vault not found');
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
      throw new Error('Vault not found');
    }

    const parentSubcategory = await VaultSubcategory.findOne({
      vaultId: vault._id,
      _id: new Types.ObjectId(subcategoryId)
    });

    if (!parentSubcategory) {
      throw new Error('Subcategory not found');
    }

    // Get immediate children
    const subcategories = await VaultSubcategory.find({
      vaultId: vault._id,
      categoryId: parentSubcategory.categoryId,
      parentId: parentSubcategory._id
    }).sort({ order: 1 });

    // Get item counts and items for each subcategory
    const subcategoriesWithChildren = await Promise.all(
      subcategories.map(async (sub) => {
        // Check if subcategory has children
        const hasChildren = await VaultSubcategory.exists({
          vaultId: vault._id,
          categoryId: parentSubcategory.categoryId,
          parentId: sub._id
        });

        // Get item count and items for this subcategory
        const [count, items] = await Promise.all([
          VaultItem.countDocuments({
            vaultId: vault._id,
            subcategoryId: sub._id
          }),
          VaultItem.find({
            vaultId: vault._id,
            subcategoryId: sub._id
          }).sort({ createdAt: -1 })
        ]);

        // Get child subcategories
        const childSubcategories = await VaultSubcategory.find({
          vaultId: vault._id,
          categoryId: parentSubcategory.categoryId,
          parentId: sub._id
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
      let currentParent = await VaultSubcategory.findById(newParentId);
      while (currentParent) {
        if (currentParent._id.toString() === subcategoryId) {
          throw new Error('Cannot move subcategory to its own descendant');
        }
        currentParent = await VaultSubcategory.findById(currentParent.parentId);
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
      subcategoryId: { $in: [subcategoryId, ...childSubcategoryIds] }
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
          archivedBy: profileId
        }
      });
    }

    // Archive subcategories instead of deleting
    await VaultSubcategory.updateMany(
      {
        vaultId: vault._id,
        _id: { $in: [subcategoryId, ...childSubcategoryIds] }
      },
      {
        $set: {
          status: 'archived',
          archivedAt: new Date(),
          archivedBy: profileId
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
}

export const vaultService = new VaultService();