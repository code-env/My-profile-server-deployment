/**
 * @file nfc.routes.ts
 * @description NFC Card Management Routes
 * ===================================
 *
 * This module defines all routes for NFC card operations including:
 * - Card creation and management
 * - NFC data writing and reading (hardware)
 * - Analytics tracking
 * - Access control management
 * - Real-world NFC programming using industry approaches
 *
 * @version 2.0.0
 * @author My Profile Server
 */

import { Router } from 'express';
import { NFCController } from '../controllers/nfc.controller';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = Router();

/**
 * Hardware Programming Routes (Real-world NFC implementation)
 * These routes implement server-side card programming using industry-proven approaches
 */

// Program NFC card with profile data (admin access)
router.post('/cards/:cardId/program',
  requireRole(['admin']),
  [
    param('cardId').isString().withMessage('Valid card ID required'),
    body('profileId').isMongoId().withMessage('Valid profile ID required'),
    body('readerName').optional().isString().withMessage('Reader name must be string'),
    handleValidationErrors
  ],
  NFCController.programCard
);

// Read NFC card data for verification
router.post('/cards/read',
  requireRole(['admin']),
  [
    body('readerName').optional().isString().withMessage('Reader name must be string'),
    handleValidationErrors
  ],
  NFCController.readCard
);

// Format/erase NFC card
router.post('/cards/:cardId/format',
  requireRole(['admin']),
  [
    param('cardId').isString().withMessage('Valid card ID required'),
    body('profileId').isMongoId().withMessage('Valid profile ID required'),
    body('readerName').optional().isString().withMessage('Reader name must be string'),
    handleValidationErrors
  ],
  NFCController.formatCard
);

// Reprogram existing card with updated data
router.post('/cards/:cardId/reprogram',
  requireRole(['admin']),
  [
    param('cardId').isString().withMessage('Valid card ID required'),
    body('profileId').isMongoId().withMessage('Valid profile ID required'),
    body('readerName').optional().isString().withMessage('Reader name must be string'),
    handleValidationErrors
  ],
  NFCController.reprogramCard
);

// Get NFC hardware status
router.get('/hardware/status',
  requireRole(['admin']),
  NFCController.getHardwareStatus
);

// Initialize NFC hardware
router.post('/hardware/initialize',
  requireRole(['admin', 'superadmin']),
  NFCController.initializeHardware
);

/**
 * Legacy Validation Rules (for existing endpoints)
 */
const validateCardCreation = [
  body('cardType')
    .isIn(['basic', 'premium', 'enterprise'])
    .withMessage('Card type must be basic, premium, or enterprise'),
  body('configuration.template')
    .optional()
    .isIn(['full', 'minimal', 'custom'])
    .withMessage('Template must be full, minimal, or custom'),
  body('configuration.fields')
    .optional()
    .isArray()
    .withMessage('Fields must be an array'),
  body('accessControl.isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('accessControl.accessLevel')
    .optional()
    .isIn(['public', 'protected', 'private'])
    .withMessage('Access level must be public, protected, or private'),
  body('accessControl.allowedUsers')
    .optional()
    .isArray()
    .withMessage('Allowed users must be an array'),
  body('accessControl.locationRestriction')
    .optional()
    .isObject()
    .withMessage('Location restriction must be an object'),
  handleValidationErrors
];

const validateCardConfiguration = [
  param('cardId')
    .isMongoId()
    .withMessage('Invalid card ID'),
  body('configuration.template')
    .optional()
    .isIn(['full', 'minimal', 'custom'])
    .withMessage('Template must be full, minimal, or custom'),
  body('configuration.fields')
    .optional()
    .isArray()
    .withMessage('Fields must be an array'),
  body('configuration.customData')
    .optional()
    .isObject()
    .withMessage('Custom data must be an object'),
  handleValidationErrors
];

const validateAccessControl = [
  param('cardId')
    .isMongoId()
    .withMessage('Invalid card ID'),
  body('accessControl')
    .isObject()
    .withMessage('Access control must be an object'),
  body('accessControl.isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('accessControl.accessLevel')
    .optional()
    .isIn(['public', 'protected', 'private'])
    .withMessage('Access level must be public, protected, or private'),
  handleValidationErrors
];

const validateScanRecord = [
  body('cardId')
    .isMongoId()
    .withMessage('Invalid card ID'),
  body('scannedBy')
    .optional()
    .isMongoId()
    .withMessage('Invalid scanned by user ID'),
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  body('deviceInfo')
    .optional()
    .isObject()
    .withMessage('Device info must be an object'),
  handleValidationErrors
];

const validateCardId = [
  param('cardId')
    .isMongoId()
    .withMessage('Invalid card ID'),
  handleValidationErrors
];

/**
 * Card Management Routes
 */

// Create a new NFC card
router.post('/cards', validateCardCreation, NFCController.createCard);

// Get user's NFC cards
router.get('/cards', NFCController.getUserCards);

// Get specific card details
router.get('/cards/:cardId', validateCardId, NFCController.getCard);

// Update card configuration
router.put('/cards/:cardId/configuration', validateCardConfiguration, NFCController.updateCardConfiguration);

// Update card access control
router.put('/cards/:cardId/access-control', validateAccessControl, NFCController.updateAccessControl);

// Delete a card
router.delete('/cards/:cardId', validateCardId, NFCController.deleteCard);

/**
 * NFC Data Generation Routes
 */

// Generate NFC write data for a card
router.post('/cards/:cardId/generate-write-data', validateCardId, NFCController.generateWriteData);

// Get card data for NFC reading (public endpoint for Flutter app)
router.get('/cards/:cardId/read-data', validateCardId, NFCController.getCardReadData);

/**
 * Analytics Routes
 */

// Record a scan (public endpoint for when someone scans the card)
router.post('/scan', validateScanRecord, NFCController.recordScan);

// Get card analytics (for card owner)
router.get('/cards/:cardId/analytics', validateCardId, NFCController.getCardAnalytics);

// Get scan history for a card
router.get('/cards/:cardId/scans', [
  ...validateCardId,
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  handleValidationErrors
], NFCController.getCardScans);

/**
 * Template Management Routes
 */

// Get available configuration templates
router.get('/templates', NFCController.getTemplates);

// Get template details
router.get('/templates/:templateName', [
  param('templateName')
    .isIn(['full', 'minimal', 'custom'])
    .withMessage('Template name must be full, minimal, or custom'),
  handleValidationErrors
], NFCController.getTemplate);

/**
 * Bulk Operations Routes
 */

// Get analytics for all user's cards
router.get('/analytics/overview', NFCController.getUserAnalyticsOverview);

// Export card data
router.get('/cards/:cardId/export', validateCardId, NFCController.exportCardData);

// Bulk update access control for multiple cards
router.put('/cards/bulk/access-control', [
  body('cardIds')
    .isArray({ min: 1 })
    .withMessage('Card IDs must be a non-empty array'),
  body('cardIds.*')
    .isMongoId()
    .withMessage('Each card ID must be valid'),
  body('accessControl')
    .isObject()
    .withMessage('Access control must be an object'),
  handleValidationErrors
], NFCController.bulkUpdateAccessControl);

export default router;
