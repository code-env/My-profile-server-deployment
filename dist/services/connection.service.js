"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Connection_1 = require("../models/Connection");
const profile_model_1 = require("../models/profile.model");
const logger_1 = require("../utils/logger");
const notification_service_1 = require("../services/notification.service");
const analytics_service_1 = require("../services/analytics.service");
const connection_analytics_service_1 = require("./connection-analytics.service");
const mongoose_1 = __importDefault(require("mongoose"));
class ConnectionService {
    // static async createConnection(
    //   fromUserId: any,
    //   toProfileId: string,
    //   connectionType: string,
    //   details: {
    //     message?: string;
    //     amount?: number;
    //     employmentDetails?: {
    //       position?: string;
    //       company?: string;
    //       salary?: string;
    //       startDate?: Date;
    //     };
    //     metadata?: Record<string, any>;
    //     source?: 'qr' | 'link' | 'direct';
    //   }
    // ) {
    //   console.log('Entering createConnection with params:', { fromUserId, toProfileId, connectionType, details });
    //   try {
    //     const profile = await ProfileModel.findById(toProfileId);
    //     if (!profile) {
    //       throw new Error('Profile not found');
    //     }
    //     // Check if connection is allowed based on profile preferences
    //     if (!this.isConnectionAllowed(profile, connectionType)) {
    //       throw new Error(`This profile does not accept ${connectionType} connections`);
    //     }
    //     // Validate donation amount if applicable
    //     // if (connectionType === 'donation' &&
    //     //     profile.connectionPreferences.minimumDonation &&
    //     //     (!details.amount || details.amount < profile.connectionPreferences.minimumDonation)) {
    //     //   throw new Error(`Minimum donation amount is ${profile.connectionPreferences.minimumDonation}`);
    //     // }
    //     // Check for existing connection
    //     const existingConnection = await Connection.findOne({
    //       fromUser: fromUserId,
    //       toProfile: toProfileId,
    //       connectionType,
    //       status: { $in: ['pending', 'accepted'] },
    //     });
    //     if (existingConnection) {
    //       throw new Error('Connection already exists');
    //     }
    //     // Determine if connection should be auto-accepted
    //     const shouldAutoAccept = this.shouldAutoAcceptConnection(profile, details.source, connectionType);
    //     // Create new connection
    //     const connection = await Connection.create({
    //       fromUser: fromUserId,
    //       toProfile: toProfileId,
    //       connectionType,
    //       status: shouldAutoAccept ? 'accepted' : 'pending',
    //       message: details.message,
    //       amount: details.amount,
    //       employmentDetails: details.employmentDetails,
    //       metadata: {
    //         ...details.metadata,
    //         source: details.source
    //       },
    //     });
    //     // If connection is automatically accepted, update profile stats and connections
    //     if (shouldAutoAccept) {
    //       await this.updateProfileConnections(toProfileId, fromUserId, connectionType, 'add');
    //       // Track the engagement
    //       await this.analyticsService.trackEngagement(
    //         toProfileId,
    //         profile.profileInformation.creator.toString(),
    //         fromUserId,
    //         'connect',
    //         { connectionType, source: details.source }
    //       );
    //       // Send notification for auto-accepted connection
    //       await this.notificationService.createNotification({
    //         type: 'CONNECTION_ACCEPTED',
    //         recipient: fromUserId,
    //         sender: profile.profileInformation.creator instanceof mongoose.Types.ObjectId ? profile.profileInformation.creator : new mongoose.Types.ObjectId(profile.profileInformation.creator),
    //         reference: {
    //           type: 'connection',
    //           id: connection._id
    //         },
    //         metadata: {
    //           connectionType,
    //           profileName: profile.profileInformation.username,
    //           source: details.source
    //         }
    //       });
    //     } else {
    //       // Send connection request notification
    //       await this.notificationService.createNotification({
    //         type: 'CONNECTION_REQUEST',
    //         recipient: profile.profileInformation.creator,
    //         sender: new mongoose.Types.ObjectId(fromUserId),
    //         reference: {
    //           type: 'connection',
    //           id: connection._id
    //         },
    //         metadata: {
    //           connectionType,
    //           message: details.message,
    //           source: details.source
    //         }
    //       });
    //     }
    //     return connection;
    //   } catch (error) {
    //     logger.error('Error in createConnection:', error);
    //     throw error;
    //   }
    // }
    static async createConnection(fromUserId, fromProfileId, toProfileId, connectionType, details) {
        console.log('Entering createConnection with params:', { fromUserId, fromProfileId, toProfileId, connectionType, details });
        try {
            const fromProfile = await profile_model_1.ProfileModel.findById(fromProfileId);
            const toProfile = await profile_model_1.ProfileModel.findById(toProfileId);
            if (!fromProfile)
                throw new Error('From profile not found');
            if (!toProfile)
                throw new Error('To profile not found');
            if (!this.isConnectionAllowed(toProfile, connectionType)) {
                throw new Error(`This profile does not accept ${connectionType} connections`);
            }
            const existingConnection = await Connection_1.Connection.findOne({
                fromUser: fromUserId,
                fromProfile: fromProfileId,
                toProfile: toProfileId,
                connectionType,
                status: { $in: ['pending', 'accepted'] },
            });
            if (existingConnection)
                throw new Error('Connection already exists');
            // affiliated profile types
            const affiliationTypes = ['group', 'team', 'family', 'neighborhood', 'company', 'business', 'association', 'organization', 'institution', 'community'];
            const connectionCategory = affiliationTypes.includes(fromProfile.profileType) || affiliationTypes.includes(toProfile.profileType) ? 'affiliation' : 'connection';
            const shouldAutoAccept = this.shouldAutoAcceptConnection(toProfile, details.source, connectionType);
            const connection = await Connection_1.Connection.create({
                fromUser: fromUserId,
                fromProfile: fromProfileId,
                toProfile: toProfileId,
                connectionType,
                connectionCategory,
                status: shouldAutoAccept ? 'accepted' : 'pending',
                connectionReason: details.connectionReason,
                exchangeInformationfor: details.exchangeInformationfor,
                metadata: { ...details.metadata, source: details.source },
                source: details.source,
            });
            if (shouldAutoAccept) {
                // await this.updateProfileConnections(toProfileId, fromUserId, connectionType, 'add');
                await this.analyticsService.trackEngagement(toProfileId, toProfile.profileInformation.creator.toString(), fromUserId, 'connect', { connectionType, source: details.source });
                await this.notificationService.createNotification({
                    type: 'connection_accepted',
                    message: "new connection accepted",
                    title: 'Connection Accepted',
                    recipient: fromUserId,
                    sender: new mongoose_1.default.Types.ObjectId(toProfile.profileInformation.creator),
                    reference: { type: 'connection', id: connection._id },
                    metadata: { connectionType, profileName: toProfile.profileInformation.username, source: details.source },
                });
            }
            else {
                await this.notificationService.createNotification({
                    type: 'connection_request',
                    message: details.connectionReason || 'You have a new connection request',
                    title: 'Connection Request',
                    recipient: toProfile.profileInformation.creator,
                    sender: new mongoose_1.default.Types.ObjectId(fromUserId),
                    reference: { type: 'connection', id: connection._id },
                    metadata: { connectionType, connectionReason: details.connectionReason, source: details.source },
                });
            }
            return connection;
        }
        catch (error) {
            logger_1.logger.error('Error in createConnection:', error);
            throw error;
        }
    }
    static async updateConnectionStatus(connectionId, status) {
        console.log('Entering updateConnectionStatus with params:', { connectionId, status });
        try {
            const connection = await Connection_1.Connection.findById(connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }
            const oldStatus = connection.status;
            connection.status = status;
            await connection.save();
            // Update profile connections when status changes to accepted
            if (oldStatus !== 'accepted' && status === 'accepted') {
                await this.updateProfileConnections(connection.toProfile.toString(), connection.fromUser.toString(), connection.connectionType, 'add');
            }
            // Remove from connections when status changes from accepted to rejected
            else if (oldStatus === 'accepted' && status === 'rejected') {
                await this.updateProfileConnections(connection.toProfile.toString(), connection.fromUser.toString(), connection.connectionType, 'remove');
            }
            return connection;
        }
        catch (error) {
            logger_1.logger.error('Error in updateConnectionStatus:', error);
            throw error;
        }
    }
    static async getProfileConnections(profileId, status, connectionCategory) {
        console.log('Entering getProfileConnections with params:', { profileId, status, connectionCategory });
        try {
            const query = { toProfile: profileId };
            if (status) {
                query.status = status;
            }
            // Add connectionCategory filter if provided
            if (connectionCategory) {
                query.connectionCategory = connectionCategory;
            }
            return await Connection_1.Connection.find(query)
                .populate('fromUser', 'firstName lastName email profileImage')
                .sort({ createdAt: -1 });
        }
        catch (error) {
            console.error('Error in getProfileConnections:', error);
            logger_1.logger.error('Get profile connections error:', error);
            throw error;
        }
    }
    static async getUserConnections(userId, status) {
        console.log('Entering getUserConnections with params:', { userId, status });
        try {
            const query = { fromUser: userId };
            if (status) {
                query.status = status;
            }
            return await Connection_1.Connection.find(query)
                .populate('toProfile', 'name profileType profileImage')
                .sort({ createdAt: -1 });
        }
        catch (error) {
            console.error('Error in getUserConnections:', error);
            logger_1.logger.error('Get user connections error:', error);
            throw error;
        }
    }
    static async getPendingConnections(userId) {
        try {
            const userProfileIds = await this.getUserProfileIds(userId);
            const pendingConnections = await Connection_1.Connection.find({
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
        }
        catch (error) {
            logger_1.logger.error('Get pending connections error:', error);
            throw error;
        }
    }
    static async getConnectionStats(userId) {
        try {
            const userProfileIds = await this.getUserProfileIds(userId);
            const [sent, received, accepted, pending] = await Promise.all([
                Connection_1.Connection.countDocuments({ fromUser: userId }),
                Connection_1.Connection.countDocuments({ toProfile: { $in: userProfileIds } }),
                Connection_1.Connection.countDocuments({
                    $or: [
                        { fromUser: userId, status: 'accepted' },
                        { toProfile: { $in: userProfileIds }, status: 'accepted' }
                    ]
                }),
                Connection_1.Connection.countDocuments({
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
        }
        catch (error) {
            logger_1.logger.error('Get connection stats error:', error);
            throw error;
        }
    }
    static async removeConnection(connectionId, userId) {
        try {
            const connection = await Connection_1.Connection.findOne({
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
        }
        catch (error) {
            logger_1.logger.error('Remove connection error:', error);
            throw error;
        }
    }
    static async getConnectionSuggestions(userId) {
        try {
            // Get user's interests and skills from their profiles
            const userProfiles = await profile_model_1.ProfileModel.find({ user: userId });
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
        }
        catch (error) {
            logger_1.logger.error('Error in getConnectionSuggestions:', error);
            throw error;
        }
    }
    static async trackInteraction(fromUserId, toProfileId, type, metadata) {
        try {
            await this.analyticsService.trackEngagement(toProfileId, toProfileId, // profile owner
            fromUserId, type, metadata);
            // Update last interaction timestamp
            await Connection_1.Connection.findOneAndUpdate({
                $or: [
                    { fromUser: new mongoose_1.default.Types.ObjectId(fromUserId), toProfile: new mongoose_1.default.Types.ObjectId(toProfileId) },
                    { fromUser: new mongoose_1.default.Types.ObjectId(toProfileId), toProfile: new mongoose_1.default.Types.ObjectId(fromUserId) }
                ]
            }, { $set: { lastInteractionAt: new Date() } }, { upsert: true });
        }
        catch (error) {
            logger_1.logger.error('Error tracking interaction:', error);
            throw error;
        }
    }
    static async getConnectionStrength(userId, connectionId) {
        return connection_analytics_service_1.ConnectionAnalyticsService.calculateConnectionStrength(new mongoose_1.default.Types.ObjectId(userId), new mongoose_1.default.Types.ObjectId(connectionId));
    }
    static async getUserProfileIds(userId) {
        const profiles = await profile_model_1.ProfileModel.find({ user: userId });
        return profiles.map((profile) => profile._id.toString());
    }
    static isConnectionAllowed(profile, connectionType) {
        if (!profile.connectionPreferences)
            return true;
        const { allowedConnectionTypes } = profile.connectionPreferences;
        return !allowedConnectionTypes || allowedConnectionTypes.includes(connectionType);
    }
    static async updateProfileStats(profileId, connectionType, operation) {
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile)
            return;
        const modifier = operation === 'increment' ? 1 : -1;
        if (!profile.stats)
            profile.stats = {};
        if (!profile.stats.connections)
            profile.stats.connections = {};
        profile.stats.connections[connectionType] =
            (profile.stats.connections[connectionType] || 0) + modifier;
        await profile.save();
    }
    static async updateProfileConnections(fromprofileId, telegramomprofileId, connectionType, operation) {
        const fProfile = await profile_model_1.ProfileModel.findById(fromprofileId);
        const tProfile = await profile_model_1.ProfileModel.findById(telegramomprofileId);
        if (!fProfile || !tProfile)
            throw new Error('Profile not found');
        const updateOperations = {};
        // Update arrays based on operation
        if (operation === 'add') {
            // Add to appropriate arrays if not already present
            fProfile.analytics.Circles.connections = fProfile.analytics.Circles.connections + 1;
            tProfile.analytics.Circles.connections = tProfile.analytics.Circles.connections + 1;
            await fProfile.save();
            await tProfile.save();
            // Update specific connection type counts
            if (connectionType === 'follow') {
                fProfile.analytics.Circles.following = fProfile.analytics.Circles.following + 1;
                tProfile.analytics.Circles.followers = tProfile.analytics.Circles.followers + 1;
                await tProfile.save();
            }
            if (connectionType === 'affiliation') {
                fProfile.analytics.Circles.affiliations = fProfile.analytics.Circles.affiliations + 1;
                await tProfile.save();
            }
        }
        else if (operation === 'remove') {
            // Remove from appropriate arrays
            fProfile.analytics.Circles.connections = fProfile.analytics.Circles.connections - 1;
            tProfile.analytics.Circles.connections = tProfile.analytics.Circles.connections - 1;
            await fProfile.save();
            await tProfile.save();
            // Update specific connection type counts
            if (connectionType === 'follow') {
                fProfile.analytics.Circles.following = fProfile.analytics.Circles.following - 1;
                tProfile.analytics.Circles.followers = tProfile.analytics.Circles.followers - 1;
                await tProfile.save();
            }
        }
    }
    static shouldAutoAcceptConnection(profile, source, connectionType) {
        const { privacySettings } = profile;
        if (!privacySettings)
            return false;
        // If profile has automatic approval setting or connection type is from qrcode or from link,a automatically accept the request on behalf of the user
        if (privacySettings.connectionType === 'direct' || source === 'qrcode' || source === 'link' || privacySettings.connectionType === 'follow' || connectionType === 'connection') {
            return true;
        }
        return false;
    }
}
ConnectionService.notificationService = new notification_service_1.NotificationService();
ConnectionService.analyticsService = new analytics_service_1.AnalyticsService();
ConnectionService.connectionAnalytics = new connection_analytics_service_1.ConnectionAnalyticsService();
exports.default = ConnectionService;
