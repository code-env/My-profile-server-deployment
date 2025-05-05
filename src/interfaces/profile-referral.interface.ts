import mongoose from 'mongoose';

export enum ReferralRewardType {
  SIGNUP = 'signup',
  MILESTONE_LEVEL_1 = 'milestone_level_1',
  MILESTONE_LEVEL_2 = 'milestone_level_2',
  MILESTONE_LEVEL_3 = 'milestone_level_3',
  MILESTONE_LEVEL_4 = 'milestone_level_4',
  MILESTONE_LEVEL_5 = 'milestone_level_5'
}

export enum ReferralRewardStatus {
  PENDING = 'pending',
  COMPLETED = 'completed'
}

export interface IReferralReward {
  type: ReferralRewardType;
  amount: number;
  status: ReferralRewardStatus;
  date: Date;
}

export interface IReferredProfile {
  profileId: mongoose.Types.ObjectId;
  date: Date;
  hasReachedThreshold: boolean;
  thresholdReachedDate?: Date;
  referrals: mongoose.Types.ObjectId[]; // IDs of profiles this profile has referred
}

export interface IProfileReferral {
  profileId: mongoose.Types.ObjectId;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId; // Profile that referred this profile
  earnedPoints: number;
  pendingPoints: number;
  totalReferrals: number;
  successfulReferrals: number; // Referrals that have reached 1000+ MyPts
  currentMilestoneLevel: number; // 0-5 representing milestone levels
  referredProfiles: IReferredProfile[];
  rewards: IReferralReward[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IProfileReferralMethods {
  addReferredProfile(profileId: mongoose.Types.ObjectId): Promise<void>;
  updateReferralStatus(referredProfileId: mongoose.Types.ObjectId, hasReachedThreshold: boolean): Promise<void>;
  checkAndUpdateMilestoneLevel(): Promise<number>;
  checkLevel1Milestone(successfulReferrals: any[]): Promise<boolean>;
  awardReferralPoints(type: ReferralRewardType, amount: number): Promise<IReferralReward>;
}
