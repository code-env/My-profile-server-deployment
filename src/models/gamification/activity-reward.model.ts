import mongoose, { Document, Schema, Model } from 'mongoose';
import { IActivityReward, BadgeCategory } from '../../interfaces/gamification.interface';

export type ActivityRewardDocument = IActivityReward & Document;

const ActivityRewardSchema = new Schema<IActivityReward>(
  {
    activityType: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: Object.values(BadgeCategory),
      required: true,
      index: true
    },
    pointsRewarded: {
      type: Number,
      required: true,
      min: 0
    },
    cooldownPeriod: {
      type: Number,
      default: 0,
      min: 0
    },
    maxRewardsPerDay: {
      type: Number,
      min: 0
    },
    isEnabled: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Create indexes for better query performance
ActivityRewardSchema.index({ category: 1, isEnabled: 1 });
ActivityRewardSchema.index({ pointsRewarded: -1 });

export interface IActivityRewardModel extends Model<IActivityReward> {
  findByCategory(category: BadgeCategory): Promise<ActivityRewardDocument[]>;
  findEnabledActivities(): Promise<ActivityRewardDocument[]>;
  findByActivityType(activityType: string): Promise<ActivityRewardDocument | null>;
}

// Static methods
ActivityRewardSchema.statics.findByCategory = function(category: BadgeCategory): Promise<ActivityRewardDocument[]> {
  return this.find({ category, isEnabled: true }).sort({ pointsRewarded: -1 });
};

ActivityRewardSchema.statics.findEnabledActivities = function(): Promise<ActivityRewardDocument[]> {
  return this.find({ isEnabled: true }).sort({ category: 1, pointsRewarded: -1 });
};

ActivityRewardSchema.statics.findByActivityType = function(activityType: string): Promise<ActivityRewardDocument | null> {
  return this.findOne({ activityType });
};

export const ActivityRewardModel = mongoose.model<IActivityReward, IActivityRewardModel>(
  'ActivityReward',
  ActivityRewardSchema
);
