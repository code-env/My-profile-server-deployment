"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const Analytics_1 = require("../models/Analytics");
const notification_service_1 = require("./notification.service");
const logger_1 = require("../utils/logger");
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const geoip_lite_1 = __importDefault(require("geoip-lite"));
class AnalyticsService {
    constructor() {
        this.notificationService = new notification_service_1.NotificationService();
    }
    async trackProfileView(profileId, ownerId, viewerId, userAgent, ip) {
        console.log('Entering trackProfileView with params:', { profileId, ownerId, viewerId, userAgent, ip });
        try {
            let analytics = await Analytics_1.Analytics.findOne({ profileId });
            if (!analytics) {
                analytics = new Analytics_1.Analytics({
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
                await this.notificationService.createProfileViewNotification(profileId, viewerId, ownerId);
            }
            return analytics;
        }
        catch (error) {
            console.error('Error in trackProfileView:', error);
            logger_1.logger.error('Error tracking profile view:', error);
            throw error;
        }
    }
    async trackEngagement(profileId, ownerId, userId, type, metadata) {
        console.log('Entering trackEngagement with params:', { profileId, ownerId, userId, type, metadata });
        try {
            let analytics = await Analytics_1.Analytics.findOne({ profileId });
            if (!analytics) {
                analytics = new Analytics_1.Analytics({
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
        }
        catch (error) {
            console.error('Error in trackEngagement:', error);
            logger_1.logger.error('Error tracking engagement:', error);
            throw error;
        }
    }
    async getProfileAnalytics(profileId, period = 'month') {
        console.log('Entering getProfileAnalytics with params:', { profileId, period });
        try {
            const analytics = await Analytics_1.Analytics.findOne({ profileId });
            if (!analytics)
                return null;
            const startDate = this.getStartDate(period);
            return {
                overview: analytics.metrics,
                periodStats: {
                    views: this.getPeriodStats(analytics.views, startDate),
                    engagements: this.getPeriodStats(analytics.engagements, startDate),
                },
                dailyStats: analytics.dailyStats.filter(stat => stat.date >= startDate),
            };
        }
        catch (error) {
            console.error('Error in getProfileAnalytics:', error);
            logger_1.logger.error('Error getting profile analytics:', error);
            throw error;
        }
    }
    async getUserAnalytics(userId) {
        console.log('Entering getUserAnalytics with params:', { userId });
        try {
            const analytics = await Analytics_1.Analytics.find({ ownerId: userId });
            return analytics.map(profile => ({
                profileId: profile.profileId,
                metrics: profile.metrics,
                recentActivity: {
                    views: profile.views.slice(-5),
                    engagements: profile.engagements.slice(-5),
                },
            }));
        }
        catch (error) {
            console.error('Error in getUserAnalytics:', error);
            logger_1.logger.error('Error getting user analytics:', error);
            throw error;
        }
    }
    parseUserAgent(userAgent) {
        if (!userAgent)
            return {};
        const parseUserAgent = (ua) => {
            const parser = new ua_parser_js_1.default.UAParser(ua);
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
    parseLocation(ip) {
        if (!ip)
            return {};
        const geo = geoip_lite_1.default.lookup(ip);
        if (!geo)
            return {};
        return {
            country: geo.country,
            city: geo.city,
        };
    }
    isUniqueView(analytics, viewerId) {
        if (!viewerId)
            return true;
        const recentViews = analytics.views.filter(view => view.viewer && view.viewer.equals(viewerId) &&
            view.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000));
        return recentViews.length === 0;
    }
    updateDailyStats(analytics) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let dailyStat = analytics.dailyStats.find(stat => stat.date.getTime() === today.getTime());
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
        const todayViews = analytics.views.filter(view => view.timestamp >= today);
        dailyStat.views = todayViews === null || todayViews === void 0 ? void 0 : todayViews.length;
        dailyStat.uniqueViews = todayViews.filter(view => view.isUnique).length;
        // Update engagements for today
        const todayEngagements = analytics.engagements.filter(engagement => engagement.timestamp >= today);
        const engagementCounts = new Map();
        todayEngagements.forEach(engagement => {
            const count = engagementCounts.get(engagement.type) || 0;
            engagementCounts.set(engagement.type, count + 1);
        });
        dailyStat.engagements = engagementCounts;
    }
    getStartDate(period) {
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
    getPeriodStats(items, startDate) {
        const filteredItems = items.filter(item => item.timestamp >= startDate);
        return {
            total: filteredItems.length,
            timeline: this.generateTimeline(filteredItems, startDate),
        };
    }
    generateTimeline(items, startDate) {
        const timeline = {};
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
    async getInteractionCount(userId, connectionId, startDate) {
        try {
            // Count interactions from both directions
            const interactions = await Analytics_1.Analytics.aggregate([
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
        }
        catch (error) {
            console.error('Error getting interaction count:', error);
            logger_1.logger.error('Error getting interaction count:', error);
            return 0;
        }
    }
}
exports.AnalyticsService = AnalyticsService;
