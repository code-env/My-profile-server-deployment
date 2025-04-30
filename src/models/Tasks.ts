import mongoose, { Document, Schema, Model } from 'mongoose';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { IProfile } from '../interfaces/profile.interface';
import { IList } from './List';
import { IUser } from './User';

export interface ITask extends Document {
  name: string;
  description?: string;
  subTasks: ISubTask[];
  startTime?: Date;
  endTime?: Date;
  isAllDay: boolean;
  duration?: {
    hours: number;
    minutes: number;
  };
  repeat: RepeatSettings;
  reminders: Reminder[];
  visibility: VisibilityType;
  participants: mongoose.Types.ObjectId[] | IProfile[];
  reward?: Reward;
  color: string;
  category: TaskCategory;
  priority: PriorityLevel;
  status: TaskStatus;
  notes?: string;
  attachments: Attachment[];
  comments: Comment[];
  location?: Location;
  createdBy: mongoose.Types.ObjectId | IUser;
  profile?: mongoose.Types.ObjectId | IProfile;
  updatedAt: Date;
  createdAt: Date;
  relatedList?: mongoose.Types.ObjectId | IList;
}

export interface ISubTask {
  description?: string;
  isCompleted: boolean;
  createdAt?: Date
  completedAt?: Date;
}

export interface RepeatSettings {
  isRepeating: boolean;
  frequency: RepeatFrequency;
  interval?: number;
  endCondition: EndCondition;
  endDate?: Date;
  occurrences?: number;
  nextRun?: Date;
}

export interface Reminder {
  type: ReminderType;
  amount?: number;
  unit?: ReminderUnit;
  customEmail?: string;
  triggered?: boolean;
  triggerTime?: Date;
  minutesBefore?: number; // Added for the "30 mins before" from screenshot
}

export interface Reward {
  type: 'Reward' | 'Punishment';
  points: number;
  currency?: 'MyPts'; // Added from screenshot
  description?: string;
}

export interface Attachment {
  type: 'Photo' | 'File' | 'Link' | 'Other';
  url: string;
  name: string;
  description?: string;
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId | IProfile;
  size?: number;
  fileType?: string;
  daysSinceUpload?: number; // For "Uploaded 23 days ago"
}

export interface Comment {
  text: string;
  createdBy: mongoose.Types.ObjectId | IProfile;
  createdAt?: Date;
  updatedAt?: Date;
  likes: mongoose.Types.ObjectId[] | IProfile[];
}

export interface Location {
  name: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Maintained all original enums exactly as you had them
export enum RepeatFrequency {
  None = 'None',
  OneTime = 'One time only',
  Daily = 'Every Day',
  Weekdays = 'Every Weekdays',
  Weekends = 'Every Weekend',
  Weekly = 'Every Week',
  BiWeekly = 'Every 2 weeks',
  Monthly = 'Every month',
  Yearly = 'Every year',
  Custom = 'Custom'
}

export enum EndCondition {
  Never = 'No end repeat',
  UntilDate = 'On date',
  AfterOccurrences = 'After number of events'
}

export enum ReminderType {
  None = 'No reminder',
  AtEventTime = 'At time of event',
  Minutes15 = '15 minutes before',
  Minutes30 = '30 minutes before',
  Hours1 = '1 hour before',
  Hours2 = '2 hours before',
  Days1 = '1 day before',
  Days2 = '2 days before',
  Weeks1 = '1 week before',
  Custom = 'Custom'
}

export enum ReminderUnit {
  Minutes = 'Minutes',
  Hours = 'Hours',
  Days = 'Days',
  Weeks = 'Weeks'
}

export enum VisibilityType {
  Everyone = 'Everyone (Public)',
  Connections = 'Connections only (Private)',
  OnlyMe = 'Only me (Hidden)'
}

export enum TaskCategory {
  Personal = 'Personal',
  Family = 'Family',
  Dependent = 'Dependent'
}

export enum PriorityLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}

export enum TaskStatus {
  Todo = 'To-do',
  InProgress = 'In Progress',
  Revision = 'Revision',
  Completed = 'Completed',
  Upcoming = 'Upcoming' // Added from screenshot
}

const subTaskSchema = new Schema<ISubTask>({
  description: { type: String },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

const repeatSettingsSchema = new Schema<RepeatSettings>({
  isRepeating: { type: Boolean, default: false },
  frequency: { 
    type: String, 
    enum: Object.values(RepeatFrequency),
    default: RepeatFrequency.None
  },
  interval: { type: Number, min: 1 },
  endCondition: { 
    type: String, 
    enum: Object.values(EndCondition),
    default: EndCondition.Never
  },
  endDate: { type: Date },
  occurrences: { type: Number, min: 1 },
  nextRun: { type: Date }
});

const reminderSchema = new Schema<Reminder>({
  type: { 
    type: String, 
    enum: Object.values(ReminderType),
    required: true,
    default: ReminderType.None
  },
  amount: { type: Number, min: 1 },
  unit: { type: String, enum: Object.values(ReminderUnit) },
  customEmail: { type: String },
  triggered: { type: Boolean, default: false },
  triggerTime: { type: Date },
  minutesBefore: { type: Number } // For the "30 mins before" from screenshot
});

const rewardSchema = new Schema<Reward>({
  type: { 
    type: String, 
    enum: ['Reward', 'Punishment'],
    required: true
  },
  points: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'MyPts' }, // From screenshot
  description: { type: String }
});

const locationSchema = new Schema<Location>({
  name: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  }
});

const attachmentSchema = new Schema<Attachment>({
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
    ref: 'Users',
    required: true
  },
  size: { type: Number },
  fileType: { type: String }
});

const commentSchema = new Schema<Comment>({
  text: { type: String, required: true },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'Profile',
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  likes: [{ type: Schema.Types.ObjectId, ref: 'Profile' }]
});

const taskSchema = new Schema<ITask>(
  {
    name: { type: String, required: true },
    description: { type: String },
    subTasks: [subTaskSchema],
    startTime: { type: Date },
    endTime: { type: Date },
    isAllDay: { type: Boolean, default: false }, // For "All day"
    duration: {
      hours: { type: Number, min: 0, max: 23, default: 0 }, // For "1 hour 00 mins" from screenshot
      minutes: { type: Number, min: 0, max: 59, default: 0 }
    },
    repeat: repeatSettingsSchema,
    reminders: [reminderSchema],
    visibility: { 
      type: String, 
      enum: Object.values(VisibilityType),
      default: VisibilityType.Everyone
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'Profile'
    }],
    reward: rewardSchema,
    color: { type: String, default: '#1DA1F2' },
    category: { 
      type: String, 
      enum: Object.values(TaskCategory),
      default: TaskCategory.Personal
    },
    priority: { 
      type: String, 
      enum: Object.values(PriorityLevel),
      default: PriorityLevel.Low
    },
    status: { 
      type: String, 
      enum: Object.values(TaskStatus),
      default: TaskStatus.Upcoming // Changed to match screenshot
    },
    notes: { type: String },
    attachments: [attachmentSchema],
    comments: [commentSchema],
    location: locationSchema,
    profile: { 
      type: Schema.Types.ObjectId, 
      ref: 'Profile'
    },
    createdBy: { 
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true
    },
    relatedList: {
      type: Schema.Types.ObjectId,
      ref: 'List'
    }
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

// Virtual for "All day" display logic
taskSchema.virtual('displayTime').get(function() {
  if (this.isAllDay) {
    return 'All day';
  }
  if (this.startTime && this.endTime) {
    return `${this.startTime.toLocaleTimeString()} - ${this.endTime.toLocaleTimeString()}`;
  }
  if (this.duration) {
    return `${this.duration.hours}h ${this.duration.minutes}m`;
  }
  return 'No time set';
});

// Virtual for attachment time display ("23 days ago")
attachmentSchema.virtual('timeSinceUpload').get(function() {
  return formatDistanceToNow(this.uploadedAt, { addSuffix: true });
});

// Virtual for created by display ("Created by John Doe - 21 min ago")
taskSchema.virtual('createdByDisplay').get(function() {
  return `Created by ${this.createdBy} - ${formatDistanceToNow(this.createdAt, { addSuffix: true })}`;
});

// Pre-save hook for all-day events
taskSchema.pre('save', function(next) {
  if (this.isAllDay) {
    // Set start to midnight and end to 23:59:59
    const start = new Date(this.startTime || new Date());
    start.setHours(0, 0, 0, 0);
    this.startTime = start;
    
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    this.endTime = end;
    
    // Set duration to 24 hours
    this.duration = { hours: 24, minutes: 0 };
  }
  next();
});

// Indexes (maintained all original indexes)
taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ createdBy: 1, priority: 1 });
taskSchema.index({ createdBy: 1, category: 1 });
taskSchema.index({ startTime: 1 });
taskSchema.index({ endTime: 1 });
taskSchema.index({ status: 1, endTime: 1 });
taskSchema.index({ 'repeat.nextRun': 1 });

export interface TaskModel extends Model<ITask> {
  // Add any static methods here if needed
}

export const Task = mongoose.model<ITask, TaskModel>('Task', taskSchema);