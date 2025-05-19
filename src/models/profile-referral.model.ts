import mongoose, { Document, Schema, Model } from 'mongoose';
import { generateReferralCode } from '../utils/crypto';
import { logger } from '../utils/logger';
import {
  IProfileReferral,
  IProfileReferralMethods,
  ReferralRewardType,
  ReferralRewardStatus
} from '../interfaces/profile-referral.interface';
import { MyPtsModel } from './my-pts.model';
import { TransactionType } from '../interfaces/my-pts.interface';

// Define ProfileReferralDocument type
export type ProfileReferralDocument = IProfileReferral & Document & IProfileReferralMethods;

// Create the ProfileReferral schema
const profileReferralSchema = new Schema<IProfileReferral, Model<IProfileReferral, {}, IProfileReferralMethods>, IProfileReferralMethods>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      unique: true,
      index: true
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      sparse: true,
      index: true
    },
    earnedPoints: {
      type: Number,
      default: 0
    },
    pendingPoints: {
      type: Number,
      default: 0
    },
    totalReferrals: {
      type: Number,
      default: 0
    },
    successfulReferrals: {
      type: Number,
      default: 0
    },
    currentMilestoneLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    referredProfiles: [{
      profileId: {
        type: Schema.Types.ObjectId,
        ref: 'Profile'
      },
      date: {
        type: Date,
        default: Date.now
      },
      hasReachedThreshold: {
        type: Boolean,
        default: false
      },
      thresholdReachedDate: {
        type: Date
      },
      referrals: [{
        type: Schema.Types.ObjectId,
        ref: 'Profile'
      }]
    }],
    rewards: [{
      type: {
        type: String,
        enum: Object.values(ReferralRewardType)
      },
      amount: {
        type: Number,
        required: true
      },
      status: {
        type: String,
        enum: Object.values(ReferralRewardStatus),
        default: ReferralRewardStatus.PENDING
      },
      date: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true
  }
);

// Indexes for better query performance
profileReferralSchema.index({ referralCode: 1 });
profileReferralSchema.index({ 'referredProfiles.profileId': 1 });
profileReferralSchema.index({ currentMilestoneLevel: -1 });

// Instance methods
profileReferralSchema.methods.addReferredProfile = async function(profileId: mongoose.Types.ObjectId): Promise<void> {
  // Check if profile is already in referredProfiles
  const existingReferral = this.referredProfiles.find(
    (ref: any) => ref.profileId.toString() === profileId.toString()
  );

  if (!existingReferral) {
    this.referredProfiles.push({
      profileId,
      date: new Date(),
      hasReachedThreshold: false,
      referrals: []
    });
    this.totalReferrals += 1;
    await this.save();
  }
};

profileReferralSchema.methods.updateReferralStatus = async function(
  referredProfileId: mongoose.Types.ObjectId,
  hasReachedThreshold: boolean
): Promise<void> {
  const referredProfile = this.referredProfiles.find(
    (ref: any) => ref.profileId.toString() === referredProfileId.toString()
  );

  if (referredProfile && !referredProfile.hasReachedThreshold && hasReachedThreshold) {
    referredProfile.hasReachedThreshold = true;
    referredProfile.thresholdReachedDate = new Date();
    this.successfulReferrals += 1;

    // Check if this update triggers a milestone
    await this.checkAndUpdateMilestoneLevel();

    await this.save();
  }
};

profileReferralSchema.methods.checkAndUpdateMilestoneLevel = async function(): Promise<number> {
  // Get all successful referrals
  const successfulReferrals = this.referredProfiles.filter((ref: any) => ref.hasReachedThreshold);

  // Level 1: User has 3 successful referrals (each with 1000+ MyPts)
  if (this.currentMilestoneLevel < 1 && successfulReferrals.length >= 3) {
    this.currentMilestoneLevel = 1;
    // Award 100 MyPts for reaching Level 1
    await this.awardReferralPoints(ReferralRewardType.MILESTONE_LEVEL_1, 100);

    // Check if any of these 3 referrals has referred at least 3 others with 1000+ MyPts
    const level2Eligible = await this.checkLevel2Eligibility(successfulReferrals);

    if (level2Eligible && this.currentMilestoneLevel < 2) {
      this.currentMilestoneLevel = 2;
      // Award 150 MyPts for reaching Level 2
      await this.awardReferralPoints(ReferralRewardType.MILESTONE_LEVEL_2, 150);

      // Check for level 3 eligibility
      const level3Eligible = await this.checkLevel3Eligibility(successfulReferrals);

      if (level3Eligible && this.currentMilestoneLevel < 3) {
        this.currentMilestoneLevel = 3;
        // Award 200 MyPts for reaching Level 3
        await this.awardReferralPoints(ReferralRewardType.MILESTONE_LEVEL_3, 200);

        // Check for level 4 eligibility
        const level4Eligible = await this.checkLevel4Eligibility(successfulReferrals);

        if (level4Eligible && this.currentMilestoneLevel < 4) {
          this.currentMilestoneLevel = 4;
          // Award 250 MyPts for reaching Level 4
          await this.awardReferralPoints(ReferralRewardType.MILESTONE_LEVEL_4, 250);

          // Check for level 5 eligibility
          const level5Eligible = await this.checkLevel5Eligibility(successfulReferrals);

          if (level5Eligible && this.currentMilestoneLevel < 5) {
            this.currentMilestoneLevel = 5;
            // Award 300 MyPts for reaching Level 5
            await this.awardReferralPoints(ReferralRewardType.MILESTONE_LEVEL_5, 300);
          }
        }
      }
    }
  }

  await this.save();
  return this.currentMilestoneLevel;
};

// Helper method to check Level 2 eligibility
profileReferralSchema.methods.checkLevel2Eligibility = async function(
  successfulReferrals: any[]
): Promise<boolean> {
  // Need at least 3 successful referrals to qualify
  if (successfulReferrals.length < 3) return false;

  // Check if at least one of the successful referrals has 3+ successful referrals of their own
  for (const referral of successfulReferrals) {
    // Get the referral document for this profile
    const referralDoc = await ProfileReferralModel.findOne({ profileId: referral.profileId });

    if (referralDoc && referralDoc.successfulReferrals >= 3) {
      return true;
    }
  }

  return false;
};

// Helper method to check Level 3 eligibility
profileReferralSchema.methods.checkLevel3Eligibility = async function(
  successfulReferrals: any[]
): Promise<boolean> {
  // Need at least 3 successful referrals to qualify
  if (successfulReferrals.length < 3) return false;

  // Check if at least two of the successful referrals have 3+ successful referrals of their own
  let count = 0;
  for (const referral of successfulReferrals) {
    // Get the referral document for this profile
    const referralDoc = await ProfileReferralModel.findOne({ profileId: referral.profileId });

    if (referralDoc && referralDoc.successfulReferrals >= 3) {
      count++;
      if (count >= 2) return true;
    }
  }

  return false;
};

// Helper method to check Level 4 eligibility
profileReferralSchema.methods.checkLevel4Eligibility = async function(
  successfulReferrals: any[]
): Promise<boolean> {
  // Need at least 3 successful referrals to qualify
  if (successfulReferrals.length < 3) return false;

  // Check if all three of the successful referrals have 3+ successful referrals of their own
  let count = 0;
  for (const referral of successfulReferrals.slice(0, 3)) {
    // Get the referral document for this profile
    const referralDoc = await ProfileReferralModel.findOne({ profileId: referral.profileId });

    if (referralDoc && referralDoc.successfulReferrals >= 3) {
      count++;
    }
  }

  return count >= 3;
};

// Helper method to check Level 5 eligibility
profileReferralSchema.methods.checkLevel5Eligibility = async function(
  successfulReferrals: any[]
): Promise<boolean> {
  // Need at least 5 successful referrals to qualify for level 5
  if (successfulReferrals.length < 5) return false;

  // Check if at least 5 of the successful referrals have 3+ successful referrals of their own
  let count = 0;
  for (const referral of successfulReferrals) {
    // Get the referral document for this profile
    const referralDoc = await ProfileReferralModel.findOne({ profileId: referral.profileId });

    if (referralDoc && referralDoc.successfulReferrals >= 3) {
      count++;
      if (count >= 5) return true;
    }
  }

  return false;
};

profileReferralSchema.methods.awardReferralPoints = async function(
  type: ReferralRewardType,
  amount: number
): Promise<any> {
  // Create a new reward record
  const reward = {
    type,
    amount,
    status: ReferralRewardStatus.PENDING,
    date: new Date()
  };

  this.rewards.push(reward);
  this.pendingPoints += amount;

  // Process the reward (add MyPts to the profile)
  try {
    const myPts = await MyPtsModel.findOrCreate(this.profileId);

    // Add the points to the profile's MyPts balance
    await myPts.addMyPts(
      amount,
      TransactionType.EARN_MYPTS,
      `Earned ${amount} MyPts for referral milestone: ${type}`,
      { referralRewardType: type }
    );

    // Update the reward status to completed
    const rewardIndex = this.rewards.length - 1;
    this.rewards[rewardIndex].status = ReferralRewardStatus.COMPLETED;
    this.earnedPoints += amount;
    this.pendingPoints -= amount;

    await this.save();
    return this.rewards[rewardIndex];
  } catch (error) {
    logger.error('Error awarding referral points:', error);
    throw error;
  }
};

// Pre-save middleware
profileReferralSchema.pre('save', async function(next) {
  try {
    // Generate referral code if it doesn't exist
    if (!this.referralCode) {
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!isUnique && attempts < maxAttempts) {
        const code = generateReferralCode();
        // Check if the code already exists
        const existingReferral = await (this.constructor as any).findOne({ referralCode: code });
        if (!existingReferral) {
          this.referralCode = code;
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        logger.error('Failed to generate unique referral code after maximum attempts');
        throw new Error('Failed to generate unique referral code');
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Static methods
profileReferralSchema.statics.findOrCreate = async function(
  profileId: mongoose.Types.ObjectId
): Promise<ProfileReferralDocument> {
  let profileReferral = await this.findOne({ profileId });

  if (!profileReferral) {
    profileReferral = await this.create({
      profileId,
      referralCode: generateReferralCode()
    });
  }

  return profileReferral;
};

// Define interface for model type
export interface IProfileReferralModel extends Model<IProfileReferral, {}, IProfileReferralMethods> {
  findOrCreate(profileId: mongoose.Types.ObjectId): Promise<ProfileReferralDocument>;
}

// Create and export the model
export const ProfileReferralModel = mongoose.model<IProfileReferral, IProfileReferralModel>('ProfileReferral', profileReferralSchema);
