import { Request, Response, NextFunction } from 'express';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';

export const attachProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Find the user's primary profile
    // Check if a specific profile is requested
    const requestedProfileId = req.query.profileId || req.header('X-Profile-Id');

    if (requestedProfileId) {
      // First try to find the profile directly
      let requestedProfile = await ProfileModel.findOne({
        _id: requestedProfileId,
        'profileInformation.creator': (req.user as any)._id
      });

      // If not found, check if the requestedProfileId is actually a user ID
      if (!requestedProfile) {
        logger.info(`Profile not found directly. Checking if ${requestedProfileId} is a user ID...`);

        // Check if the requestedProfileId matches the user's ID
        if (requestedProfileId === (req.user as any)._id.toString()) {
          logger.info(`ProfileId matches userId. Looking for user's profiles...`);

          // Find the user's profiles
          const userProfiles = await ProfileModel.find({
            'profileInformation.creator': (req.user as any)._id
          }).sort({ createdAt: 1 }); // Get oldest profile first

          if (userProfiles && userProfiles.length > 0) {
            // Use the first profile
            requestedProfile = userProfiles[0];
            logger.info(`Using user's first profile: ${requestedProfile._id}`);
          }
        }
      }

      if (!requestedProfile) {
        return res.status(404).json({
          success: false,
          message: 'Requested profile not found or not owned by user'
        });
      }

      req.profile = requestedProfile as any;
      return next();
    }

    // If no specific profile requested, find user's profiles
    const profiles = await ProfileModel.find({
      'profileInformation.creator': (req.user as any)._id,
    }).sort({ createdAt: 1 }); // Get oldest profile first

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No profiles found for user'
      });
    }

    // First try to find an individual profile
    const profile = profiles.find(p => p.profileCategory?.toLowerCase() === 'individual') ||
                   profiles[0]; // If no individual profile, use the first profile


    // Attach profile to request
    req.profile = profile as any;
    next();
  } catch (error) {
    logger.error('Profile authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during profile authentication'
    });
  }
};
