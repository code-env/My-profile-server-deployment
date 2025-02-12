import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

export const configureSecurityHeaders = () => {
  return [
    // Configure helmet with relaxed CSP for development
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"]
        }
      }
    }),

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
        "style-src 'self' 'unsafe-inline' https: https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' https: https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
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
