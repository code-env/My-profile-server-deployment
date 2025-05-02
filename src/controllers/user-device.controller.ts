import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { logger } from '../utils/logger';
import createHttpError from 'http-errors';
import firebaseService from '../services/firebase.service';

/**
 * @desc    Register a device for push notifications
 * @route   POST /api/user/devices/register
 * @access  Private
 */
export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { token, deviceName, deviceType } = req.body;

  if (!token) {
    throw createHttpError(400, 'Push token is required');
  }

  try {
    logger.info(`Registering device for user ${user._id} with token ${token.substring(0, 10)}...`);

    // Check if the token is valid by sending a test notification
    const testResult = await firebaseService.sendPushNotification(
      token,
      'Device Registration',
      'Your device has been registered for push notifications',
      { notificationType: 'registration' }
    );

    if (!testResult) {
      logger.warn(`Invalid push token provided by user ${user._id}: ${token.substring(0, 10)}...`);
      throw createHttpError(400, 'Invalid push token');
    }

    // Generate a unique device ID
    const deviceId = `${user._id}-${Date.now()}`;

    // Check if the device with this token already exists
    const existingDeviceIndex = user.devices?.findIndex((device: any) => device.pushToken === token);

    if (existingDeviceIndex !== -1 && existingDeviceIndex !== undefined) {
      // Update existing device
      logger.info(`Updating existing device for user ${user._id}`);

      user.devices[existingDeviceIndex].lastActive = new Date();
      user.devices[existingDeviceIndex].name = deviceName || user.devices[existingDeviceIndex].name;
      user.devices[existingDeviceIndex].type = deviceType || user.devices[existingDeviceIndex].type;

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Device updated successfully',
        device: user.devices[existingDeviceIndex]
      });
      return;
    }

    // Add new device
    const newDevice = {
      id: deviceId,
      name: deviceName || 'Unknown Device',
      type: deviceType || 'smartphone',
      lastActive: new Date(),
      biometricEnabled: false,
      trusted: true,
      pushToken: token
    };

    // Initialize devices array if it doesn't exist
    if (!user.devices) {
      user.devices = [];
    }

    user.devices.push(newDevice);
    await user.save();

    logger.info(`Device registered successfully for user ${user._id}`);

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      device: newDevice
    });
  } catch (error) {
    logger.error(`Error registering device for user ${user._id}:`, error);
    throw error;
  }
});

/**
 * @desc    Unregister a device for push notifications
 * @route   DELETE /api/user/devices/:deviceId
 * @access  Private
 */
export const unregisterDevice = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { deviceId } = req.params;

  if (!deviceId) {
    throw createHttpError(400, 'Device ID is required');
  }

  try {
    logger.info(`Unregistering device ${deviceId} for user ${user._id}`);

    // Find the device index
    const deviceIndex = user.devices?.findIndex((device: any) => device.id === deviceId);

    if (deviceIndex === -1 || deviceIndex === undefined) {
      throw createHttpError(404, 'Device not found');
    }

    // Remove the device
    user.devices.splice(deviceIndex, 1);
    await user.save();

    logger.info(`Device ${deviceId} unregistered successfully for user ${user._id}`);

    res.status(200).json({
      success: true,
      message: 'Device unregistered successfully'
    });
  } catch (error) {
    logger.error(`Error unregistering device for user ${user._id}:`, error);
    throw error;
  }
});

/**
 * @desc    Get all registered devices for a user
 * @route   GET /api/user/devices
 * @access  Private
 */
export const getUserDevices = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;

  try {
    logger.info(`Getting devices for user ${user._id}`);

    const devices = user.devices || [];

    res.status(200).json({
      success: true,
      count: devices.length,
      devices
    });
  } catch (error) {
    logger.error(`Error getting devices for user ${user._id}:`, error);
    throw error;
  }
});

/**
 * @desc    Update device settings
 * @route   PUT /api/user/devices/:deviceId
 * @access  Private
 */
export const updateDeviceSettings = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { deviceId } = req.params;
  const { name, biometricEnabled, trusted } = req.body;

  if (!deviceId) {
    throw createHttpError(400, 'Device ID is required');
  }

  try {
    logger.info(`Updating device ${deviceId} for user ${user._id}`);

    // Find the device index
    const deviceIndex = user.devices?.findIndex((device: any) => device.id === deviceId);

    if (deviceIndex === -1 || deviceIndex === undefined) {
      throw createHttpError(404, 'Device not found');
    }

    // Update device settings
    if (name) user.devices[deviceIndex].name = name;
    if (biometricEnabled !== undefined) user.devices[deviceIndex].biometricEnabled = biometricEnabled;
    if (trusted !== undefined) user.devices[deviceIndex].trusted = trusted;

    user.devices[deviceIndex].lastActive = new Date();
    await user.save();

    logger.info(`Device ${deviceId} updated successfully for user ${user._id}`);

    res.status(200).json({
      success: true,
      message: 'Device updated successfully',
      device: user.devices[deviceIndex]
    });
  } catch (error) {
    logger.error(`Error updating device for user ${user._id}:`, error);
    throw error;
  }
});

/**
 * @desc    Send a test push notification to a device
 * @route   POST /api/user/devices/:deviceId/test
 * @access  Private
 */
export const testDevicePushNotification = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { deviceId } = req.params;

  if (!deviceId) {
    throw createHttpError(400, 'Device ID is required');
  }

  try {
    logger.info(`Testing push notification for device ${deviceId} of user ${user._id}`);

    // Find the device
    const device = user.devices?.find((device: any) => device.id === deviceId);

    if (!device) {
      throw createHttpError(404, 'Device not found');
    }

    if (!device.pushToken) {
      throw createHttpError(400, 'Device does not have a push token');
    }

    // Send test notification
    const result = await firebaseService.sendPushNotification(
      device.pushToken,
      'Test Notification',
      'This is a test notification from MyPts',
      {
        notificationType: 'test',
        timestamp: Date.now().toString()
      }
    );

    if (!result) {
      // Token might be invalid, remove it
      device.pushToken = undefined;
      await user.save();

      throw createHttpError(400, 'Failed to send push notification. The device token may be invalid.');
    }

    // Update last active
    device.lastActive = new Date();
    await user.save();

    logger.info(`Test push notification sent successfully to device ${deviceId} of user ${user._id}`);

    res.status(200).json({
      success: true,
      message: 'Test push notification sent successfully'
    });
  } catch (error) {
    logger.error(`Error sending test push notification to device ${deviceId} of user ${user._id}:`, error);
    throw error;
  }
});
