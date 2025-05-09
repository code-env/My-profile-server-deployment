import { Connection } from '../models/Connection';
import { ProfileModel } from '../models/profile.model';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { NotificationService } from '../services/notification.service';
import { AnalyticsService } from '../services/analytics.service';
import { ConnectionAnalyticsService } from './connection-analytics.service';
import mongoose, { Mongoose } from 'mongoose';

class ConnectionService {
  private static notificationService = new NotificationService();
  private static analyticsService = new AnalyticsService();
  private static connectionAnalytics = new ConnectionAnalyticsService();

  static async createConnection(
    fromUserId: any,
    toProfileId: string,
    connectionType: string,
    details: {
      message?: string;
      amount?: number;
      employmentDetails?: {
        position?: string;
        company?: string;
        salary?: string;
        startDate?: Date;
      };
      metadata?: Record<string, any>;
      source?: 'qr' | 'link' | 'direct';
    }
  ) {
    console.log('Entering createConnection with params:', { fromUserId, toProfileId, connectionType, details });
    try {
      const profile = await ProfileModel.findById(toProfileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Check if connection is allowed based on profile preferences
      if (!this.isConnectionAllowed(profile, connectionType)) {
        throw new Error(`This profile does not accept ${connectionType} connections`);
      }

      // Validate donation amount if applicable
      // if (connectionType === 'donation' &&
      //     profile.connectionPreferences.minimumDonation &&
      //     (!details.amount || details.amount < profile.connectionPreferences.minimumDonation)) {
      //   throw new Error(`Minimum donation amount is ${profile.connectionPreferences.minimumDonation}`);
      // }

      // Check for existing connection
      const existingConnection = await Connection.findOne({
        fromUser: fromUserId,
        toProfile: toProfileId,
        connectionType,
        status: { $in: ['pending', 'accepted'] },
      });

      if (existingConnection) {
        throw new Error('Connection already exists');
      }

      // Determine if connection should be auto-accepted
      const shouldAutoAccept = this.shouldAutoAcceptConnection(profile, details.source, connectionType);

      // Create new connection
      const connection = await Connection.create({
        fromUser: fromUserId,
        toProfile: toProfileId,
        connectionType,
        status: shouldAutoAccept ? 'accepted' : 'pending',
        message: details.message,
        amount: details.amount,
        employmentDetails: details.employmentDetails,
        metadata: {
          ...details.metadata,
          source: details.source
        },
      });

      // If connection is automatically accepted, update profile stats and connections
      if (shouldAutoAccept) {
        await this.updateProfileConnections(toProfileId, fromUserId, connectionType, 'add');

        // Track the engagement
        await this.analyticsService.trackEngagement(
          toProfileId,
          profile.profileInformation.creator.toString(),
          fromUserId,
          'connect',
          { connectionType, source: details.source }
        );

        // Send notification for auto-accepted connection
        await this.notificationService.createNotification({
          type: 'CONNECTION_ACCEPTED',
          recipient: fromUserId,
          sender: profile.profileInformation.creator instanceof mongoose.Types.ObjectId ? profile.profileInformation.creator : new mongoose.Types.ObjectId(profile.profileInformation.creator),
          reference: {
            type: 'connection',
            id: connection._id
          },
          metadata: {
            connectionType,
            profileName: profile.profileInformation.username,
            source: details.source
          }
        });
      } else {
        // Send connection request notification
        await this.notificationService.createNotification({
          type: 'CONNECTION_REQUEST',
          recipient: profile.profileInformation.creator,
          sender: new mongoose.Types.ObjectId(fromUserId),
          reference: {
            type: 'connection',
            id: connection._id
          },
          metadata: {
            connectionType,
            message: details.message,
            source: details.source
          }
        });
      }

      return connection;
    } catch (error) {
      logger.error('Error in createConnection:', error);
      throw error;
    }
  }

  static async updateConnectionStatus(connectionId: string, status: 'accepted' | 'rejected') {
    console.log('Entering updateConnectionStatus with params:', { connectionId, status });
    try {
      const connection = await Connection.findById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const oldStatus = connection.status;
      connection.status = status;
      await connection.save();

      // Update profile connections when status changes to accepted
      if (oldStatus !== 'accepted' && status === 'accepted') {
        await this.updateProfileConnections(
          connection.toProfile.toString(),
          connection.fromUser.toString(),
          connection.connectionType,
          'add'
        );
      }
      // Remove from connections when status changes from accepted to rejected
      else if (oldStatus === 'accepted' && status === 'rejected') {
        await this.updateProfileConnections(
          connection.toProfile.toString(),
          connection.fromUser.toString(),
          connection.connectionType,
          'remove'
        );
      }

      return connection;
    } catch (error) {
      logger.error('Error in updateConnectionStatus:', error);
      throw error;
    }
  }

  static async getProfileConnections(profileId: string, status?: string) {
    console.log('Entering getProfileConnections with params:', { profileId, status });
    try {
      const query: any = { toProfile: profileId };
      if (status) {
        query.status = status;
      }

      return await Connection.find(query)
        .populate('fromUser', 'firstName lastName email profileImage')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error in getProfileConnections:', error);
      logger.error('Get profile connections error:', error);
      throw error;
    }
  }

  static async getUserConnections(userId: string, status?: string) {
    console.log('Entering getUserConnections with params:', { userId, status });
    try {
      const query: any = { fromUser: userId };
      if (status) {
        query.status = status;
      }

      return await Connection.find(query)
        .populate('toProfile', 'name profileType profileImage')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error in getUserConnections:', error);
      logger.error('Get user connections error:', error);
      throw error;
    }
  }

  static async getPendingConnections(userId: string) {
    try {
      const userProfileIds = await this.getUserProfileIds(userId);

      const pendingConnections = await Connection.find({
        $or: [
          { fromUser: userId, status: 'pending' },
          {
            toProfile: { $in: userProfileIds },
            status: 'pending'
          }
        ]
      })
      .populate('fromUser', 'username email fullName')
      .populate('toProfile', 'name type category');

      return pendingConnections;
    } catch (error) {
      logger.error('Get pending connections error:', error);
      throw error;
    }
  }

  static async getConnectionStats(userId: string) {
    try {
      const userProfileIds = await this.getUserProfileIds(userId);

      const [sent, received, accepted, pending] = await Promise.all([
        Connection.countDocuments({ fromUser: userId }),
        Connection.countDocuments({ toProfile: { $in: userProfileIds } }),
        Connection.countDocuments({
          $or: [
            { fromUser: userId, status: 'accepted' },
            { toProfile: { $in: userProfileIds }, status: 'accepted' }
          ]
        }),
        Connection.countDocuments({
          $or: [
            { fromUser: userId, status: 'pending' },
            { toProfile: { $in: userProfileIds }, status: 'pending' }
          ]
        })
      ]);

      return {
        total: sent + received,
        sent,
        received,
        accepted,
        pending
      };
    } catch (error) {
      logger.error('Get connection stats error:', error);
      throw error;
    }
  }

  static async removeConnection(connectionId: string, userId: string) {
    try {
      const connection = await Connection.findOne({
        _id: connectionId,
        $or: [
          { fromUser: userId },
          { toProfile: { $in: await this.getUserProfileIds(userId) } }
        ]
      });

      if (!connection) {
        throw new Error('Connection not found or unauthorized');
      }

      await connection.deleteOne();
      await this.updateProfileStats(connection.toProfile.toString(), connection.connectionType, 'decrement');
    } catch (error) {
      logger.error('Remove connection error:', error);
      throw error;
    }
  }

  static async getConnectionSuggestions(userId: string) {
    try {
      // Get user's interests and skills from their profiles
      const userProfiles = await ProfileModel.find({ user: userId });

      // Since 'interests' is not defined, we'll use skills as a fallback
      // const userSkills = userProfiles.flatMap((profile) => profile.skills?.map(skill => skill.name) || []);

      // Find profiles with similar skills
      // const suggestions = await ProfileModel.find({
      //   user: { $ne: userId },
      //   'skills.name': { $in: userSkills }
      // })
      // .populate('user', 'username email fullName')
      // .limit(10);

      // return suggestions;
    } catch (error) {
      logger.error('Error in getConnectionSuggestions:', error);
      throw error;
    }
  }

  static async trackInteraction(
    fromUserId: any,
    toProfileId: string,
    type: 'view' | 'message' | 'engage' | 'endorse' | 'share' | any,
    metadata?: Record<string, any>
  ) {
    try {
      await this.analyticsService.trackEngagement(
        toProfileId,
        toProfileId, // profile owner
        fromUserId,
        type,
        metadata
      );

      // Update last interaction timestamp
      await Connection.findOneAndUpdate(
        {
          $or: [
            { fromUser: new mongoose.Types.ObjectId(fromUserId), toProfile: new mongoose.Types.ObjectId(toProfileId) },
            { fromUser: new mongoose.Types.ObjectId(toProfileId), toProfile: new mongoose.Types.ObjectId(fromUserId) }
          ]
        },
        { $set: { lastInteractionAt: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      logger.error('Error tracking interaction:', error);
      throw error;
    }
  }

  static async getConnectionStrength(userId: string, connectionId: string) {
    return ConnectionAnalyticsService.calculateConnectionStrength(
      new mongoose.Types.ObjectId(userId),
      new mongoose.Types.ObjectId(connectionId)
    );
  }

  private static async getUserProfileIds(userId: string): Promise<string[]> {
    const profiles:any = await ProfileModel.find({ user: userId });
    return profiles.map((profile: { _id: { toString: () => any; }; }) => profile._id.toString());
  }

  private static isConnectionAllowed(profile: any, connectionType: string): boolean {
    if (!profile.connectionPreferences) return true;

    const { allowedConnectionTypes } = profile.connectionPreferences;
    return !allowedConnectionTypes || allowedConnectionTypes.includes(connectionType);
  }

  private static async updateProfileStats(
    profileId: string,
    connectionType: string,
    operation: 'increment' | 'decrement'
  ) {
    const profile: any = await ProfileModel.findById(profileId);
    if (!profile) return;

    const modifier = operation === 'increment' ? 1 : -1;

    if (!profile.stats) profile.stats = {};
    if (!profile.stats.connections) profile.stats.connections = {};

    profile.stats.connections[connectionType] =
      (profile.stats.connections[connectionType] || 0) + modifier;

    await profile.save();
  }

  private static async updateProfileConnections(
    profileId: string,
    userId: string,
    connectionType: string,
    operation: 'add' | 'remove'
  ) {
    const profile:any = await ProfileModel.findById(profileId);
    if (!profile) throw new Error('Profile not found');

    const updateOperations: any = {};

    // Update arrays based on operation
    if (operation === 'add') {
      // Add to appropriate arrays if not already present
      if (!profile.connections.connected.includes(userId)) {
        updateOperations.$push = {
          'connections.connected': userId,
          'connections.lastConnections': {
            user: userId,
            connectionType,
            connectedAt: new Date()
          }
        };
      }

      // Update specific connection type counts
      if (connectionType === 'follow') {
        updateOperations.$inc = { 'stats.followers': 1 };
        updateOperations.$push = {
          ...updateOperations.$push,
          'connections.followers': userId
        };
      }
    } else {
      // Remove from arrays
      updateOperations.$pull = {
        'connections.connected': userId,
        'connections.followers': userId,
        'connections.following': userId
      };

      // Update specific connection type counts
      if (connectionType === 'follow') {
        updateOperations.$inc = { 'stats.followers': -1 };
      }
    }

    // Limit lastConnections array to last 10 connections
    updateOperations.$push = {
      ...updateOperations.$push,
      'connections.lastConnections': { $each: [], $slice: -10 }
    };

    await ProfileModel.updateOne(
      { _id: profileId },
      updateOperations
    );
  }

  private static shouldAutoAcceptConnection(
    profile: any,
    source?: 'qr' | 'link' | 'direct',
    connectionType?: string
  ): boolean {
    const { connectionPreferences } = profile;

    // If profile has automatic approval setting
    if (connectionPreferences.connectionApproval === 'automatic') {
      return true;
    }

    // Auto-accept connections from QR codes and connect links if verification isn't required
    if (connectionPreferences.connectionApproval !== 'verified-only' &&
        (source === 'qr' || source === 'link')) {
      return true;
    }

    // Auto-accept followers if allowed
    if (connectionType === 'follow' && connectionPreferences.allowFollowers) {
      return true;
    }

    return false;
  }
}

export default ConnectionService;
