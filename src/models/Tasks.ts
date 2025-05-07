import mongoose, { Document, Schema, Model } from 'mongoose';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { IProfile } from '../interfaces/profile.interface';
import { IList } from './List';
import { IUser } from './User';
import { 
  ISubTask, 
  Comment,
  RepeatSettings,
  Reminder,
  Reward,
  Attachment,
  Location,
  VisibilityType,
  TaskCategory,
  PriorityLevel,
  TaskStatus,
  TaskType
} from './plans-shared';
import { 
  repeatSettingsSchema,
  reminderSchema,
  rewardSchema,
  attachmentSchema,
  locationSchema
} from './plans-shared';

export interface ITask extends Document {
  name: string;
  type: TaskType;
  description?: string;
  subTasks: ISubTask[];
  startTime?: Date;
  endTime?: Date;
  scheduledTime?: Date;
  completedAt?: Date;
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
  likes: mongoose.Types.ObjectId[];
}

const subTaskSchema = new Schema<ISubTask>({
  description: { type: String },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
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
    isAllDay: { type: Boolean, default: false },
    duration: {
      hours: { type: Number, min: 0, max: 23, default: 0 },
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
      default: PriorityLevel.LOW
    },
    status: { 
      type: String, 
      enum: Object.values(TaskStatus),
      default: TaskStatus.Upcoming
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
    },
    likes: [{ type: Schema.Types.ObjectId, ref: 'Profile' }]
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

// Pre-save hook for all-day events
taskSchema.pre('save', function(next) {
  if (this.isAllDay) {
    const start = new Date(this.startTime || new Date());
    start.setHours(0, 0, 0, 0);
    this.startTime = start;
    
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    this.endTime = end;
    
    this.duration = { hours: 24, minutes: 0 };
  }
  next();
});

// Indexes
taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ createdBy: 1, priority: 1 });
taskSchema.index({ createdBy: 1, category: 1 });
taskSchema.index({ startTime: 1 });
taskSchema.index({ endTime: 1 });
taskSchema.index({ status: 1, endTime: 1 });
taskSchema.index({ 'repeat.nextRun': 1 });

export interface TaskModel extends Model<ITask> {}

export const Task = mongoose.model<ITask, TaskModel>('Task', taskSchema);