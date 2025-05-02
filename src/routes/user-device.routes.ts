import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  registerDevice,
  unregisterDevice,
  getUserDevices,
  updateDeviceSettings,
  testDevicePushNotification
} from '../controllers/user-device.controller';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Register a device for push notifications
router.route('/register')
  .post(registerDevice);

// Get all registered devices
router.route('/')
  .get(getUserDevices);

// Unregister a device
router.route('/:deviceId')
  .delete(unregisterDevice)
  .put(updateDeviceSettings);

// Test push notification
router.route('/:deviceId/test')
  .post(testDevicePushNotification);

export default router;
