import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import mongoose from 'mongoose';
import { AnalyticsService } from '../services/analytics.service';
import { logger } from '../utils/logger';
import { emitSocialInteraction } from '../utils/socketEmitter';

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

  // Emit social interaction for profile view (only if user is authenticated and viewing someone else's profile)
  if (user && user._id && ownerId && user._id.toString() !== ownerId.toString()) {
    try {
      setImmediate(async () => {
        await emitSocialInteraction(user._id, {
          type: 'share', // Using 'share' as closest match for profile view
          profile: new mongoose.Types.ObjectId(user.activeProfile || user._id),
          targetProfile: new mongoose.Types.ObjectId(profileId),
          contentId: new mongoose.Types.ObjectId(profileId),
          content: 'viewed profile'
        });
      });
    } catch (error) {
      console.error('Failed to emit social interaction for profile view:', error);
    }
  }

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

  // Emit social interaction for engagement tracking
  if (user._id.toString() !== ownerId.toString()) {
    try {
      setImmediate(async () => {
        await emitSocialInteraction(user._id, {
          type: type as 'like' | 'comment' | 'share' | 'connection',
          profile: new mongoose.Types.ObjectId(user.activeProfile || user._id),
          targetProfile: new mongoose.Types.ObjectId(profileId),
          contentId: new mongoose.Types.ObjectId(profileId),
          content: `${type} engagement${metadata ? `: ${JSON.stringify(metadata)}` : ''}`
        });
      });
    } catch (error) {
      console.error('Failed to emit social interaction for engagement:', error);
    }
  }

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
