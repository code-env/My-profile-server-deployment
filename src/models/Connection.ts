import mongoose, { Document, Schema } from 'mongoose';

export interface IConnection extends Document {
  fromUser: mongoose.Types.ObjectId;
  toProfile: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  connectionType: 'follow' | 'connect' | 'business' | 'donation';
  message?: string;
  amount?: number; 
  employmentDetails?: {
    position?: string;
    company?: string;
    salary?: string;
    startDate?: Date;
  };
  metadata?: Record<string, any>;
  lastInteractionAt?: Date;
  interactionStats?: {
    views: number;
    messages: number;
    engagements: number;
    endorsements: number;
    shares: number;
  };
  strengthScores?: {
    score: number;
    timestamp: Date;
    factors: {
      interactionFrequency: number;
      mutualConnections: number;
      engagementDuration: number;
      sharedInterests: number;
      messageFrequency: number;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const connectionSchema = new Schema<IConnection>(
  {
    fromUser: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    toProfile: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'blocked'],
      default: 'pending',
    },
    connectionType: {
      type: String,
      enum: ['follow', 'connect', 'business', 'donation'],
      required: true,
    },
    message: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    employmentDetails: {
      position: String,
      company: String,
      salary: String,
      startDate: Date,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
    interactionStats: {
      views: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      engagements: { type: Number, default: 0 },
      endorsements: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
    },
    strengthScores: [{
      score: Number,
      timestamp: { type: Date, default: Date.now },
      factors: {
        interactionFrequency: Number,
        mutualConnections: Number,
        engagementDuration: Number,
        sharedInterests: Number,
        messageFrequency: Number,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
connectionSchema.index({ fromUser: 1, toProfile: 1 }, { unique: true });
connectionSchema.index({ status: 1 });
connectionSchema.index({ lastInteractionAt: 1 });

export const Connection = mongoose.model<IConnection>('Connections', connectionSchema);
