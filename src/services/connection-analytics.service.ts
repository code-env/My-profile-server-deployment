import mongoose from 'mongoose';
import { Connection } from '../models/Connection';
import { ProfileModel } from '../models/profile.model';
import { Message } from '../models/message.model';
import { AnalyticsService } from './analytics.service';
import { logger } from '../utils/logger';

interface ConnectionStrength {
  score: number;
  factors: {
    interactionFrequency: number;
    mutualConnections: number;
    engagementDuration: number;
    sharedInterests: number;
    messageFrequency: number;
    lastInteraction: Date;
  };
  metadata: {
    strongestFactors: string[];
    suggestedActions?: string[];
  };
}

export class ConnectionAnalyticsService {
  private static analyticsService = new AnalyticsService();
  private static SCORE_WEIGHTS = {
    interactionFrequency: 0.25,
    mutualConnections: 0.15,
    engagementDuration: 0.20,
    sharedInterests: 0.15,
    messageFrequency: 0.25
  };

  /**
   * Calculate connection strength score between two users
   */
  static async calculateConnectionStrength(
    userId: mongoose.Types.ObjectId,
    connectionId: mongoose.Types.ObjectId
  ): Promise<ConnectionStrength> {
    try {
      const connection = await Connection.findOne({
        $or: [
          { fromUser: userId, toProfile: connectionId },
          { fromUser: connectionId, toProfile: userId }
        ]
      });

      if (!connection) {
        throw new Error('Connection not found');
      }

      const [
        interactionFrequency,
        mutualConnections,
        messageFrequency,
        sharedInterests
      ] = await Promise.all([
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
    } catch (error) {
      logger.error('Error calculating connection strength:', error);
      throw error;
    }
  }

  /**
   * Calculate interaction frequency score (0-1)
   */
  private static async calculateInteractionFrequency(
    userId: mongoose.Types.ObjectId,
    connectionId: mongoose.Types.ObjectId,
    timeframe: number = 30 // days
  ): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    const interactions = await this.analyticsService.getInteractionCount(
      userId,
      connectionId,
      startDate
    );

    // Normalize score (assuming 20 interactions per month is maximum)
    return Math.min(interactions / 20, 1);
  }

  /**
   * Calculate mutual connections score (0-1)
   */
  private static async calculateMutualConnections(
    userId: mongoose.Types.ObjectId,
    connectionId: mongoose.Types.ObjectId
  ): Promise<number> {
    const [userConnections, connectionConnections] = await Promise.all([
      Connection.find({ fromUser: userId, status: 'accepted' }).distinct('toProfile'),
      Connection.find({ fromUser: connectionId, status: 'accepted' }).distinct('toProfile')
    ]);

    const mutualCount = userConnections.filter(conn => 
      connectionConnections.some(otherConn => otherConn.equals(conn))
    ).length;

    // Normalize score (assuming 10 mutual connections is maximum)
    return Math.min(mutualCount / 10, 1);
  }

  /**
   * Calculate message frequency score (0-1)
   */
  private static async calculateMessageFrequency(
    userId: mongoose.Types.ObjectId,
    connectionId: mongoose.Types.ObjectId,
    timeframe: number = 30 // days
  ): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframe);

    const messageCount = await Message.countDocuments({
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
  private static async calculateSharedInterests(
    userId: mongoose.Types.ObjectId,
    connectionId: mongoose.Types.ObjectId
  ): Promise<number> {
    const [userProfile, connectionProfile] = await Promise.all([
      ProfileModel.findOne({ owner: userId }),
      ProfileModel.findOne({ owner: connectionId })
    ]);

    if (!userProfile || !connectionProfile) {
      return 0;
    }

    // Compare skills, interests, and industry
    const sharedSkills = userProfile.skills.filter(skill =>
      connectionProfile.skills.includes(skill)
    ).length;

    // const sharedIndustries = userProfile.industries.filter((industry: any) =>
    //   connectionProfile.industries.includes(industry)
    // ).length;

    // Normalize score (assuming 5 shared items is maximum)
    return Math.min((sharedSkills) / 5, 1);
  }

  /**
   * Calculate engagement duration score (0-1)
   */
  private static calculateEngagementDuration(
    connectionDate: Date,
    maxDuration: number = 365 // days
  ): number {
    const durationInDays = (new Date().getTime() - connectionDate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.min(durationInDays / maxDuration, 1);
  }

  /**
   * Calculate weighted score
   */
  private static calculateWeightedScore(factors: ConnectionStrength['factors']): number {
    return (
      factors.interactionFrequency * this.SCORE_WEIGHTS.interactionFrequency +
      factors.mutualConnections * this.SCORE_WEIGHTS.mutualConnections +
      factors.engagementDuration * this.SCORE_WEIGHTS.engagementDuration +
      factors.sharedInterests * this.SCORE_WEIGHTS.sharedInterests +
      factors.messageFrequency * this.SCORE_WEIGHTS.messageFrequency
    );
  }

  /**
   * Identify strongest connection factors
   */
  private static identifyStrongFactors(factors: ConnectionStrength['factors']): string[] {
    const threshold = 0.7; // Strong factor threshold
    const strongFactors: string[] = [];

    if (factors.interactionFrequency >= threshold) strongFactors.push('High interaction frequency');
    if (factors.mutualConnections >= threshold) strongFactors.push('Strong mutual network');
    if (factors.engagementDuration >= threshold) strongFactors.push('Long-term connection');
    if (factors.sharedInterests >= threshold) strongFactors.push('Many shared interests');
    if (factors.messageFrequency >= threshold) strongFactors.push('Active communication');

    return strongFactors;
  }

  /**
   * Generate suggested actions to strengthen connection
   */
  private static generateSuggestedActions(factors: ConnectionStrength['factors']): string[] {
    const suggestions: string[] = [];
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
    const daysSinceLastInteraction = 
      (new Date().getTime() - factors.lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastInteraction > 30) {
      suggestions.push('Reconnect with this contact - it\'s been a while');
    }

    return suggestions;
  }

  /**
   * Get connection strength history
   */
  static async getConnectionStrengthHistory(
    userId: mongoose.Types.ObjectId,
    connectionId: mongoose.Types.ObjectId,
    period: 'week' | 'month' | 'year' = 'month'
  ) {
    // Implementation for historical strength tracking
    // This will be used for trending and analytics
  }
}
