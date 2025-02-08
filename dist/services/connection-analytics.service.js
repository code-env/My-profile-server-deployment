"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionAnalyticsService = void 0;
const Connection_1 = require("../models/Connection");
const profile_model_1 = require("../models/profile.model");
const message_model_1 = require("../models/message.model");
const analytics_service_1 = require("./analytics.service");
const logger_1 = require("../utils/logger");
class ConnectionAnalyticsService {
    /**
     * Calculate connection strength score between two users
     */
    static async calculateConnectionStrength(userId, connectionId) {
        try {
            const connection = await Connection_1.Connection.findOne({
                $or: [
                    { fromUser: userId, toProfile: connectionId },
                    { fromUser: connectionId, toProfile: userId }
                ]
            });
            if (!connection) {
                throw new Error('Connection not found');
            }
            const [interactionFrequency, mutualConnections, messageFrequency, sharedInterests] = await Promise.all([
                this.calculateInteractionFrequency(userId, connectionId),
                this.calculateMutualConnections(userId, connectionId),
                this.calculateMessageFrequency(userId, connectionId),
                this.calculateSharedInterests(userId, connectionId)
            ]);
            const engagementDuration = this.calculateEngagementDuration(connection.createdAt);
            // Calculate weighted score
            const factors = {
                interactionFrequency,
                mutualConnections,
                engagementDuration,
                sharedInterests,
                messageFrequency,
                lastInteraction: connection.updatedAt
            };
            const score = this.calculateWeightedScore(factors);
            const strongestFactors = this.identifyStrongFactors(factors);
            const suggestedActions = this.generateSuggestedActions(factors);
            return {
                score,
                factors,
                metadata: {
                    strongestFactors,
                    suggestedActions
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Error calculating connection strength:', error);
            throw error;
        }
    }
    /**
     * Calculate interaction frequency score (0-1)
     */
    static async calculateInteractionFrequency(userId, connectionId, timeframe = 30 // days
    ) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        const interactions = await this.analyticsService.getInteractionCount(userId, connectionId, startDate);
        // Normalize score (assuming 20 interactions per month is maximum)
        return Math.min(interactions / 20, 1);
    }
    /**
     * Calculate mutual connections score (0-1)
     */
    static async calculateMutualConnections(userId, connectionId) {
        const [userConnections, connectionConnections] = await Promise.all([
            Connection_1.Connection.find({ fromUser: userId, status: 'accepted' }).distinct('toProfile'),
            Connection_1.Connection.find({ fromUser: connectionId, status: 'accepted' }).distinct('toProfile')
        ]);
        const mutualCount = userConnections.filter(conn => connectionConnections.some(otherConn => otherConn.equals(conn))).length;
        // Normalize score (assuming 10 mutual connections is maximum)
        return Math.min(mutualCount / 10, 1);
    }
    /**
     * Calculate message frequency score (0-1)
     */
    static async calculateMessageFrequency(userId, connectionId, timeframe = 30 // days
    ) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframe);
        const messageCount = await message_model_1.Message.countDocuments({
            $or: [
                { sender: userId, recipient: connectionId },
                { sender: connectionId, recipient: userId }
            ],
            createdAt: { $gte: startDate }
        });
        // Normalize score (assuming 50 messages per month is maximum)
        return Math.min(messageCount / 50, 1);
    }
    /**
     * Calculate shared interests score (0-1)
     */
    static async calculateSharedInterests(userId, connectionId) {
        const [userProfile, connectionProfile] = await Promise.all([
            profile_model_1.ProfileModel.findOne({ owner: userId }),
            profile_model_1.ProfileModel.findOne({ owner: connectionId })
        ]);
        if (!userProfile || !connectionProfile) {
            return 0;
        }
        // Compare skills, interests, and industry
        const sharedSkills = userProfile.skills.filter(skill => connectionProfile.skills.includes(skill)).length;
        // const sharedIndustries = userProfile.industries.filter((industry: any) =>
        //   connectionProfile.industries.includes(industry)
        // ).length;
        // Normalize score (assuming 5 shared items is maximum)
        return Math.min((sharedSkills) / 5, 1);
    }
    /**
     * Calculate engagement duration score (0-1)
     */
    static calculateEngagementDuration(connectionDate, maxDuration = 365 // days
    ) {
        const durationInDays = (new Date().getTime() - connectionDate.getTime()) / (1000 * 60 * 60 * 24);
        return Math.min(durationInDays / maxDuration, 1);
    }
    /**
     * Calculate weighted score
     */
    static calculateWeightedScore(factors) {
        return (factors.interactionFrequency * this.SCORE_WEIGHTS.interactionFrequency +
            factors.mutualConnections * this.SCORE_WEIGHTS.mutualConnections +
            factors.engagementDuration * this.SCORE_WEIGHTS.engagementDuration +
            factors.sharedInterests * this.SCORE_WEIGHTS.sharedInterests +
            factors.messageFrequency * this.SCORE_WEIGHTS.messageFrequency);
    }
    /**
     * Identify strongest connection factors
     */
    static identifyStrongFactors(factors) {
        const threshold = 0.7; // Strong factor threshold
        const strongFactors = [];
        if (factors.interactionFrequency >= threshold)
            strongFactors.push('High interaction frequency');
        if (factors.mutualConnections >= threshold)
            strongFactors.push('Strong mutual network');
        if (factors.engagementDuration >= threshold)
            strongFactors.push('Long-term connection');
        if (factors.sharedInterests >= threshold)
            strongFactors.push('Many shared interests');
        if (factors.messageFrequency >= threshold)
            strongFactors.push('Active communication');
        return strongFactors;
    }
    /**
     * Generate suggested actions to strengthen connection
     */
    static generateSuggestedActions(factors) {
        const suggestions = [];
        const threshold = 0.3; // Weak factor threshold
        if (factors.interactionFrequency < threshold) {
            suggestions.push('Increase interaction frequency by engaging with their content');
        }
        if (factors.messageFrequency < threshold) {
            suggestions.push('Start a conversation or schedule a catch-up');
        }
        if (factors.mutualConnections < threshold) {
            suggestions.push('Explore and connect with mutual connections');
        }
        if (factors.sharedInterests < threshold) {
            suggestions.push('Update your profile with more detailed interests and skills');
        }
        // Check for recent inactivity
        const daysSinceLastInteraction = (new Date().getTime() - factors.lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastInteraction > 30) {
            suggestions.push('Reconnect with this contact - it\'s been a while');
        }
        return suggestions;
    }
    /**
     * Get connection strength history
     */
    static async getConnectionStrengthHistory(userId, connectionId, period = 'month') {
        // Implementation for historical strength tracking
        // This will be used for trending and analytics
    }
}
exports.ConnectionAnalyticsService = ConnectionAnalyticsService;
ConnectionAnalyticsService.analyticsService = new analytics_service_1.AnalyticsService();
ConnectionAnalyticsService.SCORE_WEIGHTS = {
    interactionFrequency: 0.25,
    mutualConnections: 0.15,
    engagementDuration: 0.20,
    sharedInterests: 0.15,
    messageFrequency: 0.25
};
