import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { ProfileController } from '../controllers/profile.controller';
import {
  createTemplate,
  bulkCreateTemplates,
  listTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate
} from '../controllers/admin-profile-template.controller';

const router = express.Router();

// Initialize ProfileController
const profileController = new ProfileController();

// Apply authentication middleware to all routes
// router.use(authenticateToken);

// Admin routes for managing profile templates
router.post('/t/create', authenticateToken, requireRole(['user', 'admin', 'superadmin']), createTemplate);
router.post('/t/bulk-create', authenticateToken, requireRole(['user', 'admin', 'superadmin']), bulkCreateTemplates);
router.get('/t/list', authenticateToken, listTemplates);
router.get('/t/:id', authenticateToken, getTemplateById);
router.put('/t/:id', authenticateToken, requireRole(['user','admin', 'superadmin']), updateTemplate);
router.delete('/t/:id', authenticateToken, requireRole(['user','admin', 'superadmin']), deleteTemplate);

// Template-based profile routes
router.post('/p', authenticateToken, requireRole(['user', 'admin', 'superadmin']), profileController.createProfile.bind(profileController));
router.post('/p/:profileId/fields', authenticateToken, profileController.setEnabledFields.bind(profileController));
router.put('/p/:profileId/content', authenticateToken, profileController.updateProfileContent.bind(profileController));
router.put('/p/:profileId/basic-info', authenticateToken, profileController.updateProfileBasicInfo.bind(profileController));
router.get('/p/:profileId', profileController.getProfile.bind(profileController)); // Public access


router.get('/p', authenticateToken, profileController.getUserProfiles.bind(profileController));
router.delete('/p/:profileId', authenticateToken, requireRole(['user', 'admin', 'superadmin']), profileController.deleteProfile.bind(profileController));
router.post('/default', authenticateToken, requireRole(['user', 'admin', 'superadmin']), profileController.createDefaultProfile.bind(profileController));

// Admin routes for managing all profiles
router.get('/all', authenticateToken, profileController.getAllProfiles.bind(profileController));

/**
 * @route DELETE /api/profiles/duplicates/personal
 * @desc Delete duplicate personal profiles, keeping ones with non-zero MYPTS balance
 * @access Admin only
 * @returns {Object} Summary of deletion results including profiles deleted and kept
 */
router.delete('/duplicates/personal', authenticateToken, requireRole(['admin', 'superadmin']), profileController.deleteDuplicatePersonalProfiles.bind(profileController));

// Profile availability routes
router.post('/:profileId/availability', profileController.setAvailability);
router.patch('/:profileId/availability', profileController.updateAvailability);
router.get('/:profileId/availability', profileController.getAvailability);
router.get('/:profileId/availability/slots', profileController.getAvailableSlots);

// Get community profiles with filters
router.get(
  '/communities',
  profileController.getCommunityProfiles.bind(profileController)
);

export default router;
