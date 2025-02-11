"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logs_controller_1 = require("../controllers/logs.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Apply auth middleware to all routes
router.use(auth_middleware_1.protect);
// Restrict access to admin users only
const adminOnly = (0, auth_middleware_1.requireRoles)('admin');
// Log file routes
router.get('/files/:filename', adminOnly, logs_controller_1.getLogFile);
router.delete('/files/:filename', adminOnly, logs_controller_1.deleteLogFile);
// Advanced tracking routes
router.get('/tracking', adminOnly, logs_controller_1.getTrackingData);
router.get('/tracking/analytics', adminOnly, logs_controller_1.getTrackingAnalytics);
// Example analytics queries:
// GET /api/logs/tracking?ip=192.168.1.1
// GET /api/logs/tracking?country=US&threatScore=70
// GET /api/logs/tracking?browser=chrome&startDate=2025-01-01&endDate=2025-01-31
// GET /api/logs/tracking/analytics?timeframe=24h (options: 1h, 24h, 7d, 30d)
exports.default = router;
