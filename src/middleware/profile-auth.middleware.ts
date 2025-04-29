import { Request, Response, NextFunction } from 'express';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { Document } from 'mongoose';
import { IProfile } from '../interfaces/profile.interface';

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
      const requestedProfile = await ProfileModel.findOne({
        _id: requestedProfileId,
        owner: (req.user as any)._id
      });

      if (!requestedProfile) {
        return res.status(404).json({
          success: false,
          message: 'Requested profile not found or not owned by user'
        });
      }

      req.profile = requestedProfile;
      return next();
    }

    // If no specific profile requested, find user's profiles
    const profiles = await ProfileModel.find({
      owner: (req.user as any)._id,
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
    req.profile = profile;
    next();
  } catch (error) {
    logger.error('Profile authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during profile authentication'
    });
  }
};
