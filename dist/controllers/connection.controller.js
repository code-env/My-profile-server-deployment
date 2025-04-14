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
class ConnectionController {
    /**
     * Create a new connection request
     * @route POST /api/connections/request
     */
    static async createConnectionRequest(req, res) {
        try {
            const user = req.user;
            const { toProfileId, connectionType, details } = req.body;
            const fromUserId = user === null || user === void 0 ? void 0 : user._id;
            if (!fromUserId) {
                throw new errors_1.CustomError("MISSING_TOKEN", 'User not authenticated');
            }
            const connection = await connection_service_1.default.createConnection(fromUserId, toProfileId, connectionType, details);
            res.status(201).json({
                success: true,
                data: connection
            });
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
            const profile = await profile_model_1.ProfileModel.findById(profileId)
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
                throw new errors_1.CustomError('NOT_FOUND', 'Profile not found');
            }
            let connections;
            let total;
            switch (type) {
                case 'recent':
                    connections = profile.connections.lastConnections;
                    total = connections.length;
                    break;
                case 'followers':
                    connections = await profile_model_1.ProfileModel.findById(profileId)
                        .populate({
                        path: 'connections.followers',
                        select: 'username fullName email profilePicture',
                        options: {
                            skip: (Number(page) - 1) * Number(limit),
                            limit: Number(limit)
                        }
                    });
                    total = profile.stats.followers;
                    connections = (connections === null || connections === void 0 ? void 0 : connections.connections.followers) || [];
                    break;
                case 'following':
                    connections = await profile_model_1.ProfileModel.findById(profileId)
                        .populate({
                        path: 'connections.following',
                        select: 'username fullName email profilePicture',
                        options: {
                            skip: (Number(page) - 1) * Number(limit),
                            limit: Number(limit)
                        }
                    });
                    total = profile.stats.following;
                    connections = (connections === null || connections === void 0 ? void 0 : connections.connections.following) || [];
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
            const { profileId } = req.params;
            const { connectionType = 'follow' } = req.body;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            const connection = await connection_service_1.default.createConnection(userId, profileId, connectionType, {
                source: 'qr',
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
            res.status(error instanceof errors_1.CustomError ? 400 : 500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to connect via QR'
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
            const { profileId } = req.params;
            const { connectionType = 'follow' } = req.body;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            const connection = await connection_service_1.default.createConnection(userId, profileId, connectionType, {
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
            res.status(error instanceof errors_1.CustomError ? 400 : 500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to connect via link'
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
            const { toProfileId, connectionType, message, metadata } = req.body;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            const connection = await connection_service_1.default.createConnection(userId, toProfileId, connectionType, {
                message,
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
            res.status(error instanceof errors_1.CustomError ? 400 : 500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to send connection request'
            });
        }
    }
}
exports.ConnectionController = ConnectionController;
