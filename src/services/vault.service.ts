import { Vault, VaultCategory, VaultSubcategory, VaultItem, IVaultItem } from '../models/Vault';
import { Types } from 'mongoose';
import CloudinaryService from '../services/cloudinary.service';
import { User } from '../models/User';

class VaultService {
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.cloudinaryService = new CloudinaryService();
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

  async getUserVault(profileId: string) {
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

    const query: any = { vaultId: vault._id };
    
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

  async addItem(userId: string, profileId: string, category: string, subcategory: string, item: any) {
    let fileSize = 0;
    const uploadedImages: any = {};

    // Handle main file upload if present
    if (item.fileData) {
      const uploadOptions = {
        folder: `vault/${profileId}/${category}/${subcategory}`,
        resourceType: this.getResourceTypeFromCategory(category),
        tags: [`vault-${category}`, `vault-${subcategory}`]
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
          folder: `vault/${profileId}/${category}/${subcategory}/card/front`,
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
          folder: `vault/${profileId}/${category}/${subcategory}/card/back`,
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
                folder: `vault/${profileId}/${category}/${subcategory}/card/additional`,
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
          folder: `vault/${profileId}/${category}/${subcategory}/document/front`,
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
          folder: `vault/${profileId}/${category}/${subcategory}/document/back`,
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
                folder: `vault/${profileId}/${category}/${subcategory}/document/additional`,
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
          folder: `vault/${profileId}/${category}/${subcategory}/identification/front`,
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
          folder: `vault/${profileId}/${category}/${subcategory}/identification/back`,
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
                folder: `vault/${profileId}/${category}/${subcategory}/identification/additional`,
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

    // Get or create vault
    let vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      vault = await Vault.create({
        userId: new Types.ObjectId(userId),
        profileId: new Types.ObjectId(profileId),
        storageUsed: fileSize
      });
    } else {
      vault.storageUsed = (vault.storageUsed || 0) + fileSize;
      await vault.save();
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

    // Get or create subcategory
    let subcategoryDoc = await VaultSubcategory.findOne({
      vaultId: vault._id,
      categoryId: categoryDoc._id,
      name: subcategory
    });
    if (!subcategoryDoc) {
      subcategoryDoc = await VaultSubcategory.create({
        vaultId: vault._id,
        categoryId: categoryDoc._id,
        name: subcategory,
        order: await VaultSubcategory.countDocuments({ 
          vaultId: vault._id,
          categoryId: categoryDoc._id 
        })
      });
    }

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

  async createSubcategory(profileId: string, categoryName: string, subcategoryName: string) {
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

    const existingSubcategory = await VaultSubcategory.findOne({
      vaultId: vault._id,
      categoryId: category._id,
      name: subcategoryName
    });
    if (existingSubcategory) {
      throw new Error('Subcategory already exists');
    }

    const subcategory = await VaultSubcategory.create({
      vaultId: vault._id,
      categoryId: category._id,
      name: subcategoryName,
      order: await VaultSubcategory.countDocuments({
        vaultId: vault._id,
        categoryId: category._id
      })
    });

    return {
      _id: subcategory._id,
      name: subcategory.name,
      order: subcategory.order
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
    
    // Add to vault
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

    await this.addItem(userId, profileId, category, subcategory, item);
    return uploadResult;
  }

  async getSubcategories(profileId: string, categoryIdentifier: string) {
    const vault = await Vault.findOne({ profileId: new Types.ObjectId(profileId) });
    if (!vault) {
      throw new Error('Vault not found');
    }

    let category;
    if (Types.ObjectId.isValid(categoryIdentifier)) {
      // If it's a valid ObjectId, search by ID
      category = await VaultCategory.findOne({
        vaultId: vault._id,
        _id: new Types.ObjectId(categoryIdentifier)
      });
    } else {
      // Otherwise search by name (case-insensitive)
      const escapedIdentifier = categoryIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      category = await VaultCategory.findOne({
        vaultId: vault._id,
        name: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') }
      });
    }

    if (!category) {
      throw new Error('Category not found');
    }

    const subcategories = await VaultSubcategory.find({
      vaultId: vault._id,
      categoryId: category._id
    }).sort({ order: 1 });

    return subcategories.map(sub => ({
      _id: sub._id,
      name: sub.name,
      order: sub.order
    }));
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
}

const vaultService = new VaultService();
export default vaultService; 