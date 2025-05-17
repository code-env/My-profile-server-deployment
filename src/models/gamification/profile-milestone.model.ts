import mongoose, { Document, Schema, Model } from 'mongoose';
import { IProfileMilestone, MilestoneLevel, MILESTONE_THRESHOLDS } from '../../interfaces/gamification.interface';

export type ProfileMilestoneDocument = IProfileMilestone & Document;

const ProfileMilestoneSchema = new Schema<IProfileMilestone>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      unique: true,
      index: true
    },
    currentLevel: {
      type: String,
      enum: Object.values(MilestoneLevel),
      default: MilestoneLevel.STARTER,
      required: true
    },
    currentPoints: {
      type: Number,
      default: 0,
      min: 0
    },
    nextLevel: {
      type: String,
      enum: [...Object.values(MilestoneLevel), null],
      default: MilestoneLevel.EXPLORER
    },
    nextLevelThreshold: {
      type: Number,
      default: MILESTONE_THRESHOLDS[MilestoneLevel.EXPLORER]
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    milestoneHistory: [
      {
        level: {
          type: String,
          enum: Object.values(MilestoneLevel),
          required: true
        },
        achievedAt: {
          type: Date,
          default: Date.now,
          required: true
        }
      }
    ]
  },
  { timestamps: true }
);

// Create indexes for better query performance
ProfileMilestoneSchema.index({ currentLevel: 1 });
ProfileMilestoneSchema.index({ currentPoints: -1 });
ProfileMilestoneSchema.index({ 'milestoneHistory.achievedAt': -1 });

export interface IProfileMilestoneModel extends Model<IProfileMilestone> {
  findOrCreate(profileId: mongoose.Types.ObjectId): Promise<ProfileMilestoneDocument>;
  updateMilestone(profileId: mongoose.Types.ObjectId, points: number): Promise<ProfileMilestoneDocument>;
}

// Static methods
ProfileMilestoneSchema.statics.findOrCreate = async function(
  profileId: mongoose.Types.ObjectId
): Promise<ProfileMilestoneDocument> {
  let milestone = await this.findOne({ profileId });

  if (!milestone) {
    milestone = await this.create({
      profileId,
      currentLevel: MilestoneLevel.STARTER,
      currentPoints: 0,
      nextLevel: MilestoneLevel.EXPLORER,
      nextLevelThreshold: MILESTONE_THRESHOLDS[MilestoneLevel.EXPLORER],
      progress: 0,
      milestoneHistory: [
        {
          level: MilestoneLevel.STARTER,
          achievedAt: new Date()
        }
      ]
    });
  }

  return milestone;
};

ProfileMilestoneSchema.statics.updateMilestone = async function(
  profileId: mongoose.Types.ObjectId,
  points: number
): Promise<ProfileMilestoneDocument> {
  // Use the model's findOrCreate method, but we need to cast 'this' to the correct type
  const milestone = await (this as IProfileMilestoneModel).findOrCreate(profileId);

  // Update current points
  milestone.currentPoints = points;

  // Determine current level based on points
  let currentLevel = MilestoneLevel.STARTER;
  let nextLevel: MilestoneLevel | null = MilestoneLevel.EXPLORER;
  let nextThreshold = MILESTONE_THRESHOLDS[MilestoneLevel.EXPLORER];

  // Find the highest milestone level achieved
  const milestoneEntries = Object.entries(MILESTONE_THRESHOLDS);
  for (let i = milestoneEntries.length - 1; i >= 0; i--) {
    const [level, threshold] = milestoneEntries[i];
    if (points >= threshold) {
      currentLevel = level as MilestoneLevel;

      // Set next level and threshold
      if (i < milestoneEntries.length - 1) {
        nextLevel = milestoneEntries[i + 1][0] as MilestoneLevel;
        nextThreshold = milestoneEntries[i + 1][1];
      } else {
        // Already at highest level
        nextLevel = null;
        nextThreshold = 0;
      }
      break;
    }
  }

  // Check if level has changed
  if (currentLevel !== milestone.currentLevel) {
    milestone.milestoneHistory.push({
      level: currentLevel,
      achievedAt: new Date()
    });
  }

  // Update milestone data
  milestone.currentLevel = currentLevel;
  milestone.nextLevel = nextLevel;
  milestone.nextLevelThreshold = nextThreshold;

  // Calculate progress percentage to next level
  if (nextLevel) {
    const currentThreshold = MILESTONE_THRESHOLDS[currentLevel];
    const pointsToNextLevel = nextThreshold - currentThreshold;
    const pointsEarned = points - currentThreshold;
    milestone.progress = Math.min(Math.floor((pointsEarned / pointsToNextLevel) * 100), 99);
  } else {
    milestone.progress = 100; // Max level reached
  }

  await milestone.save();
  return milestone;
};

export const ProfileMilestoneModel = mongoose.model<IProfileMilestone, IProfileMilestoneModel>(
  'ProfileMilestone',
  ProfileMilestoneSchema
);
