/**
 * @fileoverview Central route configuration
 * Sets up all API routes with proper middleware and validation
 */

import { Application } from 'express';
import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';
import connectionRoutes from './connection.routes';
import { protect } from '../middleware/auth.middleware';

export const setupRoutes = (app: Application): void => {
  // Public routes
  app.use('/api/auth', authRoutes);

  // Protected routes
  app.use('/api/profiles', protect, profileRoutes);
  app.use('/api/connections', protect, connectionRoutes);

  // Register additional routes here
};
