import { Schema } from 'mongoose';
import { Comment } from './interfaces';

export const commentSchema = new Schema<Comment>({
  text: { type: String, required: true },
  postedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'Profile',
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
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