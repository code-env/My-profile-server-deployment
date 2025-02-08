import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { TokenPayload } from '../types/auth.types';
import { IUser, User } from '../models/User';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: User ;
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
    logger.debug('Processing authentication token');

    if (!token) {
      logger.warn('Authentication failed: No token provided');
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload;

    if (!decoded.userId) {
      logger.warn('Authentication failed: Invalid token payload');
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token'
      });
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      logger.error(`User not found for ID: ${decoded.userId}`);
      return res.status(401).json({
        status: 'error',
        message: 'User no longer exists'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error: unknown) {
  if (error instanceof jwt.JsonWebTokenError) {
    logger.warn('Invalid token:', error.message);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error during authentication'
    });
  }
};

const extractToken = (req: Request): string | null => {
  // Check cookies first
  const token = req.cookies.accesstoken ||
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

    const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
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
