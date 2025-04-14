/**
 * Device Model - Represents an IoT device in the system
 * @module models/device
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Interface representing a device document
 * @interface IDevice
 */
export interface IDevice {
  /** Reference to the associated profile */
  profileId: mongoose.Types.ObjectId;
  
  /** Type of the device */
  deviceType: 'smartwatch' | 'smartphone' | 'tablet' | 'laptop' | 'other';
  
  /** Unique identifier for the device */
  deviceId: string;
  
  /** User-friendly name for the device */
  deviceName: string;
  
  /** Device manufacturer (optional) */
  manufacturer?: string;
  
  /** Device model (optional) */
  model?: string;
  
  /** Operating system version (optional) */
  osVersion?: string;
  
  /** Last synchronization timestamp */
  lastSync: Date;
  
  /** Whether the device is currently active */
  isActive: boolean;
  
  /** Device settings configuration */
  settings: {
    /** Enable/disable notifications */
    notifications: boolean;
    /** Enable/disable data synchronization */
    dataSync: boolean;
    /** Enable/disable location tracking */
    locationTracking: boolean;
    /** Enable/disable health metrics collection */
    healthMetrics: boolean;
  };
  
  /** Health-related data from the device */
  healthData?: {
    /** Last health data update timestamp */
    lastUpdate: Date;
    /** Step count (if available) */
    steps?: number;
    /** Heart rate (if available) */
    heartRate?: number;
    /** Sleep data (if available) */
    sleep?: {
      /** Start time of the sleep session */
      startTime: Date;
      /** End time of the sleep session */
      endTime: Date;
      /** Quality of the sleep session */
      quality: 'light' | 'deep' | 'rem';
    }[];
  };
  
  /** Additional metadata for the device */
  metadata: Record<string, any>;
  
  /** Timestamp when the document was created */
  createdAt: Date;
  
  /** Timestamp when the document was last updated */
  updatedAt: Date;
}

const deviceSchema = new Schema<IDevice>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
    },
    deviceType: {
      type: String,
      enum: ['smartwatch', 'smartphone', 'tablet', 'laptop', 'other'],
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
      unique: true,
    },
    deviceName: {
      type: String,
      required: true,
    },
    manufacturer: String,
    model: String,
    osVersion: String,
    lastSync: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      notifications: {
        type: Boolean,
        default: true,
      },
      dataSync: {
        type: Boolean,
        default: true,
      },
      locationTracking: {
        type: Boolean,
        default: false,
      },
      healthMetrics: {
        type: Boolean,
        default: true,
      },
    },
    healthData: {
      lastUpdate: Date,
      steps: Number,
      heartRate: Number,
      sleep: [{
        startTime: Date,
        endTime: Date,
        quality: {
          type: String,
          enum: ['light', 'deep', 'rem'],
        },
      }],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
deviceSchema.index({ profileId: 1, deviceType: 1 });
deviceSchema.index({ deviceId: 1 }, { unique: true });

export const DeviceModel = mongoose.model<IDevice>('Device', deviceSchema);
