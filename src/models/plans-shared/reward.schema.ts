import { Schema } from 'mongoose';
import { Reward } from './interfaces';

export const rewardSchema = new Schema<Reward>({
  type: { 
    type: String, 
    enum: ['Reward', 'Punishment'],
    required: true
  },
  points: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'MyPts' },
  description: { type: String }
});