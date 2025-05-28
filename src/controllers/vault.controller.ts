import { vaultService } from '../services/vault.service';
import { Types } from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Request, Response } from 'express';
import createHttpError from 'http-errors';


interface ItemFilters {
  categoryId?: string;
  subcategoryId?: string;
  type?: string;
  search?: string;
}

interface AddItemRequest {
  category: string;
  subcategory: string;
  type?: string;
  title: string;
  description?: string;
  fileData?: string;
  metadata?: Record<string, any>;
  card?: {
    number?: string;
    cvv?: string;
    pin?: string;
    expiryDate?: Date;
    issueDate?: Date;
    issuer?: string;
    holderName?: string;
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
}

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

// Get items with optional filters
const getItems = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, categoryId, subcategoryId, type, search } = req.query;
  
  if (!profileId || typeof profileId !== 'string') {
    throw createHttpError(400, 'Profile ID is required as a query parameter');
  }

  // Validate and type check query parameters
  const filters: ItemFilters = {};
  
  if (categoryId) {
    filters.categoryId = categoryId as string;
  }

  if (subcategoryId) {
    filters.subcategoryId = subcategoryId as string;
  }

  if (type) {
    filters.type = type as string;
  }

  if (search) {
    if (typeof search !== 'string') {
      throw createHttpError(400, 'Search parameter must be a string');
    }
    filters.search = search;
  }

  const result = await vaultService.getItems(profileId, filters);
  if (!result) {
    throw createHttpError(404, 'Vault not found');
  }
  res.json({
    message: 'Items fetched successfully',
    ...result
  });
});

// Get items by category
const getItemsByCategory = asyncHandler(async (req: Request, res: Response) => {
  const { categoryId } = req.params;
  const { profileId } = req.query;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  // if (!categoryId || !Types.ObjectId.isValid(categoryId)) {
  //   throw createHttpError(400, 'Valid category ID is required');
  // }

  const filters: ItemFilters = {
    categoryId,
    type: req.query.type as string,
    search: req.query.search as string
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

// Get items by subcategory
const getItemsBySubcategory = asyncHandler(async (req: Request, res: Response) => {
  const { subcategoryId } = req.params;
  const { profileId } = req.query;

  console.log(profileId, subcategoryId);

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!subcategoryId || !Types.ObjectId.isValid(subcategoryId)) {
    throw createHttpError(400, 'Valid subcategory ID is required');
  }

  const filters: ItemFilters = {
    subcategoryId,
    type: req.query.type as string,
    search: req.query.search as string
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

// Add item to vault
const addItem = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, category, subcategoryId, ...itemData } = req.body;
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!category || !subcategoryId) {
    throw createHttpError(400, 'Category and subcategory ID are required');
  }

  if (!Types.ObjectId.isValid(subcategoryId)) {
    throw createHttpError(400, 'Invalid subcategory ID format');
  }

  // Type check the item data
  const item = itemData as AddItemRequest;
  const { type, title } = item;

  // Validate required fields
  if (!title) {
    throw createHttpError(400, 'Title is required');
  }

  // Validate card data if present
  if (type === 'card' && item.card) {
    if (item.card.number && !/^\d{13,19}$/.test(item.card.number)) {
      throw createHttpError(400, 'Invalid card number format');
    }
    if (item.card.cvv && !/^\d{3,4}$/.test(item.card.cvv)) {
      throw createHttpError(400, 'Invalid CVV format');
    }
  }

  // Validate document data if present
  if (type === 'document' && item.document) {
    if (item.document.expiryDate && new Date(item.document.expiryDate) < new Date()) {
      throw createHttpError(400, 'Document expiry date cannot be in the past');
    }
  }

  // Validate identification data if present
  if (type === 'identification' && item.identification) {
    if (item.identification.expiryDate && new Date(item.identification.expiryDate) < new Date()) {
      throw createHttpError(400, 'Identification expiry date cannot be in the past');
    }
  }

  const result = await vaultService.addItem(
    profileId,
    profileId,
    category,
    subcategoryId,
    item
  );

  res.status(201).json({
    message: 'Item added successfully',
    item: result
  });
});

// Update item
const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const { profileId, ...updates } = req.body;
  
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!itemId || !Types.ObjectId.isValid(itemId)) {
    throw createHttpError(400, 'Invalid item ID');
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

  const item = await vaultService.updateItem(profileId, itemId, updates);
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
  const { profileId, categoryId, subcategoryName, parentId } = req.body;
  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!categoryId) {
    throw createHttpError(400, 'Category ID is required');
  }

  if (!subcategoryName || typeof subcategoryName !== 'string') {
    throw createHttpError(400, 'Subcategory name is required and must be a string');
  }

  const subcategory = await vaultService.createSubcategory(
    profileId,
    categoryId,
    subcategoryName,
    parentId
  );

  res.status(201).json(subcategory);
});

// Get item by ID
export const getItemById = asyncHandler(async (req: Request, res: Response) => {
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
export const uploadAndAddToVault = asyncHandler(async (req: Request, res: Response) => {
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
  const { profileId, subcategoryId, newParentId } = req.body;

  if (!profileId) {
    throw createHttpError(400, 'Profile ID is required');
  }

  if (!subcategoryId) {
    throw createHttpError(400, 'Subcategory ID is required');
  }

  const subcategory = await vaultService.moveSubcategory(
    profileId,
    subcategoryId,
    newParentId
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
  const { profileId, subcategoryId } = req.query;

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

export {
  getUserVault,
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
  deleteSubcategory
}; 
