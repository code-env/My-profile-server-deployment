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

  // Badge activity controllers
  addActivityToBadge,
  updateBadgeActivity,
  removeActivityFromBadge,
  updateBadgeActivityProgress,
  getBadgeActivityProgress,

  // Profile badge controllers
  getProfileBadges,
  awardBadge,

  // Badge suggestion controllers
  createBadgeSuggestion,
  getProfileBadgeSuggestions,
  getPendingBadgeSuggestions,
  getBadgeSuggestionsByStatus,
  updateBadgeSuggestionStatus,
  implementBadgeSuggestion,
  deleteBadgeSuggestion,

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

// Badge activity routes
router.post('/badges/:badgeId/activities', protect, requireRole(['admin', 'superadmin']), addActivityToBadge);
router.put('/badges/:badgeId/activities/:activityId', protect, requireRole(['admin', 'superadmin']), updateBadgeActivity);
router.delete('/badges/:badgeId/activities/:activityId', protect, requireRole(['admin', 'superadmin']), removeActivityFromBadge);

// Profile badge routes
router.get('/profiles/:profileId/badges', protect, attachProfile, getProfileBadges);
router.post('/profiles/:profileId/badges', protect, requireRole(['admin', 'superadmin']), awardBadge);

// Badge activity progress routes
router.get('/profiles/:profileId/badges/:badgeId/activities', protect, attachProfile, getBadgeActivityProgress);
router.put('/profiles/:profileId/badges/:badgeId/activities/:activityId', protect, attachProfile, updateBadgeActivityProgress);

// Badge suggestion routes
router.post('/profiles/:profileId/badge-suggestions', protect, attachProfile, createBadgeSuggestion);
router.get('/profiles/:profileId/badge-suggestions', protect, attachProfile, getProfileBadgeSuggestions);
router.get('/badge-suggestions/pending', protect, requireRole(['admin', 'superadmin']), getPendingBadgeSuggestions);
router.get('/badge-suggestions/status/:status', protect, requireRole(['admin', 'superadmin']), getBadgeSuggestionsByStatus);
router.put('/badge-suggestions/:suggestionId/status', protect, requireRole(['admin', 'superadmin']), updateBadgeSuggestionStatus);
router.post('/badge-suggestions/:suggestionId/implement', protect, requireRole(['admin', 'superadmin']), implementBadgeSuggestion);
router.delete('/badge-suggestions/:suggestionId', protect, requireRole(['admin', 'superadmin']), deleteBadgeSuggestion);

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
