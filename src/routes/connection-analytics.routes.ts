import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { ConnectionAnalyticsController } from '../controllers/connection-analytics.controller';

const router = express.Router();

// Get connection strength
router.get('/strength/:connectionId', protect, ConnectionAnalyticsController.getConnectionStrength);

// Get connection strength history
router.get('/history/:connectionId', protect, ConnectionAnalyticsController.getStrengthHistory);

export default router;
