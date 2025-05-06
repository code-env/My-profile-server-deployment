import express from 'express';
import { AdminController } from '../controllers/admin.controller';
import { protect } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(requireRole(['admin', 'superadmin']));

// Admin details
router.get('/details', AdminController.getAdminDetails);

export default router;
