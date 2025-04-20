import { Request, Response, NextFunction } from 'express';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

/**
 * Middleware to authenticate requests using a profile access token
 * This allows API access to specific profiles without requiring user authentication
 */
export const authenticateProfileToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    // Extract token from Authorization header or query parameter
    const token =
      req.header('X-Profile-Token') ||
      req.header('Authorization')?.replace('Profile-Token ', '') ||
      req.query.profile_token as string;

    if (!token) {
      logger.warn('Profile token authentication failed: No token provided');
      return res.status(401).json({
        status: 'error',
        message: 'Profile authentication required'
      });
    }

    let decodedToken;
    try {
      // Verify the JWT token
      decodedToken = (jwt as any).verify(token, config.JWT_SECRET) as { profileId: string, type: string };

      // Ensure it's a profile access token
      if (decodedToken.type !== 'profile_access' || !decodedToken.profileId) {
        logger.warn('Profile token authentication failed: Invalid token type');
        return res.status(401).json({
          status: 'error',
          message: 'Invalid profile access token'
        });
      }
    } catch (jwtError) {
      logger.warn('Profile token authentication failed: JWT verification error', jwtError);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid profile access token'
      });
    }

    // Find the profile using the decoded profile ID
    const profile = await ProfileModel.findById(decodedToken.profileId);

    if (!profile) {
      logger.warn(`Profile token authentication failed: Profile not found for ID ${decodedToken.profileId}`);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid profile access token'
      });
    }

    // Verify that the token matches the one stored in the profile
    if (profile.accessToken !== token) {
      logger.warn(`Profile token authentication failed: Token mismatch for profile ${decodedToken.profileId}`);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid profile access token'
      });
    }

    // Attach profile to request for later use
    req.profile = profile;

    logger.info(`Profile authenticated via access token: ${profile._id}`);
    next();
  } catch (error) {
    logger.error('Profile token authentication error:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error during profile authentication'
    });
  }
};

/**
 * Middleware to optionally authenticate using a profile access token
 * If token is provided and valid, attaches profile to request
 * If token is invalid or not provided, continues without error
 */
export const optionalProfileTokenAuth = async (
  req: Request,
  _res: Response, // Unused parameter prefixed with underscore
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header or query parameter
    const token =
      req.header('X-Profile-Token') ||
      req.header('Authorization')?.replace('Profile-Token ', '') ||
      req.query.profile_token as string;

    if (!token) {
      return next();
    }

    let decodedToken;
    try {
      // Verify the JWT token
      decodedToken = (jwt as any).verify(token, config.JWT_SECRET) as { profileId: string, type: string };

      // Ensure it's a profile access token
      if (decodedToken.type !== 'profile_access' || !decodedToken.profileId) {
        return next();
      }
    } catch (jwtError) {
      // If token verification fails, continue without setting profile
      logger.debug('Optional profile token authentication failed: JWT verification error', jwtError);
      return next();
    }

    // Find the profile using the decoded profile ID
    const profile = await ProfileModel.findById(decodedToken.profileId);

    if (profile) {
      // Attach profile to request for later use
      req.profile = profile;
      logger.debug(`Profile optionally authenticated via access token: ${profile._id}`);
    }

    next();
  } catch (error) {
    // If any other error occurs, continue without setting profile
    logger.warn('Optional profile token authentication failed:', error);
    next();
  }
};
