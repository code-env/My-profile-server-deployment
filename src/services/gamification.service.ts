import mongoose from 'mongoose';
import { BadgeModel } from '../models/gamification/badge.model';
import { ProfileBadgeModel } from '../models/gamification/profile-badge.model';
import { ProfileMilestoneModel } from '../models/gamification/profile-milestone.model';
import { LeaderboardEntryModel } from '../models/gamification/leaderboard.model';
import { ActivityRewardModel } from '../models/gamification/activity-reward.model';
import { UserActivityModel } from '../models/gamification/user-activity.model';
import { AnalyticsDashboardModel } from '../models/gamification/analytics-dashboard.model';
import { BadgeSuggestionModel } from '../models/gamification/badge-suggestion.model';
import { ProfileModel } from '../models/profile.model';
import { MyPtsModel } from '../models/my-pts.model';
import {
  BadgeCategory,
  BadgeRarity,
  MilestoneLevel,
  MILESTONE_THRESHOLDS,
  IBadge,
  IBadgeActivity,
  IUserBadge,
  IUserBadgeActivityProgress,
  IProfileMilestone,
  ILeaderboardEntry,
  IActivityReward,
  IBadgeSuggestion,
  BadgeSuggestionStatus
} from '../interfaces/gamification.interface';
import { TransactionType } from '../interfaces/my-pts.interface';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';

export class GamificationService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Badge Management
   */

  async createBadge(badgeData: Omit<IBadge, '_id' | 'createdAt' | 'updatedAt'>): Promise<IBadge> {
    try {
      const badge = await BadgeModel.create(badgeData);
      logger.info(`Created new badge: ${badge.name}`, { badgeId: badge._id });
      return badge;
    } catch (error) {
      logger.error('Error creating badge:', error);
      throw error;
    }
  }

  async getBadgeById(badgeId: mongoose.Types.ObjectId | string): Promise<IBadge | null> {
    try {
      return await BadgeModel.findById(badgeId);
    } catch (error) {
      logger.error(`Error getting badge with ID ${badgeId}:`, error);
      throw error;
    }
  }

  async getAllBadges(): Promise<IBadge[]> {
    try {
      return await BadgeModel.find().sort({ category: 1, rarity: 1 });
    } catch (error) {
      logger.error('Error getting all badges:', error);
      throw error;
    }
  }

  async getBadgesByCategory(category: BadgeCategory): Promise<IBadge[]> {
    try {
      return await BadgeModel.findByCategory(category);
    } catch (error) {
      logger.error(`Error getting badges for category ${category}:`, error);
      throw error;
    }
  }

  async updateBadge(
    badgeId: mongoose.Types.ObjectId | string,
    updateData: Partial<IBadge>
  ): Promise<IBadge | null> {
    try {
      const badge = await BadgeModel.findByIdAndUpdate(badgeId, updateData, { new: true });
      if (badge) {
        logger.info(`Updated badge: ${badge.name}`, { badgeId: badge._id });
      }
      return badge;
    } catch (error) {
      logger.error(`Error updating badge with ID ${badgeId}:`, error);
      throw error;
    }
  }

  /**
   * Badge Activity Management
   */

  async addActivityToBadge(
    badgeId: mongoose.Types.ObjectId | string,
    activityData: IBadgeActivity
  ): Promise<IBadge | null> {
    try {
      // Generate a unique activity ID if not provided
      if (!activityData.activityId) {
        activityData.activityId = new mongoose.Types.ObjectId().toString();
      }

      const badge = await BadgeModel.findByIdAndUpdate(
        badgeId,
        { $push: { activities: activityData } },
        { new: true }
      );

      if (badge) {
        logger.info(`Added activity to badge: ${badge.name}`, {
          badgeId: badge._id,
          activityId: activityData.activityId
        });
      }

      return badge;
    } catch (error) {
      logger.error(`Error adding activity to badge with ID ${badgeId}:`, error);
      throw error;
    }
  }

  async updateBadgeActivity(
    badgeId: mongoose.Types.ObjectId | string,
    activityId: string,
    updateData: Partial<IBadgeActivity>
  ): Promise<IBadge | null> {
    try {
      // Create update object with dot notation for nested fields
      const updateObj: Record<string, any> = {};

      Object.entries(updateData).forEach(([key, value]) => {
        if (key !== 'activityId') { // Don't allow changing the activityId
          updateObj[`activities.$.${key}`] = value;
        }
      });

      const badge = await BadgeModel.findOneAndUpdate(
        { _id: badgeId, 'activities.activityId': activityId },
        { $set: updateObj },
        { new: true }
      );

      if (badge) {
        logger.info(`Updated activity in badge: ${badge.name}`, {
          badgeId: badge._id,
          activityId
        });
      }

      return badge;
    } catch (error) {
      logger.error(`Error updating activity ${activityId} in badge with ID ${badgeId}:`, error);
      throw error;
    }
  }

  async removeActivityFromBadge(
    badgeId: mongoose.Types.ObjectId | string,
    activityId: string
  ): Promise<IBadge | null> {
    try {
      const badge = await BadgeModel.findByIdAndUpdate(
        badgeId,
        { $pull: { activities: { activityId } } },
        { new: true }
      );

      if (badge) {
        logger.info(`Removed activity from badge: ${badge.name}`, {
          badgeId: badge._id,
          activityId
        });
      }

      return badge;
    } catch (error) {
      logger.error(`Error removing activity ${activityId} from badge with ID ${badgeId}:`, error);
      throw error;
    }
  }

  async deleteBadge(badgeId: mongoose.Types.ObjectId | string): Promise<boolean> {
    try {
      const result = await BadgeModel.findByIdAndDelete(badgeId);
      if (result) {
        logger.info(`Deleted badge with ID ${badgeId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error deleting badge with ID ${badgeId}:`, error);
      throw error;
    }
  }

  /**
   * Profile Badge Management
   */

  async getProfileBadges(profileId: mongoose.Types.ObjectId | string): Promise<IUserBadge[]> {
    try {
      return await ProfileBadgeModel.find({ profileId }).populate('badgeId');
    } catch (error) {
      logger.error(`Error getting badges for profile ${profileId}:`, error);
      throw error;
    }
  }

  async awardBadge(
    profileId: mongoose.Types.ObjectId | string,
    badgeId: mongoose.Types.ObjectId | string
  ): Promise<IUserBadge | null> {
    try {
      // Check if badge already exists for this profile
      let profileBadge = await ProfileBadgeModel.findOne({ profileId, badgeId });

      if (profileBadge && profileBadge.isCompleted) {
        // Badge already awarded
        return profileBadge;
      }

      if (!profileBadge) {
        // Create new badge progress
        profileBadge = await ProfileBadgeModel.create({
          profileId,
          badgeId,
          progress: 100,
          isCompleted: true,
          completedAt: new Date()
        });
      } else {
        // Update existing badge to completed
        profileBadge.progress = 100;
        profileBadge.isCompleted = true;
        profileBadge.completedAt = new Date();
        await profileBadge.save();
      }

      // Get badge details for notification
      const badge = await BadgeModel.findById(badgeId);

      if (badge) {
        // Update profile's badge array
        await ProfileModel.findByIdAndUpdate(
          profileId,
          {
            $push: {
              ProfileBadges: {
                id: badgeId,
                name: badge.name,
                category: badge.category,
                description: badge.description,
                icon: badge.icon,
                earnedAt: new Date()
              }
            }
          }
        );

        // Send notification
        await this.notificationService.createBadgeEarnedNotification(
          profileId,
          badge.name,
          badge.description,
          badge.icon
        );

        // Update analytics
        await this.updateBadgeAnalytics(profileId);
      }

      logger.info(`Awarded badge to profile ${profileId}`, { badgeId });
      return profileBadge;
    } catch (error) {
      logger.error(`Error awarding badge to profile ${profileId}:`, error);
      throw error;
    }
  }

  async updateBadgeProgress(
    profileId: mongoose.Types.ObjectId | string,
    badgeId: mongoose.Types.ObjectId | string,
    progress: number
  ): Promise<IUserBadge | null> {
    try {
      // Find or create badge progress
      let profileBadge = await ProfileBadgeModel.findOne({ profileId, badgeId });

      if (!profileBadge) {
        profileBadge = await ProfileBadgeModel.create({
          profileId,
          badgeId,
          progress: Math.min(progress, 100),
          isCompleted: progress >= 100
        });
      } else if (!profileBadge.isCompleted) {
        // Only update if not already completed
        profileBadge.progress = Math.min(progress, 100);

        if (progress >= 100 && !profileBadge.isCompleted) {
          profileBadge.isCompleted = true;
          profileBadge.completedAt = new Date();

          // Award the badge if progress reaches 100%
          await this.awardBadge(profileId, badgeId);
        }

        await profileBadge.save();
      }

      return profileBadge;
    } catch (error) {
      logger.error(`Error updating badge progress for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Badge Activity Progress Management
   */

  async updateBadgeActivityProgress(
    profileId: mongoose.Types.ObjectId | string,
    badgeId: mongoose.Types.ObjectId | string,
    activityId: string,
    progress: number
  ): Promise<IUserBadge | null> {
    try {
      // Find the badge to get activity details
      const badge = await BadgeModel.findById(badgeId);
      if (!badge || !badge.activities) {
        throw new Error(`Badge not found or has no activities: ${badgeId}`);
      }

      // Find the specific activity
      const activity = badge.activities.find(a => a.activityId === activityId);
      if (!activity) {
        throw new Error(`Activity not found in badge: ${activityId}`);
      }

      // Find or create badge progress
      let profileBadge = await ProfileBadgeModel.findOne({ profileId, badgeId });

      if (!profileBadge) {
        // Create new badge progress with activity progress
        profileBadge = await ProfileBadgeModel.create({
          profileId,
          badgeId,
          progress: 0,
          isCompleted: false,
          activityProgress: [{
            activityId,
            progress: Math.min(progress, 100),
            isCompleted: progress >= 100,
            completedAt: progress >= 100 ? new Date() : undefined
          }]
        });
      } else {
        // Find existing activity progress
        const activityProgressIndex = profileBadge.activityProgress?.findIndex(
          ap => ap.activityId === activityId
        ) ?? -1;

        if (activityProgressIndex === -1) {
          // Activity progress doesn't exist, create it
          if (!profileBadge.activityProgress) {
            profileBadge.activityProgress = [];
          }

          profileBadge.activityProgress.push({
            activityId,
            progress: Math.min(progress, 100),
            isCompleted: progress >= 100,
            completedAt: progress >= 100 ? new Date() : undefined
          });
        } else if (profileBadge.activityProgress &&
                  activityProgressIndex >= 0 &&
                  !profileBadge.activityProgress[activityProgressIndex].isCompleted) {
          // Update existing activity progress if not already completed
          profileBadge.activityProgress[activityProgressIndex].progress = Math.min(progress, 100);

          if (progress >= 100) {
            profileBadge.activityProgress[activityProgressIndex].isCompleted = true;
            profileBadge.activityProgress[activityProgressIndex].completedAt = new Date();

            // Award MyPts for completing the activity
            if (activity.myPtsReward > 0) {
              try {
                const myPts = await MyPtsModel.findOrCreate(new mongoose.Types.ObjectId(profileId.toString()));
                await myPts.addMyPts(
                  activity.myPtsReward,
                  TransactionType.EARN_MYPTS,
                  `Earned ${activity.myPtsReward} MyPts for completing "${activity.name}" activity`,
                  { badgeId, activityId }
                );

                // Update profile's MyPts balance
                await ProfileModel.findByIdAndUpdate(profileId, {
                  $inc: {
                    'ProfileMypts.currentBalance': activity.myPtsReward,
                    'ProfileMypts.lifetimeMypts': activity.myPtsReward
                  }
                });
              } catch (error) {
                logger.error(`Error awarding MyPts for activity completion:`, error);
                // Continue execution even if MyPts award fails
              }
            }
          }
        }

        // Check if all required activities are completed
        if (badge.requiredActivitiesCount && badge.activities) {
          const requiredActivities = badge.activities.filter(a => a.isRequired);
          const completedRequiredActivities = profileBadge.activityProgress?.filter(
            ap => ap.isCompleted && requiredActivities.some(ra => ra.activityId === ap.activityId)
          ) ?? [];

          // Calculate overall badge progress
          const totalRequired = Math.min(badge.requiredActivitiesCount, requiredActivities.length);
          const completedRequired = completedRequiredActivities.length;

          if (totalRequired > 0) {
            profileBadge.progress = Math.min(Math.floor((completedRequired / totalRequired) * 100), 100);

            // Check if badge is completed
            if (completedRequired >= totalRequired && !profileBadge.isCompleted) {
              profileBadge.isCompleted = true;
              profileBadge.completedAt = new Date();

              // Award the badge
              await this.awardBadge(profileId, badgeId);
            }
          }
        }

        await profileBadge.save();
      }

      return profileBadge;
    } catch (error) {
      logger.error(`Error updating badge activity progress for profile ${profileId}:`, error);
      throw error;
    }
  }

  async getBadgeActivityProgress(
    profileId: mongoose.Types.ObjectId | string,
    badgeId: mongoose.Types.ObjectId | string
  ): Promise<IUserBadgeActivityProgress[] | null> {
    try {
      const profileBadge = await ProfileBadgeModel.findOne({ profileId, badgeId });
      return profileBadge?.activityProgress || null;
    } catch (error) {
      logger.error(`Error getting badge activity progress for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Milestone Management
   */

  async getProfileMilestone(profileId: mongoose.Types.ObjectId | string): Promise<IProfileMilestone | null> {
    try {
      return await ProfileMilestoneModel.findOrCreate(new mongoose.Types.ObjectId(profileId.toString()));
    } catch (error) {
      logger.error(`Error getting milestone for profile ${profileId}:`, error);
      throw error;
    }
  }

  async updateProfileMilestone(
    profileId: mongoose.Types.ObjectId | string,
    points: number
  ): Promise<IProfileMilestone | null> {
    try {
      const milestone = await ProfileMilestoneModel.updateMilestone(
        new mongoose.Types.ObjectId(profileId.toString()),
        points
      );

      // Check if milestone level has changed
      const history = milestone.milestoneHistory;
      if (history.length > 1 && history[history.length - 1].level !== history[history.length - 2].level) {
        // New milestone achieved, send notification
        await this.notificationService.createMilestoneAchievedNotification(
          profileId,
          milestone.currentLevel,
          milestone.currentPoints
        );

        // Update analytics
        await this.updateMilestoneAnalytics(profileId);
      }

      return milestone;
    } catch (error) {
      logger.error(`Error updating milestone for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Leaderboard Management
   */

  async getLeaderboard(limit: number = 100): Promise<ILeaderboardEntry[]> {
    try {
      return await LeaderboardEntryModel.getTopEntries(limit);
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  async getLeaderboardByMilestone(level: MilestoneLevel, limit: number = 100): Promise<ILeaderboardEntry[]> {
    try {
      return await LeaderboardEntryModel.getEntriesByMilestone(level, limit);
    } catch (error) {
      logger.error(`Error getting leaderboard for milestone ${level}:`, error);
      throw error;
    }
  }

  async getProfileRank(profileId: mongoose.Types.ObjectId | string): Promise<ILeaderboardEntry | null> {
    try {
      return await LeaderboardEntryModel.getProfileRank(new mongoose.Types.ObjectId(profileId.toString()));
    } catch (error) {
      logger.error(`Error getting rank for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Activity Reward Management
   */

  async createActivityReward(rewardData: Omit<IActivityReward, '_id' | 'createdAt' | 'updatedAt'>): Promise<IActivityReward> {
    try {
      const reward = await ActivityRewardModel.create(rewardData);
      logger.info(`Created new activity reward: ${reward.activityType}`, { rewardId: reward._id });
      return reward;
    } catch (error) {
      logger.error('Error creating activity reward:', error);
      throw error;
    }
  }

  async getActivityRewards(): Promise<IActivityReward[]> {
    try {
      return await ActivityRewardModel.findEnabledActivities();
    } catch (error) {
      logger.error('Error getting activity rewards:', error);
      throw error;
    }
  }

  async getActivityRewardByType(activityType: string): Promise<IActivityReward | null> {
    try {
      return await ActivityRewardModel.findByActivityType(activityType);
    } catch (error) {
      logger.error(`Error getting activity reward for type ${activityType}:`, error);
      throw error;
    }
  }

  async updateActivityReward(
    activityType: string,
    updateData: Partial<IActivityReward>
  ): Promise<IActivityReward | null> {
    try {
      const reward = await ActivityRewardModel.findOneAndUpdate(
        { activityType },
        updateData,
        { new: true }
      );

      if (reward) {
        logger.info(`Updated activity reward: ${reward.activityType}`, { rewardId: reward._id });
      }

      return reward;
    } catch (error) {
      logger.error(`Error updating activity reward for type ${activityType}:`, error);
      throw error;
    }
  }

  /**
   * Analytics Updates
   */

  private async updateBadgeAnalytics(profileId: mongoose.Types.ObjectId | string): Promise<void> {
    try {
      const dashboard = await AnalyticsDashboardModel.findOrCreate(new mongoose.Types.ObjectId(profileId.toString()));

      // Count earned badges
      const badgeCount = await ProfileBadgeModel.countDocuments({
        profileId,
        isCompleted: true
      });

      // Update dashboard
      dashboard.usage.badgesEarned = badgeCount;
      dashboard.lastUpdated = new Date();
      await dashboard.save();
    } catch (error) {
      logger.error(`Error updating badge analytics for profile ${profileId}:`, error);
    }
  }

  private async updateMilestoneAnalytics(profileId: mongoose.Types.ObjectId | string): Promise<void> {
    try {
      const dashboard = await AnalyticsDashboardModel.findOrCreate(new mongoose.Types.ObjectId(profileId.toString()));

      // Get milestone history count
      const milestone = await ProfileMilestoneModel.findOne({ profileId });
      if (milestone) {
        dashboard.usage.milestonesReached = milestone.milestoneHistory.length;
        dashboard.lastUpdated = new Date();
        await dashboard.save();
      }
    } catch (error) {
      logger.error(`Error updating milestone analytics for profile ${profileId}:`, error);
    }
  }

  /**
   * Badge Suggestion Management
   */

  async createBadgeSuggestion(
    profileId: mongoose.Types.ObjectId | string,
    suggestionData: Omit<IBadgeSuggestion, '_id' | 'profileId' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<IBadgeSuggestion> {
    try {
      const suggestion = await BadgeSuggestionModel.create({
        ...suggestionData,
        profileId,
        status: BadgeSuggestionStatus.PENDING
      });

      logger.info(`Created new badge suggestion: ${suggestion.name}`, {
        suggestionId: suggestion._id,
        profileId
      });

      return suggestion;
    } catch (error) {
      logger.error(`Error creating badge suggestion for profile ${profileId}:`, error);
      throw error;
    }
  }

  async getBadgeSuggestionById(suggestionId: mongoose.Types.ObjectId | string): Promise<IBadgeSuggestion | null> {
    try {
      return await BadgeSuggestionModel.findById(suggestionId);
    } catch (error) {
      logger.error(`Error getting badge suggestion with ID ${suggestionId}:`, error);
      throw error;
    }
  }

  async getProfileBadgeSuggestions(profileId: mongoose.Types.ObjectId | string): Promise<IBadgeSuggestion[]> {
    try {
      return await BadgeSuggestionModel.findByProfile(new mongoose.Types.ObjectId(profileId.toString()));
    } catch (error) {
      logger.error(`Error getting badge suggestions for profile ${profileId}:`, error);
      throw error;
    }
  }

  async getPendingBadgeSuggestions(): Promise<IBadgeSuggestion[]> {
    try {
      return await BadgeSuggestionModel.findPendingSuggestions();
    } catch (error) {
      logger.error('Error getting pending badge suggestions:', error);
      throw error;
    }
  }

  async getBadgeSuggestionsByStatus(status: BadgeSuggestionStatus): Promise<IBadgeSuggestion[]> {
    try {
      return await BadgeSuggestionModel.findByStatus(status);
    } catch (error) {
      logger.error(`Error getting badge suggestions with status ${status}:`, error);
      throw error;
    }
  }

  async updateBadgeSuggestionStatus(
    suggestionId: mongoose.Types.ObjectId | string,
    status: BadgeSuggestionStatus,
    adminFeedback?: string
  ): Promise<IBadgeSuggestion | null> {
    try {
      const updateData: Partial<IBadgeSuggestion> = { status };

      if (adminFeedback) {
        updateData.adminFeedback = adminFeedback;
      }

      const suggestion = await BadgeSuggestionModel.findByIdAndUpdate(
        suggestionId,
        updateData,
        { new: true }
      );

      if (suggestion) {
        logger.info(`Updated badge suggestion status: ${suggestion.name}`, {
          suggestionId: suggestion._id,
          status
        });

        // If approved, notify the user
        if (status === BadgeSuggestionStatus.APPROVED) {
          await this.notificationService.createBadgeSuggestionApprovedNotification(
            suggestion.profileId,
            suggestion.name
          );
        }

        // If rejected, notify the user with feedback
        if (status === BadgeSuggestionStatus.REJECTED && adminFeedback) {
          await this.notificationService.createBadgeSuggestionRejectedNotification(
            suggestion.profileId,
            suggestion.name,
            adminFeedback
          );
        }
      }

      return suggestion;
    } catch (error) {
      logger.error(`Error updating badge suggestion status for ID ${suggestionId}:`, error);
      throw error;
    }
  }

  async implementBadgeSuggestion(
    suggestionId: mongoose.Types.ObjectId | string,
    badgeData: Omit<IBadge, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ badge: IBadge; suggestion: IBadgeSuggestion | null }> {
    try {
      // Create the badge
      const badge = await this.createBadge(badgeData);

      // Update the suggestion status to implemented
      const suggestion = await BadgeSuggestionModel.findByIdAndUpdate(
        suggestionId,
        {
          status: BadgeSuggestionStatus.IMPLEMENTED,
          implementedBadgeId: badge._id
        },
        { new: true }
      );

      if (suggestion) {
        // Notify the user that their suggestion was implemented
        await this.notificationService.createBadgeSuggestionImplementedNotification(
          suggestion.profileId,
          badge.name
        );

        logger.info(`Implemented badge suggestion: ${suggestion.name}`, {
          suggestionId: suggestion._id,
          badgeId: badge._id
        });
      }

      return { badge, suggestion };
    } catch (error) {
      logger.error(`Error implementing badge suggestion for ID ${suggestionId}:`, error);
      throw error;
    }
  }

  async deleteBadgeSuggestion(suggestionId: mongoose.Types.ObjectId | string): Promise<boolean> {
    try {
      const result = await BadgeSuggestionModel.findByIdAndDelete(suggestionId);

      if (result) {
        logger.info(`Deleted badge suggestion with ID ${suggestionId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error deleting badge suggestion with ID ${suggestionId}:`, error);
      throw error;
    }
  }
}
