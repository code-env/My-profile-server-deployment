import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  trackProfileView,
  trackEngagement,
  getProfileAnalytics,
  getUserAnalytics,
} from '../controllers/analytics.controller';

const router = express.Router();

router.use(protect);

// Profile-specific analytics
router.route('/profiles/:id/view')
  .post(trackProfileView);

router.route('/profiles/:id/engage')
  .post(trackEngagement);

router.route('/profiles/:id')
  .get(getProfileAnalytics);

// User analytics
router.route('/user')
  .get(getUserAnalytics);

export default router;
