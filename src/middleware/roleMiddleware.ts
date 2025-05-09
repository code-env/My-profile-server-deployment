import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../utils/errors';
import { User } from '../models/User';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';
import { Role } from '../types';

export const requireRole = (roles: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      // const user = {
      //     "_id":"67deb94fd0eac9122a27148b",
      //     "role":"user",
      //     "token":"dfudiufhdifuhdiu.ggndiufdhiufhidf.dffdjhbdjhbj"
      //   }


      if (!user) {
        throw new CustomError('UNAUTHORIZED', 'Authentication required');
      }

      // Default to 'user' role if none is specified
      const userRole = user.role || 'user';

      if (!roles.includes(userRole as Role)) {
        logger.error(`Role verification failed: User role '${userRole}' not in allowed roles [${roles.join(', ')}]`);
        throw new CustomError('FORBIDDEN', 'Insufficient permissions');
      }

      next();
    } catch (error) {
      logger.error('Role verification error:', error);
      res.status(error instanceof CustomError ? 403 : 500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Permission denied'
      });
    }
  };
};

export const checkProfileOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;

    const profileId = req.params.id;

    if (!profileId) {
      throw new CustomError('BAD_REQUEST', 'Profile ID is required');
    }

    // Superadmin can access all profiles
    if (user.role === 'superadmin') {
      return next();
    }

    // For other users, check if they own or manage the profile
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      throw new CustomError('NOT_FOUND', 'Profile not found');
    }

    // Check if user is the creator of the profile
    const isOwner = profile.profileInformation?.creator?.toString() === user._id.toString();

    // Check if user is a manager of the profile (if managers array exists)
    // In the new model, managers might be stored in a different location
    // For now, we'll assume there are no managers in the new model
    const isManager = false;

    const isAdmin = user.role === 'admin';

    if (!isOwner && !isManager && !isAdmin) {
      logger.error(`Profile access denied: User ${user._id} attempted to access profile ${profileId}`);
      throw new CustomError('FORBIDDEN', 'You do not have permission to access this profile');
    }

    // Attach profile to request for later use
    // Use type assertion to avoid type compatibility issues
    req.profile = profile as any;
    next();
  } catch (error) {
    logger.error('Profile ownership verification error:', error);
    res.status(error instanceof CustomError ? 403 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Permission denied'
    });
  }
};

export const updateUserToAdmin = async (userId: string) => {
  try {
    const user = await User.findById(userId);
    if (user && user.profiles.length > 1 && user.role === 'user') {
      user.role = 'admin';
      await user.save();
      logger.info(`User ${user.email} promoted to admin due to multiple profiles`);
    }
  } catch (error) {
    logger.error('Error updating user role:', error);
  }
};
