import { Analytics, IAnalytics } from '../models/Analytics';
import { NotificationService } from './notification.service';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import UAParser from 'ua-parser-js';
import geoip from 'geoip-lite';

export class AnalyticsService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async trackProfileView(
    profileId: mongoose.Types.ObjectId,
    ownerId: mongoose.Types.ObjectId,
    viewerId?: mongoose.Types.ObjectId,
    userAgent?: string,
    ip?: string
  ) {
    console.log('Entering trackProfileView with params:', { profileId, ownerId, viewerId, userAgent, ip });
    try {
      let analytics:any = await Analytics.findOne({ profileId });
      
      if (!analytics) {
        analytics = new Analytics({
          profileId,
          ownerId,
          views: [],
          engagements: [],
          metrics: {
            totalViews: 0,
            uniqueViews: 0,
            totalEngagements: 0,
            avgViewDuration: 0,
            connectionRate: 0,
            responseRate: 0,
            popularSections: {},
          },
          dailyStats: [],
        });
      }

      // Parse user agent and location
      const deviceInfo = this.parseUserAgent(userAgent);
      const location = this.parseLocation(ip);

      // Check if this is a unique view (not from the same viewer in the last 24 hours)
      const isUnique = this.isUniqueView(analytics, viewerId);

      // Add view
      analytics.views.push({
        timestamp: new Date(),
        viewer: viewerId,
        location,
        device: deviceInfo,
        isUnique,
      });

      // Update daily stats
      this.updateDailyStats(analytics);

      // Update metrics
      await analytics.updateMetrics();

      // Send notification for profile view if it's a unique view
      if (isUnique && viewerId && !viewerId.equals(ownerId)) {
        await this.notificationService.createProfileViewNotification(
          profileId,
          viewerId,
          ownerId
        );
      }

      return analytics;
    } catch (error) {
      console.error('Error in trackProfileView:', error);
      logger.error('Error tracking profile view:', error);
      throw error;
    }
  }

  async trackEngagement(
    profileId: mongoose.Types.ObjectId | string,
    ownerId: mongoose.Types.ObjectId | string,
    userId: mongoose.Types.ObjectId ,
    type: 'like' |"view" | 'comment' | 'share' | 'download' | 'connect' | 'message',
    metadata?: Record<string, any>
  ) {
    console.log('Entering trackEngagement with params:', { profileId, ownerId, userId, type, metadata });
    try {
      let analytics:any = await Analytics.findOne({ profileId });
      
      if (!analytics) {
        analytics = new Analytics({
          profileId,
          ownerId,
          views: [],
          engagements: [],
        });
      }

      // Add engagement
      analytics.engagements.push({
        type,
        timestamp: new Date(),
        user: userId,
        metadata,
      });

      // Update daily stats
      this.updateDailyStats(analytics);

      // Update metrics
      await analytics.updateMetrics();

      return analytics;
    } catch (error) {
      console.error('Error in trackEngagement:', error);
      logger.error('Error tracking engagement:', error);
      throw error;
    }
  }

  async getProfileAnalytics(profileId: mongoose.Types.ObjectId, period: 'day' | 'week' | 'month' | 'year' = 'month') {
    console.log('Entering getProfileAnalytics with params:', { profileId, period });
    try {
      const analytics = await Analytics.findOne({ profileId });
      if (!analytics) return null;

      const startDate = this.getStartDate(period);
      
      return {
        overview: analytics.metrics,
        periodStats: {
          views: this.getPeriodStats(analytics.views, startDate),
          engagements: this.getPeriodStats(analytics.engagements, startDate),
        },
        dailyStats: analytics.dailyStats.filter(stat => stat.date >= startDate),
      };
    } catch (error) {
      console.error('Error in getProfileAnalytics:', error);
      logger.error('Error getting profile analytics:', error);
      throw error;
    }
  }

  async getUserAnalytics(userId: mongoose.Types.ObjectId) {
    console.log('Entering getUserAnalytics with params:', { userId });
    try {
      const analytics = await Analytics.find({ ownerId: userId });
      
      return analytics.map(profile => ({
        profileId: profile.profileId,
        metrics: profile.metrics,
        recentActivity: {
          views: profile.views.slice(-5),
          engagements: profile.engagements.slice(-5),
        },
      }));
    } catch (error) {
      console.error('Error in getUserAnalytics:', error);
      logger.error('Error getting user analytics:', error);
      throw error;
    }
  }

  private parseUserAgent(userAgent?: string) {
    if (!userAgent) return {};

    const parseUserAgent = (ua: string) => {
      const parser = new UAParser.UAParser(ua);
      console.log('Parsing user agent:', ua);
      const result = parser.getResult();
      console.log('Parsed result:', result);
      return result;
    };

    const result = parseUserAgent(userAgent);
    
    return {
      type: result.device.type || 'desktop',
      browser: result.browser.name || 'unknown',
      os: result.os.name || 'unknown',
    };
  }

  private parseLocation(ip?: string) {
    if (!ip) return {};

    const geo = geoip.lookup(ip);
    if (!geo) return {};

    return {
      country: geo.country,
      city: geo.city,
    };
  }

  private isUniqueView(analytics: IAnalytics, viewerId?: mongoose.Types.ObjectId): boolean {
    if (!viewerId) return true;

    const recentViews = analytics.views.filter(
      view => view.viewer && view.viewer.equals(viewerId) && 
              view.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    return recentViews.length === 0;
  }

  private updateDailyStats(analytics: IAnalytics) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyStat:any = analytics.dailyStats.find(stat => 
      stat.date.getTime() === today.getTime()
    );

    if (!dailyStat) {
      dailyStat = {
        date: today,
        views: 0,
        uniqueViews: 0,
        engagements: new Map(),
      };
      analytics.dailyStats.push(dailyStat);
    }

    // Update views for today
    const todayViews = analytics.views.filter(view => 
      view.timestamp >= today
    );
    dailyStat.views = todayViews?.length;
    dailyStat.uniqueViews = todayViews.filter(view => view.isUnique).length;

    // Update engagements for today
    const todayEngagements = analytics.engagements.filter(engagement => 
      engagement.timestamp >= today
    );
    const engagementCounts = new Map();
    todayEngagements.forEach(engagement => {
      const count = engagementCounts.get(engagement.type) || 0;
      engagementCounts.set(engagement.type, count + 1);
    });
    dailyStat.engagements = engagementCounts;
  }

  private getStartDate(period: 'day' | 'week' | 'month' | 'year'): Date {
    const date = new Date();
    switch (period) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date;
  }

  private getPeriodStats(items: any[], startDate: Date) {
    const filteredItems = items.filter(item => item.timestamp >= startDate);
    
    return {
      total: filteredItems.length,
      timeline: this.generateTimeline(filteredItems, startDate),
    };
  }

  private generateTimeline(items: any[], startDate: Date) {
    const timeline: Record<string, number> = {};
    const current = new Date(startDate);
    const end = new Date();

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      timeline[dateKey] = 0;
      current.setDate(current.getDate() + 1);
    }

    items.forEach(item => {
      const dateKey = item.timestamp.toISOString().split('T')[0];
      timeline[dateKey] = (timeline[dateKey] || 0) + 1;
    });

    return timeline;
  }

  /**
   * Get the number of interactions between two users within a specified timeframe
   */
  async getInteractionCount(
    userId: mongoose.Types.ObjectId, 
    connectionId: mongoose.Types.ObjectId, 
    startDate: Date
  ): Promise<number> {
    try {
      // Count interactions from both directions
      const interactions = await Analytics.aggregate([
        {
          $match: {
            $or: [
              { 'engagements.user': userId },
              { 'engagements.user': connectionId }
            ],
            'engagements.timestamp': { $gte: startDate }
          }
        },
        {
          $unwind: '$engagements'
        },
        {
          $match: {
            $or: [
              { 
                'engagements.user': userId,
                'profileId': connectionId 
              },
              { 
                'engagements.user': connectionId,
                'profileId': userId 
              }
            ]
          }
        },
        {
          $count: 'interactionCount'
        }
      ]);

      return interactions.length > 0 ? interactions[0].interactionCount : 0;
    } catch (error) {
      console.error('Error getting interaction count:', error);
      logger.error('Error getting interaction count:', error);
      return 0;
    }
  }
}
