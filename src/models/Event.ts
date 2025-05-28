import { Schema, model, Document, Types } from 'mongoose';
import { 
  Location, 
  Attachment, 
  Comment, 
  EventType, 
  EventStatus, 
  BookingStatus, 
  PriorityLevel,
  RepeatSettings,
  Reminder,
  Reward
} from './plans-shared';
import { NotificationChannelSettings } from './settings';

export interface IParticipant {
  profile: Types.ObjectId;
  role: 'attendee' | 'organizer' | 'speaker';
  status: 'pending' | 'accepted' | 'declined' | 'maybe';
  joinedAt: Date | null;
}

export interface IEvent extends Document {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  eventType: EventType;
  status: EventStatus;
  priority: PriorityLevel;
  visibility: 'Public' | 'ConnectionsOnly' | 'OnlyMe' | 'Custom';
  color: string;
  category: string;
  location?: Location;
  participants: IParticipant[];
  createdBy: Types.ObjectId;
  profile?: Types.ObjectId;
  attachments: Attachment[];
  comments: Comment[];
  agendaItems: Array<{
    description: string;
    assignedTo?: Types.ObjectId;
    completed: boolean;
  }>;
  isGroupEvent: boolean;
  duration?: {
    hours: number;
    minutes: number;
  };
  repeat: RepeatSettings;
  reminders: Reminder[];
  likes: Types.ObjectId[];
  maxAttendees?: number;
  createdAt: Date;
  updatedAt: Date;
  serviceProvider?: {
    profileId: Types.ObjectId;
    role: string;
    organization?: Types.ObjectId;
  };
  // Only used when eventType === EventType.Booking
  booking?: {
    serviceProvider: {
      profileId: Types.ObjectId;
      role: string;
      organization?: Types.ObjectId;
    };
    service?: {
      name: string;
      description?: string;
      duration: number;  // in minutes
      reward?: Reward;
    };
    status: BookingStatus;
    reward?: Reward & {
      required: boolean;
      transactionId?: string;
      status: 'pending' | 'completed' | 'failed';
    };
    notes?: string;
    cancellationReason?: string;
    rescheduleCount: number;
    requireApproval: boolean;
  };
  // Only used when eventType === EventType.Celebration
  celebration?: {
    gifts: Array<{
      description: string;
      requestedBy?: Types.ObjectId;
      promisedBy?: Types.ObjectId;
      received: boolean;
      link?: string;
    }>;
    category: 'birthday' | 'anniversary' | 'holiday' | 'achievement' | 'other';
    status: 'planning' | 'upcoming' | 'completed' | 'cancelled';
    photoAlbum?: Types.ObjectId;
    socialMediaPosts: Array<{
      platform: string;
      postId: string;
      url: string;
    }>;
  };
  statusHistory?: Array<{
    status: EventStatus;
    changedAt: Date;
    reason?: string;
    updatedBy?: Types.ObjectId;
    notes?: string;
  }>;
  // Settings integration fields
  settings?: {
    visibility?: {
      level: 'Public' | 'ConnectionsOnly' | 'OnlyMe' | 'Custom';
      customUsers?: Types.ObjectId[];
    };
    notifications?: {
      enabled: boolean;
      channels: NotificationChannelSettings;
      reminderSettings?: {
        defaultReminders: number[]; // minutes before event
        allowCustomReminders: boolean;
      };
    };
    timeSettings?: {
      useUserTimezone: boolean;
      bufferTime: number; // minutes
      defaultDuration: number; // minutes
    };
    privacy?: {
      allowComments: boolean;
      allowLikes: boolean;
      allowParticipants: boolean;
      shareWithConnections: boolean;
      requireApprovalToJoin: boolean;
    };
    booking?: {
      allowRescheduling: boolean;
      maxReschedules: number;
      cancellationWindow: number; // hours before event
      requireApproval: boolean;
      autoConfirm: boolean;
    };
    celebration?: {
      allowGiftRequests: boolean;
      allowSocialSharing: boolean;
      autoCreatePhotoAlbum: boolean;
    };
  };
  [key: string]: any; // For additional fields specific to tasks or events
}

const EventSchema = new Schema<IEvent>({
  title: { type: String, required: true },
  description: String,
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isAllDay: { type: Boolean, default: false },
  eventType: {
    type: String,
    enum: Object.values(EventType),
    default: EventType.Meeting
  },
  status: {
    type: String,
    enum: Object.values(EventStatus),
    default: EventStatus.Upcoming
  },
  priority: {
    type: String,
    enum: Object.values(PriorityLevel),
    default: PriorityLevel.Low
  },
  visibility: {
    type: String,
    enum: ['Public', 'ConnectionsOnly', 'OnlyMe', 'Custom'],
    default: 'Public'
  },
  color: { type: String, default: '#1DA1F2' },
  category: { type: String, default: 'Personal' },
  location: {
    name: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    online: { type: Boolean, default: false },
    meetingUrl: String
  },
  participants: [{
    profile: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true
    },
    role: {
      type: String,
      enum: ['attendee', 'organizer', 'speaker'],
      default: 'attendee'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'maybe'],
      default: 'pending'
    },
    joinedAt: {
      type: Date,
      default: null
    }
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  profile: {
    type: Schema.Types.ObjectId,
    ref: 'Profile'
  },
  attachments: [{
    fileType: String,
    url: String,
    name: String,
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Users'
    }
  }],
  comments: [{
    text: String,
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Profile'
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment'
    },
    depth: { type: Number, default: 0 },
    threadId: { type: Schema.Types.ObjectId },
    isThreadRoot: { type: Boolean, default: true },
    replies: [{
      type: Schema.Types.ObjectId,
      ref: 'Comment'
    }],
    reactions: {
      type: Map,
      of: [{
        type: Schema.Types.ObjectId,
        ref: 'Profile'
      }]
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  agendaItems: [{
    description: String,
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'Profile'
    },
    completed: { type: Boolean, default: false }
  }],
  isGroupEvent: { type: Boolean, default: false },
  duration: {
    hours: { type: Number, min: 0, max: 23, default: 0 },
    minutes: { type: Number, min: 0, max: 59, default: 0 }
  },
  repeat: {
    isRepeating: { type: Boolean, default: false },
    frequency: { 
      type: String, 
      enum: ['None', 'Daily', 'Weekdays', 'Weekends', 'Weekly', 'BiWeekly', 'Monthly', 'Yearly', 'Custom'],
      default: 'None'
    },
    interval: { type: Number, min: 1 },
    endCondition: { 
      type: String, 
      enum: ['Never', 'UntilDate', 'AfterOccurrences'],
      default: 'Never'
    },
    endDate: { type: Date },
    occurrences: { type: Number, min: 1 },
    nextRun: { type: Date }
  },
  reminders: [{
    type: {
      type: String,
      enum: ['None', 'AtEventTime', 'Minutes15', 'Minutes30', 'Hours1', 'Hours2', 'Days1', 'Days2', 'Weeks1', 'Custom'],
      required: true,
      default: 'None'
    },
    amount: { type: Number, min: 1 },
    unit: { type: String, enum: ['Minutes', 'Hours', 'Days', 'Weeks'] },
    customEmail: { type: String },
    triggered: { type: Boolean, default: false },
    triggerTime: { type: Date },
    minutesBefore: { type: Number }
  }],
  likes: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
  serviceProvider: {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile'
    },
    role: String,
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization'
    }
  },
  maxAttendees: {
    type: Number,
    min: 1
  },
  // Only used when eventType === EventType.Booking
  booking: {
    serviceProvider: {
      profileId: {
        type: Schema.Types.ObjectId,
        ref: 'Profile',
        default: null
      },
      role: { type: String, default: 'provider' },
      organization: {
        type: Schema.Types.ObjectId,
        ref: 'Organization'
      }
    },
    service: {
      name: { type: String },
      description: String,
      duration: { type: Number },  // in minutes
      reward: {
        type: { 
          type: String, 
          enum: ['Reward', 'Punishment'],
          default: 'Reward'
        },
        points: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'MyPts' },
        description: { type: String }
      }
    },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.Pending
    },
    reward: {
      type: { 
        type: String, 
        enum: ['Reward', 'Punishment'],
        default: 'Reward'
      },
      points: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'MyPts' },
      description: { type: String },
      required: { type: Boolean, default: false },
      transactionId: String,
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
      }
    },
    notes: String,
    cancellationReason: String,
    rescheduleCount: { type: Number, default: 0 },
    requireApproval: { type: Boolean, default: false }
  },
  // Only used when eventType === EventType.Celebration
  celebration: {
    gifts: [{
      description: { type: String, required: true },
      requestedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Profile'
      },
      promisedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Profile'
      },
      received: { type: Boolean, default: false },
      link: String
    }],
    category: {
      type: String,
      enum: ['birthday', 'anniversary', 'holiday', 'achievement', 'other'],
      default: 'birthday'
    },
    status: {
      type: String,
      enum: ['planning', 'upcoming', 'completed', 'cancelled'],
      default: 'planning'
    },
    photoAlbum: {
      type: Schema.Types.ObjectId,
      ref: 'PhotoAlbum'
    },
    socialMediaPosts: [{
      platform: { type: String, required: true },
      postId: { type: String, required: true },
      url: { type: String, required: true }
    }]
  },
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(EventStatus),
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String,
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Users'
    },
    notes: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Settings integration fields
  settings: {
    visibility: {
      level: {
        type: String,
        enum: ['Public', 'ConnectionsOnly', 'OnlyMe', 'Custom'],
        default: 'Public'
      },
      customUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'Profile'
      }]
    },
    notifications: {
      enabled: { type: Boolean, default: true },
      channels: {
        push: { type: Boolean, default: true },
        text: { type: Boolean, default: false },
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false }
      },
      reminderSettings: {
        defaultReminders: { type: [Number], default: [15, 60] }, // 15 min and 1 hour before
        allowCustomReminders: { type: Boolean, default: true }
      }
    },
    timeSettings: {
      useUserTimezone: { type: Boolean, default: true },
      bufferTime: { type: Number, min: 0, max: 60, default: 15 },
      defaultDuration: { type: Number, min: 0, max: 120, default: 60 }
    },
    privacy: {
      allowComments: { type: Boolean, default: true },
      allowLikes: { type: Boolean, default: true },
      allowParticipants: { type: Boolean, default: true },
      shareWithConnections: { type: Boolean, default: true },
      requireApprovalToJoin: { type: Boolean, default: false }
    },
    booking: {
      allowRescheduling: { type: Boolean, default: true },
      maxReschedules: { type: Number, min: 0, max: 10, default: 3 },
      cancellationWindow: { type: Number, min: 0, max: 24, default: 24 },
      requireApproval: { type: Boolean, default: false },
      autoConfirm: { type: Boolean, default: false }
    },
    celebration: {
      allowGiftRequests: { type: Boolean, default: true },
      allowSocialSharing: { type: Boolean, default: true },
      autoCreatePhotoAlbum: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
EventSchema.index({ startTime: 1 });
EventSchema.index({ endTime: 1 });
EventSchema.index({ 'booking.serviceProvider.profileId': 1, startTime: 1 });
EventSchema.index({ 'booking.status': 1 });

// Add method to check if booking can be rescheduled
EventSchema.methods.canReschedule = function(maxReschedules: number = 3): boolean {
  if (this.eventType !== EventType.Booking || !this.booking) return false;
  return this.booking.rescheduleCount < maxReschedules;
};

// Add method to check if booking can be cancelled
EventSchema.methods.canCancel = function(cancellationWindow: number = 24): boolean {
  if (this.eventType !== EventType.Booking || !this.booking) return false;
  const hoursUntilStart = (this.startTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);
  return hoursUntilStart >= cancellationWindow;
};

// Pre-save hook for all-day events
EventSchema.pre('save', function(next) {
  if (this.isAllDay) {
    const start = new Date(this.startTime);
    start.setHours(0, 0, 0, 0);
    this.startTime = start;
    
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    this.endTime = end;

    // Set duration to 24 hours
    this.duration = { hours: 24, minutes: 0 };
  }

  // Set booking to undefined if eventType is not Booking
  if (this.eventType !== EventType.Booking) {
    this.set('booking', undefined);
  }

  // Set celebration to undefined if eventType is not Celebration
  if (this.eventType !== EventType.Celebration) {
    this.set('celebration', undefined);
  }

  next();
});

export const Event = model<IEvent>('Event', EventSchema);
