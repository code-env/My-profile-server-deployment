import mongoose, { Schema, Document } from 'mongoose';
import { logger } from '../utils/logger';

export interface IAdminSettings extends Document {
  key: string;
  value: any;
  description?: string;
  updatedAt: Date;
}

const adminSettingsSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: Schema.Types.Mixed,
    required: true
  },
  description: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for better query performance
adminSettingsSchema.index({ key: 1 });

export const AdminSettingsModel = mongoose.model<IAdminSettings>('AdminSettings', adminSettingsSchema);

/**
 * Get a setting value by key
 * @param key The setting key
 * @param defaultValue Default value if setting is not found
 * @returns The setting value or default value
 */
export const getSetting = async <T>(key: string, defaultValue?: T): Promise<T> => {
  try {
    const setting = await AdminSettingsModel.findOne({ key });
    if (setting) {
      return setting.value as T;
    }
    return defaultValue as T;
  } catch (error) {
    logger.error(`Error getting setting ${key}: ${error}`);
    return defaultValue as T;
  }
};

/**
 * Set a setting value
 * @param key The setting key
 * @param value The setting value
 * @param description Optional description of the setting
 * @returns The updated setting document
 */
export const setSetting = async <T>(key: string, value: T, description?: string): Promise<IAdminSettings> => {
  try {
    return await AdminSettingsModel.findOneAndUpdate(
      { key },
      {
        key,
        value,
        description: description || '',
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    logger.error(`Error setting ${key}: ${error}`);
    throw error;
  }
};

/**
 * Initialize default admin settings if they don't exist
 */
export const initializeDefaultSettings = async (): Promise<void> => {
  try {
    // Admin hub email
    await setSetting(
      'adminHubEmail',
      'admin@getmyprofile.online',
      'Email address for admin notifications'
    );

    // Notification preferences
    await setSetting(
      'notificationPreferences',
      {
        transactions: true,
        profileRegistrations: true,
        systemAlerts: true
      },
      'Admin notification preferences'
    );

    logger.info('Default admin settings initialized');
  } catch (error) {
    logger.error(`Error initializing default admin settings: ${error}`);
  }
};
