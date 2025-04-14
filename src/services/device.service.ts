import { DeviceModel, IDevice } from '../models/device.model';
import { ProfileModel } from '../models/profile.model';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export class DeviceService {
  /**
   * Link a new device to a profile
   */
  async linkDevice(
    profileId: string,
    deviceData: Partial<IDevice>
  ): Promise<IDevice> {
    try {
      const profile = await ProfileModel.findById(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      const existingDevice = await DeviceModel.findOne({
        deviceId: deviceData.deviceId,
      });
      if (existingDevice) {
        throw new Error('Device already linked to a profile');
      }

      const device = new DeviceModel({
        ...deviceData,
        profileId: new mongoose.Types.ObjectId(profileId),
      });

      await device.save();
      logger.info(`Device ${device.deviceId} linked to profile ${profileId}`);
      
      return device;
    } catch (error) {
      logger.error('Error linking device:', error);
      throw error;
    }
  }

  /**
   * Unlink a device from a profile
   */
  async unlinkDevice(profileId: string, deviceId: string): Promise<boolean> {
    try {
      const result = await DeviceModel.findOneAndUpdate(
        { profileId, deviceId },
        { isActive: false },
        { new: true }
      );

      if (!result) {
        throw new Error('Device not found or already unlinked');
      }

      logger.info(`Device ${deviceId} unlinked from profile ${profileId}`);
      return true;
    } catch (error) {
      logger.error('Error unlinking device:', error);
      throw error;
    }
  }

  /**
   * Update device health data
   */
  async updateHealthData(
    deviceId: string,
    healthData: IDevice['healthData']
  ): Promise<IDevice> {
    try {
      const device = await DeviceModel.findOneAndUpdate(
        { deviceId, isActive: true },
        {
          $set: {
            healthData,
            lastSync: new Date(),
          },
        },
        { new: true }
      );

      if (!device) {
        throw new Error('Device not found or inactive');
      }

      logger.info(`Health data updated for device ${deviceId}`);
      return device;
    } catch (error) {
      logger.error('Error updating health data:', error);
      throw error;
    }
  }

  /**
   * Get all devices linked to a profile
   */
  async getProfileDevices(profileId: string): Promise<IDevice[]> {
    try {
      const devices = await DeviceModel.find({
        profileId,
        isActive: true,
      }).sort({ createdAt: -1 });

      return devices;
    } catch (error) {
      logger.error('Error fetching profile devices:', error);
      throw error;
    }
  }

  /**
   * Update device settings
   */
  async updateDeviceSettings(
    deviceId: string,
    settings: IDevice['settings']
  ): Promise<IDevice> {
    try {
      const device = await DeviceModel.findOneAndUpdate(
        { deviceId, isActive: true },
        {
          $set: { settings },
        },
        { new: true }
      );

      if (!device) {
        throw new Error('Device not found or inactive');
      }

      logger.info(`Settings updated for device ${deviceId}`);
      return device;
    } catch (error) {
      logger.error('Error updating device settings:', error);
      throw error;
    }
  }

  /**
   * Get device health statistics
   */
  async getHealthStats(
    deviceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const device = await DeviceModel.findOne({
        deviceId,
        isActive: true,
      });

      if (!device) {
        throw new Error('Device not found or inactive');
      }

      // Implement your health statistics calculation logic here
      // This is just a placeholder example
      const stats = {
        averageSteps: 0,
        averageHeartRate: 0,
        sleepQuality: 'N/A',
        // Add more statistics as needed
      };

      return stats;
    } catch (error) {
      logger.error('Error fetching health statistics:', error);
      throw error;
    }
  }
}
