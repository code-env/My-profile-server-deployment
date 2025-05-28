"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialService = void 0;
const Connection_1 = require("../models/Connection");
const Endorsement_1 = require("../models/Endorsement");
const User_1 = require("../models/User");
const notification_service_1 = require("./notification.service");
const analytics_service_1 = require("./analytics.service");
const logger_1 = require("../utils/logger");
class SocialService {
    constructor() {
        this.notificationService = new notification_service_1.NotificationService();
        this.analyticsService = new analytics_service_1.AnalyticsService();
    }
    // Connection Methods
    async sendConnectionRequest(senderId, recipientId, message) {
        console.log('Entering sendConnectionRequest with params:', { senderId, recipientId, message });
        try {
            // Check if connection already exists
            const existingConnection = await Connection_1.Connection.findOne({
                $or: [
                    { user1: senderId, user2: recipientId },
                    { user1: recipientId, user2: senderId }
                ]
            });
            if (existingConnection) {
                throw new Error('Connection already exists or pending');
            }
            // Create connection request
            const connection = await Connection_1.Connection.create({
                user1: senderId,
                user2: recipientId,
                status: 'pending',
                requestMessage: message,
                initiator: senderId,
            });
            // Send notification
            await this.notificationService.createNotification({
                recipient: recipientId,
                type: 'connection_request',
                title: 'New Connection Request',
                message: message || 'Someone wants to connect with you',
                relatedTo: {
                    model: 'Connection',
                    id: connection._id,
                },
            });
            console.log('Exiting sendConnectionRequest with result:', connection);
            return connection;
        }
        catch (error) {
            console.error('Error in sendConnectionRequest:', error);
            logger_1.logger.error('Error sending connection request:', error);
            throw error;
        }
    }
    async respondToConnectionRequest(userId, connectionId, accept) {
        try {
            const connection = await Connection_1.Connection.findById(connectionId);
            if (!connection) {
                throw new Error('Connection request not found');
            }
            if (!connection.toProfile.equals(userId)) {
                throw new Error('Not authorized to respond to this request');
            }
            if (connection.status !== 'pending') {
                throw new Error('Connection request already handled');
            }
            connection.status = accept ? 'accepted' : 'rejected';
            connection.respondedAt = new Date();
            await connection.save();
            // Send notification to initiator
            await this.notificationService.createNotification({
                recipient: connection.user1,
                type: 'connection_response',
                title: accept ? 'Connection Accepted' : 'Connection Declined',
                message: accept ? 'Your connection request was accepted' : 'Your connection request was declined',
                relatedTo: {
                    model: 'Connection',
                    id: connection._id,
                },
            });
            // Track engagement if accepted
            if (accept) {
                await this.analyticsService.trackEngagement(connection.user1, connection.user2, connection.user1, 'connect');
            }
            return connection;
        }
        catch (error) {
            logger_1.logger.error('Error responding to connection request:', error);
            throw error;
        }
    }
    async getConnections(userId, status = ['accepted'], page = 1, limit = 10) {
        try {
            const connections = await Connection_1.Connection.find({
                $or: [
                    { user1: userId },
                    { user2: userId }
                ],
                status: { $in: status }
            })
                .populate('user1', 'firstName lastName profileImage')
                .populate('user2', 'firstName lastName profileImage')
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);
            const total = await Connection_1.Connection.countDocuments({
                $or: [
                    { user1: userId },
                    { user2: userId }
                ],
                status: { $in: status }
            });
            return {
                connections: connections.map((conn) => ({
                    ...conn.toObject(),
                    otherUser: conn.user1._id.equals(userId) ? conn.user2 : conn.user1
                })),
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    page,
                    limit
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting connections:', error);
            throw error;
        }
    }
    // Endorsement Methods
    async createEndorsement(endorserId, recipientId, data) {
        try {
            // Check if users are connected
            const isConnected = await this.areUsersConnected(endorserId, recipientId);
            if (!isConnected) {
                throw new Error('Must be connected to endorse');
            }
            // Check for existing endorsement
            const existingEndorsement = await Endorsement_1.Endorsement.findOne({
                endorser: endorserId,
                recipient: recipientId,
                skill: data.skill
            });
            if (existingEndorsement) {
                throw new Error('Already endorsed this skill');
            }
            // Calculate endorsement weight based on relationship and endorser's profile
            const weight = await this.calculateEndorsementWeight(endorserId, data.relationship);
            // Create endorsement
            const endorsement = await Endorsement_1.Endorsement.create({
                ...data,
                endorser: endorserId,
                recipient: recipientId,
                weight
            });
            // Send notification
            await this.notificationService.createEndorsementNotification(endorserId, recipientId, data.skill);
            // Track engagement
            await this.analyticsService.trackEngagement(recipientId, endorserId, endorserId, 'comment', { skill: data.skill });
            return endorsement;
        }
        catch (error) {
            logger_1.logger.error('Error creating endorsement:', error);
            throw error;
        }
    }
    async getEndorsements(userId, options = {}) {
        console.log('Entering getEndorsements with params:', { userId, options });
        try {
            const { skill, level, page = 1, limit = 10 } = options;
            const query = { recipient: userId };
            if (skill)
                query.skill = skill;
            if (level)
                query.level = level;
            const endorsements = await Endorsement_1.Endorsement.find(query)
                .populate('endorser', 'firstName lastName profileImage')
                .sort({ weight: -1, endorsedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);
            const total = await Endorsement_1.Endorsement.countDocuments(query);
            // Group endorsements by skill
            const skillStats = await Endorsement_1.Endorsement.aggregate([
                { $match: { recipient: userId } },
                {
                    $group: {
                        _id: '$skill',
                        count: { $sum: 1 },
                        avgWeight: { $avg: '$weight' },
                        levels: {
                            $push: '$level'
                        }
                    }
                }
            ]);
            console.log('Exiting getEndorsements with result:', endorsements);
            return {
                endorsements,
                stats: {
                    total,
                    skills: skillStats,
                },
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    page,
                    limit
                }
            };
        }
        catch (error) {
            console.error('Error in getEndorsements:', error);
            logger_1.logger.error('Error getting endorsements:', error);
            throw error;
        }
    }
    async areUsersConnected(user1Id, user2Id) {
        const connection = await Connection_1.Connection.findOne({
            $or: [
                { user1: user1Id, user2: user2Id },
                { user1: user2Id, user2: user1Id }
            ],
            status: 'accepted'
        });
        return !!connection;
    }
    async calculateEndorsementWeight(endorserId, relationship) {
        try {
            const endorser = await User_1.User.findById(endorserId);
            if (!endorser)
                throw new Error('Endorser not found');
            // Base weight factors
            const relationshipWeights = {
                manager: 2.0,
                colleague: 1.5,
                client: 1.8,
                mentor: 2.0,
                academic: 1.7,
                other: 1.0
            };
            // Calculate base weight
            let weight = relationshipWeights[relationship] || 1.0;
            // Adjust weight based on endorser's profile
            if (endorser.role === 'admin')
                weight *= 1.5;
            if (endorser.isEmailVerified)
                weight *= 1.2;
            if (endorser.mpts > 75)
                weight *= 1.3;
            // Cap weight at maximum value
            return Math.min(weight, 10);
        }
        catch (error) {
            logger_1.logger.error('Error calculating endorsement weight:', error);
            return 1; // Default weight
        }
    }
}
exports.SocialService = SocialService;
