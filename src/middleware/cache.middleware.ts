import { Request, Response, NextFunction } from 'express';

/**
 * Cache middleware to prevent frequent refetching of the same data
 * @param duration Cache duration in seconds
 */
export const cache = (duration: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set cache headers
    res.setHeader('Cache-Control', `public, max-age=${duration}`);
    res.setHeader('Expires', new Date(Date.now() + duration * 1000).toUTCString());

    next();
  };
};
