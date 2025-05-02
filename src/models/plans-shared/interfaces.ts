import { Document, Types } from 'mongoose';
import { EndCondition, ReminderType, RepeatFrequency } from './enums';
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
}

export interface Reminder {
  type: ReminderType;
  amount?: number;
  unit?: ReminderType;
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
  createdBy: Types.ObjectId | IProfile;
  createdAt?: Date;
  updatedAt?: Date;
  likes: Types.ObjectId[] | IProfile[];
}
