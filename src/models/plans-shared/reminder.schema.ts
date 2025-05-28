import { Schema } from 'mongoose';
import { ReminderType, ReminderUnit } from './enums';
import { Reminder } from './interfaces';

export const reminderSchema = new Schema<Reminder>({
    _id: { type: Schema.Types.ObjectId, auto: true },
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
    minutesBefore: { type: Number }
});