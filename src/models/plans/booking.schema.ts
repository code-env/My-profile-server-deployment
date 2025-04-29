import { Schema, Types } from 'mongoose';

export interface IBooking {
  _id?: Types.ObjectId;
  bookedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  status: 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed' | 'no-show';
  slot: {
    start: Date;
    end: Date;
    timeZone?: string;
  };
  rescheduleCount?: number;
  cancellationReason?: string;
  payment?: {
    required: boolean;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    amount: number;
    currency?: string;
    gateway?: string;
    transactionId?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const BookingSchema = new Schema<IBooking>({
  bookedBy: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Profile' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no-show'],
    default: 'pending'
  },
  slot: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    timeZone: { type: String }
  },
  rescheduleCount: { type: Number, default: 0 },
  cancellationReason: { type: String },
  payment: {
    required: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    gateway: { type: String },
    transactionId: { type: String }
  }
}, { timestamps: true });

export { BookingSchema };