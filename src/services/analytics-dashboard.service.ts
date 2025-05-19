import mongoose from 'mongoose';
import { AnalyticsDashboardModel, AnalyticsDashboardDocument } from '../models/gamification/analytics-dashboard.model';
import { MyPtsModel, MyPtsTransactionModel } from '../models/my-pts.model';
import { ProfileModel } from '../models/profile.model';
import { ProfileBadgeModel } from '../models/gamification/profile-badge.model';
import { ProfileMilestoneModel } from '../models/gamification/profile-milestone.model';
import { UserActivityModel } from '../models/gamification/user-activity.model';
import { logger } from '../utils/logger';

export class AnalyticsDashboardService {
  /**
   * Get the analytics dashboard for a profile
   * @param profileId Profile ID
   * @returns The analytics dashboard
   */
  async getDashboard(profileId: mongoose.Types.ObjectId | string): Promise<AnalyticsDashboardDocument | null> {
    try {
      const profileObjectId = new mongoose.Types.ObjectId(profileId.toString());

      // Get or create dashboard
      let dashboard = await AnalyticsDashboardModel.findOne({ profileId: profileObjectId });

      if (!dashboard) {
        // Create new dashboard
        dashboard = await AnalyticsDashboardModel.create({
          profileId: profileObjectId,
          lastUpdated: new Date()
        });

        // Initialize dashboard with current data
        await this.refreshDashboard(profileObjectId);

        // Reload the dashboard
        dashboard = await AnalyticsDashboardModel.findOne({ profileId: profileObjectId });
      }

      return dashboard;
    } catch (error) {
      logger.error(`Error getting analytics dashboard for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh the analytics dashboard with the latest data
   * @param profileId Profile ID
   * @returns The updated dashboard
   */
  async refreshDashboard(profileId: mongoose.Types.ObjectId | string): Promise<AnalyticsDashboardDocument> {
    try {
      const profileObjectId = new mongoose.Types.ObjectId(profileId.toString());

      // Get or create dashboard
      const dashboard = await AnalyticsDashboardModel.findOrCreate(profileObjectId);

      // Update MyPts data
      await this.updateMyPtsData(profileObjectId, dashboard);

      // Update usage data
      await this.updateUsageData(profileObjectId, dashboard);

      // Update profiling data
      await this.updateProfilingData(profileObjectId, dashboard);

      // Update other categories
      await this.updateProductsData(profileObjectId, dashboard);
      await this.updateNetworkingData(profileObjectId, dashboard);
      await this.updateCircleData(profileObjectId, dashboard);

      // Save updates
      dashboard.lastUpdated = new Date();
      await dashboard.save();

      return dashboard;
    } catch (error) {
      logger.error(`Error refreshing analytics dashboard for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Update MyPts data in the dashboard
   * @param profileId Profile ID
   * @param dashboard Dashboard document
   */
  private async updateMyPtsData(
    profileId: mongoose.Types.ObjectId,
    dashboard: AnalyticsDashboardDocument
  ): Promise<void> {
    try {
      // Get MyPts data
      const myPts = await MyPtsModel.findOne({ profileId });

      if (myPts) {
        dashboard.myPts.currentBalance = myPts.balance;
        dashboard.myPts.lifetimeEarned = myPts.lifetimeEarned;
        dashboard.myPts.lifetimeSpent = myPts.lifetimeSpent;
      }

      // Get recent transactions
      const recentTransactions = await MyPtsTransactionModel.find({ profileId })
        .sort({ createdAt: -1 })
        .limit(20);

      // Update transactions list
      dashboard.myPts.transactions = recentTransactions.map((tx) => ({
        date: tx.createdAt,
        amount: tx.amount,
        type: tx.type
      }));
    } catch (error) {
      logger.error(`Error updating MyPts data for profile ${profileId}:`, error);
    }
  }

  /**
   * Update usage data in the dashboard
   * @param profileId Profile ID
   * @param dashboard Dashboard document
   */
  private async updateUsageData(
    profileId: mongoose.Types.ObjectId,
    dashboard: AnalyticsDashboardDocument
  ): Promise<void> {
    try {
      // Count badges
      const badgeCount = await ProfileBadgeModel.countDocuments({
        profileId,
        isCompleted: true
      });

      // Get milestone history
      const milestone = await ProfileMilestoneModel.findOne({ profileId });
      const milestoneCount = milestone ? milestone.milestoneHistory.length : 0;

      // Get login stamps (activity of type 'login')
      const loginCount = await UserActivityModel.countDocuments({
        profileId,
        activityType: 'login'
      });

      // Update dashboard
      dashboard.usage.badgesEarned = badgeCount;
      dashboard.usage.milestonesReached = milestoneCount;
      dashboard.usage.loginStamps = loginCount;

      // Get recent activities
      const recentActivities = await UserActivityModel.find({ profileId })
        .sort({ timestamp: -1 })
        .limit(20);

      // Update activity history
      dashboard.usage.activityHistory = recentActivities.map((activity) => ({
        date: activity.timestamp,
        activityType: activity.activityType,
        pointsEarned: activity.MyPtsEarned
      }));
    } catch (error) {
      logger.error(`Error updating usage data for profile ${profileId}:`, error);
    }
  }

  /**
   * Update profiling data in the dashboard
   * @param profileId Profile ID
   * @param dashboard Dashboard document
   */
  private async updateProfilingData(
    profileId: mongoose.Types.ObjectId,
    dashboard: AnalyticsDashboardDocument
  ): Promise<void> {
    try {
      // Get profile data
      const profile = await ProfileModel.findById(profileId);

      if (profile) {
        // Calculate profile completion percentage
        const completionPercentage = this.calculateProfileCompletion(profile);

        // Count links
        const links = this.countProfileLinks(profile);

        // Update dashboard
        dashboard.profiling.completionPercentage = completionPercentage;
        dashboard.profiling.totalLinks = links;

        // Count content items (sections)
        if (profile.sections && Array.isArray(profile.sections)) {
          dashboard.profiling.contentItems = profile.sections.length;
        }
      }
    } catch (error) {
      logger.error(`Error updating profiling data for profile ${profileId}:`, error);
    }
  }

  /**
   * Update products data in the dashboard
   * @param profileId Profile ID
   * @param dashboard Dashboard document
   */
  private async updateProductsData(
    profileId: mongoose.Types.ObjectId,
    dashboard: AnalyticsDashboardDocument
  ): Promise<void> {
    try {
      // Get tap and scan activities
      const tapCount = await UserActivityModel.countDocuments({
        profileId,
        activityType: 'tap'
      });

      const scanCount = await UserActivityModel.countDocuments({
        profileId,
        activityType: 'scan'
      });

      // Get profile data for product info
      const profile = await ProfileModel.findById(profileId);

      if (profile && profile.ProfileProducts) {
        // Count accessories and devices
        const isAccessory = profile.ProfileProducts.type === 'Accessory';
        const isDevice = profile.ProfileProducts.type === 'Device';

        dashboard.products.accessories = isAccessory ? 1 : 0;
        dashboard.products.devices = isDevice ? 1 : 0;
      }

      // Update dashboard
      dashboard.products.taps = tapCount;
      dashboard.products.scans = scanCount;
    } catch (error) {
      logger.error(`Error updating products data for profile ${profileId}:`, error);
    }
  }

  /**
   * Update networking data in the dashboard
   * @param profileId Profile ID
   * @param dashboard Dashboard document
   */
  private async updateNetworkingData(
    profileId: mongoose.Types.ObjectId,
    dashboard: AnalyticsDashboardDocument
  ): Promise<void> {
    try {
      // Get share activities
      const shareCount = await UserActivityModel.countDocuments({
        profileId,
        activityType: 'share'
      });

      // Get profile views from analytics
      const viewCount = await UserActivityModel.countDocuments({
        profileId,
        activityType: 'profile_view'
      });

      // Update dashboard
      dashboard.networking.shares = shareCount;
      dashboard.networking.profileViews = viewCount;
    } catch (error) {
      logger.error(`Error updating networking data for profile ${profileId}:`, error);
    }
  }

  /**
   * Update circle data in the dashboard
   * @param profileId Profile ID
   * @param dashboard Dashboard document
   */
  private async updateCircleData(
    profileId: mongoose.Types.ObjectId,
    dashboard: AnalyticsDashboardDocument
  ): Promise<void> {
    try {
      // Get profile data
      const profile = await ProfileModel.findById(profileId);

      if (profile && profile.profileInformation) {
        // Count followers, following, and connections
        const followerCount = profile.profileInformation.followers?.length || 0;
        const followingCount = profile.profileInformation.following?.length || 0;
        const connectionCount = profile.profileInformation.connectedProfiles?.length || 0;
        const affiliationCount = profile.profileInformation.affiliatedProfiles?.length || 0;

        // Update dashboard
        dashboard.circle.followers = followerCount;
        dashboard.circle.following = followingCount;
        dashboard.circle.connections = connectionCount;
        dashboard.circle.affiliations = affiliationCount;
      }
    } catch (error) {
      logger.error(`Error updating circle data for profile ${profileId}:`, error);
    }
  }

  /**
   * Calculate profile completion percentage
   * @param profile Profile document
   * @returns Completion percentage (0-100)
   */
  private calculateProfileCompletion(profile: any): number {
    try {
      // Define required fields to check
      const requiredFields = [
        'profileInformation.username',
        'profileInformation.profileLink',
        'ProfileFormat.profileImage',
        'profileLocation.country'
      ];

      // Count completed fields
      let completedFields = 0;

      for (const field of requiredFields) {
        const fieldParts = field.split('.');
        let value = profile;

        for (const part of fieldParts) {
          value = value?.[part];
          if (value === undefined) break;
        }

        if (value) completedFields++;
      }

      // Calculate percentage
      return Math.round((completedFields / requiredFields.length) * 100);
    } catch (error) {
      logger.error('Error calculating profile completion:', error);
      return 0;
    }
  }

  /**
   * Count links in a profile
   * @param profile Profile document
   * @returns Number of links
   */
  private countProfileLinks(profile: any): number {
    try {
      let linkCount = 0;

      // Count standard links
      if (profile.profileInformation?.profileLink) linkCount++;
      if (profile.profileInformation?.connectLink) linkCount++;
      if (profile.profileInformation?.followLink) linkCount++;

      // Count QR codes
      if (profile.ProfileQrCode?.qrCode) linkCount++;
      if (profile.ProfileQrCode?.emailSignature) linkCount++;

      // Count referral links
      if (profile.ProfileReferal?.referalLink) linkCount++;

      return linkCount;
    } catch (error) {
      logger.error('Error counting profile links:', error);
      return 0;
    }
  }
}
