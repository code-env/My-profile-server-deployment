import { IBooking } from './booking.schema';
import Joi from 'joi/lib';
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum PlanType {
  TASK = 'task',
  EVENT = 'event',
  MEETING = 'meeting',
  APPOINTMENT = 'appointment',
  CELEBRATION = 'celebration',
  INTERACTION = 'interaction',
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

  bookingSettings: {
    timeZone: string;
    dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
    timeFormat: '12h' | '24h';
    firstDayOfWeek: number; // 0 = Sunday, 1 = Monday
    availability: Array<{
      day: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      startTime: string;
      endTime: string;
    }>;
    slotDuration: number; // in minutes
    bufferTime: number; // in minutes
    maxConcurrentBookings: number;
    maxReschedules?: number;
    cancellationPolicy?: 'flexible' | 'moderate' | 'strict' | 'non-refundable';
    // pricing?: 
    payment?: {
      currency: string;
      amount: number;
      paymentMethods: string[];
      paymentLink?: string;
    };
  };

  bookings?: IBooking[];

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

    bookingSettings: {
      timeZone: { type: String, default: 'UTC' },
      dateFormat: { type: String, enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'], default: 'MM/DD/YYYY' },
      timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
      firstDayOfWeek: { type: Number, default: 1 }, // 0 = Sunday, 1 = Monday
      availability: [{
        day: { type: Number, min: 0, max: 6 },
        startTime: { type: String },
        endTime: { type: String }
      }],
      slotDuration: { type: Number, default: 30 }, // in minutes
      bufferTime: { type: Number, default: 15 }, // in minutes
      maxConcurrentBookings: { type: Number, default: 1 },
      maxReschedules: { type: Number },
      cancellationPolicy: { 
        type: String, 
        enum: ['flexible', 'moderate', 'strict', 'non-refundable'] 
      },

      payment: {
        currency: { type: String, default: 'MyPts' },
        amount: { type: Number, default: 0 },
        paymentMethods: [{ type: String }],
        paymentLink: { type: String }
      }
    },
    links: [{
      url: { type: String, required: true },
      title: { type: String, required: true },
      createdBy: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
      createdAt: { type: Date, default: Date.now }
    }],

    bookings: [{
      type: Schema.Types.ObjectId,
      ref: 'Booking'
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