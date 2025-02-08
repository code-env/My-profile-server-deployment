import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

export const configureSecurityHeaders = () => {
  return [
    // Basic security headers
    helmet(),
    
    // Custom security headers
    (req: Request, res: Response, next: NextFunction) => {
      // Strict Transport Security
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );

      // Content Security Policy
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self'; " +
        "frame-ancestors 'none'; " +
        "form-action 'self'"
      );

      // Permissions Policy
      res.setHeader(
        'Permissions-Policy',
        'geolocation=(), camera=(), microphone=(), payment=()'
      );

      // Cross-Origin Policies
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

      next();
    }
  ];
};
