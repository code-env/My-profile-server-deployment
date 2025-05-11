import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Interface for the Presence document
 */
export interface IPresence extends Document {
  userId: Types.ObjectId;
  profileId: Types.ObjectId;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastActive: Date;
  socketId: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    deviceType: string;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Schema for the Presence model
 */
const presenceSchema = new Schema<IPresence>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away', 'busy'],
      default: 'offline',
      index: true
    },
    lastActive: {
      type: Date,
      default: Date.now,
      index: true
    },
    socketId: {
      type: String,
      required: true,
      unique: true
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
      deviceType: String
    },
    metadata: {
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }
  },
  {
    timestamps: {
      createdAt: 'metadata.createdAt',
      updatedAt: 'metadata.updatedAt'
    }
  }
);

// Create indexes for efficient queries
presenceSchema.index({ userId: 1, status: 1 });
presenceSchema.index({ profileId: 1, status: 1 });
presenceSchema.index({ lastActive: 1 });

// Create TTL index to automatically remove stale presence records
// This will remove records that haven't been updated in 24 hours
presenceSchema.index({ lastActive: 1 }, { expireAfterSeconds: 86400 });

/**
 * Presence model for tracking user online/offline status
 */
export const Presence = mongoose.model<IPresence>('Presence', presenceSchema);
