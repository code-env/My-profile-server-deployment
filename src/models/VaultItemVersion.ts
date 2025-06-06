import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IVaultItemVersion extends Document {
  itemId: Types.ObjectId;
  profileId: Types.ObjectId;
  version: number;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata: {
    changedBy: Types.ObjectId;
    changeReason?: string;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
  };
  snapshot: Record<string, any>;
}

const vaultItemVersionSchema = new Schema<IVaultItemVersion>({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'VaultItem',
    required: true,
    index: true
  },
  profileId: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true
  },
  changes: [{
    field: {
      type: String,
      required: true
    },
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed
  }],
  metadata: {
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true
    },
    changeReason: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  },
  snapshot: {
    type: Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

// Compound index for efficient version queries
vaultItemVersionSchema.index({ itemId: 1, version: 1 }, { unique: true });

export const VaultItemVersion = mongoose.model<IVaultItemVersion>('VaultItemVersion', vaultItemVersionSchema); 