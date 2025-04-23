import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { logger } from '../utils/logger';

/**
 * Middleware to validate request body against a Zod schema
 * @param schema Zod schema to validate against
 */
export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body against schema
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        // Format Zod errors for better readability
        const formattedErrors = result.error.errors.map(error => ({
          path: error.path.join('.'),
          message: error.message
        }));
        
        logger.warn(`Validation failed for ${req.path}:`, formattedErrors);
        
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: formattedErrors
        });
      }
      
      // If validation passes, update req.body with parsed data
      req.body = result.data;
      next();
    } catch (error: any) {
      logger.error(`Validation error: ${error.message}`, { error });
      return res.status(500).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
  };
};
