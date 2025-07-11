// validation.ts
// Middleware for validating incoming requests using express-validator.
// This middleware checks for validation errors and returns a 400 response if any are found.

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Middleware function to validate incoming requests.
 * 
 * This middleware uses express-validator to check for validation errors in the request.
 * If any errors are found, it returns a 400 response with the error details.
 * Otherwise, it calls the next middleware function in the chain.
 * 
 * @param req - The request object.
 * @param res - The response object.
 * @param next - The next middleware function.
 * @returns {void}
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
    /**
     * Get the validation errors from the request.
     * 
     * The validationResult function from express-validator returns an object containing the validation errors.
     */
    const errors = validationResult(req);
    
    /**
     * Check if there are any validation errors.
     * 
     * If there are errors, return a 400 response with the error details.
     */
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    /**
     * If there are no validation errors, call the next middleware function.
     */
    next();
};

