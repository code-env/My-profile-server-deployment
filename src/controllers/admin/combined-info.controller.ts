import { Request, Response } from 'express';
import { User } from '../../models/User';
import { ProfileModel } from '../../models/profile.model';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

/**
 * Controller for combined user and profile information
 * Used primarily for admin interfaces
 */
export class CombinedInfoController {
  /**
   * Get all users with their profiles
   * @route GET /api/admin/combined-info
   */
  static async getAllCombinedInfo(req: Request, res: Response) {
    try {
      // Pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Search parameters
      const search = req.query.search as string;
      const searchQuery = search ? {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
          { referralCode: { $regex: search, $options: 'i' } }
        ]
      } : {};

      // Get users with pagination
      const users = await User.find(
        searchQuery,
        {
          _id: 1,
          email: 1,
          fullName: 1,
          username: 1,
          dateOfBirth: 1,
          countryOfResidence: 1,
          phoneNumber: 1,
          formattedPhoneNumber: 1,
          accountType: 1,
          accountCategory: 1,
          verificationMethod: 1,
          isEmailVerified: 1,
          isPhoneVerified: 1,
          signupType: 1,
          role: 1,
          subscription: 1,
          mpts: 1,
          profileImage: 1,
          profiles: 1,
          referralCode: 1,
          createdAt: 1,
          updatedAt: 1
        }
      )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Get total count for pagination
      const total = await User.countDocuments(searchQuery);

      // Get all profile IDs from the users
      const profileIds = users.flatMap(user => user.profiles || []);

      // Fetch all profiles in one query
      const profiles = await ProfileModel.find(
        { _id: { $in: profileIds } },
        {
          _id: 1,
          secondaryId: 1,
          profileCategory: 1,
          profileType: 1,
          profileInformation: 1,
          ProfileFormat: 1,
          profileLocation: 1,
          verificationStatus: 1,
          ProfileMypts: 1,
          ProfileReferal: 1,
          createdAt: 1,
          updatedAt: 1
        }
      ).lean();

      // Create a map of profiles by ID for quick lookup
      const profileMap = new Map();
      profiles.forEach(profile => {
        profileMap.set(profile._id.toString(), profile);
      });

      // Combine user and profile data
      const combinedData = users.map(user => {
        // Get profiles for this user
        const userProfiles = (user.profiles || [])
          .map((profileId: mongoose.Types.ObjectId) => {
            const profileIdStr = profileId.toString();
            return profileMap.get(profileIdStr) || null;
          })
          .filter(Boolean); // Remove null values

        return {
          user: {
            ...user,
            profiles: user.profiles?.map((id: mongoose.Types.ObjectId) => id.toString())
          },
          profiles: userProfiles
        };
      });

      res.status(200).json({
        success: true,
        data: combinedData,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      logger.error('Error in getAllCombinedInfo:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch combined user and profile data',
        debug: process.env.NODE_ENV === 'development' ? {
          errorType: error.constructor.name,
          errorMessage: error.message,
          stack: error.stack
        } : undefined
      });
    }
  }

  /**
   * Get combined info for a specific user by Profile ID
   * @route GET /api/admin/combined-info/:profileId
   */
  static async getCombinedInfoById(req: Request, res: Response) {
    try {
      const { profileId } = req.params; // Changed from userId to profileId

      // Add debug logging
      logger.info(`[CombinedInfoController] Requested profileId: ${profileId}`);

      // Validate profileId
      if (!mongoose.Types.ObjectId.isValid(profileId)) {
        logger.warn(`[CombinedInfoController] Invalid profileId format: ${profileId}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid profile ID format'
        });
      }

      // Find the profile
      const profile = await ProfileModel.findById(profileId).lean();
      logger.info(`[CombinedInfoController] Profile lookup result for ${profileId}: ${profile ? 'FOUND' : 'NOT FOUND'}`);

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
      }

      // Find the user associated with the profile
      const user = await User.findOne({ profiles: new mongoose.Types.ObjectId(profileId) })
        .select({
          _id: 1,
          email: 1,
          fullName: 1,
          username: 1,
          dateOfBirth: 1,
          countryOfResidence: 1,
          phoneNumber: 1,
          formattedPhoneNumber: 1,
          accountType: 1,
          accountCategory: 1,
          verificationMethod: 1,
          isEmailVerified: 1,
          isPhoneVerified: 1,
          signupType: 1,
          role: 1,
          subscription: 1,
          mpts: 1,
          profileImage: 1,
          referralCode: 1,
          createdAt: 1,
          updatedAt: 1
        })
        .lean();
      logger.info(`[CombinedInfoController] User lookup for profileId ${profileId}: ${user ? 'FOUND' : 'NOT FOUND'}`);

      if (!user) {
        logger.warn(`[CombinedInfoController] No user found with profileId in profiles array: ${profileId}`);
        return res.status(404).json({
          success: false,
          message: `User not found for profile ID: ${profileId}`
        });
      }

      // Get all profiles for this user to ensure consistency
      // Ensure user.profiles is correctly accessed and mapped if it exists
      const profileIdsForUser = user.profiles ? user.profiles.map((id: any) => new mongoose.Types.ObjectId(id)) : [];
      const userProfiles = await ProfileModel.find(
        { _id: { $in: profileIdsForUser } },
        {
          _id: 1,
          secondaryId: 1,
          profileCategory: 1,
          profileType: 1,
          profileInformation: 1,
          ProfileFormat: 1,
          profileLocation: 1,
          verificationStatus: 1,
          ProfileMypts: 1,
          ProfileReferal: 1,
          createdAt: 1,
          updatedAt: 1
        }
      ).lean();

      const combinedData = {
        user: {
          ...user,
          profiles: user.profiles?.map((id: mongoose.Types.ObjectId) => id.toString()) // Ensure this map is safe
        },
        profiles: userProfiles
      };

      res.status(200).json({
        success: true,
        data: combinedData
      });
    } catch (error: any) {
      logger.error('Error in getCombinedInfoById:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch combined user and profile data',
        debug: process.env.NODE_ENV === 'development' ? {
          errorType: error.constructor.name,
          errorMessage: error.message,
          stack: error.stack
        } : undefined
      });
    }
  }
}
