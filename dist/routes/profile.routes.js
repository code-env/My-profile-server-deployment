"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const profile_service_1 = require("../services/profile.service");
const profile_controller_1 = require("../controllers/profile.controller");
const router = express_1.default.Router();
// Initialize ProfileService
const profileService = new profile_service_1.ProfileService();
// Apply authentication middleware to all routes
// router.use(authenticateToken);
// Profile creation and claiming
// requireRole(['user', 'superadmin', 'admin'])
router.post('/create-profile', (0, roleMiddleware_1.requireRole)(['user', 'superadmin', 'admin']), profile_controller_1.createProfile);
router.post('/create-claimable', (0, roleMiddleware_1.requireRole)(['user', 'superadmin', 'admin']), profile_controller_1.createClaimableProfile);
router.post('/claim', (0, roleMiddleware_1.requireRole)(['user', 'superadmin', 'admin']), profile_controller_1.claimProfile);
// Profile management
// Admin route to get all profiles
router.get('/all', (0, roleMiddleware_1.requireRole)(['admin', 'superadmin']), profile_controller_1.getAllProfiles);
// Add a middleware to log the authentication token
router.get('/user-profiles', (req, _res, next) => {
    console.log('Auth header:', req.header('Authorization'));
    console.log('Cookies:', req.cookies);
    next();
}, authMiddleware_1.authenticateToken, profile_controller_1.getUserProfilesGrouped);
router.route('/:id')
    .get(roleMiddleware_1.checkProfileOwnership, profile_controller_1.getProfileInfo)
    .put((0, roleMiddleware_1.requireRole)(['user', 'superadmin', 'admin']), profile_controller_1.updateProfileNew)
    .delete((0, roleMiddleware_1.requireRole)(['user', 'superadmin']), profile_controller_1.deleteProfile);
// Manager management
router.post('/:id/managers', (0, roleMiddleware_1.requireRole)(['user', 'superadmin']), roleMiddleware_1.checkProfileOwnership, profile_controller_1.addProfileManager);
router.delete('/:id/managers/:managerId', (0, roleMiddleware_1.requireRole)(['user', 'superadmin']), roleMiddleware_1.checkProfileOwnership, profile_controller_1.removeManager);
router.put('/:id/personal-info', roleMiddleware_1.checkProfileOwnership, profile_controller_1.updatePersonalInfo);
router.put('/:id/contact-info', roleMiddleware_1.checkProfileOwnership, profile_controller_1.updateContactInfo);
router.put('/:id/social-info', roleMiddleware_1.checkProfileOwnership, profile_controller_1.updateSocialInfo);
// router.put('/:id/visibility', checkProfileOwnership, updateProfileVisibility);
router.put('/:id/settings', roleMiddleware_1.checkProfileOwnership, profile_controller_1.updateProfileSettings);
router.post('/:id/transfer', roleMiddleware_1.checkProfileOwnership, profile_controller_1.transferProfile);
// Security and verification routes
router.post('/:id/verify', roleMiddleware_1.checkProfileOwnership, async (req, res) => {
    const { documents } = req.body;
    const profile = await profileService.verifyProfile(req.params.id, documents);
    res.json(profile);
});
router.put('/:id/security', roleMiddleware_1.checkProfileOwnership, async (req, res) => {
    const profile = await profileService.updateSecuritySettings(req.params.id, req.body);
    res.json(profile);
});
// Social networking routes
router.put('/:id/connection-preferences', roleMiddleware_1.checkProfileOwnership, async (req, res) => {
    const profile = await profileService.updateConnectionPreferences(req.params.id, req.body);
    res.json(profile);
});
router.put('/:id/social-links', roleMiddleware_1.checkProfileOwnership, async (req, res) => {
    const profile = await profileService.updateSocialLinks(req.params.id, req.body);
    res.json(profile);
});
exports.default = router;
