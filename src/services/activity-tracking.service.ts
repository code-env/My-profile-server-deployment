import mongoose from 'mongoose';
import { ActivityRewardModel } from '../models/gamification/activity-reward.model';
import { UserActivityModel } from '../models/gamification/user-activity.model';
import { AnalyticsDashboardModel } from '../models/gamification/analytics-dashboard.model';
import { MyPtsModel } from '../models/my-pts.model';
import { ProfileModel } from '../models/profile.model';
import { GamificationService } from './gamification.service';
import { TransactionType } from '../interfaces/my-pts.interface';
import { BadgeCategory } from '../interfaces/gamification.interface';
import { logger } from '../utils/logger';

export class ActivityTrackingService {
  private gamificationService: GamificationService;

  constructor() {
    this.gamificationService = new GamificationService();
  }

  /**
   * Track a user activity and award MyPts if applicable
   * @param profileId Profile ID
   * @param activityType Type of activity
   * @param metadata Additional data about the activity
   * @returns The created activity record
   */
  async trackActivity(
    profileId: mongoose.Types.ObjectId | string,
    activityType: string,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; pointsEarned: number; activityId?: mongoose.Types.ObjectId }> {
    try {
      const profileObjectId = new mongoose.Types.ObjectId(profileId.toString());

      // Check if activity is eligible for rewards
      const activityReward = await ActivityRewardModel.findByActivityType(activityType);

      if (!activityReward || !activityReward.isEnabled) {
        // Activity not configured for rewards or disabled
        logger.info(`Activity ${activityType} not configured for rewards or disabled`);
        return { success: true, pointsEarned: 0 };
      }

      // Check cooldown period if applicable
      if (activityReward.cooldownPeriod && activityReward.cooldownPeriod > 0) {
        const cooldownHours = activityReward.cooldownPeriod;
        const cooldownDate = new Date();
        cooldownDate.setHours(cooldownDate.getHours() - cooldownHours);

        const recentActivity = await UserActivityModel.findOne({
          profileId: profileObjectId,
          activityType,
          timestamp: { $gte: cooldownDate }
        });

        if (recentActivity) {
          // Activity in cooldown period, no reward
          logger.info(`Activity ${activityType} in cooldown period for profile ${profileId}`);
          return { success: true, pointsEarned: 0 };
        }
      }

      // Check daily limit if applicable
      if (activityReward.maxRewardsPerDay && activityReward.maxRewardsPerDay > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayCount = await UserActivityModel.countActivitiesInTimeRange(
          profileObjectId,
          activityType,
          today,
          new Date()
        );

        if (todayCount >= activityReward.maxRewardsPerDay) {
          // Daily limit reached, no reward
          logger.info(`Daily limit reached for activity ${activityType} for profile ${profileId}`);
          return { success: true, pointsEarned: 0 };
        }
      }

      // Activity is eligible for reward
      const pointsEarned = activityReward.pointsRewarded;

      // Create activity record
      const activity = await UserActivityModel.create({
        profileId: profileObjectId,
        activityType,
        timestamp: new Date(),
        MyPtsEarned: pointsEarned,
        metadata
      });

      // Award MyPts to the profile
      if (pointsEarned > 0) {
        try {
          const myPts = await MyPtsModel.findOrCreate(profileObjectId);

          await myPts.addMyPts(
            pointsEarned,
            TransactionType.EARN_MYPTS,
            `Earned ${pointsEarned} MyPts for ${activityReward.description}`,
            { activityType, activityId: activity._id }
          );

          // Update profile's MyPts balance
          await ProfileModel.findByIdAndUpdate(profileObjectId, {
            $inc: {
              'ProfileMypts.currentBalance': pointsEarned,
              'ProfileMypts.lifetimeMypts': pointsEarned
            }
          });

          // Update milestone based on new balance
          await this.updateMilestoneFromMyPts(profileObjectId);

          // Update analytics
          await this.updateActivityAnalytics(profileObjectId, activityType, pointsEarned);

          logger.info(`Awarded ${pointsEarned} MyPts to profile ${profileId} for activity ${activityType}`);
        } catch (error) {
          logger.error(`Error awarding MyPts for activity ${activityType}:`, error);
          // Continue execution even if MyPts award fails
        }
      }

      return {
        success: true,
        pointsEarned,
        activityId: activity._id
      };
    } catch (error) {
      logger.error(`Error tracking activity ${activityType} for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Get recent activities for a profile
   * @param profileId Profile ID
   * @param limit Maximum number of activities to return
   * @returns List of recent activities
   */
  async getRecentActivities(
    profileId: mongoose.Types.ObjectId | string,
    limit: number = 20
  ): Promise<any[]> {
    try {
      const profileObjectId = new mongoose.Types.ObjectId(profileId.toString());
      const activities = await UserActivityModel.getRecentActivities(profileObjectId, limit);

      // Enrich with activity descriptions
      const enrichedActivities = await Promise.all(
        activities.map(async (activity) => {
          const reward = await ActivityRewardModel.findByActivityType(activity.activityType);
          return {
            ...activity.toObject(),
            description: reward?.description || activity.activityType
          };
        })
      );

      return enrichedActivities;
    } catch (error) {
      logger.error(`Error getting recent activities for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Get activity statistics for a profile
   * @param profileId Profile ID
   * @returns Activity statistics
   */
  async getActivityStatistics(
    profileId: mongoose.Types.ObjectId | string
  ): Promise<Record<string, any>> {
    try {
      const profileObjectId = new mongoose.Types.ObjectId(profileId.toString());

      // Get all activities for the profile
      const activities = await UserActivityModel.find({ profileId: profileObjectId });

      // Group by activity type
      const activityCounts: Record<string, number> = {};
      const pointsByActivity: Record<string, number> = {};

      activities.forEach((activity) => {
        const type = activity.activityType;
        activityCounts[type] = (activityCounts[type] || 0) + 1;
        pointsByActivity[type] = (pointsByActivity[type] || 0) + activity.MyPtsEarned;
      });

      // Get activity descriptions
      const activityTypes = Object.keys(activityCounts);
      const activityDescriptions: Record<string, string> = {};

      for (const type of activityTypes) {
        const reward = await ActivityRewardModel.findByActivityType(type);
        activityDescriptions[type] = reward?.description || type;
      }

      // Calculate totals
      const totalActivities = activities.length;
      const totalPointsEarned = activities.reduce((sum, activity) => sum + activity.MyPtsEarned, 0);

      // Get recent trend (last 7 days)
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const recentActivities = activities.filter(
        (activity) => activity.timestamp >= lastWeek
      );

      const dailyActivity: Record<string, number> = {};

      recentActivities.forEach((activity) => {
        const dateStr = activity.timestamp.toISOString().split('T')[0];
        dailyActivity[dateStr] = (dailyActivity[dateStr] || 0) + 1;
      });

      return {
        totalActivities,
        totalPointsEarned,
        activityCounts,
        pointsByActivity,
        activityDescriptions,
        dailyActivity
      };
    } catch (error) {
      logger.error(`Error getting activity statistics for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Update milestone based on MyPts balance
   * @param profileId Profile ID
   */
  private async updateMilestoneFromMyPts(profileId: mongoose.Types.ObjectId | string): Promise<void> {
    try {
      const profileObjectId = new mongoose.Types.ObjectId(profileId.toString());

      // Get current MyPts balance
      const myPts = await MyPtsModel.findOne({ profileId: profileObjectId });

      if (myPts) {
        // Update milestone with current balance
        await this.gamificationService.updateProfileMilestone(profileObjectId, myPts.balance);
      }
    } catch (error) {
      logger.error(`Error updating milestone for profile ${profileId}:`, error);
    }
  }

  /**
   * Update analytics for an activity
   * @param profileId Profile ID
   * @param activityType Activity type
   * @param pointsEarned Points earned
   */
  private async updateActivityAnalytics(
    profileId: mongoose.Types.ObjectId,
    activityType: string,
    pointsEarned: number
  ): Promise<void> {
    try {
      const dashboard = await AnalyticsDashboardModel.findOrCreate(profileId);

      // Initialize activityHistory if it doesn't exist
      if (!dashboard.usage.activityHistory) {
        dashboard.usage.activityHistory = [];
      }

      // Add to activity history
      dashboard.usage.activityHistory.push({
        date: new Date(),
        activityType,
        pointsEarned
      });

      // Limit history to last 100 entries
      if (dashboard.usage.activityHistory.length > 100) {
        dashboard.usage.activityHistory = dashboard.usage.activityHistory.slice(-100);
      }

      // Update specific analytics based on activity type
      const reward = await ActivityRewardModel.findByActivityType(activityType);

      if (reward) {
        switch (reward.category) {
          case BadgeCategory.PLATFORM_USAGE:
            if (activityType === 'login') {
              dashboard.usage.loginStamps += 1;
            }
            break;
          case BadgeCategory.PRODUCTS:
            if (activityType === 'tap') {
              dashboard.products.taps += 1;
            } else if (activityType === 'scan') {
              dashboard.products.scans += 1;
            }
            break;
          case BadgeCategory.NETWORKING:
            if (activityType === 'share') {
              dashboard.networking.shares += 1;
            } else if (activityType === 'profile_view') {
              dashboard.networking.profileViews += 1;
            }
            break;
          // Add more categories as needed
        }
      }

      dashboard.lastUpdated = new Date();
      await dashboard.save();
    } catch (error) {
      logger.error(`Error updating activity analytics for profile ${profileId}:`, error);
    }
  }
}
