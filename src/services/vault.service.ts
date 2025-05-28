import { Vault, VaultCategory, VaultSubcategory, VaultItem, IVaultItem, IVaultSubcategory } from '../models/Vault';
import { Types } from 'mongoose';
import CloudinaryService from '../services/cloudinary.service';
import { User } from '../models/User';
import createHttpError from 'http-errors';

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
}

export const vaultService = new VaultService();