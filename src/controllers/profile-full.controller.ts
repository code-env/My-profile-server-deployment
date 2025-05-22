import { Request, Response } from 'express';
import { ProfileModel } from '../models/profile.model';
import { User } from '../models/User';
import mongoose from 'mongoose';

/**
 * Get a specific profile and its associated creator/owner info
 * GET /api/profile-full/:profileId
 */
export const getProfileWithOwner = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID' });
    }

    // Find the profile
    const profile = await ProfileModel.findById(profileId).lean();
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Find the creator/owner (by profileInformation.creator)
    let owner = null;
    if (profile.profileInformation && profile.profileInformation.creator) {
      owner = await User.findById(profile.profileInformation.creator).lean();
    }

    return res.status(200).json({
      success: true,
      profile,
      owner
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error instanceof Error ? error.message : error });
  }
};
