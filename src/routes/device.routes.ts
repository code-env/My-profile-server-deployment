import express from 'express';
import { DeviceService } from '../services/device.service';
import { protect } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation';
import { logger } from '../utils/logger';
import { IUser } from '../models/User';

const router = express.Router();
const deviceService = new DeviceService();

// Link a new device to a profile
router.post(
  '/link',
  protect,
  validateRequest,
  async (req, res) => {
    const user = req?.user as IUser;

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
    } catch (error:any) {
      logger.error('Error in link device route:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Unlink a device from a profile
router.post(
  '/unlink/:deviceId',
  protect,
  async (req, res) => {
    const user = req?.user as IUser;
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
    } catch (error:any) {
      logger.error('Error in unlink device route:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Update device health data
router.post(
  '/:deviceId/health',
  protect,
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const healthData = req.body;
      
      const device = await deviceService.updateHealthData(deviceId, healthData);
      res.status(200).json(device);
    } catch (error :any) {
      logger.error('Error in update health data route:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Get all devices for a profile
router.get(
  '/profile',
  protect,
  async (req, res) => {
    const user = req?.user as IUser;
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
    } catch (error: any) {
      logger.error('Error in get profile devices route:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Update device settings
router.put(
  '/:deviceId/settings',
  protect,
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const settings = req.body;
      
      const device = await deviceService.updateDeviceSettings(deviceId, settings);
      res.status(200).json(device);
    } catch (error: any) {
      logger.error('Error in update device settings route:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Get device health statistics
router.get(
  '/:deviceId/health/stats',
  protect,
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate } = req.query;
      
      const stats = await deviceService.getHealthStats(
        deviceId,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.status(200).json(stats);
    } catch (error: any) {
      logger.error('Error in get health stats route:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;
