import mongoose, { Schema } from 'mongoose';
import { ChatMessage } from '../types/profiles';

const messageSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  attachments: [{
    type: { type: String, enum: ['image', 'document', 'voice'] },
    url: String,
  }],
  metadata: {
    clientMessageId: String,
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
  },
});

// Create indexes for efficient querying
messageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });
messageSchema.index({ receiverId: 1, status: 1 });

export const MessageModel = mongoose.model<ChatMessage>('Message', messageSchema);
