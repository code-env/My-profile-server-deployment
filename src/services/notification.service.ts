import { Notification, INotification } from '../models/Notification';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { Server as SocketServer } from 'socket.io';
import mongoose from 'mongoose';

export const notificationEvents = new EventEmitter();

export class NotificationService {
  private io: SocketServer | null = null;

  constructor() {
    // Listen for notification events
    notificationEvents.on('notification:created', this.handleNotificationCreated.bind(this));
  }

  setSocketServer(io: SocketServer) {
    this.io = io;
  }

  private async handleNotificationCreated(notification: INotification) {
    console.log('Entering handleNotificationCreated with notification:', notification);
    try {
      // Emit to connected socket if available
      if (this.io) {
        this.io.to(`user:${notification.recipient}`).emit('notification:new', notification);
      }

      // Send push notification if user has enabled them
      await this.sendPushNotification(notification);

    } catch (error) {
      console.error('Error in handleNotificationCreated:', error);
      logger.error('Error handling notification creation:', error);
    }
  }

  private async sendPushNotification(notification: INotification) {
    console.log('Entering sendPushNotification with notification:', notification);
    try {
      const user = await User.findById(notification.recipient);
      if (!user) return;

      // TODO: Implement push notification logic here
      // This could integrate with Firebase Cloud Messaging, OneSignal, or other providers
    } catch (error) {
      console.error('Error in sendPushNotification:', error);
      logger.error('Error sending push notification:', error);
    }
  }

  async createNotification(data: Partial<INotification | any>) {
    console.log('Entering createNotification with data:', data);
    try {
      const notification = await Notification.create(data);
      notificationEvents.emit('notification:created', notification);
      return notification;
    } catch (error) {
      console.error('Error in createNotification:', error);
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId: mongoose.Types.ObjectId, query: {
    isRead?: boolean;
    isArchived?: boolean;
    limit?: number;
    page?: number;
  }) {
    console.log('Entering getUserNotifications with userId and query:', userId, query);
    try {
      const { isRead, isArchived = false, limit = 10, page = 1 } = query;

      const filter: any = {
        recipient: userId,
        isArchived,
      };

      if (typeof isRead === 'boolean') {
        filter.isRead = isRead;
      }

      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments(filter);

      return {
        notifications,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page,
          limit,
        },
      };
    } catch (error) {
      console.error('Error in getUserNotifications:', error);
      logger.error('Error getting user notifications:', error);
    }
  }

  async markAsRead(notificationId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
    console.log('Entering markAsRead with notificationId and userId:', notificationId, userId);
    try {
      return Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true },
        { new: true }
      );
    } catch (error) {
      console.error('Error in markAsRead:', error);
      logger.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead(userId: mongoose.Types.ObjectId) {
    console.log('Entering markAllAsRead with userId:', userId);
    try {
      return Notification.updateMany(
        { recipient: userId, isRead: false },
        { isRead: true }
      );
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
      logger.error('Error marking all notifications as read:', error);
    }
  }

  async archiveNotification(notificationId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
    console.log('Entering archiveNotification with notificationId and userId:', notificationId, userId);
    try {
      return Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isArchived: true },
        { new: true }
      );
    } catch (error) {
      console.error('Error in archiveNotification:', error);
      logger.error('Error archiving notification:', error);
    }
  }

  async deleteNotification(notificationId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
    console.log('Entering deleteNotification with notificationId and userId:', notificationId, userId);
    try {
      return Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
    } catch (error) {
      console.error('Error in deleteNotification:', error);
      logger.error('Error deleting notification:', error);
    }
  }

  // Helper method to create common notification types
  async createProfileViewNotification(profileId: mongoose.Types.ObjectId, viewerId: mongoose.Types.ObjectId, profileOwnerId: mongoose.Types.ObjectId) {
    console.log('Entering createProfileViewNotification with profileId, viewerId, and profileOwnerId:', profileId, viewerId, profileOwnerId);
    try {
      const viewer:any = await User.findById(viewerId).select('firstName lastName');
      if (!viewer) return;

      return this.createNotification({
        recipient: profileOwnerId,
        type: 'profile_view',
        title: 'New Profile View',
        message: `${viewer.firstName} ${viewer.lastName} viewed your profile`,
        relatedTo: {
          model: 'Profile',
          id: profileId,
        },
        priority: 'low',
      });
    } catch (error :any) {
      console.error('Error in createProfileViewNotification:', error);
      logger.error('Error creating profile view notification:', error);
    }
  }

  async createConnectionRequestNotification(requesterId: mongoose.Types.ObjectId, recipientId: mongoose.Types.ObjectId) {
    console.log('Entering createConnectionRequestNotification with requesterId and recipientId:', requesterId, recipientId);
    try {
      const requester:any = await User.findById(requesterId).select('firstName lastName');
      if (!requester) return;

      return this.createNotification({
        recipient: recipientId,
        type: 'connection_request',
        title: 'New Connection Request',
        message: `${requester.firstName} ${requester.lastName} wants to connect with you`,
        relatedTo: {
          model: 'User',
          id: requesterId,
        },
        action: {
          text: 'View Request',
          url: `/connections/requests/${requesterId}`,
        },
        priority: 'medium',
      });
    } catch (error) {
      console.error('Error in createConnectionRequestNotification:', error);
      logger.error('Error creating connection request notification:', error);
    }
  }

  async createProfileConnectionRequestNotification(requesterProfileId: mongoose.Types.ObjectId, receiverProfileId: mongoose.Types.ObjectId, connectionId: mongoose.Types.ObjectId) {
    console.log('Entering createProfileConnectionRequestNotification with requesterProfileId and receiverProfileId:', requesterProfileId, receiverProfileId);
    try {
      // Get the profiles
      const ProfileModel = mongoose.model('Profile');
      const requesterProfile = await ProfileModel.findById(requesterProfileId).select('name profileImage owner');
      const receiverProfile = await ProfileModel.findById(receiverProfileId).select('name owner');

      if (!requesterProfile || !receiverProfile) return;

      return this.createNotification({
        recipient: receiverProfile.owner,
        type: 'profile_connection_request',
        title: 'New Profile Connection Request',
        message: `${requesterProfile.name} wants to connect with your profile ${receiverProfile.name}`,
        relatedTo: {
          model: 'ProfileConnection',
          id: connectionId,
        },
        action: {
          text: 'View Request',
          url: `/profiles/${receiverProfileId}/connections/requests`,
        },
        priority: 'medium',
        data: {
          requesterProfileId,
          receiverProfileId,
          connectionId,
          requesterProfileName: requesterProfile.name,
          requesterProfileImage: requesterProfile.profileImage
        }
      });
    } catch (error) {
      console.error('Error in createProfileConnectionRequestNotification:', error);
      logger.error('Error creating profile connection request notification:', error);
    }
  }

  async createProfileConnectionAcceptedNotification(requesterProfileId: mongoose.Types.ObjectId, receiverProfileId: mongoose.Types.ObjectId, connectionId: mongoose.Types.ObjectId) {
    console.log('Entering createProfileConnectionAcceptedNotification with requesterProfileId and receiverProfileId:', requesterProfileId, receiverProfileId);
    try {
      // Get the profiles
      const ProfileModel = mongoose.model('Profile');
      const requesterProfile = await ProfileModel.findById(requesterProfileId).select('name owner');
      const receiverProfile = await ProfileModel.findById(receiverProfileId).select('name profileImage owner');

      if (!requesterProfile || !receiverProfile) return;

      return this.createNotification({
        recipient: requesterProfile.owner,
        type: 'profile_connection_accepted',
        title: 'Profile Connection Accepted',
        message: `${receiverProfile.name} has accepted your connection request`,
        relatedTo: {
          model: 'ProfileConnection',
          id: connectionId,
        },
        action: {
          text: 'View Profile',
          url: `/profiles/${receiverProfileId}`,
        },
        priority: 'medium',
        data: {
          requesterProfileId,
          receiverProfileId,
          connectionId,
          receiverProfileName: receiverProfile.name,
          receiverProfileImage: receiverProfile.profileImage
        }
      });
    } catch (error) {
      console.error('Error in createProfileConnectionAcceptedNotification:', error);
      logger.error('Error creating profile connection accepted notification:', error);
    }
  }

  async createEndorsementNotification(endorserId: mongoose.Types.ObjectId, recipientId: mongoose.Types.ObjectId, skill: string) {
    console.log('Entering createEndorsementNotification with endorserId, recipientId, and skill:', endorserId, recipientId, skill);
    try {
      const endorser:any = await User.findById(endorserId).select('firstName lastName');
      if (!endorser) return;

      return this.createNotification({
        recipient: recipientId,
        type: 'endorsement_received',
        title: 'New Skill Endorsement',
        message: `${endorser.firstName} ${endorser.lastName} endorsed you for ${skill}`,
        relatedTo: {
          model: 'User',
          id: endorserId,
        },
        priority: 'medium',
      });
    } catch (error) {
      console.error('Error in createEndorsementNotification:', error);
      logger.error('Error creating endorsement notification:', error);
    }
  }
}
