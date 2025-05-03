import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProfileReferralModel } from '../models/profile-referral.model';
import { ProfileReferralService } from '../services/profile-referral.service';
import { logger } from '../utils/logger';

export class ProfileReferralController {
  /**
   * Initialize referral code for the authenticated profile
   * @route POST /api/referrals/initialize
   */
  static async initializeReferralCode(req: Request, res: Response) {
    try {
      const profile = req.profile as any;
      
      if (!profile) {
        return res.status(401).json({
          success: false,
          message: 'Profile not authenticated'
        });
      }
      
      // Get profile ID from request or query parameter
      const profileId = profile._id || req.query.profileId;
      
      if (!profileId) {
        return res.status(400).json({
          success: false,
          message: 'Profile ID is required'
        });
      }
      
      logger.info(`Initializing referral code for profile: ${profileId}`);
      const referral = await ProfileReferralService.initializeReferralCode(profileId);
      
      return res.status(200).json({
        success: true,
        data: {
          referralCode: referral.referralCode,
          profileId: profileId
        }
      });
    } catch (error: any) {
      logger.error('Error initializing referral code:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize referral code'
      });
    }
  }

  /**
   * Get referral information for the authenticated profile
   * @route GET /api/referrals
   */
  static async getReferralInfo(req: Request, res: Response) {
    try {
      const profile = req.profile as any;
      
      if (!profile) {
        return res.status(401).json({
          success: false,
          message: 'Profile not authenticated'
        });
      }
      
      const referralStats = await ProfileReferralService.getReferralStats(profile._id);
      
      return res.status(200).json({
        success: true,
        data: referralStats
      });
    } catch (error: any) {
      logger.error('Error getting referral info:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get referral information'
      });
    }
  }

  /**
   * Get referral tree for the authenticated profile
   * @route GET /api/referrals/tree
   */
  static async getReferralTree(req: Request, res: Response) {
    try {
      const profile = req.profile as any;
      
      if (!profile) {
        return res.status(401).json({
          success: false,
          message: 'Profile not authenticated'
        });
      }
      
      const depth = req.query.depth ? parseInt(req.query.depth as string) : 2;
      const referralTree = await ProfileReferralService.getReferralTree(profile._id, depth);
      
      return res.status(200).json({
        success: true,
        data: referralTree
      });
    } catch (error: any) {
      logger.error('Error getting referral tree:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get referral tree'
      });
    }
  }

  /**
   * Validate a referral code
   * @route POST /api/referrals/validate
   */
  static async validateReferralCode(req: Request, res: Response) {
    try {
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({
          success: false,
          message: 'Referral code is required'
        });
      }
      
      try {
        const referringProfileId = await ProfileReferralService.validateReferralCode(referralCode);
        
        return res.status(200).json({
          success: true,
          data: {
            valid: true,
            referringProfileId
          }
        });
      } catch (error) {
        return res.status(200).json({
          success: true,
          data: {
            valid: false
          }
        });
      }
    } catch (error: any) {
      logger.error('Error validating referral code:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to validate referral code'
      });
    }
  }

  /**
   * Get leaderboard of top referrers
   * @route GET /api/referrals/leaderboard
   */
  static async getReferralLeaderboard(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Get the authenticated profile if available (optional)
      const profile = req.profile as any;
      const profileId = profile?._id;
      
      // First, get the top referrers
      let leaderboard = await ProfileReferralModel.find()
        .sort({ successfulReferrals: -1, totalReferrals: -1, earnedPoints: -1 })
        .limit(limit)
        .populate('profileId', 'name profileImage')
        .select('profileId referralCode totalReferrals successfulReferrals currentMilestoneLevel earnedPoints');
      
      // If we have fewer results than the limit, get more profiles to fill the leaderboard
      if (leaderboard.length < limit) {
        const existingIds = leaderboard.map(entry => entry.profileId?._id?.toString()).filter(Boolean);
        
        // Get additional profiles that aren't already in the leaderboard
        const additionalProfiles = await ProfileReferralModel.find({
          profileId: { $nin: existingIds }
        })
          .sort({ createdAt: -1 }) // Sort by newest first
          .limit(limit - leaderboard.length)
          .populate('profileId', 'name profileImage')
          .select('profileId referralCode totalReferrals successfulReferrals currentMilestoneLevel earnedPoints');
        
        leaderboard = [...leaderboard, ...additionalProfiles];
      }
      
      // If the user is authenticated but their profile isn't in the leaderboard,
      // fetch their position and add it to the response
      let userPosition = null;
      if (profileId) {
        const userReferral = await ProfileReferralModel.findOne({ profileId });
        
        if (userReferral) {
          // Check if user is already in the leaderboard
          const isInLeaderboard = leaderboard.some(
            entry => entry.profileId?._id?.toString() === profileId.toString()
          );
          
          if (!isInLeaderboard) {
            // Count how many profiles have more successful referrals
            const betterProfiles = await ProfileReferralModel.countDocuments({
              $or: [
                { successfulReferrals: { $gt: userReferral.successfulReferrals } },
                {
                  successfulReferrals: userReferral.successfulReferrals,
                  totalReferrals: { $gt: userReferral.totalReferrals }
                },
                {
                  successfulReferrals: userReferral.successfulReferrals,
                  totalReferrals: userReferral.totalReferrals,
                  earnedPoints: { $gt: userReferral.earnedPoints }
                }
              ]
            });
            
            userPosition = {
              rank: betterProfiles + 1,
              profile: userReferral.profileId,
              referralCode: userReferral.referralCode,
              totalReferrals: userReferral.totalReferrals,
              successfulReferrals: userReferral.successfulReferrals,
              milestoneLevel: userReferral.currentMilestoneLevel,
              earnedPoints: userReferral.earnedPoints
            };
          }
        }
      }
      
      return res.status(200).json({
        success: true,
        data: leaderboard.map(entry => ({
          profile: entry.profileId,
          referralCode: entry.referralCode,
          totalReferrals: entry.totalReferrals,
          successfulReferrals: entry.successfulReferrals,
          milestoneLevel: entry.currentMilestoneLevel,
          earnedPoints: entry.earnedPoints
        })),
        userPosition
      });
    } catch (error: any) {
      logger.error('Error getting referral leaderboard:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get referral leaderboard'
      });
    }
  }

  /**
   * Generate a shareable referral link
   * @route GET /api/referrals/share-link
   */
  static async getShareableLink(req: Request, res: Response) {
    try {
      const profile = req.profile as any;
      
      if (!profile) {
        return res.status(401).json({
          success: false,
          message: 'Profile not authenticated'
        });
      }
      
      const referral = await ProfileReferralService.getProfileReferral(profile._id);
      const baseUrl = process.env.FRONTEND_URL || 'https://mypts.com';
      const shareableLink = `${baseUrl}/register?ref=${referral.referralCode}`;
      
      return res.status(200).json({
        success: true,
        data: {
          referralCode: referral.referralCode,
          shareableLink
        }
      });
    } catch (error: any) {
      logger.error('Error generating shareable link:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate shareable link'
      });
    }
  }
}
