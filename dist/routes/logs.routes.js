"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const logs_controller_1 = require("../controllers/logs.controller");
const router = (0, express_1.Router)();
// Serve logs dashboard
router.get('/dashboard', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../public/logs.html'));
});
// Apply auth middleware to all routes
// router.use(protect);
// Restrict access to admin users only
// const adminOnly = requireRoles('admin');
// Log file routes
router.get('/files/:filename', logs_controller_1.getLogFile);
router.delete('/files/:filename', logs_controller_1.deleteLogFile);
// Advanced tracking routes
router.get('/tracking', logs_controller_1.getTrackingData);
router.get('/tracking/analytics', logs_controller_1.getTrackingAnalytics);
// Example analytics queries:
// GET /api/logs/tracking?ip=192.168.1.1
// GET /api/logs/tracking?country=US&threatScore=70
// GET /api/logs/tracking?browser=chrome&startDate=2025-01-01&endDate=2025-01-31
// GET /api/logs/tracking/analytics?timeframe=24h (options: 1h, 24h, 7d, 30d)
exports.default = router;
