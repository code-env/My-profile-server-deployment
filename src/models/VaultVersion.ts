import mongoose, { Schema, Document } from 'mongoose';
import { Types } from 'mongoose';

export interface IVaultVersion extends Document {
  itemId: Types.ObjectId;
  versionNumber: number;
  data: any;
  metadata: {
    restoredFrom?: number;
    restoredAt?: Date;
    changedBy?: string;
    changeReason?: string;
  };
  createdAt: Date;
}

const VaultVersionSchema = new Schema<IVaultVersion>({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'VaultItem',
    required: true,
    index: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  metadata: {
    restoredFrom: Number,
    restoredAt: Date,
    changedBy: String,
    changeReason: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient version lookup
VaultVersionSchema.index({ itemId: 1, versionNumber: -1 });

export const VaultVersion = mongoose.model<IVaultVersion>('VaultVersion', VaultVersionSchema); 