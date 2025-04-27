// import Joi from 'joi/lib';
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum PlanType {
  TASK = 'task',
  EVENT = 'event',
  MEETING = 'meeting',
  APPOINTMENT = 'appointment',
  CELEBRATION = 'celebration'
}


interface IPlanBase {
  title: string;
  description?: string;
  isAllDay: boolean;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  repeat: {
    frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval: number;
    daysOfWeek?: number[];
    endDate?: Date;
    endAfterOccurrences?: number;
  };
  reminders: Array<{
    timeBefore: number;
    type: 'before' | 'after' | 'at time';
    status: 'pending' | 'sent' | 'failed';
    method: 'notification' | 'email' | 'sms' | 'call';
  }>;
  visibility: 'public' | 'private' | 'selected';
  participants: Types.ObjectId[];
  color: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
  reward?: {
    points: number;
    description: string;
  };
  attachments: Array<{
    fileType: string;
    url: string;
    name: string;
    uploadedBy: Types.ObjectId;
    uploadedAt: Date;
  }>;
  comments: Array<{
    text: string;
    postedBy: Types.ObjectId;
    replies?: any[];
    reactions?: Map<string, Types.ObjectId[]>;
  }>;

  likes: Array<{
    userId: Types.ObjectId;
    createdAt: Date;
  }>;

  links: Array<{
    url: string;
    title: string;
    createdBy: Types.ObjectId;
  }>;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface IPlan extends IPlanBase, Document {
  planType: string;
}

const PlanSchema = new Schema<IPlan>(
  {
    title: { type: String, required: true },
    description: { type: String },
    isAllDay: { type: Boolean, default: false },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
    repeat: {
      frequency: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'],
        default: 'none'
      },
      interval: { type: Number, default: 1 },
      daysOfWeek: [{ type: Number, min: 0, max: 6 }],
      endDate: { type: Date },
      endAfterOccurrences: { type: Number }
    },
    reminders: [{
      timeBefore: { type: Number, required: true },
      type: { type: String, enum: ['before', 'after', 'at time'], default: 'before' },
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      method: {
        type: String,
        enum: ['notification', 'email', 'sms', 'call'],
        default: 'notification'
      }
    }],
    visibility: {
      type: String,
      enum: ['public', 'private', 'selected'],
      default: 'private'
    },
    participants: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
    color: { type: String, default: '#1DA1F2' },
    reward: {
      points: { type: Number, default: 0 },
      description: { type: String }
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    notes: { type: String },
    attachments: [{
      fileType: { type: String, required: true },
      url: { type: String, required: true },
      name: { type: String, required: true },
      uploadedBy: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
      uploadedAt: { type: Date, default: Date.now }
    }],
    comments: [{
      text: { type: String, required: true },
      postedBy: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
      postedAt: { type: Date, default: Date.now },
      replies: [{
        text: { type: String, required: true },
        postedBy: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
        postedAt: { type: Date, default: Date.now }
      }],
      reactions: {
        type: Map,
        of: [{ type: Schema.Types.ObjectId, ref: 'Profile' }]
      }
    }],
    likes: [{
      userId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    links: [{
      url: { type: String, required: true },
      title: { type: String, required: true },
      createdBy: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    planType: { type: String, required: true, enum: ['task', 'event', 'meeting', 'appointment', 'celebration'] }
  },
  {
    timestamps: true,
    discriminatorKey: 'planType'
  }

);



// Indexes
PlanSchema.index({ title: 'text', description: 'text' });
PlanSchema.index({ startTime: 1 });
PlanSchema.index({ endTime: 1 });
PlanSchema.index({ participants: 1 });
PlanSchema.index({ createdBy: 1 });
// Base model
const PlanModel = mongoose.model<IPlan>('Plan', PlanSchema);

export { PlanModel, IPlan };
