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

import express from 'express';
import { body, param, query } from 'express-validator';
import { vaultController } from '../controllers/vault.controller';
import { protect } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { validate } from '../middleware/requestValidator';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for file uploads
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 uploads per window
  message: { error: 'Too many upload requests, please try again later' }
});

// General validation schemas
const objectIdValidation = param('itemId').isMongoId().withMessage('Valid item ID is required');
const albumIdValidation = param('albumId').isMongoId().withMessage('Valid album ID is required');

const paginationValidation = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
];

// ===========================
// GENERAL VAULT ROUTES
// ===========================

/**
 * @route GET /api/vault/items
 * @desc Get all vault items with filtering and pagination
 * @access Private
 */
router.get('/items',
  protect,
  validate([
    query('category').optional().isIn(['wallet', 'documents', 'media']).withMessage('Invalid category'),
    query('subcategory').optional().isString().trim(),
    query('tags').optional(),
    query('search').optional().isString().isLength({ max: 100 }).withMessage('Search query too long'),
    query('isFavorite').optional().isBoolean().withMessage('isFavorite must be boolean'),
    query('sortBy').optional().isIn(['name', 'createdAt', 'updatedAt', 'fileSize']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    ...paginationValidation
  ]),
  vaultController.getVaultItems
);

/**
 * @route GET /api/vault/items/:itemId
 * @desc Get a specific vault item
 * @access Private
 */
router.get('/items/:itemId',
  protect,
  validate([objectIdValidation]),
  vaultController.getVaultItem
);

/**
 * @route DELETE /api/vault/items/:itemId
 * @desc Delete a vault item
 * @access Private
 */
router.delete('/items/:itemId',
  protect,
  validate([objectIdValidation]),
  vaultController.deleteVaultItem
);

// ===========================
// WALLET ROUTES
// ===========================

const walletValidation = [
  body('name').notEmpty().trim().isLength({ max: 100 }).withMessage('Name is required and must be under 100 characters'),
  body('subcategory').isIn([
    'identity-card', 'residency-medical', 'financial-cards',
    'myprofile-cards', 'membership-loyalty', 'passes-tickets',
    'discount-receipts', 'other'
  ]).withMessage('Invalid wallet subcategory'),
  body('cardType').notEmpty().withMessage('Card type is required'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description too long'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().trim().isLength({ max: 50 }).withMessage('Tag too long'),
  body('isEncrypted').optional().isBoolean().withMessage('isEncrypted must be boolean'),
  body('isFavorite').optional().isBoolean().withMessage('isFavorite must be boolean'),
  body('accessLevel').optional().isIn(['private', 'shared', 'public']).withMessage('Invalid access level'),
  body('cardNumber').optional().isString().isLength({ min: 8, max: 20 }).withMessage('Invalid card number length'),
  body('expiryDate').optional().isISO8601().withMessage('Invalid expiry date format'),
  body('issuer').optional().isString().trim().isLength({ max: 100 }).withMessage('Issuer name too long'),
  body('holderName').optional().isString().trim().isLength({ max: 100 }).withMessage('Holder name too long'),
  body('cardNetwork').optional().isIn(['visa', 'mastercard', 'amex', 'discover', 'other']).withMessage('Invalid card network'),
  body('documentNumber').optional().isString().isLength({ max: 50 }).withMessage('Document number too long'),
  body('issuingCountry').optional().isLength({ min: 2, max: 2 }).withMessage('Country code must be 2 characters'),
  body('issuingAuthority').optional().isString().trim().isLength({ max: 100 }).withMessage('Issuing authority too long'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  body('pinRequired').optional().isBoolean().withMessage('pinRequired must be boolean'),
  body('biometricRequired').optional().isBoolean().withMessage('biometricRequired must be boolean')
];

/**
 * @route POST /api/vault/wallet
 * @desc Create a new wallet item
 * @access Private
 */
router.post('/wallet',
  protect,
  validate(walletValidation),
  vaultController.createWalletItem
);

/**
 * @route PUT /api/vault/wallet/:itemId
 * @desc Update a wallet item
 * @access Private
 */
router.put('/wallet/:itemId',
  protect,
  objectIdValidation,
  walletValidation.map(validation => validation.optional()),
  vaultController.updateWalletItem
);

/**
 * @route POST /api/vault/wallet/:itemId/image
 * @desc Upload card image (front or back)
 * @access Private
 */
router.post('/wallet/:itemId/image',
  protect,
  uploadRateLimit,
  upload.single('image'),
  [
    objectIdValidation,
    body('side').isIn(['front', 'back']).withMessage('Side must be either front or back')
  ],
  vaultController.uploadCardImage
);

// ===========================
// DOCUMENT ROUTES
// ===========================

const documentValidation = [
  body('name').notEmpty().trim().isLength({ max: 100 }).withMessage('Name is required and must be under 100 characters'),
  body('subcategory').isIn(['documents', 'receipts', 'forms', 'vouchers', 'other']).withMessage('Invalid document subcategory'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description too long'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().trim().isLength({ max: 50 }).withMessage('Tag too long'),
  body('isEncrypted').optional().isBoolean().withMessage('isEncrypted must be boolean'),
  body('isFavorite').optional().isBoolean().withMessage('isFavorite must be boolean'),
  body('accessLevel').optional().isIn(['private', 'shared', 'public']).withMessage('Invalid access level'),
  body('documentType').optional().isString().trim().isLength({ max: 100 }).withMessage('Document type too long'),
  body('issuedBy').optional().isString().trim().isLength({ max: 100 }).withMessage('Issued by too long'),
  body('issuedDate').optional().isISO8601().withMessage('Invalid issued date format'),
  body('expiryDate').optional().isISO8601().withMessage('Invalid expiry date format'),
  body('promoCode').optional().isString().trim().isLength({ max: 50 }).withMessage('Promo code too long'),
  body('discountValue').optional().isString().trim().isLength({ max: 20 }).withMessage('Discount value too long'),
  body('discountType').optional().isIn(['percentage', 'fixed', 'other']).withMessage('Invalid discount type'),
  body('validUntil').optional().isISO8601().withMessage('Invalid valid until date format')
];

/**
 * @route POST /api/vault/documents
 * @desc Create a new document item
 * @access Private
 */
router.post('/documents',
  protect,
  uploadRateLimit,
  upload.single('file'),
  validate(documentValidation),
  vaultController.createDocumentItem
);

/**
 * @route PUT /api/vault/documents/:itemId
 * @desc Update a document item
 * @access Private
 */
router.put('/documents/:itemId',
  protect,
  objectIdValidation,
  documentValidation.map(validation => validation.optional()),
  vaultController.updateDocumentItem
);

/**
 * @route POST /api/vault/documents/:itemId/link-scan
 * @desc Link document to existing scan
 * @access Private
 */
router.post('/documents/:itemId/link-scan',
  protect,
  [
    objectIdValidation,
    body('scanId').isMongoId().withMessage('Valid scan ID is required')
  ],
  vaultController.linkDocumentToScan
);

// ===========================
// MEDIA ROUTES
// ===========================

const mediaValidation = [
  body('name').notEmpty().trim().isLength({ max: 100 }).withMessage('Name is required and must be under 100 characters'),
  body('subcategory').isIn(['gallery', 'videos', 'audio', 'other']).withMessage('Invalid media subcategory'),
  body('mediaType').isIn(['image', 'video', 'audio']).withMessage('Invalid media type'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description too long'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().trim().isLength({ max: 50 }).withMessage('Tag too long'),
  body('isEncrypted').optional().isBoolean().withMessage('isEncrypted must be boolean'),
  body('isFavorite').optional().isBoolean().withMessage('isFavorite must be boolean'),
  body('accessLevel').optional().isIn(['private', 'shared', 'public']).withMessage('Invalid access level'),
  body('capturedAt').optional().isISO8601().withMessage('Invalid captured date format'),
  body('location.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('location.address').optional().isString().trim().isLength({ max: 200 }).withMessage('Address too long'),
  body('albumId').optional().isMongoId().withMessage('Invalid album ID'),
  body('isProfilePicture').optional().isBoolean().withMessage('isProfilePicture must be boolean'),
  body('isCoverPhoto').optional().isBoolean().withMessage('isCoverPhoto must be boolean')
];

/**
 * @route POST /api/vault/media
 * @desc Create a new media item
 * @access Private
 */
router.post('/media',
  protect,
  uploadRateLimit,
  upload.single('file'),
  mediaValidation,
  vaultController.createMediaItem
);

/**
 * @route PUT /api/vault/media/:itemId
 * @desc Update a media item
 * @access Private
 */
router.put('/media/:itemId',
  protect,
  objectIdValidation,
  mediaValidation.map(validation => validation.optional()),
  vaultController.updateMediaItem
);

// ===========================
// ALBUM ROUTES
// ===========================

const albumValidation = [
  body('name').notEmpty().trim().isLength({ max: 100 }).withMessage('Album name is required and must be under 100 characters'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('Description too long'),
  body('isPrivate').optional().isBoolean().withMessage('isPrivate must be boolean'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be non-negative')
];

/**
 * @route POST /api/vault/albums
 * @desc Create a new album
 * @access Private
 */
router.post('/albums',
  protect,
  albumValidation,
  vaultController.createAlbum
);

/**
 * @route GET /api/vault/albums
 * @desc Get all albums for current profile
 * @access Private
 */
router.get('/albums',
  protect,
  vaultController.getAlbums
);

/**
 * @route PUT /api/vault/albums/:albumId
 * @desc Update an album
 * @access Private
 */
router.put('/albums/:albumId',
  protect,
  validate([albumIdValidation]),
  albumValidation.map(validation => validation.optional()),
  vaultController.updateAlbum
);

/**
 * @route DELETE /api/vault/albums/:albumId
 * @desc Delete an album
 * @access Private
 */
router.delete('/albums/:albumId',
  protect,
  validate([albumIdValidation]),
  vaultController.deleteAlbum
);

// ===========================
// ANALYTICS & STATISTICS ROUTES
// ===========================

/**
 * @route GET /api/vault/stats
 * @desc Get vault statistics for current profile
 * @access Private
 */
router.get('/stats',
  protect,
  vaultController.getVaultStats
);

/**
 * @route GET /api/vault/activity
 * @desc Get vault activity log
 * @access Private
 */
router.get('/activity',
  protect,
  [
    query('itemId').optional().isMongoId().withMessage('Invalid item ID'),
    query('action').optional().isIn(['created', 'updated', 'deleted', 'viewed', 'shared', 'downloaded']).withMessage('Invalid action'),
    ...paginationValidation
  ],
  vaultController.getVaultActivity
);

// ===========================
// SHARING & ACCESS CONTROL ROUTES
// ===========================

/**
 * @route POST /api/vault/items/:itemId/share
 * @desc Share a vault item with other profiles
 * @access Private
 */
router.post('/items/:itemId/share',
  protect,
  [
    objectIdValidation,
    body('shareWithProfileIds').isArray({ min: 1 }).withMessage('Must share with at least one profile'),
    body('shareWithProfileIds.*').isMongoId().withMessage('Invalid profile ID'),
    body('accessLevel').optional().isIn(['shared', 'public']).withMessage('Invalid access level')
  ],
  vaultController.shareVaultItem
);

/**
 * @route GET /api/vault/shared
 * @desc Get items shared with current profile
 * @access Private
 */
router.get('/shared',
  protect,
  vaultController.getSharedItems
);

// ===========================
// SEARCH ROUTES
// ===========================

/**
 * @route GET /api/vault/search
 * @desc Search vault items
 * @access Private
 */
router.get('/search',
  protect,
  [
    query('q').notEmpty().isString().isLength({ min: 1, max: 100 }).withMessage('Search query is required and must be under 100 characters'),
    query('categories').optional(),
    query('tags').optional(),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format')
  ],
  vaultController.searchVault
);

export default router;
