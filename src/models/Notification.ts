import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  relatedTo?: {
    model: string;
    id: mongoose.Types.ObjectId;
  };
  action?: {
    text: string;
    url: string;
  };
  priority: 'low' | 'medium' | 'high';
  isRead: boolean;
  isArchived: boolean;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      required: true,
      enum: [
        'profile_view',
        'profile_like',
        'connection_request',
        'connection_accepted',
        'profile_comment',
        'endorsement_received',
        'message_received',
        'security_alert',
        'system_notification',
        'achievement_unlocked',
      ],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedTo: {
      model: {
        type: String,
        enum: ['Profile', 'User', 'Comment', 'Message'],
      },
      id: {
        type: Schema.Types.ObjectId,
      },
    },
    action: {
      text: String,
      url: String,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
// notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isArchived: 1, createdAt: -1 });

// Automatically remove expired notifications
notificationSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { expiresAt: { $exists: true } }
});

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
