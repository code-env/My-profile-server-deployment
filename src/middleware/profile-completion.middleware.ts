import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { IUser } from '../models/User';

/**
 * Middleware to check if user has completed their profile
 * Redirects incomplete social auth users to complete-profile page
 */
export const requireProfileCompletion = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    // Skip check if no user (will be handled by auth middleware)
    if (!user) {
      return next();
    }

    // Skip check for certain routes that should always be accessible
    const exemptPaths = [
      '/auth/update-profile',
      '/auth/logout',
      '/auth/refresh',
      '/auth/user/me',
      '/api/auth/update-profile',
      '/api/auth/logout',
      '/api/auth/refresh',
      '/api/auth/user/me'
    ];

    const isExemptPath = exemptPaths.some(path => req.path.includes(path));
    if (isExemptPath) {
      return next();
    }

    // Check if user has completed their profile
    const isProfileIncomplete = user.isProfileComplete === false ||
                               !user.countryOfResidence ||
                               !user.dateOfBirth;

    // Only enforce for social auth users
    const isSocialAuth = user.signupType && user.signupType !== 'email';

    if (isSocialAuth && isProfileIncomplete) {
      logger.info(`User ${user._id} (${user.email}) has incomplete profile, requiring completion`);

      return res.status(403).json({
        success: false,
        message: 'Profile completion required',
        code: 'PROFILE_INCOMPLETE',
        redirectTo: '/complete-profile',
        missingFields: {
          countryOfResidence: !user.countryOfResidence,
          dateOfBirth: !user.dateOfBirth
        }
      });
    }

    // Profile is complete or user is email-registered, continue
    next();
  } catch (error) {
    logger.error('Error in profile completion middleware:', error);
    // Don't block the request on middleware errors
    next();
  }
};

/**
 * Middleware specifically for API routes that need profile completion
 * Returns JSON response instead of redirect
 */
export const requireProfileCompletionAPI = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      return next();
    }

    const isProfileIncomplete = user.isProfileComplete === false ||
                               !user.countryOfResidence ||
                               !user.dateOfBirth;

    const isSocialAuth = user.signupType && user.signupType !== 'email';

    if (isSocialAuth && isProfileIncomplete) {
      logger.info(`API request blocked for incomplete profile: ${user._id} (${user.email})`);

      return res.status(403).json({
        success: false,
        message: 'Please complete your profile to access this feature',
        code: 'PROFILE_INCOMPLETE',
        redirectTo: '/complete-profile',
        missingFields: {
          countryOfResidence: !user.countryOfResidence,
          dateOfBirth: !user.dateOfBirth
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Error in API profile completion middleware:', error);
    next();
  }
};
