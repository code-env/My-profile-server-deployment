import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleMiddleware';
import { attachProfile } from '../middleware/profile-auth.middleware';
import {
  // Badge controllers
  createBadge,
  getAllBadges,
  getBadgesByCategory,
  updateBadge,
  deleteBadge,
  
  // Profile badge controllers
  getProfileBadges,
  awardBadge,
  
  // Milestone controllers
  getProfileMilestone,
  
  // Leaderboard controllers
  getLeaderboard,
  getLeaderboardByMilestone,
  getProfileRank,
  updateLeaderboard,
  
  // Activity tracking controllers
  trackActivity,
  getRecentActivities,
  getActivityStatistics
} from '../controllers/gamification.controller';

const router = express.Router();

// Badge routes
router.get('/badges', protect, getAllBadges);
router.get('/badges/category/:category', protect, getBadgesByCategory);
router.post('/badges', protect, requireRole(['admin', 'superadmin']), createBadge);
router.put('/badges/:id', protect, requireRole(['admin', 'superadmin']), updateBadge);
router.delete('/badges/:id', protect, requireRole(['admin', 'superadmin']), deleteBadge);

// Profile badge routes
router.get('/profiles/:profileId/badges', protect, attachProfile, getProfileBadges);
router.post('/profiles/:profileId/badges', protect, requireRole(['admin', 'superadmin']), awardBadge);

// Milestone routes
router.get('/profiles/:profileId/milestone', protect, attachProfile, getProfileMilestone);

// Leaderboard routes
router.get('/leaderboard', protect, getLeaderboard);
router.get('/leaderboard/milestone/:milestone', protect, getLeaderboardByMilestone);
router.get('/profiles/:profileId/rank', protect, attachProfile, getProfileRank);
router.post('/leaderboard/update', protect, requireRole(['admin', 'superadmin']), updateLeaderboard);

// Activity tracking routes
router.post('/profiles/:profileId/activities', protect, attachProfile, trackActivity);
router.get('/profiles/:profileId/activities', protect, attachProfile, getRecentActivities);
router.get('/profiles/:profileId/activities/statistics', protect, attachProfile, getActivityStatistics);

export default router;
