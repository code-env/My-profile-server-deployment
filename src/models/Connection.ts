import mongoose, { Document, Schema } from 'mongoose';

export interface IConnection extends Document {
  fromUser: mongoose.Types.ObjectId;
  fromProfile: mongoose.Types.ObjectId;
  toProfile: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected' | 'disconnect' | 'unfollow' | 'unaffiliate';
  connectionType: 'follow' | 'connect';
  connectionCategory: 'connection' | 'affiliation'
  coonectionReason?: string;
  exchangeInformationfor?: string;

  metadata?: Record<string, any>;
  source?: 'link' | 'qrcode' | 'direct'
  lastInteractionAt?: Date;
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
    fromProfile: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
    },
    toProfile: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    connectionType: {
      type: String,
      enum: ['follow', 'connect'],
      required: true,
    },
    connectionCategory: {
      type: String,
      enum: ['connection', 'affiliation'],
      required: true,
    },
    
   
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },

    source: {
      type: String,
      enum: ['link', 'qrcode', 'direct'],
      default: 'direct',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
connectionSchema.index({ fromProfile:1, toProfile: 1 }, { unique: true });
connectionSchema.index({ status: 1 });


export const Connection = mongoose.model<IConnection>('Connections', connectionSchema);
