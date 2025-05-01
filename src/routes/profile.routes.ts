import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRole, checkProfileOwnership } from '../middleware/roleMiddleware';
import { ProfileService } from '../services/profile.service';
import {
  createProfile,
  getProfileInfo,
  updateProfile,
  deleteProfile,
  updatePersonalInfo,
  updateContactInfo,
  updateSocialInfo,
  transferProfile,
  addProfileManager,
  addManager,
  removeManager,
  claimProfile,
  updateProfileVisibility,
  updateProfileSettings,
  createClaimableProfile,
  getUserProfilesGrouped,
  updateProfileNew,
  getAllProfiles,
} from '../controllers/profile.controller';

const router = express.Router();

// Initialize ProfileService
const profileService = new ProfileService();

// Apply authentication middleware to all routes
// router.use(authenticateToken);

// Profile creation and claiming
// requireRole(['user', 'superadmin', 'admin'])
router.post('/create-profile',requireRole(['user', 'superadmin', 'admin']), createProfile);
router.post('/create-claimable', requireRole(['user', 'superadmin', 'admin']), createClaimableProfile);
router.post('/claim', requireRole(['user', 'superadmin', 'admin']), claimProfile);

// Profile management
// Admin route to get all profiles
router.get('/all', requireRole(['admin', 'superadmin']), getAllProfiles);

// Add a middleware to log the authentication token
router.get('/user-profiles', (req, _res, next) => {
  console.log('Auth header:', req.header('Authorization'));
  console.log('Cookies:', req.cookies);
  next();
}, authenticateToken, getUserProfilesGrouped)
router.route('/:id')
  .get(authenticateToken, getProfileInfo) // Use authenticateToken instead of checkProfileOwnership
  .put(requireRole(['user', 'superadmin', 'admin']), updateProfileNew)
  .delete(requireRole(['user', 'superadmin']), deleteProfile);

// Manager management
router.post('/:id/managers', requireRole(['user', 'superadmin']), checkProfileOwnership, addProfileManager);
router.delete('/:id/managers/:managerId', requireRole(['user', 'superadmin']), checkProfileOwnership, removeManager);

router.put('/:id/personal-info', checkProfileOwnership, updatePersonalInfo);
router.put('/:id/contact-info', checkProfileOwnership, updateContactInfo);
router.put('/:id/social-info', checkProfileOwnership, updateSocialInfo);
// router.put('/:id/visibility', checkProfileOwnership, updateProfileVisibility);
router.put('/:id/settings', checkProfileOwnership, updateProfileSettings);

router.post('/:id/transfer', checkProfileOwnership, transferProfile);

// Security and verification routes
router.post('/:id/verify', checkProfileOwnership, async (req, res) => {
  const { documents } = req.body;
  const profile = await profileService.verifyProfile(req.params.id, documents);
  res.json(profile);
});

router.put('/:id/security', checkProfileOwnership, async (req, res) => {
  const profile = await profileService.updateSecuritySettings(req.params.id, req.body);
  res.json(profile);
});

// Social networking routes
router.put('/:id/connection-preferences', checkProfileOwnership, async (req, res) => {
  const profile = await profileService.updateConnectionPreferences(req.params.id, req.body);
  res.json(profile);
});

router.put('/:id/social-links', checkProfileOwnership, async (req, res) => {
  const profile = await profileService.updateSocialLinks(req.params.id, req.body);
  res.json(profile);
});

export default router;
