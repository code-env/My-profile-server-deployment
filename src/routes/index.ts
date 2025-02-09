/**
 * @file index.ts
 * @description Central Route Configuration & Management
 * =================================================
 *
 * Core routing module that orchestrates all API endpoints and their middleware chains.
 * This module serves as the central hub for route registration and organization,
 * implementing a modular approach to route management.
 *
 * Design Principles:
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
import profileRoutes from './profile.routes';
import connectionRoutes from './connection.routes';
import { protect } from '../middleware/auth.middleware';

/**
 * Configures and sets up all API routes for the application
 * @param app Express application instance
 * @description Initializes routes with their respective middleware chains
 */
export const setupRoutes = (app: Application): void => {
  // Root route - serve landing page
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });

  // Public routes
  app.use('/api/auth', authRoutes);

  // Protected routes
  app.use('/api/profiles', protect, profileRoutes);
  app.use('/api/connections', protect, connectionRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Register additional routes here
};
