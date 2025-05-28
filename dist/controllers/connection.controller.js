"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionController = void 0;
const connection_service_1 = __importDefault(require("../services/connection.service"));
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const profile_model_1 = require("../models/profile.model");
const Connection_1 = require("../models/Connection");
class ConnectionController {
    /**
     * Create a new connection request
     * @route POST /api/connections/request
     */
    static async createConnectionRequest(req, res) {
        try {
            const user = req.user;
            const { fromProfileId, toProfileId, connectionType, details = {} } = req.body;
            const fromUserId = user === null || user === void 0 ? void 0 : user._id;
            if (!fromUserId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            if (!fromProfileId) {
                throw new errors_1.CustomError('MISSING_PARAM', 'fromProfileId is required');
            }
            const connection = await connection_service_1.default.createConnection(fromUserId, fromProfileId, toProfileId, connectionType, details);
            res.status(201).json({ success: true, data: connection });
        }
        catch (error) {
            logger_1.logger.error('Error in createConnectionRequest:', error);
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
    static async updateConnectionStatus(req, res) {
        try {
            const user = req.user;
            const { connectionId } = req.params;
            const { status } = req.body;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError("MISSING_TOKEN", 'User not authenticated');
            }
            const connection = await connection_service_1.default.updateConnectionStatus(connectionId, status);
            // TODO: use the actual profile id here, not the user id and then emit the event
            // if (status === 'accepted') {
            //   await emitSocialInteraction(userId, {
            //     type: 'connection',
            //     profile: new Types.ObjectId(userId),
            //     targetProfile: new Types.ObjectId(connection.toProfile),
            //     contentId: connection._id as Types.ObjectId,
            //   });
            // }
            res.json({
                success: true,
                data: connection
            });
        }
        catch (error) {
            logger_1.logger.error('Error in updateConnectionStatus:', error);
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
    static async getUserConnections(req, res) {
        try {
            const user = req.user;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            const { status } = req.query;
            if (!userId) {
                throw new errors_1.CustomError("MISSING_TOKEN", 'User not authenticated');
            }
            const connections = await connection_service_1.default.getUserConnections(userId, status);
            res.json({
                success: true,
                data: connections
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getUserConnections:', error);
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
    static async getPendingConnections(req, res) {
        try {
            const user = req.user;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError("MISSING_TOKEN", 'User not authenticated');
            }
            const connections = await connection_service_1.default.getPendingConnections(userId);
            res.json({
                success: true,
                data: connections
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getPendingConnections:', error);
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
    static async getConnectionStats(req, res) {
        try {
            const user = req.user;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError("MISSING_TOKEN", 'User not authenticated');
            }
            const stats = await connection_service_1.default.getConnectionStats(userId);
            res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getConnectionStats:', error);
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
    static async removeConnection(req, res) {
        try {
            const user = req.user;
            const { connectionId } = req.params;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError("MISSING_TOKEN", 'User not authenticated');
            }
            await connection_service_1.default.removeConnection(connectionId, userId);
            res.json({
                success: true,
                message: 'Connection removed successfully'
            });
        }
        catch (error) {
            logger_1.logger.error('Error in removeConnection:', error);
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
    static async getConnectionSuggestions(req, res) {
        try {
            const user = req.user;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError("MISSING_TOKEN", 'User not authenticated');
            }
            const suggestions = await connection_service_1.default.getConnectionSuggestions(userId);
            res.json({
                success: true,
                data: suggestions
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getConnectionSuggestions:', error);
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
    static async getProfileConnections(req, res) {
        try {
            const { profileId } = req.params;
            const { type = 'all', page = 1, limit = 10 } = req.query;
            // First check if profile exists
            const profile = await profile_model_1.ProfileModel.findById(profileId);
            if (!profile) {
                throw new errors_1.CustomError('NOT_FOUND', 'Profile not found');
            }
            let connections;
            let total = 0;
            // Get connections based on type
            switch (type) {
                case 'recent':
                    // Get recent connections from Connection model
                    connections = await Connection_1.Connection.find({ toProfile: profileId, status: 'accepted' })
                        .sort({ createdAt: -1 })
                        .limit(Number(limit))
                        .skip((Number(page) - 1) * Number(limit))
                        .populate('fromUser', 'username fullName email profileImage');
                    total = await Connection_1.Connection.countDocuments({ toProfile: profileId, status: 'accepted' });
                    break;
                case 'followers':
                    // Get followers from Connection model (users who follow this profile)
                    connections = await Connection_1.Connection.find({
                        toProfile: profileId,
                        status: 'accepted',
                        connectionType: 'follow'
                    })
                        .sort({ createdAt: -1 })
                        .limit(Number(limit))
                        .skip((Number(page) - 1) * Number(limit))
                        .populate('fromUser', 'username fullName email profileImage');
                    total = await Connection_1.Connection.countDocuments({
                        toProfile: profileId,
                        status: 'accepted',
                        connectionType: 'follow'
                    });
                    break;
                case 'following':
                    // Get following from Connection model (profiles this user follows)
                    connections = await Connection_1.Connection.find({
                        fromUser: profile.profileInformation.creator,
                        status: 'accepted',
                        connectionType: 'follow'
                    })
                        .sort({ createdAt: -1 })
                        .limit(Number(limit))
                        .skip((Number(page) - 1) * Number(limit))
                        .populate('toProfile', 'profileInformation.username profileInformation.title ProfileFormat.profileImage');
                    total = await Connection_1.Connection.countDocuments({
                        fromUser: profile.profileInformation.creator,
                        status: 'accepted',
                        connectionType: 'follow'
                    });
                    break;
                default:
                    // Get all connections
                    connections = await Connection_1.Connection.find({
                        $or: [
                            { toProfile: profileId, status: 'accepted' },
                            { fromUser: profile.profileInformation.creator, status: 'accepted' }
                        ]
                    })
                        .sort({ createdAt: -1 })
                        .limit(Number(limit))
                        .skip((Number(page) - 1) * Number(limit))
                        .populate('fromUser', 'username fullName email profileImage')
                        .populate('toProfile', 'profileInformation.username profileInformation.title ProfileFormat.profileImage');
                    total = await Connection_1.Connection.countDocuments({
                        $or: [
                            { toProfile: profileId, status: 'accepted' },
                            { fromUser: profile.profileInformation.creator, status: 'accepted' }
                        ]
                    });
            }
            // Get connection stats
            const stats = {
                followers: await Connection_1.Connection.countDocuments({
                    toProfile: profileId,
                    status: 'accepted',
                    connectionType: 'follow'
                }),
                following: await Connection_1.Connection.countDocuments({
                    fromUser: profile.profileInformation.creator,
                    status: 'accepted',
                    connectionType: 'follow'
                }),
                connected: await Connection_1.Connection.countDocuments({
                    $or: [
                        { toProfile: profileId, status: 'accepted', connectionType: 'connect' },
                        { fromUser: profile.profileInformation.creator, status: 'accepted', connectionType: 'connect' }
                    ]
                }),
                pending: await Connection_1.Connection.countDocuments({
                    toProfile: profileId,
                    status: 'pending'
                })
            };
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
                    stats
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getProfileConnections:', error);
            res.status(error instanceof errors_1.CustomError ? 400 : 500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to get profile connections'
            });
        }
    }
    /**
     * Connect via QR code
     * @route POST /api/connections/qr/:profileId
     */
    static async connectViaQR(req, res) {
        try {
            const user = req.user;
            const { profileId: toProfileId } = req.params;
            const { fromProfileId, connectionType = 'follow' } = req.body;
            const fromUserId = user === null || user === void 0 ? void 0 : user._id;
            if (!fromUserId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            if (!fromProfileId) {
                throw new errors_1.CustomError('MISSING_PARAM', 'fromProfileId is required');
            }
            const connection = await connection_service_1.default.createConnection(fromUserId, fromProfileId, toProfileId, connectionType, {
                source: 'qrcode',
                metadata: {
                    scannedAt: new Date(),
                    userAgent: req.headers['user-agent']
                }
            });
            res.json({
                success: true,
                data: connection,
                message: connection.status === 'accepted'
                    ? 'Connected successfully'
                    : 'Connection request sent'
            });
        }
        catch (error) {
            logger_1.logger.error('Error in connectViaQR:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to connect via QR'
            });
        }
    }
    /**
     * Connect via link
     * @route POST /api/connections/link/:profileId
     */
    static async connectViaLink(req, res) {
        try {
            const user = req.user;
            const { profileId: toProfileId } = req.params;
            const { fromProfileId, connectionType = 'follow' } = req.body;
            const fromUserId = user === null || user === void 0 ? void 0 : user._id;
            if (!fromUserId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            if (!fromProfileId) {
                throw new errors_1.CustomError('MISSING_PARAM', 'fromProfileId is required');
            }
            const connection = await connection_service_1.default.createConnection(fromUserId, fromProfileId, toProfileId, connectionType, {
                source: 'link',
                metadata: {
                    clickedAt: new Date(),
                    referrer: req.headers.referer,
                    userAgent: req.headers['user-agent']
                }
            });
            res.json({
                success: true,
                data: connection,
                message: connection.status === 'accepted'
                    ? 'Connected successfully'
                    : 'Connection request sent'
            });
        }
        catch (error) {
            logger_1.logger.error('Error in connectViaLink:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to connect via link'
            });
        }
    }
    /**
     * Request connection (direct)
     * @route POST /api/connections/request
     */
    static async requestConnection(req, res) {
        try {
            const user = req.user;
            const { fromProfileId, toProfileId, connectionType, message, metadata } = req.body;
            const fromUserId = user === null || user === void 0 ? void 0 : user._id;
            if (!fromUserId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            if (!fromProfileId) {
                throw new errors_1.CustomError('MISSING_PARAM', 'fromProfileId is required');
            }
            const connection = await connection_service_1.default.createConnection(fromUserId, fromProfileId, toProfileId, connectionType, {
                connectionReason: message,
                metadata,
                source: 'direct'
            });
            res.json({
                success: true,
                data: connection,
                message: connection.status === 'accepted'
                    ? 'Connected successfully'
                    : 'Connection request sent'
            });
        }
        catch (error) {
            logger_1.logger.error('Error in requestConnection:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to send connection request'
            });
        }
    }
}
exports.ConnectionController = ConnectionController;
