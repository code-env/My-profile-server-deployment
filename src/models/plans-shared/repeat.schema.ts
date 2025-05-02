import { Schema } from 'mongoose';
import { RepeatSettings } from './interfaces';
import { EndCondition, RepeatFrequency } from './enums';

export const repeatSettingsSchema = new Schema<RepeatSettings>({
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