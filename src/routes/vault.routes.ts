import express from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { validate } from '../middleware/requestValidator';
import rateLimit from 'express-rate-limit';

import {
  getItems,
  addItem,
  updateItem,
  deleteItem,
  getCategories,
  createCategory,
  createSubcategory,
  getUserVault,
  getSubcategories,
  clearAllVaultItems,
  moveSubcategory,
  getNestedSubcategories,
  getItemsBySubcategory,
  getItemsByCategory,
  deleteSubcategory
} from '../controllers/vault.controller';
import { authenticateToken } from '../middleware/authMiddleware';

/**
 * @file vault.routes.ts
 * @description Vault Routes for Digital Asset Management
 * ====================================================
 *
 * This file defines all routes for the Vault system including
 * wallet items, documents, media, albums, and analytics.
 *
 * @version 1.0.0
 * @author My Profile Server
 */

const router = express.Router();

// Rate limiting for file uploads
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 uploads per window
  message: { error: 'Too many upload requests, please try again later' }
});

// General validation schemas
const objectIdValidation = param('itemId').isMongoId().withMessage('Valid item ID is required');
const categoryIdValidation = param('categoryId').isMongoId().withMessage('Valid category ID is required');
const subcategoryIdValidation = param('subcategoryId').isMongoId().withMessage('Valid subcategory ID is required');

const paginationValidation = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
];

// Profile ID validation for query parameters
const profileIdQueryValidation = [
  query('profileId').notEmpty().isMongoId().withMessage('Valid profile ID is required')
];

// Category validation schema
const categoryValidation = [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Category name is required and must be under 100 characters'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
  body('icon').optional().isString().trim().isLength({ max: 50 }).withMessage('Icon must be under 50 characters'),
  body('color').optional().isString().trim().matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer')
];

// Subcategory validation schema
const subcategoryValidation = [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Subcategory name is required and must be under 100 characters'),
  body('categoryId').notEmpty().isMongoId().withMessage('Valid category ID is required'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
  body('icon').optional().isString().trim().isLength({ max: 50 }).withMessage('Icon must be under 50 characters'),
  body('color').optional().isString().trim().matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  body('parentSubcategoryId').optional().isMongoId().withMessage('Parent subcategory ID must be valid')
];

// Item validation schema
const itemValidation = [
  body('category').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Category is required and must be under 100 characters'),
  body('subcategory').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Subcategory is required and must be under 100 characters'),
  body('type').optional().isString().trim().isLength({ max: 50 }).withMessage('Type must be under 50 characters'),
  body('title').notEmpty().trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be under 200 characters'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be under 1000 characters'),
  body('fileData').optional().isString(),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
  
  // Card validation
  body('card.number').optional().isString().isLength({ min: 8, max: 20 }).withMessage('Card number must be between 8-20 characters'),
  body('card.cvv').optional().isString().isLength({ min: 3, max: 4 }).withMessage('CVV must be 3-4 characters'),
  body('card.pin').optional().isString().isLength({ min: 4, max: 8 }).withMessage('PIN must be 4-8 characters'),
  body('card.expiryDate').optional().isISO8601().withMessage('Expiry date must be valid ISO date'),
  body('card.issueDate').optional().isISO8601().withMessage('Issue date must be valid ISO date'),
  body('card.issuer').optional().isString().trim().isLength({ max: 100 }).withMessage('Issuer must be under 100 characters'),
  body('card.holderName').optional().isString().trim().isLength({ max: 100 }).withMessage('Holder name must be under 100 characters'),
  
  // Document validation
  body('document.type').optional().isString().trim().isLength({ max: 100 }).withMessage('Document type must be under 100 characters'),
  body('document.status').optional().isString().trim().isLength({ max: 50 }).withMessage('Document status must be under 50 characters'),
  body('document.class').optional().isString().trim().isLength({ max: 50 }).withMessage('Document class must be under 50 characters'),
  body('document.category').optional().isString().trim().isLength({ max: 100 }).withMessage('Document category must be under 100 characters'),
  body('document.subcategory').optional().isString().trim().isLength({ max: 100 }).withMessage('Document subcategory must be under 100 characters'),
  body('document.version').optional().isString().trim().isLength({ max: 20 }).withMessage('Document version must be under 20 characters'),
  body('document.authority').optional().isString().trim().isLength({ max: 100 }).withMessage('Authority must be under 100 characters'),
  body('document.number').optional().isString().trim().isLength({ max: 50 }).withMessage('Document number must be under 50 characters'),
  body('document.issueDate').optional().isISO8601().withMessage('Issue date must be valid ISO date'),
  body('document.expiryDate').optional().isISO8601().withMessage('Expiry date must be valid ISO date'),
  body('document.location').optional().isString().trim().isLength({ max: 200 }).withMessage('Location must be under 200 characters'),
  body('document.notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be under 1000 characters'),
  body('document.tags').optional().isArray().withMessage('Tags must be an array'),
  body('document.tags.*').optional().isString().trim().isLength({ max: 50 }).withMessage('Each tag must be under 50 characters'),
  body('document.customFields').optional().isObject().withMessage('Custom fields must be an object'),
  
  // Location validation
  body('location.country').optional().isString().trim().isLength({ min: 2, max: 2 }).withMessage('Country must be 2-character code'),
  body('location.state').optional().isString().trim().isLength({ max: 100 }).withMessage('State must be under 100 characters'),
  body('location.city').optional().isString().trim().isLength({ max: 100 }).withMessage('City must be under 100 characters'),
  body('location.address').optional().isString().trim().isLength({ max: 200 }).withMessage('Address must be under 200 characters'),
  body('location.postalCode').optional().isString().trim().isLength({ max: 20 }).withMessage('Postal code must be under 20 characters'),
  
  // Identification validation
  body('identification.type').optional().isString().trim().isLength({ max: 50 }).withMessage('Identification type must be under 50 characters'),
  body('identification.number').optional().isString().trim().isLength({ max: 50 }).withMessage('Identification number must be under 50 characters'),
  body('identification.issueDate').optional().isISO8601().withMessage('Issue date must be valid ISO date'),
  body('identification.expiryDate').optional().isISO8601().withMessage('Expiry date must be valid ISO date'),
  body('identification.issuingCountry').optional().isString().trim().isLength({ min: 2, max: 2 }).withMessage('Issuing country must be 2-character code'),
  body('identification.issuingAuthority').optional().isString().trim().isLength({ max: 100 }).withMessage('Issuing authority must be under 100 characters')
];

// Move subcategory validation
const moveSubcategoryValidation = [
  body('subcategoryId').notEmpty().isMongoId().withMessage('Valid subcategory ID is required'),
  body('newCategoryId').notEmpty().isMongoId().withMessage('Valid new category ID is required'),
  body('newParentSubcategoryId').optional().isMongoId().withMessage('New parent subcategory ID must be valid')
];

// Search validation
const searchValidation = [
  query('category').optional().isString().trim(),
  query('subcategory').optional().isString().trim(),
  query('type').optional().isString().trim(),
  query('search').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Search query must be 1-100 characters')
];

// ===========================
// GENERAL VAULT ROUTES
// ===========================

/**
 * @route GET /api/vault
 * @desc Get user's vault
 * @access Private
 */
router.get('/',
  authenticateToken,
  validate(profileIdQueryValidation),
  getUserVault
);

/**
 * @route GET /api/vault/items
 * @desc Get all vault items with filtering and pagination
 * @access Private
 */
router.get('/items',
  protect,
  validate([
    ...profileIdQueryValidation,
    ...searchValidation,
    ...paginationValidation
  ]),
  getItems
);

/**
 * @route POST /api/vault/items
 * @desc Add a new vault item
 * @access Private
 */
router.post('/items',
  authenticateToken,
  uploadRateLimit,
  upload.single('file'),
  validate(itemValidation),
  addItem
);

/**
 * @route PUT /api/vault/items/:itemId
 * @desc Update a vault item
 * @access Private
 */
router.put('/items/:itemId',
  protect,
  uploadRateLimit,
  upload.single('file'),
  validate([
    objectIdValidation,
    ...itemValidation.map(validation => validation.optional())
  ]),
  updateItem
);

/**
 * @route DELETE /api/vault/items/:itemId
 * @desc Delete a vault item
 * @access Private
 */
router.delete('/items/:itemId',
  protect,
  validate([objectIdValidation]),
  deleteItem
);

// ===========================
// CATEGORY ROUTES
// ===========================

/**
 * @route GET /api/vault/categories
 * @desc Get all categories
 * @access Private
 */
router.get('/categories',
  authenticateToken,
  validate(profileIdQueryValidation),
  getCategories
);

/**
 * @route POST /api/vault/categories
 * @desc Create a new category
 * @access Private
 */
router.post('/categories',
  authenticateToken,
  validate(categoryValidation),
  createCategory
);

/**
 * @route GET /api/vault/categories/:categoryId/items
 * @desc Get items by category
 * @access Private
 */
router.get('/categories/:categoryId/items',
  authenticateToken,
  validate([
    categoryIdValidation,
    ...profileIdQueryValidation,
    ...searchValidation,
    ...paginationValidation
  ]),
  getItemsByCategory
);

// ===========================
// SUBCATEGORY ROUTES
// ===========================

/**
 * @route GET /api/vault/subcategories
 * @desc Get all subcategories
 * @access Private
 */
router.get('/subcategories',
  authenticateToken,
  validate(profileIdQueryValidation),
  getSubcategories
);

/**
 * @route POST /api/vault/subcategories
 * @desc Create a new subcategory
 * @access Private
 */
router.post('/subcategories',
  authenticateToken,
  validate(subcategoryValidation),
  createSubcategory
);

/**
 * @route GET /api/vault/subcategories/nested
 * @desc Get nested subcategories
 * @access Private
 */
router.get('/subcategories/nested',
  authenticateToken,
  validate(profileIdQueryValidation),
  getNestedSubcategories
);

/**
 * @route POST /api/vault/subcategories/move
 * @desc Move a subcategory
 * @access Private
 */
router.post('/subcategories/move',
  authenticateToken,
  validate(moveSubcategoryValidation),
  moveSubcategory
);

/**
 * @route DELETE /api/vault/subcategories
 * @desc Delete a subcategory
 * @access Private
 */
router.delete('/subcategories',
  authenticateToken,
  validate([
    body('subcategoryId').notEmpty().isMongoId().withMessage('Valid subcategory ID is required')
  ]),
  deleteSubcategory
);

/**
 * @route GET /api/vault/subcategories/:subcategoryId/items
 * @desc Get items by subcategory
 * @access Private
 */
router.get('/subcategories/:subcategoryId/items',
  authenticateToken,
  validate([
    subcategoryIdValidation,
    ...profileIdQueryValidation,
    ...searchValidation,
    ...paginationValidation
  ]),
  getItemsBySubcategory
);

// ===========================
// UTILITY ROUTES
// ===========================

/**
 * @route DELETE /api/vault/clear
 * @desc Clear all vault items
 * @access Private
 */
router.delete('/clear',
  authenticateToken,
  validate([
    body('confirmClear').equals('true').withMessage('Must confirm clear operation'),
    ...profileIdQueryValidation
  ]),
  clearAllVaultItems
);

export default router;
