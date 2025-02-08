"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceService = void 0;
const device_model_1 = require("../models/device.model");
const profile_model_1 = require("../models/profile.model");
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../utils/logger");
class DeviceService {
    /**
     * Link a new device to a profile
     */
    async linkDevice(profileId, deviceData) {
        try {
            const profile = await profile_model_1.ProfileModel.findById(profileId);
            if (!profile) {
                throw new Error('Profile not found');
            }
            const existingDevice = await device_model_1.DeviceModel.findOne({
                deviceId: deviceData.deviceId,
            });
            if (existingDevice) {
                throw new Error('Device already linked to a profile');
            }
            const device = new device_model_1.DeviceModel({
                ...deviceData,
                profileId: new mongoose_1.default.Types.ObjectId(profileId),
            });
            await device.save();
            logger_1.logger.info(`Device ${device.deviceId} linked to profile ${profileId}`);
            return device;
        }
        catch (error) {
            logger_1.logger.error('Error linking device:', error);
            throw error;
        }
    }
    /**
     * Unlink a device from a profile
     */
    async unlinkDevice(profileId, deviceId) {
        try {
            const result = await device_model_1.DeviceModel.findOneAndUpdate({ profileId, deviceId }, { isActive: false }, { new: true });
            if (!result) {
                throw new Error('Device not found or already unlinked');
            }
            logger_1.logger.info(`Device ${deviceId} unlinked from profile ${profileId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error unlinking device:', error);
            throw error;
        }
    }
    /**
     * Update device health data
     */
    async updateHealthData(deviceId, healthData) {
        try {
            const device = await device_model_1.DeviceModel.findOneAndUpdate({ deviceId, isActive: true }, {
                $set: {
                    healthData,
                    lastSync: new Date(),
                },
            }, { new: true });
            if (!device) {
                throw new Error('Device not found or inactive');
            }
            logger_1.logger.info(`Health data updated for device ${deviceId}`);
            return device;
        }
        catch (error) {
            logger_1.logger.error('Error updating health data:', error);
            throw error;
        }
    }
    /**
     * Get all devices linked to a profile
     */
    async getProfileDevices(profileId) {
        try {
            const devices = await device_model_1.DeviceModel.find({
                profileId,
                isActive: true,
            }).sort({ createdAt: -1 });
            return devices;
        }
        catch (error) {
            logger_1.logger.error('Error fetching profile devices:', error);
            throw error;
        }
    }
    /**
     * Update device settings
     */
    async updateDeviceSettings(deviceId, settings) {
        try {
            const device = await device_model_1.DeviceModel.findOneAndUpdate({ deviceId, isActive: true }, {
                $set: { settings },
            }, { new: true });
            if (!device) {
                throw new Error('Device not found or inactive');
            }
            logger_1.logger.info(`Settings updated for device ${deviceId}`);
            return device;
        }
        catch (error) {
            logger_1.logger.error('Error updating device settings:', error);
            throw error;
        }
    }
    /**
     * Get device health statistics
     */
    async getHealthStats(deviceId, startDate, endDate) {
        try {
            const device = await device_model_1.DeviceModel.findOne({
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
        }
        catch (error) {
            logger_1.logger.error('Error fetching health statistics:', error);
            throw error;
        }
    }
}
exports.DeviceService = DeviceService;
