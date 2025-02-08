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
  createClaimableProfile
} from '../controllers/profile.controller';

const router = express.Router();

// Initialize ProfileService
const profileService = new ProfileService();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Profile creation and claiming
router.post('/create-profile', requireRole(['user', 'superadmin', 'admin']), createProfile);
router.post('/create-claimable', requireRole(['user', 'superadmin', 'admin']), createClaimableProfile);
router.post('/claim', requireRole(['user', 'superadmin', 'admin']), claimProfile);

// Profile management
router.route('/:id')
  .get(checkProfileOwnership, getProfileInfo)
  .put(requireRole(['user', 'superadmin', 'admin']), updateProfile)
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

router.post('/:id/connections/:targetId', checkProfileOwnership, async (req, res) => {
  const result = await profileService.manageConnection(req.params.id, req.params.targetId, req.body.action);
  res.json(result);
});

// Portfolio and professional routes
router.post('/:id/portfolio/projects', checkProfileOwnership, async (req, res) => {
  const profile = await profileService.addPortfolioProject(req.params.id, req.body);
  res.json(profile);
});

router.put('/:id/skills', checkProfileOwnership, async (req, res) => {
  const profile = await profileService.updateSkills(req.params.id, req.body);
  res.json(profile);
});

router.put('/:id/availability', checkProfileOwnership, async (req, res) => {
  const profile = await profileService.updateAvailability(req.params.id, req.body);
  res.json(profile);
});

router.post('/:id/skills/:skillName/endorse', async (req, res) => {
  const paramsId: any = req.params.id;
  const user:any = req.user;
  const result = await profileService.addEndorsement(paramsId, req.params.skillName, user._id);
  res.json(result);
});

export default router;
