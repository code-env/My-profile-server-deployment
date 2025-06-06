import { Types } from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Request, Response } from 'express';
import createHttpError from 'http-errors';
import { vaultService } from '../services/vault.service';

interface ItemFilters {
  categoryId?: string;
  subcategoryId?: string;
  type?: string;
  search?: string;
  // Enhanced filters
  accessLevel?: 'private' | 'shared' | 'public';
  isEncrypted?: boolean;
  processingStatus?: 'pending' | 'completed' | 'failed';
  cardNetwork?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  isVerified?: boolean;
  isExpired?: boolean;
  extractedText?: string;
}

interface AddItemRequest {
  category: string;
  subcategory: string;
  type?: string;
  title: string;
  description?: string;
  fileData?: string;
  metadata?: Record<string, any>;
  
  // Enhanced security fields
  accessLevel?: 'private' | 'shared' | 'public';
  sharedWith?: string[];
  pinRequired?: boolean;
  biometricRequired?: boolean;
  
  card?: {
    number?: string;
    cvv?: string;
    pin?: string;
    expiryDate?: Date;
    issueDate?: Date;
    issuer?: string;
    holderName?: string;
    cardNetwork?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
    images?: {
      front?: { fileData?: string };
      back?: { fileData?: string };
      additional?: Array<{ fileData?: string; description?: string }>;
    };
  };
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
    customFields?: Record<string, any>;
    images?: {
      front?: { fileData?: string };
      back?: { fileData?: string };
      additional?: Array<{ fileData?: string; description?: string }>;
    };
  };
  location?: {
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    postalCode?: string;
  };
  identification?: {
    type?: string;
    number?: string;
    issueDate?: Date;
    expiryDate?: Date;
    issuingCountry?: string;
    issuingAuthority?: string;
    images?: {
      front?: { fileData?: string };
      back?: { fileData?: string };
      additional?: Array<{ fileData?: string; description?: string }>;
    };
  };
  // Enhanced media information
  media?: {
    albumId?: string;
    isProfilePicture?: boolean;
    isCoverPhoto?: boolean;
    originalFilename?: string;
  };
}

// Enhanced activity context extraction
const getActivityContext = (req: Request) => ({
  ipAddress: req.ip || req.connection.remoteAddress,
  userAgent: req.get('User-Agent'),
  location: req.body.location || undefined // Optional location data from client
});

// Get user's vault
const getUserVault = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.query as { profileId: string };
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  const vault = await vaultService.getUserVault(profileId);
  if (!vault) {
    // Create default vault structure if it doesn't exist
    const defaultCategories = await vaultService.getCategories(profileId);
    res.json({
      message: 'Vault created successfully',
      vault: defaultCategories
    });
    return;
  }
  res.json({
    message: 'Vault fetched successfully',
    vault
  });
});

// Enhanced get items with new filters
const getItems = asyncHandler(async (req: Request, res: Response) => {
  const { 
    profileId, 
    categoryId, 
    subcategoryId, 
    type, 
    search,
    accessLevel,
    isEncrypted,
    processingStatus,
    cardNetwork,
    isVerified,
    isExpired,
    extractedText
  } = req.query;
  
  if (!profileId || typeof profileId !== 'string') {
    throw createHttpError(400, 'Profile ID is required as a query parameter');
  }

  // Enhanced filters with new capabilities
  const filters: ItemFilters = {};
  
  if (categoryId) filters.categoryId = categoryId as string;
  if (subcategoryId) filters.subcategoryId = subcategoryId as string;
  if (type) filters.type = type as string;
  if (search) filters.search = search as string;
  if (accessLevel) filters.accessLevel = accessLevel as 'private' | 'shared' | 'public';
  if (isEncrypted) filters.isEncrypted = isEncrypted === 'true';
  if (processingStatus) filters.processingStatus = processingStatus as 'pending' | 'completed' | 'failed';
  if (cardNetwork) filters.cardNetwork = cardNetwork as 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  if (isVerified) filters.isVerified = isVerified === 'true';
  if (isExpired) filters.isExpired = isExpired === 'true';
  if (extractedText) filters.extractedText = extractedText as string;

  const result = await vaultService.getItems(profileId, filters);
  if (!result) {
    throw createHttpError(404, 'Vault not found');
  }
  res.json({
    message: 'Items fetched successfully',
    ...result
  });
});

// Get items by category (enhanced)
const getItemsByCategory = asyncHandler(async (req: Request, res: Response) => {
  const { categoryId } = req.params;
  const { profileId, type, search, accessLevel, processingStatus } = req.query;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  const filters: ItemFilters = {
    categoryId,
    type: type as string,
    search: search as string,
    accessLevel: accessLevel as 'private' | 'shared' | 'public',
    processingStatus: processingStatus as 'pending' | 'completed' | 'failed'
  };

  const result = await vaultService.getItems(profileId as string, filters);
  if (!result) {
    throw createHttpError(404, 'No items found for this category');
  }

  res.json({
    message: 'Category items fetched successfully',
    categoryId,
    ...result
  });
});

// Get items by subcategory (enhanced)
const getItemsBySubcategory = asyncHandler(async (req: Request, res: Response) => {
  const { subcategoryId } = req.params;
  const { profileId, type, search, accessLevel } = req.query;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!subcategoryId || !Types.ObjectId.isValid(subcategoryId)) {
    throw createHttpError(400, 'Valid subcategory ID is required');
  }

  const filters: ItemFilters = {
    subcategoryId,
    type: type as string,
    search: search as string,
    accessLevel: accessLevel as 'private' | 'shared' | 'public'
  };

  const result = await vaultService.getItems(profileId as string, filters);
  if (!result) {
    throw createHttpError(404, 'No items found for this subcategory');
  }

  res.json({
    message: 'Subcategory items fetched successfully',
    subcategoryId,
    ...result
  });
});

// Enhanced add item with new features
const addItem = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { profileId, category, subcategoryId, ...itemData }: AddItemRequest & { profileId: string; subcategoryId: string } = req.body;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!category || !subcategoryId) {
    throw createHttpError(400, 'Category and subcategory ID are required');
  }

  if (!itemData.title) {
    throw createHttpError(400, 'Item title is required');
  }

  // Validate card data if present
  if (itemData.card?.number && !/^\d{13,19}$/.test(itemData.card.number.replace(/\s/g, ''))) {
    throw createHttpError(400, 'Invalid card number format');
  }

  try {
    const result = await vaultService.addItem(user._id, profileId, category, subcategoryId, itemData);

    res.status(201).json({
      message: 'Item added successfully',
      item: result.item
    });
  } catch (error) {
    throw createHttpError(500, `Failed to add item: ${(error as Error).message}`);
  }
});

// Update item
const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const { profileId, ...updates } = req.body;
  const user: any = req.user!;
  
  if (!profileId) {
    res.status(400).json({ error: 'Profile ID is required' });
    return;
  }

  if (!itemId || !Types.ObjectId.isValid(itemId)) {
    throw createHttpError(400, 'Invalid item ID');
  }

  // Handle file upload if present
  if (req.file) {
    updates.fileData = req.file.buffer.toString('base64');
  }

  // Validate type if present
  if (updates.type) {
    const validTypes = ['document', 'card', 'identification'];
    if (!validTypes.includes(updates.type)) {
      throw createHttpError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  // Validate card data if present
  if (updates.card) {
    if (updates.card.number && !/^\d{13,19}$/.test(updates.card.number)) {
      throw createHttpError(400, 'Invalid card number format');
    }
    if (updates.card.cvv && !/^\d{3,4}$/.test(updates.card.cvv)) {
      throw createHttpError(400, 'Invalid CVV format');
    }
  }

  // Validate document data if present
  if (updates.document) {
    if (updates.document.expiryDate && new Date(updates.document.expiryDate) < new Date()) {
      throw createHttpError(400, 'Document expiry date cannot be in the past');
    }
  }

  // Validate identification data if present
  if (updates.identification) {
    if (updates.identification.expiryDate && new Date(updates.identification.expiryDate) < new Date()) {
      throw createHttpError(400, 'Identification expiry date cannot be in the past');
    }
  }

  const item = await vaultService.updateItem(user._id, profileId, itemId, updates);
  if (!item) {
    throw createHttpError(404, 'Item not found');
  }

  res.json({
    message: 'Item updated successfully',
    item
  });
});

// Delete item
const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const { profileId } = req.query as { profileId: string };

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!itemId || !Types.ObjectId.isValid(itemId)) {
    throw createHttpError(400, 'Invalid item ID');
  }

  await vaultService.deleteItem(profileId, itemId);
  res.json({
    message: 'Item deleted successfully'
  });
});

// Get all categories
const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.query;
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  const categories = await vaultService.getCategories(profileId as string);
  res.json({
    message: 'Categories fetched successfully',
    categories
  });
});

// Create new category
const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, name, subcategories } = req.body;
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!name || typeof name !== 'string') {
    throw createHttpError(400, 'Category name is required and must be a string');
  }

  if (!subcategories || !Array.isArray(subcategories)) {
    throw createHttpError(400, 'Subcategories must be an array');
  }

  if (subcategories.some(sub => typeof sub !== 'string')) {
    throw createHttpError(400, 'All subcategories must be strings');
  }

  const category = await vaultService.createCategory(
    profileId,
    name,
    subcategories
  );

  res.status(201).json({
    message: 'Category created successfully',
    category
  });
});

// Create new subcategory
const createSubcategory = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, categoryName, subcategoryName, parentId } = req.body;
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!categoryName) {
    throw createHttpError(400, 'Category name is required');
  }

  if (!subcategoryName || typeof subcategoryName !== 'string') {
    throw createHttpError(400, 'Subcategory name is required and must be a string');
  }

  const subcategory = await vaultService.createSubcategory(
    profileId,
    categoryName,
    subcategoryName,
    parentId
  );

  res.status(201).json(subcategory);
});

// Get item by ID
const getItemById = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const { profileId } = req.query as { profileId: string };
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!itemId || !Types.ObjectId.isValid(itemId)) {
    throw createHttpError(400, 'Invalid item ID');
  }

  const item = await vaultService.getItemById(profileId, itemId);
  if (!item) {
    throw createHttpError(404, 'Item not found');
  }

  res.json({
    message: 'Item fetched successfully',
    item
  });
});

// Upload and add to vault
const uploadAndAddToVault = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, fileData, category, subcategory, metadata } = req.body;
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!fileData || typeof fileData !== 'string') {
    throw createHttpError(400, 'File data is required and must be a base64 string');
  }

  if (!category || typeof category !== 'string') {
    throw createHttpError(400, 'Category is required and must be a string');
  }

  if (!subcategory || typeof subcategory !== 'string') {
    throw createHttpError(400, 'Subcategory is required and must be a string');
  }

  const result = await vaultService.uploadAndAddToVault(
    profileId,
    profileId,
    fileData,
    category,
    subcategory,
    metadata
  );

  res.status(201).json(result);
});

// Get subcategories
const getSubcategories = asyncHandler(async (req: Request, res: Response) => {
  const { categoryId, profileId, parentId } = req.query;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!categoryId) {
    throw createHttpError(400, 'Category ID is required');
  }

  const subcategories = await vaultService.getSubcategories(
    profileId as string,
    categoryId as string,
    parentId as string
  );
  
  res.json({
    message: 'Subcategories fetched successfully',
    subcategories
  });
});

// Move subcategory
const moveSubcategory = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, subcategoryId, newCategoryId, newParentSubcategoryId } = req.body;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!subcategoryId) {
    throw createHttpError(400, 'Subcategory ID is required');
  }

  if (!newCategoryId) {
    throw createHttpError(400, 'New Category ID is required');
  }

  const subcategory = await vaultService.moveSubcategory(
    profileId,
    subcategoryId,
    newParentSubcategoryId
  );

  res.json({
    message: 'Subcategory moved successfully',
    subcategory
  });
});

// Clear all vault items
const clearAllVaultItems = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.query;
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  const result = await vaultService.clearAllVaultItems(profileId as string);
  res.json({
    message: 'All vault items cleared successfully',
    result
  });
});

// Get nested subcategories
const getNestedSubcategories = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, subcategoryId } = req.query;

  if (!profileId || !subcategoryId) {
    throw createHttpError(400, 'Profile ID and Subcategory ID are required');
  }

  const subcategories = await vaultService.getNestedSubcategories(profileId as string, subcategoryId as string);
  res.json({
    message: 'Nested subcategories fetched successfully',
    subcategories
  });
});

// Delete subcategory and its items
const deleteSubcategory = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, subcategoryId } = req.body;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!subcategoryId) {
    throw createHttpError(400, 'Subcategory ID is required');
  }

  await vaultService.deleteSubcategory(profileId as string, subcategoryId as string);
  
  res.json({
    message: 'Subcategory and its items deleted successfully'
  });
});

const getVaultSettings = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.params;
  const userId = (req as any).user?.id;

  if (!userId) {
    throw createHttpError(401, 'User not authenticated');
  }

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  const vaultSettings = await vaultService.getVaultSettings(userId, profileId);
  
  res.json({
    success: true,
    data: vaultSettings
  });
});

const updateVaultSettings = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.params;
  const userId = (req as any).user?.id;
  const updates = req.body;

  if (!userId) {
    throw createHttpError(401, 'User not authenticated');
  }

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  const updatedSettings = await vaultService.updateVaultSettings(userId, profileId, updates);
  
  res.json({
    success: true,
    message: 'Vault settings updated successfully',
    data: updatedSettings
  });
});

const getVaultAccessSummary = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.params;
  const { requestingProfileId } = req.query;
  
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!requestingProfileId) {
    throw createHttpError(400, 'Requesting profile ID is required');
  }

  const accessSummary = await vaultService.getVaultAccessSummary(
    requestingProfileId as string, 
    profileId as string
  );
  
  res.json({
    success: true,
    data: accessSummary
  });
});

// Delete user vault
const deleteUserVault = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.query as { profileId: string };
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  // Clear all vault items, categories, and subcategories
  await vaultService.clearAllVaultItems(profileId);
  
  // Delete the vault document itself
  await vaultService.deleteVault(profileId);
  
  res.json({
    message: 'Vault and all contents deleted successfully'
  });
});

// Enhanced search with new capabilities
const advancedSearch = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.query as { profileId: string };
  const searchCriteria = req.body;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  try {
    const results = await vaultService.advancedSearch(profileId, searchCriteria);
    res.json({
      success: true,
      message: 'Search completed successfully',
      data: results,
      criteria: searchCriteria
    });
  } catch (error) {
    throw createHttpError(500, `Search failed: ${(error as Error).message}`);
  }
});

// Get vault analytics with enhanced metrics
const getVaultAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.params;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  try {
    const analytics = await vaultService.getVaultAnalytics(profileId);
    res.json({
      success: true,
      message: 'Analytics fetched successfully',
      data: analytics
    });
  } catch (error) {
    throw createHttpError(500, `Failed to get analytics: ${(error as Error).message}`);
  }
});

// Get audit trail
const getAuditTrail = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.query as { profileId: string };
  const { itemId } = req.params;
  const { limit, offset } = req.query;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!itemId) {
    throw createHttpError(400, 'Item ID is required');
  }

  const options = {
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined
  };

  const auditTrail = await vaultService.getAuditTrail(profileId, itemId, options);
  res.json({
    success: true,
    data: auditTrail
  });
});

// Track access (middleware)
const trackAccess = asyncHandler(async (req: Request, res: Response, next: Function) => {
  const { profileId } = req.query as { profileId: string };
  const { itemId } = req.params;
  
  // Map HTTP methods to audit actions
  const actionMap: { [key: string]: string } = {
    get: 'view',
    post: 'create',
    put: 'update',
    delete: 'delete'
  };
  
  const action = actionMap[req.method.toLowerCase()] || 'view';

  if (profileId && itemId) {
    await vaultService.trackAccess(profileId, itemId, action, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  next();
});

async function getVersions(req: Request, res: Response) {
  try {
    const { itemId } = req.params;
    const { profileId } = req.query;
    const { limit, offset } = req.query;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    const versions = await vaultService.getVersions(
      profileId.toString(),
      itemId,
      {
        limit: limit ? parseInt(limit.toString()) : undefined,
        offset: offset ? parseInt(offset.toString()) : undefined
      }
    );

    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Vault item not found') {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get versions'
    });
  }
}

async function restoreVersion(req: Request, res: Response) {
  try {
    const { itemId } = req.params;
    const { profileId } = req.query;
    const { version } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    if (!version) {
      return res.status(400).json({ error: 'Version number is required' });
    }

    const restoredItem = await vaultService.restoreVersion(
      profileId.toString(),
      itemId,
      version
    );

    res.json({
      success: true,
      data: restoredItem
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Version not found') {
      return res.status(404).json({ error: 'Version not found' });
    }
    if (error instanceof Error && error.message === 'Vault item not found') {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to restore version'
    });
  }
}

async function batchUpdate(req: Request, res: Response) {
  try {
    const { profileId } = req.query;
    const { updates } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    const results = await vaultService.batchUpdate(
      profileId.toString(),
      updates
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to perform batch update'
    });
  }
}

async function batchDelete(req: Request, res: Response) {
  try {
    const { profileId } = req.query;
    const { itemIds } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'Item IDs must be an array' });
    }

    const results = await vaultService.batchDelete(
      profileId.toString(),
      itemIds
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to perform batch delete'
    });
  }
}

async function batchMove(req: Request, res: Response) {
  try {
    const { profileId } = req.query;
    const { items } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }

    const results = await vaultService.batchMove(
      profileId.toString(),
      items
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to perform batch move'
    });
  }
}

// Enhanced share item endpoint
const shareItem = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const user: any = req.user!;
  const { shareWithProfileIds, accessLevel, pinRequired, biometricRequired } = req.body;

  if (!itemId || !Types.ObjectId.isValid(itemId)) {
    throw createHttpError(400, 'Valid item ID is required');
  }

  if (!shareWithProfileIds || !Array.isArray(shareWithProfileIds)) {
    throw createHttpError(400, 'shareWithProfileIds must be an array');
  }

  try {
    // Update item with sharing settings
    const result = await vaultService.updateItem(
      user._id,
      user.profileId,
      itemId,
      {
        accessLevel: accessLevel || 'shared',
        sharedWith: shareWithProfileIds,
        pinRequired: pinRequired || false,
        biometricRequired: biometricRequired || false
      }
    );

    res.json({
      message: 'Item shared successfully',
      item: result,
      sharedWith: shareWithProfileIds
    });
  } catch (error) {
    throw createHttpError(500, `Failed to share item: ${(error as Error).message}`);
  }
});

export {
  getUserVault,
  deleteUserVault,
  getItems,
  getItemsByCategory,
  getItemsBySubcategory,
  addItem,
  updateItem,
  deleteItem,
  getCategories,
  createCategory,
  createSubcategory,
  getSubcategories,
  getNestedSubcategories,
  clearAllVaultItems,
  moveSubcategory,
  deleteSubcategory,
  getItemById,
  uploadAndAddToVault,
  getVaultSettings,
  updateVaultSettings,
  getVaultAccessSummary,
  advancedSearch,
  getVaultAnalytics,
  getAuditTrail,
  trackAccess,
  getVersions,
  restoreVersion,
  batchUpdate,
  batchDelete,
  batchMove,
  shareItem
}; 