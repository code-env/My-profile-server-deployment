import { Schema } from 'mongoose';
import { Comment } from './interfaces';

export const commentSchema = new Schema<Comment>({
  text: { type: String, required: true },
  postedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'Post',
    required: true
  },
  parentComment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  depth: { type: Number, default: 0 },
  threadId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  likes: [{ type: Schema.Types.ObjectId, ref: 'Profile' }]
}, {
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

// Virtual for like count
commentSchema.virtual('likeCount').get(function() {
  return this.likes?.length || 0;
});