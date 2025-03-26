import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware to enforce that license validation has occurred
 * This prevents direct access to routes by bypassing the license middleware
 */
export const enforceLicenseValidation = (req: Request, res: Response, next: NextFunction) => {
  if (!req.licenseValidated) {
    logger.error('License validation bypass attempt detected');
    return res.status(403).json({
      error: 'Security violation: License validation required'
    });
  }
  next();
};
