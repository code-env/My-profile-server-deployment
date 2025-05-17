import mongoose from 'mongoose';
import { BadgeModel } from '../models/gamification/badge.model';
import { ProfileBadgeModel } from '../models/gamification/profile-badge.model';
import { ProfileMilestoneModel } from '../models/gamification/profile-milestone.model';
import { LeaderboardEntryModel } from '../models/gamification/leaderboard.model';
import { ActivityRewardModel } from '../models/gamification/activity-reward.model';
import { UserActivityModel } from '../models/gamification/user-activity.model';
import { AnalyticsDashboardModel } from '../models/gamification/analytics-dashboard.model';
import { ProfileModel } from '../models/profile.model';
import { MyPtsModel } from '../models/my-pts.model';
import { 
  BadgeCategory, 
  BadgeRarity, 
  MilestoneLevel, 
  MILESTONE_THRESHOLDS,
  IBadge,
  IUserBadge,
  IProfileMilestone,
  ILeaderboardEntry,
  IActivityReward
} from '../interfaces/gamification.interface';
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
}
