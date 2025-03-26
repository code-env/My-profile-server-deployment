import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { CustomError } from '../utils/errors';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies.accesstoken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new CustomError('UNAUTHORIZED', 'Authentication required');
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new CustomError('UNAUTHORIZED', 'User not found');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Invalid token' });
    } else {
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Authentication failed'
      });
    }
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies.accesstoken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      // If no token, continue without authentication
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;

    // Find user
    const user = await User.findById(decoded.userId);

    if (user) {
      // If user found, attach to request
      req.user = user;
    }

    next();
  } catch (error) {
    // If token verification fails, continue without authentication
    logger.warn('Optional authentication failed:', error);
    next();
  }
};

export const verifyOTP = async (req: Request, res: Response, next: NextFunction) => {
  const reqUSer:any = req.user;
  try {
    const { otp } = req.body;
    const user = await User.findById(reqUSer?._id);

    if (!user) {
      throw new CustomError('NOT_FOUND', 'User not found');
    }

    // Check if OTP exists and hasn't expired
    if (!user.verificationData?.otp || !user.verificationData?.otpExpiry) {
      throw new CustomError('INVALID_OTP', 'No OTP verification in progress');
    }

    // Check if OTP has expired
    if (new Date() > new Date(user.verificationData.otpExpiry)) {
      throw new CustomError('EXPIRED_OTP', 'OTP has expired');
    }

    // Verify OTP
    if (user.verificationData.otp !== otp) {
      // Increment attempts
      user.verificationData.attempts = (user.verificationData.attempts || 0) + 1;
      await user.save();

      if (user.verificationData.attempts >= 3) {
        // Reset OTP after 3 failed attempts
        user.verificationData.otp = undefined;
        user.verificationData.otpExpiry = undefined;
        await user.save();
        throw new CustomError('MAX_ATTEMPTS', 'Maximum OTP attempts reached. Please request a new OTP.');
      }

      throw new CustomError('INVALID_OTP', 'Invalid OTP');
    }

    // Mark verification as complete based on method
    if (user.verificationMethod === 'EMAIL') {
      user.isEmailVerified = true;
    } else if (user.verificationMethod === 'PHONE') {
      user.isPhoneVerified = true;
    }

    // Clear OTP data after successful verification
    user.verificationData.otp = undefined;
    user.verificationData.otpExpiry = undefined;
    user.verificationData.attempts = 0;
    await user.save();

    next();
  } catch (error) {
    logger.error('OTP verification error:', error);
    res.status(error instanceof CustomError ? 400 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'OTP verification failed'
    });
  }
};

export const requireVerified = async (req: Request, res: Response, next: NextFunction) => {

  try {
    const userre:any = req.user;
    const user:any = await User.findById(userre?._id);

    if (!user) {
      throw new CustomError('NOT_FOUND', 'User not found');
    }

    if (!user.isEmailVerified && !user.isPhoneVerified) {
      throw new CustomError('UNVERIFIED', 'Account verification required');
    }

    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: error instanceof Error ? error.message : 'Verification required'
    });
  }
};
