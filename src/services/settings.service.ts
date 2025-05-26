import { SettingsModel, SettingsDocument } from "../models/settings";
import { FilterQuery, UpdateQuery } from "mongoose";
import {User} from '../models/User'

export class SettingsService {
  /**
   * Create default settings for a user on signup if they don't exist
   * @param userId - User ID
   * @returns Created settings document
   */
  async createDefault(userId: string): Promise<SettingsDocument> {
    const existing = await SettingsModel.findOne({ userId });
    if (existing) return existing;
     const defaultSettings = new SettingsModel({
    userId,
    general: {
      appSystem: {
        version: "1.0.0",
        build: "1001",
      },
      time: {
        timeZone: "UTC",
        timeFormat: "24h",
      },
      regional: {
        country: "US",
        currency: "USD",
        language: "en",
        areaCode: "+1",
      },
    },
    notifications: {
      channels: {
        email: true,
        sms: false,
        push: true,
      },
      frequency: "daily",
      doNotDisturb: {
        enabled: false,
        startHour: 22,
        endHour: 7,
      },
    },
    privacy: {
      profileVisibility: "public",
      lastSeen: "everyone",
      readReceipts: true,
      showOnlineStatus: true,
    },
    discovery: {
      discoverableByEmail: true,
      discoverableByPhone: false,
      discoverableInSearch: true,
    },
    security: {
      twoFactorAuth: false,
      loginAlerts: true,
      recognizedDevices: [],
    },
    data: {
      download: {
        requested: false,
        requestedAt: null,
      },
      delete: {
        scheduled: false,
        scheduledAt: null,
      },
    },
    blocking: {
      blockedUsers: [],
    },
    payments: {
      methods: [],
      history: [],
      defaultCurrency: "USD",
    },
  });

return  await defaultSettings.save()


  }

   /**
   * Generate default settings for all users who don't have settings yet
   */
   async generateDefaultsForAllUsers(): Promise<void> {
    const users = await User.find({}, "_id").lean();
    const userIds = users.map((u: any) => u._id.toString());

    const settings = await SettingsModel.find(
      { userId: { $in: userIds } },
      "userId"
    ).lean();

    const usersWithSettings = new Set(
      settings.map((s: any) => s.userId.toString())
    );

    const usersWithoutSettings = userIds.filter(
      (id) => !usersWithSettings.has(id)
    );

    for (const userId of usersWithoutSettings) {
      await this.createDefault(userId);
    }
  }




  /**
   * Get user settings
   * @param userId - User ID
   * @returns Settings document
   */
  async getSettings(userId: string): Promise<SettingsDocument | null> {
    return await SettingsModel.findOne({ userId }).lean();
  }

  /**
   * Update user settings with flexible dot notation
   * @param userId - User ID
   * @param updates - Partial update payload (can be deeply nested)
   * @returns Updated settings document
   */
  async updateSettings(
    userId: string,
    updates: PartialDeep<SettingsDocument>
  ): Promise<SettingsDocument | null> {
    // Flatten the deeply nested update payload to dot notation
    const dotNotatedUpdate = flattenToDotNotation(updates);

    return await SettingsModel.findOneAndUpdate(
      { userId },
      { $set: dotNotatedUpdate } as UpdateQuery<SettingsDocument>,
      { new: true }
    ).lean();
  }
}



/**
 * Utility to deeply flatten an object into dot notation
 * E.g. { notification: { email: true } } => { "notification.email": true }
 */
function flattenToDotNotation(
  obj: Record<string, any>,
  prefix = "",
  result: Record<string, any> = {}
): Record<string, any> {
  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      flattenToDotNotation(obj[key], `${prefix}${key}.`, result);
    } else {
      result[`${prefix}${key}`] = obj[key];
    }
  }
  return result;
}

/**
 * Deep partial type to allow updates at any level
 */
type PartialDeep<T> = {
  [P in keyof T]?: T[P] extends object ? PartialDeep<T[P]> : T[P];
};
