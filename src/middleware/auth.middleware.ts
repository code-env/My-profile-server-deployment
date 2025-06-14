import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { TokenPayload } from '../types/auth.types';
import { IUser, User } from '../models/User';
import { logger } from '../utils/logger';



declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Verify token
    const decoded = (jwt as any).verify(token, config.JWT_SECRET) as TokenPayload;

    // Find user and check if session exists
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      logger.error(`User not found for ID: ${decoded.userId}`);
      return res.status(401).json({
        status: 'error',
        message: 'User no longer exists'
      });
    }

    // // Check if session exists in database
    // const sessionExists = user.sessions?.some(session => session.refreshToken === token);
    // if (!sessionExists) {
    //   logger.warn('Authentication failed: Session not found in database');
    //   return res.status(401).json({
    //     status: 'error',
    //     message: 'Session not found'
    //   });
    // }

    // Check if token is expired
    // if (decoded.exp && decoded.exp < Date.now() / 1000) {
    //   logger.warn('Authentication failed: Token expired');
    //   return res.status(401).json({
    //     status: 'error',
    //     message: 'Token expired'
    //   });
    // }

    if (!decoded.userId) {
      logger.warn('Authentication failed: Invalid token payload');
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token'
      });
    }

    // Check for admin role in headers or cookies
    const adminRoleHeader = req.header('X-User-Role');
    const adminCookie = req.cookies['X-User-Role'];
    const isAdminHeader = req.header('X-User-Is-Admin');
    const isAdminCookie = req.cookies['X-User-Is-Admin'];

    // If admin role is indicated in headers or cookies, ensure it's set in the user object
    if (
      (adminRoleHeader === 'admin' || adminCookie === 'admin') ||
      (isAdminHeader === 'true' || isAdminCookie === 'true')
    ) {
      // Only set admin role if the user actually has it in the database
      if (user.role === 'admin') {
        // logger.info(`Admin access granted for user ${user._id}`);
      } else {
        // logger.warn(`Admin role requested but not authorized for user ${user._id}`);
      }
    }

    // Ensure the user object has the role property from the database
    if (!user.role && (user as any)._doc && (user as any)._doc.role) {
      user.role = (user as any)._doc.role;
    }

    req.user = user;
    req.token = token;
    // console.log("protected")
    next();
  } catch (error: unknown) {
  if (error instanceof Error && error.name === 'JsonWebTokenError') {
    logger.warn('Invalid token:', error.message);
    return res.status(401).json({
      status: 'error',
      message: 'Invalid authentication token'
    });
  }

  logger.error('Authentication error:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error during authentication'
    });
  }
};

const extractToken = (req: Request): string | null => {
  // Check cookies first
  const token = req.cookies.accessToken || req.cookies.accesstoken ||
                // Then check Authorization header
                req.header('Authorization')?.replace('Bearer ', '') ||
                // Finally check query parameter
                req.query.token as string;

  return token || null;
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const decoded = (jwt as any).verify(token, config.JWT_SECRET) as TokenPayload;
    const user = await User.findById(decoded.userId);

    if (user) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without setting user
    next();
  }
};

export const requireRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {

    const user:any = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    next();
  };
};
