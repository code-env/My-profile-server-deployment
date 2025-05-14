import mongoose, { Document, Schema, Model } from 'mongoose';
import { ITask } from './Tasks';
import { IProfile } from '../interfaces/profile.interface';
import { IUser } from './User';
import { VisibilityType, Comment } from './plans-shared';
import { commentSchema } from './plans-shared/comment.schema';

export interface IList extends Document {
  name: string;
  items: ListItem[];
  visibility: VisibilityType;
  reward?: Reward;
  color: string;
  type: ListType;
  importance: ImportanceLevel;
  notes?: string;
  createdBy: mongoose.Types.ObjectId | IUser;
  profile?: mongoose.Types.ObjectId | IProfile;
  createdAt: Date;
  updatedAt: Date;
  relatedTask?: mongoose.Types.ObjectId | ITask;
  likes: Like[];
  comments: Comment[];
}

export interface ListItem {
  name: string;
  isCompleted: boolean;
  createdAt: Date;
  completedAt?: Date;
}

export interface Like {
  profile: mongoose.Types.ObjectId | IProfile;
  createdAt: Date;
}

export enum ListType {
  Shopping = 'Shopping',
  Todo = 'Todo',
  Checklist = 'Checklist',
  Routine = 'Routine',
  Other = 'Other'
}

export enum ImportanceLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}


export interface Reward {
  type: 'Reward' | 'Punishment';
  points: number;
}

const listItemSchema = new Schema<ListItem>({
  name: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

const likeSchema = new Schema<Like>({
  profile: { 
    type: Schema.Types.ObjectId, 
    ref: 'Profile',
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

const rewardSchema = new Schema<Reward>({
  type: { 
    type: String, 
    enum: ['Reward', 'Punishment'],
    required: true
  },
  points: { type: Number, required: true, min: 0 }
});

const listSchema = new Schema<IList>(
  {
    name: { type: String, required: true },
    items: [listItemSchema],
    visibility: { 
      type: String, 
      enum: Object.values(VisibilityType),
      default: VisibilityType.Public
    },
    reward: rewardSchema,
    color: { type: String, default: '#1DA1F2' },
    type: { 
      type: String, 
      enum: Object.values(ListType),
      default: ListType.Todo
    },
    importance: { 
      type: String, 
      enum: Object.values(ImportanceLevel),
      default: ImportanceLevel.Low
    },
    notes: { type: String },
    profile: { 
      type: Schema.Types.ObjectId, 
      ref: 'Profile'
    },
    createdBy: { 
      type: Schema.Types.ObjectId,
      ref: 'Users',
    },
    relatedTask: {
      type: Schema.Types.ObjectId,
      ref: 'Task'
    },
    likes: [likeSchema],
    comments: [commentSchema]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
      }
    }
  }
);

// Virtual for completion percentage
listSchema.virtual('completionPercentage').get(function () {
  if (this.items.length === 0) return 0;
  const completed = this.items.filter(item => item.isCompleted).length;
  return Math.round((completed / this.items.length) * 100);
});

// Indexes for better query performance
listSchema.index({ createdBy: 1 });
listSchema.index({ createdBy: 1, type: 1 });
listSchema.index({ createdBy: 1, importance: 1 });
listSchema.index({ relatedTask: 1 });

export interface ListModel extends Model<IList> {
  // You can add custom static methods here if needed
}

export const List = mongoose.model<IList, ListModel>('List', listSchema);