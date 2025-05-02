import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminNotification extends Document {
  type: string;
  title: string;
  message: string;
  referenceId?: string;
  metadata?: any;
  isRead: boolean;
  createdAt: Date;
}

const adminNotificationSchema = new Schema({
  type: {
    type: String,
    enum: ['TRANSACTION', 'PROFILE_REGISTRATION', 'SYSTEM_ALERT', 'USER_ACTIVITY'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  referenceId: {
    type: String
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for better query performance
adminNotificationSchema.index({ type: 1 });
adminNotificationSchema.index({ isRead: 1 });
adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ referenceId: 1 });

export const AdminNotificationModel = mongoose.model<IAdminNotification>('AdminNotification', adminNotificationSchema);
