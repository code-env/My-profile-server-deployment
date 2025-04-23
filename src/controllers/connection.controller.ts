import { Request, Response } from 'express';
import ConnectionService from '../services/connection.service';
import { logger } from '../utils/logger';
import { CustomError } from '../utils/errors';
import { ProfileModel } from '../models/profile.model';

export class ConnectionController {
  /**
   * Create a new connection request
   * @route POST /api/connections/request
   */
  static async createConnectionRequest(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const { toProfileId, connectionType, details } = req.body;
      const fromUserId = user?._id;

      if (!fromUserId) {
        throw new CustomError("MISSING_TOKEN", 'User not authenticated');
      }

      const connection = await ConnectionService.createConnection(
        fromUserId,
        toProfileId,
        connectionType,
        details
      );

      res.status(201).json({
        success: true,
        data: connection
      });
    } catch (error: any) {
      logger.error('Error in createConnectionRequest:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Update connection status (accept/reject)
   * @route PUT /api/connections/:connectionId/status
   */
  static async updateConnectionStatus(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const { connectionId } = req.params;
      const { status }: { status: 'accepted' | 'rejected' } = req.body;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError("MISSING_TOKEN", 'User not authenticated');
      }

      const connection = await ConnectionService.updateConnectionStatus(connectionId, status);

      res.json({
        success: true,
        data: connection
      });
    } catch (error: any) {
      logger.error('Error in updateConnectionStatus:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Get all user connections
   * @route GET /api/connections/my-connections
   */
  static async getUserConnections(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const userId = user?._id;
      const { status } = req.query;

      if (!userId) {
        throw new CustomError("MISSING_TOKEN", 'User not authenticated');
      }

      const connections = await ConnectionService.getUserConnections(
        userId,
        status as string | undefined
      );

      res.json({
        success: true,
        data: connections
      });
    } catch (error: any) {
      logger.error('Error in getUserConnections:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Get pending connection requests
   * @route GET /api/connections/pending
   */
  static async getPendingConnections(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError("MISSING_TOKEN", 'User not authenticated');
      }

      const connections = await ConnectionService.getPendingConnections(userId);

      res.json({
        success: true,
        data: connections
      });
    } catch (error: any) {
      logger.error('Error in getPendingConnections:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Get connection statistics
   * @route GET /api/connections/stats
   */
  static async getConnectionStats(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError("MISSING_TOKEN", 'User not authenticated');
      }

      const stats = await ConnectionService.getConnectionStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Error in getConnectionStats:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Remove a connection
   * @route DELETE /api/connections/:connectionId
   */
  static async removeConnection(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const { connectionId } = req.params;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError("MISSING_TOKEN", 'User not authenticated');
      }

      await ConnectionService.removeConnection(connectionId, userId);

      res.json({
        success: true,
        message: 'Connection removed successfully'
      });
    } catch (error: any) {
      logger.error('Error in removeConnection:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Get connection suggestions
   * @route GET /api/connections/suggestions
   */
  static async getConnectionSuggestions(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError("MISSING_TOKEN", 'User not authenticated');
      }

      const suggestions = await ConnectionService.getConnectionSuggestions(userId);

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error: any) {
      logger.error('Error in getConnectionSuggestions:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Get profile connections
   * @route GET /api/connections/profile/:profileId
   */
  static async getProfileConnections(req: Request, res: Response) {
    try {
      const { profileId } = req.params;
      const { type = 'all', page = 1, limit = 10 } = req.query;

      const profile = await ProfileModel.findById(profileId)
        .populate({
          path: 'connections.connected',
          select: 'username fullName email profilePicture',
          options: {
            skip: (Number(page) - 1) * Number(limit),
            limit: Number(limit)
          }
        })
        .populate({
          path: 'connections.lastConnections.user',
          select: 'username fullName email profilePicture'
        });

      if (!profile) {
        throw new CustomError('NOT_FOUND', 'Profile not found');
      }

      let connections;
      let total;

      switch(type) {
        case 'recent':
          connections = profile.connections.lastConnections;
          total = connections.length;
          break;
        case 'followers':
          connections = await ProfileModel.findById(profileId)
            .populate({
              path: 'connections.followers',
              select: 'username fullName email profilePicture',
              options: {
                skip: (Number(page) - 1) * Number(limit),
                limit: Number(limit)
              }
            });
          total = profile.stats.followers;
          connections = connections?.connections.followers || [];
          break;
        case 'following':
          connections = await ProfileModel.findById(profileId)
            .populate({
              path: 'connections.following',
              select: 'username fullName email profilePicture',
              options: {
                skip: (Number(page) - 1) * Number(limit),
                limit: Number(limit)
              }
            });
          total = profile.stats.following;
          connections = connections?.connections.following || [];
          break;
        default:
          connections = profile.connections.connected;
          total = connections.length;
      }

      res.json({
        success: true,
        data: {
          connections,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
          },
          stats: profile.stats
        }
      });
    } catch (error) {
      logger.error('Error in getProfileConnections:', error);
      res.status(error instanceof CustomError ? 400 : 500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get profile connections'
      });
    }
  }

  /**
   * Connect via QR code
   * @route POST /api/connections/qr/:profileId
   */
  static async connectViaQR(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const { profileId } = req.params;
      const { connectionType = 'follow' } = req.body;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError('MISSING_TOKEN', 'User not authenticated');
      }

      const connection = await ConnectionService.createConnection(
        userId,
        profileId,
        connectionType,
        {
          source: 'qr',
          metadata: {
            scannedAt: new Date(),
            userAgent: req.headers['user-agent']
          }
        }
      );

      res.json({
        success: true,
        data: connection,
        message: connection.status === 'accepted'
          ? 'Connected successfully'
          : 'Connection request sent'
      });
    } catch (error) {
      logger.error('Error in connectViaQR:', error);
      res.status(error instanceof CustomError ? 400 : 500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect via QR'
      });
    }
  }

  /**
   * Connect via link
   * @route POST /api/connections/link/:profileId
   */
  static async connectViaLink(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const { profileId } = req.params;
      const { connectionType = 'follow' } = req.body;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError('MISSING_TOKEN', 'User not authenticated');
      }

      const connection = await ConnectionService.createConnection(
        userId,
        profileId,
        connectionType,
        {
          source: 'link',
          metadata: {
            clickedAt: new Date(),
            referrer: req.headers.referer,
            userAgent: req.headers['user-agent']
          }
        }
      );

      res.json({
        success: true,
        data: connection,
        message: connection.status === 'accepted'
          ? 'Connected successfully'
          : 'Connection request sent'
      });
    } catch (error) {
      logger.error('Error in connectViaLink:', error);
      res.status(error instanceof CustomError ? 400 : 500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect via link'
      });
    }
  }

  /**
   * Request connection (direct)
   * @route POST /api/connections/request
   */
  static async requestConnection(req: Request, res: Response) {
    try {
      const user: any = req.user;
      const { toProfileId, connectionType, message, metadata } = req.body;
      const userId = user?._id;

      if (!userId) {
        throw new CustomError('MISSING_TOKEN', 'User not authenticated');
      }

      const connection = await ConnectionService.createConnection(
        userId,
        toProfileId,
        connectionType,
        {
          message,
          metadata,
          source: 'direct'
        }
      );

      res.json({
        success: true,
        data: connection,
        message: connection.status === 'accepted'
          ? 'Connected successfully'
          : 'Connection request sent'
      });
    } catch (error) {
      logger.error('Error in requestConnection:', error);
      res.status(error instanceof CustomError ? 400 : 500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send connection request'
      });
    }
  }
}
