// services/interaction.service.ts
import { Model } from 'mongoose';
import { IInteraction, InteractionMode, InteractionCategory, InteractionStatus } from '../models/Interaction';
import { Socket } from 'socket.io';
import { Types } from 'mongoose';
import { PriorityLevel, Attachment, Reminder } from '../models/plans-shared';
import { logger } from '../utils/logger';
import { RelationshipType } from '../models/RelationshipType';
import { Contact } from '../models/Contact';
import { ProfileModel } from '../models/profile.model';
import { SettingsService } from './settings.service';

export class InteractionService {
    private userSockets: Map<string, Socket> = new Map();
    private io: any; // Socket.IO server instance
    private settingsService = new SettingsService();

    constructor(private interactionModel: Model<IInteraction>) {

        // log with info like this {"metadata":{"service":"my-profile-api","timestamp":"2025-05-07 15:45:44:818"}}
        const metadata = {
            service: 'interaction-service',
            timestamp: new Date().toISOString()
        };
        logger.info(`InteractionService initialized ${JSON.stringify(metadata)}`);
    }

    setSocketServer(io: any) {
        logger.info('Setting up socket server in InteractionService');
        this.io = io;
        this.setupSocketListeners();
    }

    private setupSocketListeners() {
        if (!this.io) {
            logger.error('No socket server available');
            return;
        }
        logger.info('Setting up socket listeners');

        this.io.on('connection', (socket: Socket) => {
            logger.info('New socket connection received');
            const userId = socket.handshake.query.userId as string;
            logger.info('Connection userId:', userId);
            
            if (userId) {
                this.registerUserSocket(userId, socket);
                logger.info(`User ${userId} connected to interaction service`);

                // Log all incoming events for debugging
                socket.onAny((eventName, ...args) => {
                    logger.info(`Received event "${eventName}"`, args);
                });

                // Handle QR scan interactions
                socket.on('qr:scan', async (data: { 
                    profileId: string, 
                    scannedProfileId: string,
                    location?: { lat: number; lng: number; address?: string } 
                }) => {
                    try {
                        const interaction = await this.handleQRScanInteraction(
                            new Types.ObjectId(userId),
                            new Types.ObjectId(data.profileId),
                            new Types.ObjectId(data.scannedProfileId),
                            data.location
                        );
                        this.emitToUser(userId, 'interaction:qr:success', interaction);
                    } catch (error) {
                        logger.error('QR scan interaction error:', error);
                        this.emitToUser(userId, 'interaction:qr:error', { message: 'Failed to record QR scan interaction' });
                    }
                });

                // Handle chat interactions
                socket.on('chat:message', async (data: {
                    senderId: string,
                    receiverId: string,
                    messageId: string,
                    content: string
                }) => {
                    try {
                        const interaction = await this.handleChatInteraction(
                            new Types.ObjectId(userId),
                            new Types.ObjectId(data.senderId),
                            new Types.ObjectId(data.receiverId),
                            data.messageId,
                            data.content
                        );
                        this.emitToUser(userId, 'interaction:chat:recorded', interaction);
                    } catch (error) {
                        logger.error('Chat interaction error:', error);
                    }
                });

                // Handle social media interactions
                socket.on('social:interaction', async (
                    data: {
                    type: 'like' | 'comment' | 'share',
                    profile: Types.ObjectId,
                    targetProfile: Types.ObjectId,
                    contentId: string,
                    content?: string
                }) => {
                    logger.info('Received social:interaction event:', data);
                    try {
                        const interaction = await this.handleSocialInteraction(
                            new Types.ObjectId(userId),
                            data.profile,
                            data.targetProfile,
                            data.type,
                            data.contentId,
                            data.content
                        );
                        logger.info('Created interaction:', interaction.title);
                        this.emitToUser(userId, 'interaction:social:recorded', interaction);
                    } catch (error) {
                        logger.error('Social interaction error:', error);
                    }
                });
            }

            socket.on('disconnect', () => {
                logger.info(`Socket ${socket.id} disconnected, userId: ${userId}`);
                if (userId) {
                    this.userSockets.delete(userId);
                    logger.info(`User ${userId} disconnected from interaction service`);
                }
            });
        });
    }

    registerUserSocket(userId: string, socket: Socket) {
        this.userSockets.set(userId, socket);
        socket.on('disconnect', () => this.userSockets.delete(userId));
    }

    async createManualInteraction(
        createdBy: Types.ObjectId,
        data: {
            profile: Types.ObjectId;
            targetProfile: Types.ObjectId;
            relationship: Types.ObjectId;
            mode: InteractionMode;
            title?: string;
            notes?: string;
            category?: InteractionCategory;
            isPhysical?: boolean;
            priority?: PriorityLevel;
            nextContact?: Date;
            frequency?: string;
            color?: string;
            location?: {
                physicalLocation?: boolean;
                address?: string;
                coordinates?: { lat: number; lng: number };
            };
            attachments?: Attachment[];
            reminders?: Reminder[];
        }
    ): Promise<IInteraction> {
        // Map interaction mode to permission type for manual interactions
        const getPermissionType = (mode: InteractionMode): 'chat' | 'call' | 'visit' | 'qr_scan' | 'social' | 'connection' => {
            switch (mode) {
                case InteractionMode.CHAT:
                case InteractionMode.EMAIL:
                    return 'chat';
                case InteractionMode.CALL:
                    return 'call';
                case InteractionMode.IN_PERSON:
                    return 'visit';
                case InteractionMode.QR_SCAN:
                    return 'qr_scan';
                case InteractionMode.LIKE:
                case InteractionMode.COMMENT:
                case InteractionMode.SOCIAL_MEDIA:
                    return 'social';
                default:
                    return 'connection';
            }
        };

        const permissionType = getPermissionType(data.mode);

        // Check if interaction is allowed
        const permissionCheck = await this.checkInteractionPermissions(
            data.profile,
            data.targetProfile,
            permissionType
        );

        if (!permissionCheck.allowed) {
            throw new Error(`Manual interaction not allowed: ${permissionCheck.reason}`);
        }

        // Check if interaction should be recorded
        const recordingCheck = await this.shouldRecordInteraction(
            data.profile,
            data.targetProfile,
            data.mode
        );

        const interaction = new this.interactionModel({
            ...data,
            title: recordingCheck.record ? 
                (data.title || `Manual ${data.mode} interaction`) : 
                `${data.title || `Manual ${data.mode} interaction`} (Not Recorded)`,
            createdBy,
            isAutoGenerated: false,
            lastContact: new Date(),
            context: {
                entityType: 'manual',
                action: 'create',
                metadata: {
                    recorded: recordingCheck.record,
                    ...(recordingCheck.reason && { reason: recordingCheck.reason })
                }
            }
        });

        // Only save to database if recording is allowed
        if (recordingCheck.record) {
            const savedInteraction = await interaction.save();
            this.emitToUser(createdBy.toString(), 'interaction:created', savedInteraction);
            return savedInteraction;
        } else {
            logger.info(`Manual interaction not recorded: ${recordingCheck.reason}`);
            // Return the interaction object without saving
            return interaction;
        }
    }

    async generateInteraction(
        initiatorId: Types.ObjectId,
        initiatorProfile: Types.ObjectId,
        targetProfile: Types.ObjectId,
        mode: string, // Changed to string for flexibility
        context?: {
            entityType?: string;
            entityId?: string;
            action?: string;
            content?: string;
            metadata?: Record<string, any>;
        }
    ): Promise<IInteraction> {
        // Validate mode is valid
        if (!Object.values(InteractionMode).includes(mode as InteractionMode)) {
            throw new Error(`Invalid interaction mode: ${mode}`);
        }

        // Map interaction mode to permission type
        const getPermissionType = (mode: string): 'chat' | 'call' | 'visit' | 'qr_scan' | 'social' | 'connection' => {
            switch (mode) {
                case InteractionMode.CHAT:
                case InteractionMode.EMAIL:
                    return 'chat';
                case InteractionMode.CALL:
                    return 'call';
                case InteractionMode.IN_PERSON:
                    return 'visit';
                case InteractionMode.QR_SCAN:
                    return 'qr_scan';
                case InteractionMode.LIKE:
                case InteractionMode.COMMENT:
                case InteractionMode.SOCIAL_MEDIA:
                    return 'social';
                default:
                    return 'connection';
            }
        };

        const permissionType = getPermissionType(mode);

        // Check if interaction is allowed
        const permissionCheck = await this.checkInteractionPermissions(
            initiatorProfile,
            targetProfile,
            permissionType
        );

        if (!permissionCheck.allowed) {
            throw new Error(`Interaction not allowed: ${permissionCheck.reason}`);
        }

        // Check if interaction should be recorded
        const recordingCheck = await this.shouldRecordInteraction(
            initiatorProfile,
            targetProfile,
            mode
        );

        const title = this.generateInteractionTitle(mode as InteractionMode, context);
        const notes = this.generateInteractionNotes(mode as InteractionMode, context);

        const interaction = new this.interactionModel({
            title: recordingCheck.record ? title : `${title} (Not Recorded)`,
            profile: initiatorProfile,
            targetProfile: targetProfile,
            relationship: targetProfile,
            mode,
            category: this.determineCategory(mode as InteractionMode),
            isAutoGenerated: true,
            createdBy: initiatorId,
            lastContact: new Date(),
            notes,
            status: InteractionStatus.COMPLETED,
            context: {
                ...context,
                metadata: {
                    ...context?.metadata,
                    recorded: recordingCheck.record,
                    ...(recordingCheck.reason && { reason: recordingCheck.reason })
                }
            }
        });

        // Only save to database if recording is allowed
        if (recordingCheck.record) {
            const savedInteraction = await interaction.save();
            this.broadcastInteraction(savedInteraction);
            return savedInteraction;
        } else {
            logger.info(`Generated interaction not recorded: ${recordingCheck.reason}`);
            // Return the interaction object without saving
            return interaction;
        }
    }

    async handleQRScanInteraction(
        userId: Types.ObjectId,
        profileId: Types.ObjectId,
        scannedProfileId: Types.ObjectId,
        location?: { lat: number; lng: number; address?: string }
    ): Promise<IInteraction> {
        // Check if QR scan interaction is allowed
        const permissionCheck = await this.checkInteractionPermissions(
            profileId,
            scannedProfileId,
            'qr_scan'
        );

        if (!permissionCheck.allowed) {
            throw new Error(`QR scan interaction not allowed: ${permissionCheck.reason}`);
        }

        // Check if interaction should be recorded
        const recordingCheck = await this.shouldRecordInteraction(
            profileId,
            scannedProfileId,
            'qr_scan'
        );

        const interaction = new this.interactionModel({
            title: recordingCheck.record ? 'QR Code Scan Interaction' : 'QR Code Scan Interaction (Not Recorded)',
            profile: profileId,
            relationship: scannedProfileId,
            mode: InteractionMode.QR_SCAN,
            category: InteractionCategory.NETWORKING,
            isAutoGenerated: true,
            createdBy: userId,
            lastContact: new Date(),
            isPhysical: true,
            location: {
                physicalLocation: true,
                ...location
            },
            status: InteractionStatus.COMPLETED,
            context: {
                entityType: 'qr_scan',
                action: 'scan',
                metadata: { 
                    scanType: 'qr', 
                    recorded: recordingCheck.record,
                    ...(recordingCheck.reason && { reason: recordingCheck.reason })
                }
            }
        });

        // Only save to database if recording is allowed
        if (recordingCheck.record) {
            const savedInteraction = await interaction.save();
            this.broadcastInteraction(savedInteraction);
            return savedInteraction;
        } else {
            logger.info(`QR scan interaction not recorded: ${recordingCheck.reason}`);
            // Return the interaction object without saving
            return interaction;
        }
    }

    async handleChatInteraction(
        userId: Types.ObjectId,
        senderId: Types.ObjectId,
        receiverId: Types.ObjectId,
        messageId: string,
        content: string
    ): Promise<IInteraction> {
        // Check if chat interaction is allowed
        const permissionCheck = await this.checkInteractionPermissions(
            senderId,
            receiverId,
            'chat'
        );

        if (!permissionCheck.allowed) {
            throw new Error(`Chat interaction not allowed: ${permissionCheck.reason}`);
        }

        // Check if interaction should be recorded
        const recordingCheck = await this.shouldRecordInteraction(
            senderId,
            receiverId,
            'chat'
        );

        const interaction = new this.interactionModel({
            title: recordingCheck.record ? 'Chat Message' : 'Chat Message (Not Recorded)',
            profile: senderId,
            relationship: receiverId,
            mode: InteractionMode.CHAT,
            category: InteractionCategory.PERSONAL,
            isAutoGenerated: true,
            createdBy: userId,
            lastContact: new Date(),
            notes: content.substring(0, 200), // Store first 200 chars of message
            status: InteractionStatus.COMPLETED,
            context: {
                entityType: 'chat',
                entityId: messageId,
                action: 'message',
                content: content.substring(0, 200),
                metadata: { 
                    messageType: 'chat', 
                    recorded: recordingCheck.record,
                    ...(recordingCheck.reason && { reason: recordingCheck.reason })
                }
            }
        });

        // Only save to database if recording is allowed
        if (recordingCheck.record) {
            const savedInteraction = await interaction.save();
            this.broadcastInteraction(savedInteraction);
            return savedInteraction;
        } else {
            logger.info(`Chat interaction not recorded: ${recordingCheck.reason}`);
            // Return the interaction object without saving
            return interaction;
        }
    }

    async handleSocialInteraction(
        userId: Types.ObjectId,
        profileId: Types.ObjectId,
        targetProfile: Types.ObjectId,
        type: 'like' | 'comment' | 'share',
        contentId: string,
        content?: string
    ): Promise<IInteraction> {
        logger.info('handleSocialInteraction', userId, profileId, targetProfile, type, contentId, content);
        
        // Check if social interaction is allowed
        const permissionCheck = await this.checkInteractionPermissions(
            profileId,
            targetProfile,
            'social'
        );

        if (!permissionCheck.allowed) {
            throw new Error(`Social interaction not allowed: ${permissionCheck.reason}`);
        }

        // Check if interaction should be recorded
        const recordingCheck = await this.shouldRecordInteraction(
            profileId,
            targetProfile,
            'social'
        );

        const interaction = new this.interactionModel({
            title: recordingCheck.record ? 
                `Social Media ${type.charAt(0).toUpperCase() + type.slice(1)}` :
                `Social Media ${type.charAt(0).toUpperCase() + type.slice(1)} (Not Recorded)`,
            profile: profileId,
            targetProfile: targetProfile,
            relationship: targetProfile, // change this to actual relationship Id from relationship Types
            mode: type === 'comment' ? InteractionMode.COMMENT : 
                  type === 'like' ? InteractionMode.LIKE : 
                  InteractionMode.SOCIAL_MEDIA,
            category: InteractionCategory.NETWORKING,
            isAutoGenerated: true,
            createdBy: userId,
            lastContact: new Date(),
            notes: content,
            status: InteractionStatus.COMPLETED,
            context: {
                entityType: 'social_media',
                entityId: contentId,
                action: type,
                content: content,
                metadata: { 
                    interactionType: type,
                    recorded: recordingCheck.record,
                    ...(recordingCheck.reason && { reason: recordingCheck.reason })
                }
            }
        });

        // Only save to database if recording is allowed
        if (recordingCheck.record) {
            const savedInteraction = await interaction.save();
            this.broadcastInteraction(savedInteraction);
            return savedInteraction;
        } else {
            logger.info(`Social interaction not recorded: ${recordingCheck.reason}`);
            // Return the interaction object without saving
            return interaction;
        }
    }

    async handleTaskComment(
        userId: Types.ObjectId,
        taskId: string,
        content: string
    ): Promise<IInteraction> {
        const interaction = new this.interactionModel({
            title: 'Task Comment',
            profile: userId,
            mode: InteractionMode.COMMENT,
            category: InteractionCategory.BUSINESS,
            isAutoGenerated: true,
            createdBy: userId,
            lastContact: new Date(),
            notes: content.substring(0, 200), // Store first 200 chars of comment
            status: InteractionStatus.COMPLETED,
            context: {
                entityType: 'task',
                entityId: taskId,
                action: 'comment',
                content: content.substring(0, 200),
                metadata: { commentType: 'task' }
            }
        });

        const savedInteraction = await interaction.save();
        this.broadcastInteraction(savedInteraction);
        return savedInteraction;
    }

    private broadcastInteraction(interaction: IInteraction) {
        // Emit to both the initiator and the target of the interaction
        this.emitToUser(interaction.createdBy.toString(), 'interaction:new', interaction);
        this.emitToUser(interaction.relationship.toString(), 'interaction:received', interaction);
        
        // If we have Socket.IO server instance, also emit to rooms
        if (this.io) {
            this.io.to(`profile:${interaction.profile}`).emit('interaction:new', interaction);
            this.io.to(`profile:${interaction.relationship}`).emit('interaction:received', interaction);
        }
    }

    private emitToUser(userId: string, event: string, data: any) {
        const socket = this.userSockets.get(userId);
        if (socket) {
            socket.emit(event, data);
        }
    }

    private generateInteractionTitle(mode: InteractionMode, context?: any): string {
        switch (mode) {
            case 'comment': return `Commented on ${context?.entityType || 'content'}`;
            case 'like': return `Liked ${context?.entityType || 'content'}`;
            case 'chat': return 'Sent a message';
            default: return 'New interaction';
        }
    }

    private generateInteractionNotes(mode: InteractionMode, context?: any): string {
        if (mode === 'comment' && context?.content) {
            return `Comment: ${context.content.substring(0, 100)}`;
        }
        return '';
    }
    private determineCategory(mode: InteractionMode): InteractionCategory {
        switch (mode) {
            case InteractionMode.EMAIL:
                return InteractionCategory.WORK;
            case InteractionMode.CALL:
            case InteractionMode.IN_PERSON:
                return InteractionCategory.BUSINESS;
            default:
                return InteractionCategory.PERSONAL;
        }
    }

    // private determineRelationship(initiatorProfileId: Types.ObjectId, targetProfileId: Types.ObjectId): Types.ObjectId {
    //    // get the relatoinship type from contact or connections
    //    const relationship = Contact.findOne({
    //     $or: [
    //         { profile: initiatorProfileId, targetProfile: targetProfileId },
    //         { profile: targetProfileId, targetProfile: initiatorProfileId }
    //     ]
    //    });

    //    console.log('relationship', relationship);

    //    return relationship?._id || targetProfileId;
    // }

    // Fetch user's interactions with pagination and filters
    async getUserInteractions(
        userId: Types.ObjectId,
        profileId: Types.ObjectId,
        filters: {
            mode?: InteractionMode;
            category?: InteractionCategory;
            status?: InteractionStatus;
            startDate?: Date;
            endDate?: Date;
            isPhysical?: boolean;
        } = {},
        pagination: {
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        } = {}
    ) {
        const query: any = {
            $or: [
                { profile: profileId },
                { relationship: profileId }
            ]
        };

        // Apply filters
        if (filters.mode) query.mode = filters.mode;
        if (filters.category) query.category = filters.category;
        if (filters.status) query.status = filters.status;
        if (typeof filters.isPhysical === 'boolean') query.isPhysical = filters.isPhysical;
        
        // Date range filter
        if (filters.startDate || filters.endDate) {
            query.lastContact = {};
            if (filters.startDate) query.lastContact.$gte = filters.startDate;
            if (filters.endDate) query.lastContact.$lte = filters.endDate;
        }

        // Setup pagination
        const page = pagination.page || 1;
        const limit = pagination.limit || 10;
        const skip = (page - 1) * limit;
        const sortBy = pagination.sortBy || 'lastContact';
        const sortOrder = pagination.sortOrder || 'desc';

        // Execute query with pagination
        const [interactions, total] = await Promise.all([
            this.interactionModel
                .find(query)
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limit)
                .populate('relationship', 'name avatar')
                .lean(),
            this.interactionModel.countDocuments(query)
        ]);

        return {
            interactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // Get interaction statistics for a user
    async getUserInteractionStats(
        userId: Types.ObjectId,
        profileId: Types.ObjectId,
        timeframe: 'day' | 'week' | 'month' | 'year' = 'month'
    ) {
        const startDate = new Date();
        switch (timeframe) {
            case 'day':
                startDate.setDate(startDate.getDate() - 1);
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }

        const baseQuery = {
            $or: [
                { profile: profileId },
                { relationship: profileId }
            ],
            lastContact: { $gte: startDate }
        };

        const [
            totalInteractions,
            modeStats,
            categoryStats,
            physicalInteractions,
            statusStats,
            timelineStats
        ] = await Promise.all([
            // Total interactions
            this.interactionModel.countDocuments(baseQuery),

            // Interactions by mode
            this.interactionModel.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$mode', count: { $sum: 1 } } }
            ]),

            // Interactions by category
            this.interactionModel.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ]),

            // Physical interactions
            this.interactionModel.countDocuments({ ...baseQuery, isPhysical: true }),

            // Status distribution
            this.interactionModel.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),

            // Timeline stats (grouped by day)
            this.interactionModel.aggregate([
                { $match: baseQuery },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$lastContact' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id': 1 } }
            ])
        ]);

        // Process mode stats into a more readable format
        const modeDistribution = Object.values(InteractionMode).reduce((acc: any, mode) => {
            const stat = modeStats.find(s => s._id === mode);
            acc[mode] = stat ? stat.count : 0;
            return acc;
        }, {});

        // Process category stats
        const categoryDistribution = Object.values(InteractionCategory).reduce((acc: any, category) => {
            const stat = categoryStats.find(s => s._id === category);
            acc[category] = stat ? stat.count : 0;
            return acc;
        }, {});

        // Process status stats
        const statusDistribution = Object.values(InteractionStatus).reduce((acc: any, status) => {
            const stat = statusStats.find(s => s._id === status);
            acc[status] = stat ? stat.count : 0;
            return acc;
        }, {});

        return {
            timeframe,
            totalInteractions,
            physicalInteractions,
            modeDistribution,
            categoryDistribution,
            statusDistribution,
            timeline: timelineStats,
            averageInteractionsPerDay: totalInteractions / (timelineStats.length || 1)
        };
    }

    // Get recent interactions summary
    async getRecentInteractionsSummary(
        userId: Types.ObjectId,
        profileId: Types.ObjectId,
        limit: number = 5
    ) {
        return this.interactionModel
            .find({
                $or: [
                    { profile: profileId },
                    { relationship: profileId }
                ]
            })
            .sort({ lastContact: -1 })
            .limit(limit)
            .populate('relationship', 'name avatar')
            .lean();
    }

    // Get interaction frequency with a specific profile
    async getInteractionFrequency(
        profileId: Types.ObjectId,
        relationshipId: Types.ObjectId
    ) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const interactions = await this.interactionModel
            .find({
                $or: [
                    { profile: profileId, relationship: relationshipId },
                    { profile: relationshipId, relationship: profileId }
                ],
                lastContact: { $gte: thirtyDaysAgo }
            })
            .sort({ lastContact: 1 });

        if (interactions.length < 2) {
            return {
                averageGapDays: null,
                totalInteractions: interactions.length,
                lastInteraction: interactions[0]?.lastContact || null
            };
        }

        // Calculate average gap between interactions
        let totalGap = 0;
        for (let i = 1; i < interactions.length; i++) {
            const gap = interactions[i].lastContact.getTime() - interactions[i-1].lastContact.getTime();
            totalGap += gap / (1000 * 60 * 60 * 24); // Convert to days
        }

        return {
            averageGapDays: totalGap / (interactions.length - 1),
            totalInteractions: interactions.length,
            lastInteraction: interactions[interactions.length - 1].lastContact
        };
    }

    // Get all interactions for a profile
    async getAllProfileInteractions(profileId: Types.ObjectId) {
        return this.interactionModel
            .find({
                $or: [
                    { profile: profileId },
                    { relationship: profileId }
                ]
            })
            .populate('relationship', 'name avatar')
            .sort({ lastContact: -1 })
            .lean();
    }

    // get interactions between two profiles
    async getInteractionsBetweenProfiles(profileId: Types.ObjectId, targetProfileId: Types.ObjectId) {
        const interactions = await this.interactionModel.find({
            $or: [
                // Interactions where profileId is the initiator and targetProfileId is the target
                { profile: profileId, targetProfile: targetProfileId },
                // Interactions where targetProfileId is the initiator and profileId is the target
                { profile: targetProfileId, targetProfile: profileId }
            ]
        }).sort({ createdAt: -1 });

        // Calculate interaction stats
        const stats = {
            total: interactions.length,
            byType: {} as Record<string, number>,
            byDirection: {
                initiated: interactions.filter(i => i.profile.equals(profileId)).length,
                received: interactions.filter(i => i.profile.equals(targetProfileId)).length
            },
            lastInteraction: interactions[0]?.createdAt || null
        };

        // Count interactions by type
        interactions.forEach(interaction => {
            if (!stats.byType[interaction.mode]) {
                stats.byType[interaction.mode] = 0;
            }
            stats.byType[interaction.mode]++;
        });

        return {
            interactions,
            stats,
            hasInteracted: interactions.length > 0,
            mostCommonType: Object.entries(stats.byType)
                .sort(([,a], [,b]) => b - a)[0]?.[0] || null
        };
    }

    /**
     * Check if interaction is allowed between two profiles based on their settings
     */
    private async checkInteractionPermissions(
        initiatorProfileId: Types.ObjectId,
        targetProfileId: Types.ObjectId,
        interactionType: 'chat' | 'call' | 'visit' | 'qr_scan' | 'social' | 'connection'
    ): Promise<{ allowed: boolean; reason?: string }> {
        try {
            // Get both profiles
            const [initiatorProfile, targetProfile] = await Promise.all([
                ProfileModel.findById(initiatorProfileId).lean(),
                ProfileModel.findById(targetProfileId).lean()
            ]);

            if (!initiatorProfile || !targetProfile) {
                return { allowed: false, reason: 'Profile not found' };
            }

            // Get target profile's settings (including user settings and profile-specific settings)
            const targetSettings = await this.settingsService.getSettings(
                targetProfile.profileInformation.creator.toString(),
                targetProfileId.toString()
            );

            if (!targetSettings) {
                // If no settings found, allow interaction (default behavior)
                return { allowed: true };
            }

            // Check if initiator is blocked
            if (targetSettings.blockingSettings?.blockedProfiles?.includes(initiatorProfileId.toString())) {
                return { allowed: false, reason: 'Profile is blocked' };
            }

            // Check profile-specific settings for interaction restrictions
            const profileSpecificSettings = targetProfile.specificSettings || {};
            
            // Check interaction type specific permissions
            switch (interactionType) {
                case 'chat':
                    // Check chatWithMe permission
                    const chatPermission = targetSettings.privacy?.permissions?.chatWithMe?.level;
                    if (chatPermission === 'NoOne') {
                        return { allowed: false, reason: 'Chat interactions not allowed' };
                    }
                    
                    // Check profile-specific chat settings
                    if (profileSpecificSettings.allowMessages === false) {
                        return { allowed: false, reason: 'Messages disabled for this profile' };
                    }
                    break;

                case 'call':
                    // Check callMe permission
                    const callPermission = targetSettings.privacy?.permissions?.callMe?.level;
                    if (callPermission === 'NoOne') {
                        return { allowed: false, reason: 'Call interactions not allowed' };
                    }
                    break;

                case 'visit':
                    // Check visit permission
                    const visitPermission = targetSettings.privacy?.permissions?.visit?.level;
                    if (visitPermission === 'NoOne') {
                        return { allowed: false, reason: 'Profile visits not allowed' };
                    }
                    break;

                case 'qr_scan':
                    // Check QR scan discovery settings
                    if (targetSettings.discovery?.byQRCode === false) {
                        return { allowed: false, reason: 'QR code discovery disabled' };
                    }
                    
                    // Check profile-specific QR settings
                    if (profileSpecificSettings.allowQRPublicAccess === false) {
                        return { allowed: false, reason: 'QR access disabled for this profile' };
                    }
                    break;

                case 'social':
                    // Check if social interactions are allowed
                    if (profileSpecificSettings.allowComments === false) {
                        return { allowed: false, reason: 'Social interactions disabled' };
                    }
                    break;

                case 'connection':
                    // Check connection request permissions
                    const requestPermission = targetSettings.privacy?.permissions?.request?.level;
                    if (requestPermission === 'NoOne') {
                        return { allowed: false, reason: 'Connection requests not allowed' };
                    }
                    
                    // Check if new connection requests are blocked
                    if (targetSettings.blockingSettings?.blockNewConnectionRequests === true) {
                        return { allowed: false, reason: 'New connection requests blocked' };
                    }
                    break;
            }

            // Check visibility settings
            const profileVisibility = targetSettings.privacy?.Visibility?.profile?.profile?.level;
            if (profileVisibility === 'OnlyMe') {
                return { allowed: false, reason: 'Profile is private' };
            }

            return { allowed: true };

        } catch (error) {
            logger.error('Error checking interaction permissions:', error);
            // On error, allow interaction to maintain functionality
            return { allowed: true };
        }
    }

    /**
     * Apply settings-based filtering to interaction recording
     */
    private async shouldRecordInteraction(
        initiatorProfileId: Types.ObjectId,
        targetProfileId: Types.ObjectId,
        interactionType: string
    ): Promise<{ record: boolean; reason?: string }> {
        try {
            // Get target profile settings
            const targetProfile = await ProfileModel.findById(targetProfileId).lean();
            if (!targetProfile) {
                return { record: false, reason: 'Target profile not found' };
            }

            const targetSettings = await this.settingsService.getSettings(
                targetProfile.profileInformation.creator.toString(),
                targetProfileId.toString()
            );

            if (!targetSettings) {
                return { record: true }; // Default to recording if no settings
            }

            // Check if interaction recording is disabled for this profile type
            const profileSpecificSettings = targetProfile.specificSettings || {};
            
            // Some profile types might have interaction recording disabled
            if (profileSpecificSettings.disableInteractionRecording === true) {
                return { record: false, reason: 'Interaction recording disabled for this profile' };
            }

            // Check if analytics/tracking is disabled
            if (profileSpecificSettings.analyticsEnabled === false) {
                return { record: false, reason: 'Analytics disabled for this profile' };
            }

            // Check privacy settings for activity tracking
            const activityVisibility = targetSettings.privacy?.Visibility?.profile?.activity?.level;
            if (activityVisibility === 'OnlyMe') {
                return { record: false, reason: 'Activity tracking is private' };
            }

            return { record: true };

        } catch (error) {
            logger.error('Error checking interaction recording settings:', error);
            return { record: true }; // Default to recording on error
        }
    }
}
