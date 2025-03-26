/**
 * @file index.ts
 * @description Central Route Configuration & Management
 * =================================================
 *
 * ----------------
 * - Separation of Concerns: Routes are modularized by domain
 * - Security First: Protected routes enforce authentication
 * - Scalability: Easy addition of new route modules
 * - Maintainability: Clear structure and organization
 *
 * Route Categories:
 * ---------------
 * 1. Public Routes
 *    - Authentication endpoints (login, register, password reset)
 *    - Health checks and public info
 *
 * 2. Protected Routes
 *    - Profile management
 *    - Connection handling
 *    - User-specific operations
 *
 * Security Features:
 * ----------------
 * - JWT authentication via middleware
 * - Role-based access control
 * - Request validation
 *
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * // Adding a new route module:
 * import newFeatureRoutes from './newFeature.routes';
 * app.use('/api/new-feature', protect, newFeatureRoutes);
 */

import { Application } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes'
import profileRoutes from './profile.routes';
import connectionRoutes from './connection.routes';
import logsRoutes from './logs.routes';
import { protect } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleMiddleware';
import { testRoutes } from './test.routes';
import { enforceLicenseValidation } from '../middleware/enforce-license.middleware';

/**
 * Configures and sets up all API routes for the application
 * @param app Express application instance
 * @description Initializes routes with their respective middleware chains
 */
export const setupRoutes = (app: Application): void => {
  // Apply license validation enforcement globally
  app.use(enforceLicenseValidation);

  // Root route - serve landing page
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });

  // Admin logs page
  app.get('/admin/logs', (req, res) => {
    res.sendFile('logs.html', { root: 'public' });
  });

  // Public routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users',userRoutes)

  // Protected routes
  app.use('/api/profiles', protect, profileRoutes);
  app.use('/api/connections', protect, connectionRoutes);
  app.use('/api/logs', logsRoutes);

  // Test routes for advanced tracking (development only)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api', testRoutes);
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Register additional routes here
};
