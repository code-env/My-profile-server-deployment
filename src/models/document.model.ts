import mongoose, { Schema } from 'mongoose';
import { SharedDocument } from '../types/profiles';

const documentSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  type: {
    type: String,
    enum: ['document', 'presentation', 'spreadsheet', 'image', 'other'],
    required: true,
  },
  name: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  lastModified: { type: Date, default: Date.now },
  permissions: [{
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile' },
    access: {
      type: String,
      enum: ['view', 'edit', 'comment'],
      default: 'view',
    },
    grantedAt: { type: Date, default: Date.now },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'Profile' },
  }],
  version: { type: Number, default: 1 },
  versions: [{
    number: Number,
    url: String,
    modifiedAt: Date,
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'Profile' },
  }],
});

// Create indexes
documentSchema.index({ ownerId: 1 });
documentSchema.index({ 'permissions.profileId': 1 });
documentSchema.index({ name: 'text' });

export const DocumentModel = mongoose.model<SharedDocument>('Document', documentSchema);
