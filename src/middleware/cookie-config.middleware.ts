/**
 * Cookie Configuration Middleware
 *
 * This middleware ensures that cookies are properly configured for cross-domain usage
 * in production environments. It specifically addresses the SameSite=None requirement
 * for cross-site cookie usage.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware to configure cookies for cross-domain usage
 *
 * This middleware adds a hook before each response to ensure
 * that Set-Cookie headers are properly configured with SameSite=None and Secure=true
 * in production environments.
 */
export const configureCookiesMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  // Store the original setHeader function
  const originalSetHeader = res.setHeader;

  // Override the setHeader function to modify Set-Cookie headers
  res.setHeader = function(name: string, value: any) {
    // Only modify Set-Cookie headers in production
    if (name === 'Set-Cookie' && process.env.NODE_ENV === 'production') {
      // Ensure value is an array
      const cookies = Array.isArray(value) ? value : [value];

      // Modify each cookie to include SameSite=None; Secure
      const modifiedCookies = cookies.map(cookie => {
        if (typeof cookie === 'string' && !cookie.includes('SameSite=None')) {
          // Add SameSite=None and Secure attributes if not already present
          const secureAdded = cookie.includes('Secure') ? cookie : `${cookie}; Secure`;
          const sameSiteAdded = `${secureAdded}; SameSite=None`;
          logger.debug(`Modified cookie: ${sameSiteAdded}`);
          return sameSiteAdded;
        }
        return cookie;
      });

      // Call the original function with the modified cookies
      return originalSetHeader.call(this, name, modifiedCookies);
    }

    // For all other headers, use the original function
    return originalSetHeader.call(this, name, value);
  };

  next();
};
