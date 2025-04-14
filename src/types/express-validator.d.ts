// Custom type declarations for express-validator
import { Request, Response, NextFunction } from 'express';

declare module 'express-validator' {
  // Add any custom type extensions or additional type definitions here
  export interface ValidationChain {
    // Example of extending existing types
    customValidation?: (value: any) => boolean;
  }

  // Custom validation function type
  export type CustomValidator = (value: any) => boolean | Promise<boolean>;

  // Example of adding a custom validation method
  export function validateRequest(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): void;
}
