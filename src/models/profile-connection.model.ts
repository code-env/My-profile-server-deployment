import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProfileConnection {
  requesterId: mongoose.Types.ObjectId | string; // Profile ID of the requester
  receiverId: mongoose.Types.ObjectId | string;  // Profile ID of the receiver
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  createdAt: Date;
  updatedAt: Date;
  message?: string; // Optional message with the connection request
  acceptedAt?: Date; // When the connection was accepted
  rejectedAt?: Date; // When the connection was rejected
  blockedAt?: Date;  // When the connection was blocked
}

export interface IProfileConnectionMethods {
  isAccepted(): boolean;
  isPending(): boolean;
  isRejected(): boolean;
  isBlocked(): boolean;
}

export type ProfileConnectionDocument = IProfileConnection & Document & IProfileConnectionMethods;

const profileConnectionSchema = new Schema<IProfileConnection, Model<IProfileConnection, {}, IProfileConnectionMethods>, IProfileConnectionMethods>(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED'],
      default: 'PENDING',
      required: true,
      index: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500
    },
    acceptedAt: {
      type: Date
    },
    rejectedAt: {
      type: Date
    },
    blockedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Create a compound index for requesterId and receiverId
profileConnectionSchema.index({ requesterId: 1, receiverId: 1 }, { unique: true });

// Instance methods
profileConnectionSchema.methods.isAccepted = function(): boolean {
  return this.status === 'ACCEPTED';
};

profileConnectionSchema.methods.isPending = function(): boolean {
  return this.status === 'PENDING';
};

profileConnectionSchema.methods.isRejected = function(): boolean {
  return this.status === 'REJECTED';
};

profileConnectionSchema.methods.isBlocked = function(): boolean {
  return this.status === 'BLOCKED';
};

// Define interface for model type
export interface IProfileConnectionModel extends Model<IProfileConnection, {}, IProfileConnectionMethods> {}

// Create and export the model
export const ProfileConnectionModel = mongoose.model<IProfileConnection, IProfileConnectionModel>(
  'ProfileConnection',
  profileConnectionSchema
);

export default ProfileConnectionModel;
