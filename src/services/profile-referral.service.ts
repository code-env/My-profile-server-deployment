import mongoose from "mongoose";
import { ProfileReferralModel } from "../models/profile-referral.model";
import { ProfileModel } from "../models/profile.model";
import { MyPtsModel } from "../models/my-pts.model";
import { logger } from "../utils/logger";
import { generateReferralCode } from "../utils/crypto";
import { LeaderboardTimeFrame } from "../interfaces/profile-referral.interface";

export class ProfileReferralService {
  /**
   * Get or create a profile referral record
   * @param profileId The profile ID
   * @returns The profile referral document
   */
  static async getProfileReferral(profileId: mongoose.Types.ObjectId | string) {
    try {
      const objId =
        typeof profileId === "string"
          ? new mongoose.Types.ObjectId(profileId)
          : profileId;
      return await ProfileReferralModel.findOrCreate(objId);
    } catch (error) {
      logger.error("Error getting profile referral:", error);
      throw error;
    }
  }

  /**
   * Initialize referral code for a profile
   * @param profileId The profile ID
   * @returns The profile referral document with initialized referral code
   */
  static async initializeReferralCode(
    profileId: mongoose.Types.ObjectId | string
  ) {
    try {
      const objId =
        typeof profileId === "string"
          ? new mongoose.Types.ObjectId(profileId)
          : profileId;

      // Check if profile already has a referral record
      const existingReferral = await ProfileReferralModel.findOne({
        profileId: objId,
      });

      if (!existingReferral) {
        // Create a new referral record with a generated code
        const newReferral = await ProfileReferralModel.findOrCreate(objId);
        logger.info(
          `Initialized referral code for profile ${objId}: ${newReferral.referralCode}`
        );
        return newReferral;
      }

      // If the referral exists but doesn't have a referral code, generate one
      if (!existingReferral.referralCode) {
        existingReferral.referralCode = generateReferralCode();
        await existingReferral.save();
        logger.info(
          `Generated missing referral code for profile ${objId}: ${existingReferral.referralCode}`
        );
      }

      return existingReferral;
    } catch (error) {
      logger.error("Error initializing referral code:", error);
      throw error;
    }
  }

  /**
   * Validate a referral code and return the referring profile
   * @param referralCode The referral code to validate
   * @returns The profile ID of the referring profile or null if invalid
   */
  static async validateReferralCode(referralCode: string) {
    try {
      // Validate input
      if (
        !referralCode ||
        typeof referralCode !== "string" ||
        referralCode.trim() === ""
      ) {
        logger.warn("Invalid referral code format provided");
        return null;
      }

      const referral = await ProfileReferralModel.findOne({ referralCode });

      if (!referral) {
        logger.warn(`No profile found with referral code: ${referralCode}`);
        return null;
      }

      return referral.profileId;
    } catch (error) {
      logger.error("Error validating referral code:", error);
      // Return null instead of throwing to make this function more resilient
      return null;
    }
  }

  /**
   * Process a new referral
   * @param referredProfileId The profile being referred
   * @param referrerProfileId The profile doing the referring
   * @returns True if successful, false otherwise
   */
  static async processReferral(
    referredProfileId: mongoose.Types.ObjectId | string,
    referrerProfileId: mongoose.Types.ObjectId | string
  ) {
    try {
      // Validate inputs
      if (!referredProfileId || !referrerProfileId) {
        logger.warn("Invalid profile IDs provided for referral processing");
        return false;
      }

      // Ensure we're working with valid ObjectIds
      let referredObjId: mongoose.Types.ObjectId;
      let referrerObjId: mongoose.Types.ObjectId;

      try {
        referredObjId =
          typeof referredProfileId === "string"
            ? new mongoose.Types.ObjectId(referredProfileId)
            : referredProfileId;
        referrerObjId =
          typeof referrerProfileId === "string"
            ? new mongoose.Types.ObjectId(referrerProfileId)
            : referrerProfileId;
      } catch (error) {
        logger.error("Invalid ObjectId format for referral processing:", error);
        return false;
      }

      // Prevent self-referrals
      if (referredObjId.equals(referrerObjId)) {
        logger.warn(
          `Self-referral detected for profile ${referredObjId}, skipping`
        );
        return false;
      }

      // Get or create referral records for both profiles
      const referrerReferral =
        await ProfileReferralModel.findOrCreate(referrerObjId);
      const referredReferral =
        await ProfileReferralModel.findOrCreate(referredObjId);

      if (!referrerReferral || !referredReferral) {
        logger.error("Failed to find or create referral records");
        return false;
      }

      // Set the referredBy field for the referred profile
      referredReferral.referredBy = referrerObjId;
      await referredReferral.save();

      // Add the referred profile to the referrer's list
      await referrerReferral.addReferredProfile(referredObjId);

      logger.info(
        `Processed referral: ${referrerObjId} referred ${referredObjId}`
      );
      return true;
    } catch (error) {
      logger.error("Error processing referral:", error);
      return false;
    }
  }

  /**
   * Check if a profile has reached the MyPts threshold and update referral status
   * @param profileId The profile to check
   * @param threshold The MyPts threshold (default: 1000)
   */
  static async checkThresholdAndUpdateStatus(
    profileId: mongoose.Types.ObjectId | string,
    threshold: number = 1000
  ) {
    try {
      const objId =
        typeof profileId === "string"
          ? new mongoose.Types.ObjectId(profileId)
          : profileId;

      // Get the profile's MyPts balance
      const myPts = await MyPtsModel.findOne({ profileId: objId });

      if (!myPts) return;

      // Check if the profile has reached the threshold
      const hasReachedThreshold = myPts.balance >= threshold;

      if (hasReachedThreshold) {
        // Get the profile's referral record
        const profileReferral = await ProfileReferralModel.findOne({
          profileId: objId,
        });

        if (!profileReferral || !profileReferral.referredBy) return;

        // Get the referring profile's referral record
        const referrerReferral = await ProfileReferralModel.findOne({
          profileId: profileReferral.referredBy,
        });

        if (!referrerReferral) return;

        // Update the referral status
        await referrerReferral.updateReferralStatus(objId, true);

        logger.info(
          `Profile ${objId} has reached the threshold of ${threshold} MyPts`
        );
      }
    } catch (error) {
      logger.error("Error checking threshold and updating status:", error);
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
      const objId =
        typeof profileId === "string"
          ? new mongoose.Types.ObjectId(profileId)
          : profileId;

      const referral = await ProfileReferralModel.findOne({ profileId: objId })
        .populate(
          "referredProfiles.profileId",
          "name profileInformation ProfileFormat"
        )
        .populate("referredBy", "name profileInformation ProfileFormat");

      if (!referral) {
        return {
          referralCode: "",
          totalReferrals: 0,
          successfulReferrals: 0,
          earnedPoints: 0,
          pendingPoints: 0,
          currentMilestoneLevel: 0,
          referredProfiles: [],
          referredBy: null,
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
          thresholdReachedDate: ref.thresholdReachedDate,
        })),
        referredBy: referral.referredBy,
      };
    } catch (error) {
      logger.error("Error getting referral stats:", error);
      throw error;
    }
  }

  /**
   * Get the date range for a time frame
   * @param timeFrame The time frame (all, week, month, year)
   * @returns The start date for the time frame
   */
  private static getTimeFrameDate(timeFrame: LeaderboardTimeFrame): Date | null {
    const now = new Date();

    switch (timeFrame) {
      case LeaderboardTimeFrame.WEEKLY:
        // Get date from 7 days ago
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return weekAgo;

      case LeaderboardTimeFrame.MONTHLY:
        // Get date from 30 days ago
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        return monthAgo;

      case LeaderboardTimeFrame.YEARLY:
        // Get date from 365 days ago
        const yearAgo = new Date();
        yearAgo.setDate(now.getDate() - 365);
        return yearAgo;

      case LeaderboardTimeFrame.ALL_TIME:
      default:
        // No date filter for all-time
        return null;
    }
  }

  /**
   * Get referral leaderboard with time frame filtering
   * @param timeFrame The time frame to filter by (all, week, month, year)
   * @param limit The maximum number of results to return
   * @param page The page number for pagination
   * @returns The leaderboard data
   */
  static async getReferralLeaderboard(
    timeFrame: LeaderboardTimeFrame = LeaderboardTimeFrame.ALL_TIME,
    limit: number = 10,
    page: number = 1
  ) {
    try {
      const skip = (page - 1) * limit;
      const startDate = this.getTimeFrameDate(timeFrame);

      // Build the query based on the time frame
      let query: any = {};

      if (startDate) {
        // For time-based queries, we need to filter referrals that reached the threshold within the time frame
        query = {
          'referredProfiles.thresholdReachedDate': { $gte: startDate }
        };
      }

      // Get the top referrers based on successful referrals
      const leaderboard = await ProfileReferralModel.find(query)
        .sort({ successfulReferrals: -1, totalReferrals: -1, earnedPoints: -1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('profileId', 'name profileImage profileInformation')
        .select('profileId referralCode totalReferrals successfulReferrals currentMilestoneLevel earnedPoints');

      // Count total documents for pagination
      const total = await ProfileReferralModel.countDocuments(query);

      return {
        data: leaderboard.map(entry => ({
          profile: entry.profileId,
          referralCode: entry.referralCode,
          totalReferrals: entry.totalReferrals,
          successfulReferrals: entry.successfulReferrals,
          milestoneLevel: entry.currentMilestoneLevel,
          earnedPoints: entry.earnedPoints
        })),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error("Error getting referral leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get top earners leaderboard with time frame filtering
   * @param timeFrame The time frame to filter by (all, week, month, year)
   * @param limit The maximum number of results to return
   * @param page The page number for pagination
   * @returns The leaderboard data
   */
  static async getTopEarnersLeaderboard(
    timeFrame: LeaderboardTimeFrame = LeaderboardTimeFrame.ALL_TIME,
    limit: number = 10,
    page: number = 1
  ) {
    try {
      const skip = (page - 1) * limit;
      const startDate = this.getTimeFrameDate(timeFrame);

      // Build the query based on the time frame
      let query: any = {};
      let matchStage: any = {};

      if (startDate) {
        // For time-based queries on MyPts, we need to filter transactions within the time frame
        matchStage = {
          'transactions.date': { $gte: startDate },
          'transactions.type': 'EARN_MYPTS' // Only count earned MyPts
        };
      }

      // Use aggregation to get top earners
      const pipeline: any[] = [
        { $match: query },
        {
          $lookup: {
            from: 'mypts',
            localField: 'profileId',
            foreignField: 'profileId',
            as: 'myPtsData'
          }
        },
        { $unwind: '$myPtsData' },
        {
          $lookup: {
            from: 'profiles',
            localField: 'profileId',
            foreignField: '_id',
            as: 'profileData'
          }
        },
        { $unwind: '$profileData' },
        {
          $project: {
            profileId: 1,
            referralCode: 1,
            totalReferrals: 1,
            successfulReferrals: 1,
            currentMilestoneLevel: 1,
            earnedPoints: 1,
            profile: {
              _id: '$profileData._id',
              name: '$profileData.name',
              profileImage: '$profileData.ProfileFormat.profileImage',
              profileInformation: '$profileData.profileInformation'
            },
            myPts: {
              balance: '$myPtsData.balance',
              transactions: '$myPtsData.transactions'
            }
          }
        }
      ];

      // Add match stage for time filtering if needed
      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      // Add sorting, pagination, and projection
      pipeline.push(
        {
          $addFields: {
            // For time-based queries, calculate the sum of earned MyPts within the time frame
            filteredEarnedPoints: {
              $cond: {
                if: { $eq: [timeFrame, LeaderboardTimeFrame.ALL_TIME] },
                then: '$myPts.balance',
                else: {
                  $sum: {
                    $filter: {
                      input: '$myPts.transactions',
                      as: 'tx',
                      cond: {
                        $and: [
                          { $gte: ['$$tx.date', startDate || new Date(0)] },
                          { $eq: ['$$tx.type', 'EARN_MYPTS'] }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        },
        { $sort: { filteredEarnedPoints: -1, successfulReferrals: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            profile: 1,
            referralCode: 1,
            totalReferrals: 1,
            successfulReferrals: 1,
            milestoneLevel: '$currentMilestoneLevel',
            earnedPoints: '$filteredEarnedPoints'
          }
        }
      );

      const leaderboard = await ProfileReferralModel.aggregate(pipeline);

      // Count total documents for pagination (simplified count for performance)
      const total = await ProfileReferralModel.countDocuments(query);

      return {
        data: leaderboard,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error("Error getting top earners leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get the referral tree for a profile
   * @param profileId The profile ID
   * @param depth The depth of the tree to retrieve (default: 2)
   * @returns The referral tree
   */
  static async getReferralTree(
    profileId: mongoose.Types.ObjectId | string,
    depth: number = 2
  ) {
    try {
      const objId =
        typeof profileId === "string"
          ? new mongoose.Types.ObjectId(profileId)
          : profileId;

      const buildTree = async (
        id: mongoose.Types.ObjectId,
        currentDepth: number
      ): Promise<any> => {
        if (currentDepth > depth) return null;

        const referral = await ProfileReferralModel.findOne({ profileId: id });
        if (!referral) return null;

        const profile = await ProfileModel.findById(
          id,
          "name profileInformation ProfileFormat"
        );
        if (!profile) return null;

        const node: {
          profileId: mongoose.Types.ObjectId;
          name: string;
          profileImage?: string;
          profileInformation?: { username: string };
          successfulReferrals: number;
          totalReferrals: number;
          milestoneLevel: number;
          children: any[];
        } = {
          profileId: id,
          name: profile.profileInformation?.username || "Unknown",
          profileImage: profile.ProfileFormat?.profileImage || undefined,
          profileInformation: profile.profileInformation
            ? { username: profile.profileInformation.username }
            : undefined,
          successfulReferrals: referral.successfulReferrals,
          totalReferrals: referral.totalReferrals,
          milestoneLevel: referral.currentMilestoneLevel,
          children: [],
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
      logger.error("Error getting referral tree:", error);
      throw error;
    }
  }
}
