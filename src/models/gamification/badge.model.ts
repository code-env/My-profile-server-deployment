import mongoose, { Document, Schema, Model } from 'mongoose';
import { IBadge, IBadgeActivity, BadgeCategory, BadgeRarity } from '../../interfaces/gamification.interface';

export type BadgeDocument = IBadge & Document;

// Define the badge activity schema
const BadgeActivitySchema = new Schema<IBadgeActivity>({
  activityId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  myPtsReward: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  completionCriteria: {
    type: {
      type: String,
      required: true
    },
    threshold: {
      type: Number,
      required: true,
      min: 1
    },
    condition: String
  }
});

const BadgeSchema = new Schema<IBadge>(
  {
    name: {
      type: String,
      required: true,
      trim: true
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
    rarity: {
      type: String,
      enum: Object.values(BadgeRarity),
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    requirements: {
      type: {
        type: String,
        required: true
      },
      threshold: {
        type: Number,
        required: true
      },
      condition: String
    },
    activities: [BadgeActivitySchema],
    requiredActivitiesCount: {
      type: Number,
      min: 0
    }
  },
  { timestamps: true }
);

// Create indexes for better query performance
BadgeSchema.index({ category: 1, rarity: 1 });
BadgeSchema.index({ 'requirements.type': 1 });

export interface IBadgeModel extends Model<IBadge> {
  findByCategory(category: BadgeCategory): Promise<BadgeDocument[]>;
  findByRarity(rarity: BadgeRarity): Promise<BadgeDocument[]>;
}

// Static methods
BadgeSchema.statics.findByCategory = function(category: BadgeCategory): Promise<BadgeDocument[]> {
  return this.find({ category }).sort({ rarity: 1 });
};

BadgeSchema.statics.findByRarity = function(rarity: BadgeRarity): Promise<BadgeDocument[]> {
  return this.find({ rarity }).sort({ category: 1 });
};

export const BadgeModel = mongoose.model<IBadge, IBadgeModel>('Badge', BadgeSchema);
