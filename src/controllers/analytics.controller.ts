import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import mongoose from 'mongoose';
import { AnalyticsService } from '../services/analytics.service';
import { logger } from '../utils/logger';

const analyticsService = new AnalyticsService();

// @desc    Track profile view
// @route   POST /api/analytics/profiles/:id/view
// @access  Private
export const trackProfileView = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user;
  const { id: profileId } = req.params;
  const { ownerId } = req.body;

  const analytics = await analyticsService.trackProfileView(
    new mongoose.Types.ObjectId(profileId),
    ownerId,
    user?._id,
    req.headers['user-agent'],
    req.ip
  );

  res.json(analytics);
});

// @desc    Track profile engagement
// @route   POST /api/analytics/profiles/:id/engage
// @access  Private
export const trackEngagement = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { id: profileId } = req.params;
  const { ownerId, type, metadata } = req.body;

  if (!['like', 'comment', 'share', 'download', 'connect', 'message'].includes(type)) {
    throw createHttpError(400, 'Invalid engagement type');
  }

  const analytics = await analyticsService.trackEngagement(
    new mongoose.Types.ObjectId(profileId),
    ownerId,
    user._id,
    type,
    metadata
  );

  res.json(analytics);
});

// @desc    Get profile analytics
// @route   GET /api/analytics/profiles/:id
// @access  Private
export const getProfileAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { id: profileId } = req.params;
  const { period } = req.query;

  // Validate period
  if (period && !['day', 'week', 'month', 'year'].includes(period as string)) {
    throw createHttpError(400, 'Invalid period specified');
  }

  const analytics = await analyticsService.getProfileAnalytics(
    new mongoose.Types.ObjectId(profileId),
    period as 'day' | 'week' | 'month' | 'year'
  );

  if (!analytics) {
    throw createHttpError(404, 'Analytics not found for this profile');
  }

  res.json(analytics);
});

// @desc    Get user's profiles analytics
// @route   GET /api/analytics/user
// @access  Private
export const getUserAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;

  const analytics = await analyticsService.getUserAnalytics(user._id);

  res.json(analytics);
});
