import { Schema } from 'mongoose';
import { Location } from './interfaces';

export const locationSchema = new Schema<Location>({
  name: { type: String },
  address: { type: String },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  online: { type: Boolean, default: false },
  meetingUrl: { type: String }
});