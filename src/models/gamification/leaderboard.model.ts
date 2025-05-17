import mongoose, { Document, Schema, Model } from 'mongoose';
import { ILeaderboardEntry, MilestoneLevel } from '../../interfaces/gamification.interface';

export type LeaderboardEntryDocument = ILeaderboardEntry & Document;

const LeaderboardEntrySchema = new Schema<ILeaderboardEntry>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      unique: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    profileImage: {
      type: String
    },
    myPtsBalance: {
      type: Number,
      required: true,
      default: 0
    },
    milestoneLevel: {
      type: String,
      enum: Object.values(MilestoneLevel),
      required: true,
      default: MilestoneLevel.STARTER
    },
    rank: {
      type: Number,
      required: true,
      min: 1
    },
    previousRank: {
      type: Number,
      min: 1
    },
    badgeCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

// Create indexes for better query performance
LeaderboardEntrySchema.index({ myPtsBalance: -1 });
LeaderboardEntrySchema.index({ rank: 1 });
LeaderboardEntrySchema.index({ milestoneLevel: 1, myPtsBalance: -1 });

export interface ILeaderboardEntryModel extends Model<ILeaderboardEntry> {
  getTopEntries(limit?: number): Promise<LeaderboardEntryDocument[]>;
  getEntriesByMilestone(level: MilestoneLevel, limit?: number): Promise<LeaderboardEntryDocument[]>;
  getProfileRank(profileId: mongoose.Types.ObjectId): Promise<LeaderboardEntryDocument | null>;
  updateLeaderboard(): Promise<void>;
}

// Static methods
LeaderboardEntrySchema.statics.getTopEntries = function(limit: number = 100): Promise<LeaderboardEntryDocument[]> {
  return this.find()
    .sort({ rank: 1 })
    .limit(limit);
};

LeaderboardEntrySchema.statics.getEntriesByMilestone = function(
  level: MilestoneLevel,
  limit: number = 100
): Promise<LeaderboardEntryDocument[]> {
  return this.find({ milestoneLevel: level })
    .sort({ rank: 1 })
    .limit(limit);
};

LeaderboardEntrySchema.statics.getProfileRank = function(
  profileId: mongoose.Types.ObjectId
): Promise<LeaderboardEntryDocument | null> {
  return this.findOne({ profileId });
};

export const LeaderboardEntryModel = mongoose.model<ILeaderboardEntry, ILeaderboardEntryModel>(
  'LeaderboardEntry',
  LeaderboardEntrySchema
);
