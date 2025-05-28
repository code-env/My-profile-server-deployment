import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { protect } from '../middleware/auth.middleware';
import multer from 'multer';
import { uploadToCloudinary } from '../middleware/upload.middleware';

const router = Router();
const organizationController = new OrganizationController();
const upload = multer({ storage: multer.memoryStorage() });

// Create organization
router.post('/', protect, organizationController.createOrganization);

// Get organization
router.get('/:id', protect, organizationController.getOrganization);

// Update organization
router.patch('/:id', protect, organizationController.updateOrganization);

// Delete organization
router.delete('/:id', protect, organizationController.deleteOrganization);

// Upload logo
router.post(
  '/:id/logo',
  protect,
  upload.single('logo'),
  uploadToCloudinary,
  organizationController.uploadLogo
);

// Upload cover image
router.post(
  '/:id/cover',
  protect,
  upload.single('cover'),
  uploadToCloudinary,
  organizationController.uploadCoverImage
);

// Add member
router.post('/:id/members', protect, organizationController.addMember);

// Remove member
router.delete('/:id/members', protect, organizationController.removeMember);

// Update member role
router.patch('/:id/members/role', protect, organizationController.updateMemberRole);

// List organizations
router.get('/', protect, organizationController.listOrganizations);

export default router; 