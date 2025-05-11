import { Socket } from 'socket.io';
import { Server as SocketIOServer } from 'socket.io';
import { Types } from 'mongoose';
import { Presence, IPresence } from '../models/presence.model';
import { logger } from '../utils/logger';

/**
 * Service for managing user presence (online/offline status)
 */
export class PresenceService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map();
  private profileSockets: Map<string, Set<string>> = new Map();

  /**
   * Set the Socket.IO server instance
   * @param io Socket.IO server instance
   */
  setSocketServer(io: SocketIOServer): void {
    this.io = io;
    logger.info('PresenceService: Socket.IO server set');
  }

  /**
   * Handle a new user connection
   * @param userId User ID
   * @param profileId Profile ID
   * @param socket Socket instance
   * @param deviceInfo Device information
   */
  async handleUserConnect(
    userId: string | Types.ObjectId,
    profileId: string | Types.ObjectId,
    socket: Socket,
    deviceInfo: { userAgent: string; ip: string; deviceType: string }
  ): Promise<void> {
    try {
      const userIdStr = userId.toString();
      const profileIdStr = profileId.toString();
      const socketId = socket.id;

      logger.info(`PresenceService: User ${userIdStr} (Profile: ${profileIdStr}) connected with socket ${socketId}`);

      // Store socket ID in user and profile maps
      if (!this.userSockets.has(userIdStr)) {
        this.userSockets.set(userIdStr, new Set());
      }
      this.userSockets.get(userIdStr)?.add(socketId);

      if (!this.profileSockets.has(profileIdStr)) {
        this.profileSockets.set(profileIdStr, new Set());
      }
      this.profileSockets.get(profileIdStr)?.add(socketId);

      // Create or update presence record
      const presence = await Presence.findOneAndUpdate(
        { socketId },
        {
          userId: new Types.ObjectId(userIdStr),
          profileId: new Types.ObjectId(profileIdStr),
          status: 'online',
          lastActive: new Date(),
          socketId,
          deviceInfo
        },
        { upsert: true, new: true }
      );

      // Broadcast user's online status to relevant users
      this.broadcastStatusChange(userIdStr, profileIdStr, 'online');

      // Set up disconnect handler
      socket.on('disconnect', () => {
        this.handleUserDisconnect(userIdStr, profileIdStr, socketId);
      });

      // Set up status change handler
      socket.on('presence:status', (status: 'online' | 'away' | 'busy') => {
        this.updateUserStatus(userIdStr, profileIdStr, socketId, status);
      });

      // Set up heartbeat to keep connection alive
      socket.on('presence:heartbeat', () => {
        this.updateLastActive(socketId);
      });

    } catch (error) {
      logger.error('PresenceService: Error handling user connect', error);
    }
  }

  /**
   * Handle user disconnect
   * @param userId User ID
   * @param profileId Profile ID
   * @param socketId Socket ID
   */
  async handleUserDisconnect(
    userId: string,
    profileId: string,
    socketId: string
  ): Promise<void> {
    try {
      logger.info(`PresenceService: User ${userId} (Profile: ${profileId}) disconnected socket ${socketId}`);

      // Remove socket from maps
      this.userSockets.get(userId)?.delete(socketId);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }

      this.profileSockets.get(profileId)?.delete(socketId);
      if (this.profileSockets.get(profileId)?.size === 0) {
        this.profileSockets.delete(profileId);
      }

      // Update presence record
      await Presence.findOneAndUpdate(
        { socketId },
        {
          status: 'offline',
          lastActive: new Date()
        }
      );

      // If user has no more active sockets, broadcast offline status
      if (!this.userSockets.has(userId)) {
        this.broadcastStatusChange(userId, profileId, 'offline');
      }
    } catch (error) {
      logger.error('PresenceService: Error handling user disconnect', error);
    }
  }

  /**
   * Update user status
   * @param userId User ID
   * @param profileId Profile ID
   * @param socketId Socket ID
   * @param status New status
   */
  async updateUserStatus(
    userId: string,
    profileId: string,
    socketId: string,
    status: 'online' | 'away' | 'busy'
  ): Promise<void> {
    try {
      logger.info(`PresenceService: Updating status for user ${userId} to ${status}`);

      // Update presence record
      await Presence.findOneAndUpdate(
        { socketId },
        {
          status,
          lastActive: new Date()
        }
      );

      // Broadcast status change
      this.broadcastStatusChange(userId, profileId, status);
    } catch (error) {
      logger.error('PresenceService: Error updating user status', error);
    }
  }

  /**
   * Update last active timestamp
   * @param socketId Socket ID
   */
  async updateLastActive(socketId: string): Promise<void> {
    try {
      await Presence.findOneAndUpdate(
        { socketId },
        {
          lastActive: new Date()
        }
      );
    } catch (error) {
      logger.error('PresenceService: Error updating last active', error);
    }
  }

  /**
   * Broadcast status change to relevant users
   * @param userId User ID
   * @param profileId Profile ID
   * @param status New status
   */
  private broadcastStatusChange(
    userId: string,
    profileId: string,
    status: 'online' | 'offline' | 'away' | 'busy'
  ): void {
    if (!this.io) return;

    // Broadcast to all connected clients
    // In a production app, you might want to limit this to only relevant users
    this.io.emit('presence:update', {
      userId,
      profileId,
      status,
      timestamp: new Date()
    });
  }

  /**
   * Get user status
   * @param userId User ID
   * @returns User status
   */
  async getUserStatus(userId: string | Types.ObjectId): Promise<'online' | 'offline' | 'away' | 'busy'> {
    try {
      const userIdStr = userId.toString();

      // If user has active sockets, they're online
      const userSocketSet = this.userSockets.get(userIdStr);
      if (userSocketSet && userSocketSet.size > 0) {
        // Get the most recent status from any of their sockets
        const socketIds = Array.from(userSocketSet || []);
        if (socketIds.length > 0) {
          const presences = await Presence.find({ socketId: { $in: socketIds } }).sort({ lastActive: -1 }).limit(1);
          if (presences.length > 0) {
            return presences[0].status;
          }
        }
        return 'online';
      }

      return 'offline';
    } catch (error) {
      logger.error('PresenceService: Error getting user status', error);
      return 'offline';
    }
  }

  /**
   * Get profile status
   * @param profileId Profile ID
   * @returns Profile status
   */
  async getProfileStatus(profileId: string | Types.ObjectId): Promise<'online' | 'offline' | 'away' | 'busy'> {
    try {
      const profileIdStr = profileId.toString();

      // If profile has active sockets, they're online
      const profileSocketSet = this.profileSockets.get(profileIdStr);
      if (profileSocketSet && profileSocketSet.size > 0) {
        // Get the most recent status from any of their sockets
        const socketIds = Array.from(profileSocketSet || []);
        if (socketIds.length > 0) {
          const presences = await Presence.find({ socketId: { $in: socketIds } }).sort({ lastActive: -1 }).limit(1);
          if (presences.length > 0) {
            return presences[0].status;
          }
        }
        return 'online';
      }

      return 'offline';
    } catch (error) {
      logger.error('PresenceService: Error getting profile status', error);
      return 'offline';
    }
  }

  /**
   * Get status for multiple users
   * @param userIds Array of user IDs
   * @returns Map of user IDs to statuses
   */
  async getBatchUserStatus(userIds: (string | Types.ObjectId)[]): Promise<Map<string, 'online' | 'offline' | 'away' | 'busy'>> {
    try {
      const result = new Map<string, 'online' | 'offline' | 'away' | 'busy'>();

      // Convert all IDs to strings
      const userIdStrings = userIds.map(id => id.toString());

      // Get all presence records for these users
      const presences = await Presence.find({
        userId: { $in: userIdStrings.map(id => new Types.ObjectId(id)) }
      }).sort({ lastActive: -1 });

      // Group by user ID and get the most recent status
      const userPresences = new Map<string, IPresence>();
      for (const presence of presences) {
        const userIdStr = presence.userId.toString();
        if (!userPresences.has(userIdStr) || presence.lastActive > userPresences.get(userIdStr)!.lastActive) {
          userPresences.set(userIdStr, presence);
        }
      }

      // Set status for each user
      for (const userId of userIdStrings) {
        if (userPresences.has(userId)) {
          result.set(userId, userPresences.get(userId)!.status);
        } else {
          result.set(userId, 'offline');
        }
      }

      return result;
    } catch (error) {
      logger.error('PresenceService: Error getting batch user status', error);
      return new Map();
    }
  }
}
