import express from 'express';
import { protect } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/roleMiddleware';
import { CombinedInfoController } from '../../controllers/admin/combined-info.controller';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(requireRole(['admin', 'superadmin']));

// Get all combined user and profile info with pagination
router.get('/', CombinedInfoController.getAllCombinedInfo);

// Get combined info for a specific user by profileId
router.get('/:profileId', CombinedInfoController.getCombinedInfoById);

export default router;
