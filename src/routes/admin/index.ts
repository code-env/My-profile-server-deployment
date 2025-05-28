/**
 * Admin Routes Index
 *
 * Centralizes all admin-related routes for better organization and management.
 * All routes here are protected and only accessible to admin users.
 */

import express from 'express';
import { protect } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/roleMiddleware';
import tokenCleanupRoutes from './token-cleanup.routes';
import combinedInfoRoutes from './combined-info.routes';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(requireRole(['admin', 'superadmin']));

// Register admin sub-routes
router.use('/token-cleanup', tokenCleanupRoutes);
router.use('/combined-info', combinedInfoRoutes);

// Add more admin routes here as needed

export default router;
