import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { GamificationService } from '../services/gamification.service';
import { ActivityTrackingService } from '../services/activity-tracking.service';
import { LeaderboardService } from '../services/leaderboard.service';
import { AnalyticsDashboardService } from '../services/analytics-dashboard.service';
import { BadgeCategory, BadgeRarity, MilestoneLevel } from '../interfaces/gamification.interface';
import { logger } from '../utils/logger';

// Initialize services
const gamificationService = new GamificationService();
const activityTrackingService = new ActivityTrackingService();
const leaderboardService = new LeaderboardService();
const analyticsDashboardService = new AnalyticsDashboardService();

/**
 * Badge Controllers
 */

export const createBadge = async (req: Request, res: Response) => {
  try {
    const badgeData = req.body;

    // Validate badge data
    if (!badgeData.name || !badgeData.description || !badgeData.category || !badgeData.rarity || !badgeData.icon) {
      return res.status(400).json({
        success: false,
        message: 'Missing required badge fields'
      });
    }

    // Create badge
    const badge = await gamificationService.createBadge(badgeData);

    res.status(201).json({
      success: true,
      data: badge
    });
  } catch (error) {
    logger.error('Error creating badge:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create badge'
    });
  }
};

export const getAllBadges = async (req: Request, res: Response) => {
  try {
    const badges = await gamificationService.getAllBadges();

    res.json({
      success: true,
      data: badges
    });
  } catch (error) {
    logger.error('Error getting badges:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get badges'
    });
  }
};

export const getBadgesByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;

    // Validate category
    if (!Object.values(BadgeCategory).includes(category as BadgeCategory)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid badge category'
      });
    }

    const badges = await gamificationService.getBadgesByCategory(category as BadgeCategory);

    res.json({
      success: true,
      data: badges
    });
  } catch (error) {
    logger.error('Error getting badges by category:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get badges'
    });
  }
};

export const updateBadge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const badge = await gamificationService.updateBadge(id, updateData);

    if (!badge) {
      return res.status(404).json({
        success: false,
        message: 'Badge not found'
      });
    }

    res.json({
      success: true,
      data: badge
    });
  } catch (error) {
    logger.error('Error updating badge:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update badge'
    });
  }
};

export const deleteBadge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await gamificationService.deleteBadge(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Badge not found'
      });
    }

    res.json({
      success: true,
      message: 'Badge deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting badge:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete badge'
    });
  }
};

/**
 * Profile Badge Controllers
 */

export const getProfileBadges = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const badges = await gamificationService.getProfileBadges(profileId);

    res.json({
      success: true,
      data: badges
    });
  } catch (error) {
    logger.error('Error getting profile badges:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get profile badges'
    });
  }
};

export const awardBadge = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { badgeId } = req.body;

    if (!badgeId) {
      return res.status(400).json({
        success: false,
        message: 'Badge ID is required'
      });
    }

    const result = await gamificationService.awardBadge(profileId, badgeId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error awarding badge:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to award badge'
    });
  }
};

/**
 * Milestone Controllers
 */

export const getProfileMilestone = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const milestone = await gamificationService.getProfileMilestone(profileId);

    res.json({
      success: true,
      data: milestone
    });
  } catch (error) {
    logger.error('Error getting profile milestone:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get profile milestone'
    });
  }
};

/**
 * Leaderboard Controllers
 */

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;

    const leaderboard = await leaderboardService.getTopEntries(parseInt(limit as string));

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get leaderboard'
    });
  }
};

export const getLeaderboardByMilestone = async (req: Request, res: Response) => {
  try {
    const { milestone } = req.params;
    const { limit = '100' } = req.query;

    // Validate milestone
    if (!Object.values(MilestoneLevel).includes(milestone as MilestoneLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone level'
      });
    }

    const leaderboard = await leaderboardService.getEntriesByMilestone(
      milestone as MilestoneLevel,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    logger.error('Error getting leaderboard by milestone:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get leaderboard'
    });
  }
};

export const getProfileRank = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const rank = await leaderboardService.getProfileRank(profileId);

    if (!rank) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found on leaderboard'
      });
    }

    res.json({
      success: true,
      data: rank
    });
  } catch (error) {
    logger.error('Error getting profile rank:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get profile rank'
    });
  }
};

export const updateLeaderboard = async (req: Request, res: Response) => {
  try {
    await leaderboardService.updateLeaderboard();

    res.json({
      success: true,
      message: 'Leaderboard updated successfully'
    });
  } catch (error) {
    logger.error('Error updating leaderboard:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update leaderboard'
    });
  }
};

/**
 * Activity Tracking Controllers
 */

export const trackActivity = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { activityType, metadata } = req.body;

    if (!activityType) {
      return res.status(400).json({
        success: false,
        message: 'Activity type is required'
      });
    }

    const result = await activityTrackingService.trackActivity(
      profileId,
      activityType,
      metadata
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error tracking activity:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to track activity'
    });
  }
};

export const getRecentActivities = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { limit = '20' } = req.query;

    const activities = await activityTrackingService.getRecentActivities(
      profileId,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    logger.error('Error getting recent activities:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get recent activities'
    });
  }
};

export const getActivityStatistics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const statistics = await activityTrackingService.getActivityStatistics(profileId);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Error getting activity statistics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get activity statistics'
    });
  }
};
