import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { IProfile } from '../interfaces/profile.interface';
import { IUser } from './User';
import { 
    Attachment, 
    Comment as IComment,
    attachmentSchema, 
    locationSchema, 
    PriorityLevel, 
    Reminder, 
    reminderSchema, 
    RepeatSettings, 
    repeatSettingsSchema, 
    rewardSchema,
    VisibilityType,
    Reward
} from './plans-shared';
import { Location } from 'express-validator';
import { commentSchema } from './plans-shared/comment.schema';

export interface IEvent extends Document {
  title: string;
  description?: string;
  eventType: 'individual'|'meeting' | 'celebration' | 'appointment';
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  duration?: {
    hours: number;
    minutes: number;
  };
  repeat: RepeatSettings;
  reminders: Reminder[];
  visibility: VisibilityType;
  participants?: Types.ObjectId[] | IProfile[];
  profile?: Types.ObjectId | IProfile;
  reward?: Reward;
  color: string;
  category: string;
  priority: PriorityLevel;
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  attachments: Attachment[];
  location?: Location;
  createdBy: Types.ObjectId | IUser;
  updatedAt: Date;
  createdAt: Date;
  comments: IComment[];
  likes: Types.ObjectId[] | IProfile[];

  // Event-specific fields
  agendaItems?: {
    description: string;
    assignedTo?: Types.ObjectId;
    completed?: boolean;
  }[];
  isGroupEvent?: boolean;
  serviceProvider?: {
    profileId: Types.ObjectId;
    role: string;
  };
}


const agendaItemSchema = new Schema({
  description: { type: String, required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Profile' },
  completed: { type: Boolean, default: false }
});

const serviceProviderSchema = new Schema({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  role: { type: String, required: true }
});

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true },
    description: { type: String },
    eventType: {
      type: String,
      enum: ['meeting', 'celebration', 'appointment'],
      required: true
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    isAllDay: { type: Boolean, default: false },
    duration: {
      hours: { type: Number, min: 0, max: 23 },
      minutes: { type: Number, min: 0, max: 59 }
    },
    repeat: repeatSettingsSchema,
    reminders: [reminderSchema],
    visibility: {
      type: String,
      enum: Object.values(VisibilityType),
      default: VisibilityType.Public
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'Profile'
    }],
    reward: rewardSchema,
    color: { type: String, default: '#1DA1F2' },
    category: { type: String, default: 'Personal' },
    priority: {
      type: String,
      enum: Object.values(PriorityLevel),
      default: PriorityLevel.Low
    },
    profile: { type: Schema.Types.ObjectId, ref: 'Profile' },
    status: {
      type: String,
      enum: ['upcoming', 'in-progress', 'completed', 'cancelled'],
      default: 'upcoming'
    },
    notes: { type: String },
    attachments: [attachmentSchema],
    location: locationSchema,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true
    },
    comments: [commentSchema],
    likes: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
    agendaItems: [agendaItemSchema],
    isGroupEvent: { type: Boolean },
    serviceProvider: serviceProviderSchema
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      }
    }
  }
);

// Virtual for display time
EventSchema.virtual('displayTime').get(function () {
  if (this.isAllDay) {
    return 'All day';
  }
  if (this.startTime && this.endTime) {
    return `${this.startTime.toLocaleTimeString()} - ${this.endTime.toLocaleTimeString()}`;
  }
  return '';
});

// Virtual for comment count
EventSchema.virtual('commentCount').get(function () {
  return this.comments?.length || 0;
});

// Virtual for like count
EventSchema.virtual('likeCount').get(function () {
  return this.likes?.length || 0;
});

// Pre-save hook for all-day events
EventSchema.pre('save', function (next) {
  if (this.isAllDay) {
    const start = new Date(this.startTime);
    start.setHours(0, 0, 0, 0);
    this.startTime = start;

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    this.endTime = end;

    this.duration = { hours: 24, minutes: 0 };
  }
  next();
});

// Indexes for better query performance
EventSchema.index({ createdBy: 1, status: 1 });
EventSchema.index({ startTime: 1 });
EventSchema.index({ endTime: 1 });
EventSchema.index({ 'repeat.nextRun': 1 });
EventSchema.index({ likes: 1 }); // Index for likes
EventSchema.index({ 'comments.createdAt': 1 }); // Index for comment timestamps

export interface EventModel extends Model<IEvent> {
  // You can add static methods here if needed
}

export const Event = mongoose.model<IEvent, EventModel>('Event', EventSchema);