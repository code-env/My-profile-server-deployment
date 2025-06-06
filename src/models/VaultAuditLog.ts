import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVaultAuditLog extends Document {
  profileId: Types.ObjectId;
  itemId: Types.ObjectId;
  action: string;
  metadata: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

const VaultAuditLogSchema = new Schema<IVaultAuditLog>({
  profileId: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true,
    index: true
  },
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'VaultItem',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'view',
      'create',
      'update',
      'delete',
      'share',
      'unshare',
      'download',
      'export',
      'encrypt',
      'decrypt'
    ]
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
});

// Indexes for efficient querying
VaultAuditLogSchema.index({ profileId: 1, timestamp: -1 });
VaultAuditLogSchema.index({ itemId: 1, timestamp: -1 });
VaultAuditLogSchema.index({ action: 1, timestamp: -1 });

export const VaultAuditLog = mongoose.model<IVaultAuditLog>('VaultAuditLog', VaultAuditLogSchema); 