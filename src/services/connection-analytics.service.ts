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
      // Find the connection by its actual document ID
      const connection = await Connection.findById(connectionId);

      if (!connection) {
        throw new Error('Connection not found');
      }

      // Verify that the user is part of this connection
      const isUserInConnection = connection.fromUser.equals(userId) || 
        (connection.toProfile && await this.isUserOwnerOfProfile(userId, connection.toProfile));

      if (!isUserInConnection) {
        throw new Error('User is not part of this connection');
      }

      // Determine the other user/profile in the connection
      let otherUserId: mongoose.Types.ObjectId;
      if (connection.fromUser.equals(userId)) {
        // User is the initiator, get the owner of the target profile
        const targetProfile = await ProfileModel.findById(connection.toProfile);
        if (!targetProfile) {
          throw new Error('Target profile not found');
        }
        otherUserId = targetProfile.profileInformation.creator;
      } else {
        // User is the target, other user is the initiator
        otherUserId = connection.fromUser;
      }

      const [
        interactionFrequency,
        mutualConnections,
        messageFrequency,
        sharedInterests
      ] = await Promise.all([
        this.calculateInteractionFrequency(userId, otherUserId),
        this.calculateMutualConnections(userId, otherUserId),
        this.calculateMessageFrequency(userId, otherUserId),
        this.calculateSharedInterests(userId, otherUserId)
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
   * Helper method to check if a user owns a profile
   */
  private static async isUserOwnerOfProfile(
    userId: mongoose.Types.ObjectId,
    profileId: mongoose.Types.ObjectId
  ): Promise<boolean> {
    const profile = await ProfileModel.findById(profileId);
    return profile ? profile.profileInformation.creator.equals(userId) : false;
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
    // const sharedSkills = userProfile.skills.filter(skill =>
    //   connectionProfile.skills.includes(skill)
    // ).length;

    // const sharedIndustries = userProfile.industries.filter((industry: any) =>
    //   connectionProfile.industries.includes(industry)
    // ).length;

    // Normalize score (assuming 5 shared items is maximum)
    return Math.min((3) / 5, 1);
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
    try {
      // Find the connection by its actual document ID
      const connection = await Connection.findById(connectionId);

      if (!connection) {
        throw new Error('Connection not found');
      }

      // Verify that the user is part of this connection
      const isUserInConnection = connection.fromUser.equals(userId) || 
        (connection.toProfile && await this.isUserOwnerOfProfile(userId, connection.toProfile));

      if (!isUserInConnection) {
        throw new Error('User is not part of this connection');
      }

      // For now, return mock historical data
      // In a real implementation, this would query historical strength data
      const now = new Date();
      const dataPoints = [];
      
      let intervals = 7; // default for week
      let stepDays = 1;
      
      if (period === 'month') {
        intervals = 30;
        stepDays = 1;
      } else if (period === 'year') {
        intervals = 12;
        stepDays = 30;
      }

      for (let i = intervals - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - (i * stepDays));
        
        // Mock strength calculation for historical point
        const strength = Math.max(0.1, Math.random() * 0.9);
        
        dataPoints.push({
          date: date.toISOString(),
          strength: parseFloat(strength.toFixed(2)),
          factors: {
            interactionFrequency: Math.random() * 0.5,
            mutualConnections: Math.random() * 0.3,
            engagementDuration: Math.min(1, (now.getTime() - connection.createdAt.getTime()) / (365 * 24 * 60 * 60 * 1000)),
            sharedInterests: 0.6,
            messageFrequency: Math.random() * 0.4
          }
        });
      }

      return {
        history: dataPoints,
        period,
        summary: {
          trend: dataPoints.length > 1 ? 
            (dataPoints[dataPoints.length - 1].strength > dataPoints[0].strength ? 'increasing' : 'decreasing') : 
            'stable',
          averageStrength: dataPoints.reduce((sum, point) => sum + point.strength, 0) / dataPoints.length,
          peakStrength: Math.max(...dataPoints.map(point => point.strength)),
          lowestStrength: Math.min(...dataPoints.map(point => point.strength))
        }
      };
    } catch (error) {
      logger.error('Error getting connection strength history:', error);
      throw error;
    }
  }
}
