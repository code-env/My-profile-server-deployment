"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const device_service_1 = require("../services/device.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
const deviceService = new device_service_1.DeviceService();
// Link a new device to a profile
router.post('/link', auth_middleware_1.protect, validation_1.validateRequest, async (req, res) => {
    const user = req === null || req === void 0 ? void 0 : req.user;
    try {
        if (!user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!user.profileId) {
            return res.status(400).json({ error: 'No profile selected' });
        }
        const { profileId } = user;
        const deviceData = req.body;
        const device = await deviceService.linkDevice(profileId, deviceData);
        res.status(201).json(device);
    }
    catch (error) {
        logger_1.logger.error('Error in link device route:', error);
        res.status(400).json({ error: error.message });
    }
});
// Unlink a device from a profile
router.post('/unlink/:deviceId', auth_middleware_1.protect, async (req, res) => {
    const user = req === null || req === void 0 ? void 0 : req.user;
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!user.profileId) {
            return res.status(400).json({ error: 'No profile selected' });
        }
        const { profileId } = user;
        const { deviceId } = req.params;
        await deviceService.unlinkDevice(profileId, deviceId);
        res.status(200).json({ message: 'Device unlinked successfully' });
    }
    catch (error) {
        logger_1.logger.error('Error in unlink device route:', error);
        res.status(400).json({ error: error.message });
    }
});
// Update device health data
router.post('/:deviceId/health', auth_middleware_1.protect, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const healthData = req.body;
        const device = await deviceService.updateHealthData(deviceId, healthData);
        res.status(200).json(device);
    }
    catch (error) {
        logger_1.logger.error('Error in update health data route:', error);
        res.status(400).json({ error: error.message });
    }
});
// Get all devices for a profile
router.get('/profile', auth_middleware_1.protect, async (req, res) => {
    const user = req === null || req === void 0 ? void 0 : req.user;
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!user.profileId) {
            return res.status(400).json({ error: 'No profile selected' });
        }
        const { profileId } = user;
        const devices = await deviceService.getProfileDevices(profileId);
        res.status(200).json(devices);
    }
    catch (error) {
        logger_1.logger.error('Error in get profile devices route:', error);
        res.status(400).json({ error: error.message });
    }
});
// Update device settings
router.put('/:deviceId/settings', auth_middleware_1.protect, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const settings = req.body;
        const device = await deviceService.updateDeviceSettings(deviceId, settings);
        res.status(200).json(device);
    }
    catch (error) {
        logger_1.logger.error('Error in update device settings route:', error);
        res.status(400).json({ error: error.message });
    }
});
// Get device health statistics
router.get('/:deviceId/health/stats', auth_middleware_1.protect, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { startDate, endDate } = req.query;
        const stats = await deviceService.getHealthStats(deviceId, new Date(startDate), new Date(endDate));
        res.status(200).json(stats);
    }
    catch (error) {
        logger_1.logger.error('Error in get health stats route:', error);
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
