import mongoose, { Document, Schema, Model } from 'mongoose';
import { IBadgeSuggestion, BadgeSuggestionStatus, BadgeCategory } from '../../interfaces/gamification.interface';

export type BadgeSuggestionDocument = IBadgeSuggestion & Document;

const BadgeSuggestionSchema = new Schema<IBadgeSuggestion>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
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
    category: {
      type: String,
      enum: Object.values(BadgeCategory),
      required: true,
      index: true
    },
    suggestedActivities: [{
      type: String,
      trim: true
    }],
    status: {
      type: String,
      enum: Object.values(BadgeSuggestionStatus),
      default: BadgeSuggestionStatus.PENDING,
      index: true
    },
    adminFeedback: {
      type: String,
      trim: true
    },
    implementedBadgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Badge'
    }
  },
  { timestamps: true }
);

// Create indexes for better query performance
BadgeSuggestionSchema.index({ status: 1, createdAt: -1 });
BadgeSuggestionSchema.index({ profileId: 1, status: 1 });

export interface IBadgeSuggestionModel extends Model<IBadgeSuggestion> {
  findPendingSuggestions(): Promise<BadgeSuggestionDocument[]>;
  findByProfile(profileId: mongoose.Types.ObjectId): Promise<BadgeSuggestionDocument[]>;
  findByStatus(status: BadgeSuggestionStatus): Promise<BadgeSuggestionDocument[]>;
}

// Static methods
BadgeSuggestionSchema.statics.findPendingSuggestions = function(): Promise<BadgeSuggestionDocument[]> {
  return this.find({ status: BadgeSuggestionStatus.PENDING }).sort({ createdAt: 1 });
};

BadgeSuggestionSchema.statics.findByProfile = function(profileId: mongoose.Types.ObjectId): Promise<BadgeSuggestionDocument[]> {
  return this.find({ profileId }).sort({ createdAt: -1 });
};

BadgeSuggestionSchema.statics.findByStatus = function(status: BadgeSuggestionStatus): Promise<BadgeSuggestionDocument[]> {
  return this.find({ status }).sort({ createdAt: -1 });
};

export const BadgeSuggestionModel = mongoose.model<IBadgeSuggestion, IBadgeSuggestionModel>(
  'BadgeSuggestion',
  BadgeSuggestionSchema
);
