import { Document, Types } from 'mongoose';
import { EndCondition, ReminderType, ReminderUnit, RepeatFrequency } from './enums';
import { IProfile } from '../../interfaces/profile.interface';

// Common interfaces
export interface RepeatSettings {
  isRepeating: boolean;
  frequency: RepeatFrequency;
  interval?: number;
  endCondition: EndCondition;
  endDate?: Date;
  occurrences?: number;
  nextRun?: Date;
  customPattern?: {
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    monthsOfYear?: number[];
    interval?: number;
  };
}

export interface Reminder {
  _id?: Types.ObjectId;
  type: ReminderType;
  amount?: number;
  unit?: ReminderUnit;
  customEmail?: string;
  triggered?: boolean;
  triggerTime?: Date;
  minutesBefore?: number;
}

export interface Reward {
  type: 'Reward' | 'Punishment';
  points: number;
  currency?: 'MyPts';
  description?: string;
}

export interface Attachment {
  type: 'Photo' | 'File' | 'Link' | 'Other';
  url: string;
  name: string;
  description?: string;
  uploadedAt: Date;
  uploadedBy: Types.ObjectId | IProfile;
  size?: number;
  fileType?: string;
  daysSinceUpload?: number;
}

export interface Location {
  isPhysical?: boolean;
  name: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  online?: boolean;
  meetingUrl?: string;
}

export interface ISubTask {
  description?: string;
  isCompleted: boolean;
  createdAt?: Date;
  completedAt?: Date;
}

export interface Comment {
  _id?: Types.ObjectId;
  text: string;
  postedBy: Types.ObjectId | IProfile;
  parentComment?: Types.ObjectId;
  depth: number;
  threadId?: Types.ObjectId;
  isThreadRoot: boolean;
  replies: Types.ObjectId[];
  reactions: Map<string, Types.ObjectId[]>;
  createdAt?: Date;
  updatedAt?: Date;
  likes: Types.ObjectId[];
}
