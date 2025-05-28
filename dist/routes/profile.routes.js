"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const profile_controller_1 = require("../controllers/profile.controller");
const admin_profile_template_controller_1 = require("../controllers/admin-profile-template.controller");
const router = express_1.default.Router();
// Initialize ProfileController
const profileController = new profile_controller_1.ProfileController();
// Apply authentication middleware to all routes
// router.use(authenticateToken);
// Admin routes for managing profile templates
router.post('/t/create', authMiddleware_1.authenticateToken, (0, roleMiddleware_1.requireRole)(['user', 'admin', 'superadmin']), admin_profile_template_controller_1.createTemplate);
router.get('/t/list', authMiddleware_1.authenticateToken, admin_profile_template_controller_1.listTemplates);
router.get('/t/:id', authMiddleware_1.authenticateToken, admin_profile_template_controller_1.getTemplateById);
router.put('/t/:id', authMiddleware_1.authenticateToken, (0, roleMiddleware_1.requireRole)(['user', 'admin', 'superadmin']), admin_profile_template_controller_1.updateTemplate);
router.delete('/t/:id', authMiddleware_1.authenticateToken, (0, roleMiddleware_1.requireRole)(['user', 'admin', 'superadmin']), admin_profile_template_controller_1.deleteTemplate);
// Template-based profile routes
router.post('/p', authMiddleware_1.authenticateToken, (0, roleMiddleware_1.requireRole)(['user', 'admin', 'superadmin']), profileController.createProfile.bind(profileController));
router.post('/p/:profileId/fields', authMiddleware_1.authenticateToken, profileController.setEnabledFields.bind(profileController));
router.put('/p/:profileId/content', authMiddleware_1.authenticateToken, profileController.updateProfileContent.bind(profileController));
router.put('/p/:profileId/basic-info', authMiddleware_1.authenticateToken, profileController.updateProfileBasicInfo.bind(profileController));
router.get('/p/:profileId', profileController.getProfile.bind(profileController)); // Public access
router.get('/p', authMiddleware_1.authenticateToken, profileController.getUserProfiles.bind(profileController));
router.delete('/p/:profileId', authMiddleware_1.authenticateToken, (0, roleMiddleware_1.requireRole)(['user', 'admin', 'superadmin']), profileController.deleteProfile.bind(profileController));
router.post('/default', authMiddleware_1.authenticateToken, (0, roleMiddleware_1.requireRole)(['user', 'admin', 'superadmin']), profileController.createDefaultProfile.bind(profileController));
// Admin routes for managing all profiles
router.get('/all', authMiddleware_1.authenticateToken, profileController.getAllProfiles.bind(profileController));
// Profile availability routes
router.post('/:profileId/availability', profileController.setAvailability);
router.patch('/:profileId/availability', profileController.updateAvailability);
router.get('/:profileId/availability', profileController.getAvailability);
router.get('/:profileId/availability/slots', profileController.getAvailableSlots);
// Get community profiles with filters
router.get('/communities', profileController.getCommunityProfiles.bind(profileController));
exports.default = router;
