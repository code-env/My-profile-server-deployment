import { Router } from 'express';
import path from 'path';
import {
  getLogFile,
  deleteLogFile,
  getTrackingData,
  getTrackingAnalytics
} from '../controllers/logs.controller';
import { protect, requireRoles } from '../middleware/auth.middleware';

const router = Router();

// Serve logs dashboard
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/logs.html'));
});

// Apply auth middleware to all routes
// router.use(protect);

// Restrict access to admin users only
// const adminOnly = requireRoles('admin');

// Log file routes
router.get('/files/:filename', getLogFile);
router.delete('/files/:filename', deleteLogFile);

// Advanced tracking routes
router.get('/tracking',  getTrackingData);
router.get('/tracking/analytics', getTrackingAnalytics);

// Example analytics queries:
// GET /api/logs/tracking?ip=192.168.1.1
// GET /api/logs/tracking?country=US&threatScore=70
// GET /api/logs/tracking?browser=chrome&startDate=2025-01-01&endDate=2025-01-31
// GET /api/logs/tracking/analytics?timeframe=24h (options: 1h, 24h, 7d, 30d)

export default router;
