import mongoose, { Document, Schema, Model } from 'mongoose';
import { IUserActivity } from '../../interfaces/gamification.interface';

export type UserActivityDocument = IUserActivity & Document;

const UserActivitySchema = new Schema<IUserActivity>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    activityType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    MyPtsEarned: {
      type: Number,
      required: true,
      min: 0
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

// Create indexes for better query performance
UserActivitySchema.index({ profileId: 1, activityType: 1 });
UserActivitySchema.index({ profileId: 1, timestamp: -1 });
UserActivitySchema.index({ timestamp: -1 });

export interface IUserActivityModel extends Model<IUserActivity> {
  getRecentActivities(profileId: mongoose.Types.ObjectId, limit?: number): Promise<UserActivityDocument[]>;
  getActivitiesByType(profileId: mongoose.Types.ObjectId, activityType: string, limit?: number): Promise<UserActivityDocument[]>;
  getActivitiesInTimeRange(
    profileId: mongoose.Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<UserActivityDocument[]>;
  countActivitiesInTimeRange(
    profileId: mongoose.Types.ObjectId,
    activityType: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;
}

// Static methods
UserActivitySchema.statics.getRecentActivities = function(
  profileId: mongoose.Types.ObjectId,
  limit: number = 20
): Promise<UserActivityDocument[]> {
  return this.find({ profileId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

UserActivitySchema.statics.getActivitiesByType = function(
  profileId: mongoose.Types.ObjectId,
  activityType: string,
  limit: number = 20
): Promise<UserActivityDocument[]> {
  return this.find({ profileId, activityType })
    .sort({ timestamp: -1 })
    .limit(limit);
};

UserActivitySchema.statics.getActivitiesInTimeRange = function(
  profileId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<UserActivityDocument[]> {
  return this.find({
    profileId,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort({ timestamp: -1 });
};

UserActivitySchema.statics.countActivitiesInTimeRange = function(
  profileId: mongoose.Types.ObjectId,
  activityType: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  return this.countDocuments({
    profileId,
    activityType,
    timestamp: { $gte: startDate, $lte: endDate }
  });
};

export const UserActivityModel = mongoose.model<IUserActivity, IUserActivityModel>(
  'UserActivity',
  UserActivitySchema
);
