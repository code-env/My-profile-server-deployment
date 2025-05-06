// services/interaction.service.ts
import { Model } from 'mongoose';
import { IInteraction, InteractionMode, InteractionCategory, InteractionStatus } from '../models/Interaction';
import { Socket } from 'socket.io';
import { Types } from 'mongoose';
import { PriorityLevel, Attachment, Reminder } from '../models/plans-shared';
import { logger } from '../utils/logger';
import { RelationshipType } from '../models/RelationshipType';
import { Contact } from '../models/Contact';

export class InteractionService {
    private userSockets: Map<string, Socket> = new Map();
    private io: any; // Socket.IO server instance

    constructor(private interactionModel: Model<IInteraction>) {
        console.log('InteractionService initialized');
    }

    setSocketServer(io: any) {
        console.log('Setting up socket server in InteractionService');
        this.io = io;
        this.setupSocketListeners();
    }

    private setupSocketListeners() {
        if (!this.io) {
            console.error('No socket server available');
            return;
        }
        console.log('Setting up socket listeners');

        this.io.on('connection', (socket: Socket) => {
            console.log('New socket connection received');
            const userId = socket.handshake.query.userId as string;
            console.log('Connection userId:', userId);
            
            if (userId) {
                this.registerUserSocket(userId, socket);
                logger.info(`User ${userId} connected to interaction service`);

                // Log all incoming events for debugging
                socket.onAny((eventName, ...args) => {
                    console.log(`Received event "${eventName}"`, args);
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
                    console.log('Received social:interaction event:', data);
                    try {
                        const interaction = await this.handleSocialInteraction(
                            new Types.ObjectId(userId),
                            data.profile,
                            data.targetProfile,
                            data.type,
                            data.contentId,
                            data.content
                        );
                        console.log('Created interaction:', interaction);
                        this.emitToUser(userId, 'interaction:social:recorded', interaction);
                    } catch (error) {
                        console.error('Social interaction error:', error);
                        logger.error('Social interaction error:', error);
                    }
                });
            }

            socket.on('disconnect', () => {
                console.log(`Socket ${socket.id} disconnected, userId: ${userId}`);
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
        const interaction = new this.interactionModel({
            ...data,
            createdBy,
            isAutoGenerated: false,
            lastContact: new Date()
        });

        const savedInteraction = await interaction.save();
        this.emitToUser(createdBy.toString(), 'interaction:created', savedInteraction);
        return savedInteraction;
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

        const title = this.generateInteractionTitle(mode as InteractionMode, context);
        const notes = this.generateInteractionNotes(mode as InteractionMode, context);

        const interaction = new this.interactionModel({
            title,
            profile: initiatorProfile,
            targetProfile: targetProfile,
            relationship: targetProfile,
            mode,
            category: this.determineCategory(mode as InteractionMode),
            isAutoGenerated: true,
            createdBy: initiatorId,
            lastContact: new Date(),
            context,
            notes,
            isPhysical: mode === 'in_person'
        });

        const savedInteraction = await interaction.save();
        
        this.emitToUser(initiatorId.toString(), 'interaction:created', savedInteraction);
        this.emitToUser(targetProfile.toString(), 'interaction:received', savedInteraction);
        
        return savedInteraction;
    }

    async handleQRScanInteraction(
        userId: Types.ObjectId,
        profileId: Types.ObjectId,
        scannedProfileId: Types.ObjectId,
        location?: { lat: number; lng: number; address?: string }
    ): Promise<IInteraction> {
        const interaction = new this.interactionModel({
            title: 'QR Code Scan Interaction',
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
                metadata: { scanType: 'qr' }
            }
        });

        const savedInteraction = await interaction.save();
        this.broadcastInteraction(savedInteraction);
        return savedInteraction;
    }

    async handleChatInteraction(
        userId: Types.ObjectId,
        senderId: Types.ObjectId,
        receiverId: Types.ObjectId,
        messageId: string,
        content: string
    ): Promise<IInteraction> {
        const interaction = new this.interactionModel({
            title: 'Chat Message',
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
                metadata: { messageType: 'chat' }
            }
        });

        const savedInteraction = await interaction.save();
        this.broadcastInteraction(savedInteraction);
        return savedInteraction;
    }

    async handleSocialInteraction(
        userId: Types.ObjectId,
        profileId: Types.ObjectId,
        targetProfile: Types.ObjectId,
        type: 'like' | 'comment' | 'share',
        contentId: string,
        content?: string
    ): Promise<IInteraction> {
        console.log('handleSocialInteraction', userId, profileId, targetProfile, type, contentId, content);
        const interaction = new this.interactionModel({
            title: `Social Media ${type.charAt(0).toUpperCase() + type.slice(1)}`,
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
                metadata: { interactionType: type }
            }
        });

        const savedInteraction = await interaction.save();
        this.broadcastInteraction(savedInteraction);
        return savedInteraction;
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
}
