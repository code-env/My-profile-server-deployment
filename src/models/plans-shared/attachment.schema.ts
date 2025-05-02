import { Schema } from 'mongoose';
import { Attachment } from './interfaces';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';

export const attachmentSchema = new Schema<Attachment>({
  type: { 
    type: String, 
    enum: ['Photo', 'File', 'Link', 'Other'],
    required: true
  },
  url: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'Profile',
    required: true
  },
  size: { type: Number },
  fileType: { type: String }
});

attachmentSchema.virtual('timeSinceUpload').get(function() {
  return formatDistanceToNow(this.uploadedAt, { addSuffix: true });
});