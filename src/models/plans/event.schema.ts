import { Schema, Types } from 'mongoose';
import { IPlan, PlanModel } from './Plan';

interface IEvent extends IPlan {
  location: {
    name?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
    online: boolean;
    meetingUrl?: string;
  };
  isGroupEvent: boolean;
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  maxAttendees?: number;
  registrationRequired: boolean;
}

const EventSchema = new Schema<IEvent>({
  location: {
    name: { type: String },
    address: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },
    online: { type: Boolean, default: false },
    meetingUrl: { type: String }
  },
  isGroupEvent: { type: Boolean, default: true },
  status: { 
    type: String, 
    enum: ['upcoming', 'in-progress', 'completed', 'cancelled'], 
    default: 'upcoming' 
  },
  maxAttendees: { type: Number },
  registrationRequired: { type: Boolean, default: false }
}, { discriminatorKey: 'planType' });

// Add instance methods
EventSchema.methods.checkAvailability = function(): number {
  return this.maxAttendees ? this.maxAttendees - this.participants.length : Infinity;
};

EventSchema.methods.registerParticipant = function(profileId: Types.ObjectId): boolean {
  if (this.checkAvailability() > 0 && !this.participants.includes(profileId)) {
    this.participants.push(profileId);
    return true;
  }
  return false;
};

export const EventModel = PlanModel.discriminator<IEvent>('event', EventSchema);
export type IEventModel = typeof EventModel;