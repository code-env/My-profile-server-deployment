import mongoose from 'mongoose';
import { ProfileReferralModel } from '../models/profile-referral.model';
import { ProfileModel } from '../models/profile.model';
import { MyPtsModel } from '../models/my-pts.model';
import { ReferralRewardType } from '../interfaces/profile-referral.interface';
import { logger } from '../utils/logger';
import { CustomError } from '../utils/errors';
import { generateReferralCode } from '../utils/crypto';

export class ProfileReferralService {
  /**
   * Get or create a profile referral record
   * @param profileId The profile ID
   * @returns The profile referral document
   */
  static async getProfileReferral(profileId: mongoose.Types.ObjectId | string) {
    try {
      const objId = typeof profileId === 'string' ? new mongoose.Types.ObjectId(profileId) : profileId;
      return await ProfileReferralModel.findOrCreate(objId);
    } catch (error) {
      logger.error('Error getting profile referral:', error);
      throw error;
    }
  }

  /**
   * Initialize referral code for a profile
   * @param profileId The profile ID
   * @returns The profile referral document with initialized referral code
   */
  static async initializeReferralCode(profileId: mongoose.Types.ObjectId | string) {
    try {
      const objId = typeof profileId === 'string' ? new mongoose.Types.ObjectId(profileId) : profileId;

      // Check if profile already has a referral record
      const existingReferral = await ProfileReferralModel.findOne({ profileId: objId });

      if (!existingReferral) {
        // Create a new referral record with a generated code
        const newReferral = await ProfileReferralModel.findOrCreate(objId);
        logger.info(`Initialized referral code for profile ${objId}: ${newReferral.referralCode}`);
        return newReferral;
      }

      // If the referral exists but doesn't have a referral code, generate one
      if (!existingReferral.referralCode) {
        existingReferral.referralCode = generateReferralCode();
        await existingReferral.save();
        logger.info(`Generated missing referral code for profile ${objId}: ${existingReferral.referralCode}`);
      }

      return existingReferral;
    } catch (error) {
      logger.error('Error initializing referral code:', error);
      throw error;
    }
  }

  /**
   * Validate a referral code and return the referring profile
   * @param referralCode The referral code to validate
   * @returns The profile ID of the referring profile
   */
  static async validateReferralCode(referralCode: string) {
    try {
      const referral = await ProfileReferralModel.findOne({ referralCode });

      if (!referral) {
        throw new CustomError('INVALID_REFERRAL_CODE', 'Invalid referral code');
      }

      return referral.profileId;
    } catch (error) {
      logger.error('Error validating referral code:', error);
      throw error;
    }
  }

  /**
   * Process a new referral
   * @param referredProfileId The profile being referred
   * @param referrerProfileId The profile doing the referring
   */
  static async processReferral(referredProfileId: mongoose.Types.ObjectId | string, referrerProfileId: mongoose.Types.ObjectId | string) {
    try {
      const referredObjId = typeof referredProfileId === 'string' ? new mongoose.Types.ObjectId(referredProfileId) : referredProfileId;
      const referrerObjId = typeof referrerProfileId === 'string' ? new mongoose.Types.ObjectId(referrerProfileId) : referrerProfileId;

      // Get or create referral records for both profiles
      const referrerReferral = await ProfileReferralModel.findOrCreate(referrerObjId);
      const referredReferral = await ProfileReferralModel.findOrCreate(referredObjId);

      // Set the referredBy field for the referred profile
      referredReferral.referredBy = referrerObjId;
      await referredReferral.save();

      // Add the referred profile to the referrer's list
      await referrerReferral.addReferredProfile(referredObjId);

      logger.info(`Processed referral: ${referrerObjId} referred ${referredObjId}`);
    } catch (error) {
      logger.error('Error processing referral:', error);
      throw error;
    }
  }

  /**
   * Check if a profile has reached the MyPts threshold and update referral status
   * @param profileId The profile to check
   * @param threshold The MyPts threshold (default: 1000)
   */
  static async checkThresholdAndUpdateStatus(profileId: mongoose.Types.ObjectId | string, threshold: number = 1000) {
    try {
      const objId = typeof profileId === 'string' ? new mongoose.Types.ObjectId(profileId) : profileId;

      // Get the profile's MyPts balance
      const myPts = await MyPtsModel.findOne({ profileId: objId });

      if (!myPts) return;

      // Check if the profile has reached the threshold
      const hasReachedThreshold = myPts.balance >= threshold;

      if (hasReachedThreshold) {
        // Get the profile's referral record
        const profileReferral = await ProfileReferralModel.findOne({ profileId: objId });

        if (!profileReferral || !profileReferral.referredBy) return;

        // Get the referring profile's referral record
        const referrerReferral = await ProfileReferralModel.findOne({ profileId: profileReferral.referredBy });

        if (!referrerReferral) return;

        // Update the referral status
        await referrerReferral.updateReferralStatus(objId, true);

        logger.info(`Profile ${objId} has reached the threshold of ${threshold} MyPts`);
      }
    } catch (error) {
      logger.error('Error checking threshold and updating status:', error);
      throw error;
    }
  }

  /**
   * Get referral statistics for a profile
   * @param profileId The profile ID
   * @returns Referral statistics
   */
  static async getReferralStats(profileId: mongoose.Types.ObjectId | string) {
    try {
      const objId = typeof profileId === 'string' ? new mongoose.Types.ObjectId(profileId) : profileId;

      const referral = await ProfileReferralModel.findOne({ profileId: objId })
        .populate('referredProfiles.profileId', 'name profileImage')
        .populate('referredBy', 'name profileImage');

      if (!referral) {
        return {
          referralCode: '',
          totalReferrals: 0,
          successfulReferrals: 0,
          earnedPoints: 0,
          pendingPoints: 0,
          currentMilestoneLevel: 0,
          referredProfiles: [],
          referredBy: null
        };
      }

      return {
        referralCode: referral.referralCode,
        totalReferrals: referral.totalReferrals,
        successfulReferrals: referral.successfulReferrals,
        earnedPoints: referral.earnedPoints,
        pendingPoints: referral.pendingPoints,
        currentMilestoneLevel: referral.currentMilestoneLevel,
        referredProfiles: referral.referredProfiles.map((ref: any) => ({
          profile: ref.profileId,
          date: ref.date,
          hasReachedThreshold: ref.hasReachedThreshold,
          thresholdReachedDate: ref.thresholdReachedDate
        })),
        referredBy: referral.referredBy
      };
    } catch (error) {
      logger.error('Error getting referral stats:', error);
      throw error;
    }
  }

  /**
   * Get the referral tree for a profile
   * @param profileId The profile ID
   * @param depth The depth of the tree to retrieve (default: 2)
   * @returns The referral tree
   */
  static async getReferralTree(profileId: mongoose.Types.ObjectId | string, depth: number = 2) {
    try {
      const objId = typeof profileId === 'string' ? new mongoose.Types.ObjectId(profileId) : profileId;

      const buildTree = async (id: mongoose.Types.ObjectId, currentDepth: number): Promise<any> => {
        if (currentDepth > depth) return null;

        const referral = await ProfileReferralModel.findOne({ profileId: id });
        if (!referral) return null;

        const profile = await ProfileModel.findById(id, 'name profileImage');
        if (!profile) return null;

        const node: {
          profileId: mongoose.Types.ObjectId;
          name: string;
          profileImage?: string;
          successfulReferrals: number;
          totalReferrals: number;
          milestoneLevel: number;
          children: any[];
        } = {
          profileId: id,
          name: profile.name || 'Unknown',
          profileImage: profile.profileImage,
          successfulReferrals: referral.successfulReferrals,
          totalReferrals: referral.totalReferrals,
          milestoneLevel: referral.currentMilestoneLevel,
          children: []
        };

        if (currentDepth < depth) {
          const children = await Promise.all(
            referral.referredProfiles
              .filter((ref: any) => ref.hasReachedThreshold)
              .map((ref: any) => buildTree(ref.profileId, currentDepth + 1))
          );

          node.children = children.filter(Boolean);
        }

        return node;
      };

      return await buildTree(objId, 1);
    } catch (error) {
      logger.error('Error getting referral tree:', error);
      throw error;
    }
  }
}
