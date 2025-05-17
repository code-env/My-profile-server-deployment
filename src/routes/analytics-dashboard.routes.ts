import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { attachProfile } from '../middleware/profile-auth.middleware';
import {
  getDashboard,
  refreshDashboard,
  getMyPtsAnalytics,
  getUsageAnalytics,
  getProfilingAnalytics,
  getProductsAnalytics,
  getNetworkingAnalytics,
  getCircleAnalytics,
  getEngagementAnalytics,
  getPlansAnalytics,
  getDataAnalytics,
  getVaultAnalytics,
  getDiscoverAnalytics
} from '../controllers/analytics-dashboard.controller';

const router = express.Router();

// Main dashboard routes
router.get('/dashboard/:profileId', protect, attachProfile, getDashboard);
router.post('/dashboard/:profileId/refresh', protect, attachProfile, refreshDashboard);

// Category-specific analytics routes
router.get('/dashboard/:profileId/mypts', protect, attachProfile, getMyPtsAnalytics);
router.get('/dashboard/:profileId/usage', protect, attachProfile, getUsageAnalytics);
router.get('/dashboard/:profileId/profiling', protect, attachProfile, getProfilingAnalytics);
router.get('/dashboard/:profileId/products', protect, attachProfile, getProductsAnalytics);
router.get('/dashboard/:profileId/networking', protect, attachProfile, getNetworkingAnalytics);
router.get('/dashboard/:profileId/circle', protect, attachProfile, getCircleAnalytics);
router.get('/dashboard/:profileId/engagement', protect, attachProfile, getEngagementAnalytics);
router.get('/dashboard/:profileId/plans', protect, attachProfile, getPlansAnalytics);
router.get('/dashboard/:profileId/data', protect, attachProfile, getDataAnalytics);
router.get('/dashboard/:profileId/vault', protect, attachProfile, getVaultAnalytics);
router.get('/dashboard/:profileId/discover', protect, attachProfile, getDiscoverAnalytics);

export default router;
