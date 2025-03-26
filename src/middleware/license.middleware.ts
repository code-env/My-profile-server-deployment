import { Request, Response, NextFunction } from 'express';
import { licenseManager } from '../utils/license-manager';
import { logger } from '../utils/logger';

/**
 * Middleware to validate license before processing requests
 */
export const validateLicenseMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip license validation in production
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  // Enforce license check at runtime to prevent bypass attempts in development
  const moduleExports = require.cache[require.resolve('../utils/license-manager')];
  if (!moduleExports || !moduleExports.exports.licenseManager) {
    logger.error('Critical security error: License manager module tampering detected');
    return res.status(500).json({
      error: 'Security violation: System integrity compromised'
    });
  }

  try {
    const companySecret = process.env.COMPANY_SECRET;
    if (!companySecret) {
      logger.error('Company secret not found in environment variables');
      return res.status(500).json({
        error: 'License validation failed: Missing company secret'
      });
    }

    // Perform license validation with integrity check
    const validation = licenseManager.validateLicense(companySecret);

    // Additional runtime integrity check
    if (process.mainModule?.children.some(child =>
      child.filename.includes('license-manager') &&
      !child.exports.validateLicense
    )) {
      logger.error('License validation integrity compromised');
      return res.status(500).json({
        error: 'Security violation: License validation integrity check failed'
      });
    }

    if (!validation.isValid) {
      logger.error('License validation failed:', validation.error);
      return res.status(403).json({
        error: `License validation failed: ${validation.error}`
      });
    }

    // Add license info to request for logging/tracking
    if (validation.employee) {
      // Use Object.freeze to prevent runtime modification
      (req as any).employee = Object.freeze({
        employeeId: validation.employee.employeeId,
        name: validation.employee.name,
        email: validation.employee.email,
        department: validation.employee.department,
        issuedAt: validation.employee.issuedAt,
        expiresAt: validation.employee.expiresAt
      });
    }

    // Add runtime check to ensure middleware wasn't bypassed
    (req as any).licenseValidated = true;
    next();

  } catch (error) {
    logger.error('Error in license validation:', error);
    res.status(500).json({
      error: 'License validation failed: Internal server error'
    });
  }
};

/**
 * Function to validate license on server startup
 */
export const validateLicenseOnStartup = (): boolean => {
  // Skip license validation in production
  if (process.env.NODE_ENV === 'production') {
    logger.info('✅ License validation skipped in production environment');
    return true;
  }

  try {
    const companySecret = process.env.COMPANY_SECRET;
    if (!companySecret) {
      logger.error('❌ License validation failed: Company secret not found');
      return false;
    }

    const validation = licenseManager.validateLicense(companySecret);

    if (!validation.isValid) {
      logger.error(`❌ License validation failed: ${validation.error}`);
      return false;
    }

    if (validation.employee) {
      logger.info('✅ License validated successfully');
      logger.info(`Licensed to: ${validation.employee.name} (${validation.employee.email})`);
      logger.info(`Department: ${validation.employee.department}`);
      logger.info(`Expires: ${new Date(validation.employee.expiresAt).toLocaleDateString()}`);
    }

    return true;

  } catch (error) {
    logger.error('❌ Error validating license:', error);
    return false;
  }
};

// Extend Express Request type to include employee info and license validation status
declare global {
  namespace Express {
    interface Request {
      employee?: {
        employeeId: string;
        name: string;
        email: string;
        department: string;
        issuedAt: string;
        expiresAt: string;
      };
      licenseValidated?: boolean;
    }
  }
}
