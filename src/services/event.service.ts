import mongoose, { Types } from 'mongoose';
import {
    RepeatSettings,
    Reminder,
    Reward,
    Attachment,
    Location,
    PriorityLevel,
    VisibilityType,
    EventType,
    BookingStatus,
    EventStatus,
    Comment,
    RepeatFrequency,
    EndCondition
} from '../models/plans-shared';

import { IEvent, Event } from '../models/Event';
import { User } from '../models/User';
import { checkTimeOverlap } from '../utils/timeUtils';
import { MyPtsModel } from '../models/my-pts.model';
import { TransactionType } from '../interfaces/my-pts.interface';
import { NotificationService } from '../services/notification.service';
import participantService from './participant.service';

class EventService {
    private notificationService: NotificationService;

    constructor() {
        this.notificationService = new NotificationService();
    }

    /**
     * Calculate reminder trigger time based on reminder type and event start time
     */
    private calculateReminderTime(startTime: Date, reminderType: string, amount?: number, unit?: string): Date {
        const reminderTime = new Date(startTime);
        
        switch (reminderType) {
            case 'AtEventTime':
                return reminderTime;
            case 'Minutes15':
                reminderTime.setMinutes(reminderTime.getMinutes() - 15);
                break;
            case 'Minutes30':
                reminderTime.setMinutes(reminderTime.getMinutes() - 30);
                break;
            case 'Hours1':
                reminderTime.setHours(reminderTime.getHours() - 1);
                break;
            case 'Hours2':
                reminderTime.setHours(reminderTime.getHours() - 2);
                break;
            case 'Days1':
                reminderTime.setDate(reminderTime.getDate() - 1);
                break;
            case 'Days2':
                reminderTime.setDate(reminderTime.getDate() - 2);
                break;
            case 'Weeks1':
                reminderTime.setDate(reminderTime.getDate() - 7);
                break;
            case 'Custom':
                if (!amount || !unit) {
                    throw new Error('Custom reminder requires amount and unit');
                }
                switch (unit) {
                    case 'Minutes':
                        reminderTime.setMinutes(reminderTime.getMinutes() - amount);
                        break;
                    case 'Hours':
                        reminderTime.setHours(reminderTime.getHours() - amount);
                        break;
                    case 'Days':
                        reminderTime.setDate(reminderTime.getDate() - amount);
                        break;
                    case 'Weeks':
                        reminderTime.setDate(reminderTime.getDate() - (amount * 7));
                        break;
                    default:
                        throw new Error(`Invalid reminder unit: ${unit}`);
                }
                break;
            default:
                return reminderTime;
        }
        
        return reminderTime;
    }

    /**
     * Create a new event with all fields
     */
    async createEvent(eventData: Partial<IEvent>): Promise<IEvent> {
        // Validate meeting-specific requirements
        if (eventData.eventType === EventType.Appointment && !eventData.serviceProvider) {
            throw new Error('Service provider is required for appointments');
        }

        // Check for time overlap if the event has a time range
        if (eventData.startTime && eventData.endTime) {
            const overlapCheck = await checkTimeOverlap(
                eventData.createdBy?.toString() || '',
                eventData.profile?.toString() || '',
                {
                    startTime: eventData.startTime,
                    endTime: eventData.endTime,
                    isAllDay: eventData.isAllDay || false
                }
            );

            if (overlapCheck.overlaps) {
                throw new Error(`Time conflict with existing items: ${overlapCheck.conflictingItems.map(item => `${item.type}: ${item.title}`).join(', ')}`);
            }
        }

        // Process reminders to calculate trigger times
        if (eventData.reminders && Array.isArray(eventData.reminders)) {
            eventData.reminders = eventData.reminders.map(reminder => ({
                ...reminder,
                triggered: false,
                triggerTime: this.calculateReminderTime(
                    eventData.startTime!, 
                    reminder.type,
                    reminder.amount,
                    reminder.unit
                ),
                minutesBefore: reminder.type === 'Minutes15' ? 15 : 
                             reminder.type === 'Minutes30' ? 30 : 
                             reminder.type === 'Hours1' ? 60 :
                             reminder.type === 'Hours2' ? 120 :
                             reminder.type === 'Custom' ? reminder.amount :
                             undefined
            }));
        }

        const event = new Event({
            ...eventData,
            createdBy: eventData.createdBy || null,
            profile: eventData.profile || null,
            eventType: eventData.eventType || 'meeting',
            isAllDay: eventData.isAllDay || false,
            repeat: eventData.repeat || {
                isRepeating: false,
                frequency: 'None',
                endCondition: 'Never'
            },
            reminders: eventData.reminders || [],
            visibility: eventData.visibility || 'Public',
            participants: eventData.participants || [],
            color: eventData.color || '#1DA1F2',
            category: eventData.category || 'Personal',
            priority: eventData.priority || 'Low',
            status: eventData.status || 'upcoming',
            attachments: eventData.attachments || [],
            comments: eventData.comments || [],
            agendaItems: eventData.agendaItems || [],
            isGroupEvent: eventData.isGroupEvent || false
        });

        // Handle all-day event adjustments
        if (event.isAllDay) {
            this.adjustAllDayEvent(event);
        }

        await event.save();
        return event;
    }

    private adjustAllDayEvent(event: IEvent): void {
        if (!event.startTime) event.startTime = new Date();

        // Set start to midnight
        const start = new Date(event.startTime);
        start.setHours(0, 0, 0, 0);
        event.startTime = start;

        // Set end to 23:59:59
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        event.endTime = end;

        // Set duration to 24 hours
        event.duration = { hours: 24, minutes: 0 };
    }

    /**
     * Get event by ID with populated fields
     */
    async getEventById(eventId: string): Promise<IEvent | null> {
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            throw new Error('Invalid event ID');
        }

        const event = await Event.findById(new Types.ObjectId(eventId))
            .populate('createdBy', 'fullName email')
            .populate('profile', 'profileInformation.username profileType')
            .populate('participants', 'profileInformation.username profileType')
            .populate('serviceProvider.profileId', 'profileInformation.username profileType')
            .populate('agendaItems.assignedTo', 'profileInformation.username profileType')
            .populate('attachments.uploadedBy', 'profileInformation.username profileType')
            .populate({
                path: 'comments',
                populate: [
                    { path: 'postedBy', select: 'profileInformation.username profileType' },
                    { path: 'reactions', select: 'profileInformation.username profileType' }
                ]
            })
            .lean()
            .exec();

        if (!event) return null;

        // Convert reactions from plain object to Map
        const eventWithMaps = {
            ...event,
            comments: event.comments.map(comment => ({
                ...comment,
                reactions: new Map(Object.entries(comment.reactions))
            }))
        };

        return {
            ...eventWithMaps,
            likesCount: event.likes?.length || 0,
            commentsCount: event.comments?.length || 0
        } as IEvent;
    }

    /**
     * Get all events for a user with filters
     */
    async getUserEvents(
        userId: string,
        filters: {
            status?: string;
            priority?: PriorityLevel;
            category?: string;
            eventType?: string;
            search?: string;
            isAllDay?: boolean;
            fromDate?: Date;
            toDate?: Date;
            isGroupEvent?: boolean;
        } = {}
    ): Promise<IEvent[]> {
        const query: any = { createdBy: userId };

        // Apply filters
        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) query.category = filters.category;
        if (filters.eventType) query.eventType = filters.eventType;
        if (filters.isAllDay !== undefined) query.isAllDay = filters.isAllDay;
        if (filters.isGroupEvent !== undefined) query.isGroupEvent = filters.isGroupEvent;

        // Date range filtering
        if (filters.fromDate || filters.toDate) {
            query.$and = [];
            if (filters.fromDate) {
                query.$and.push({
                    $or: [
                        { startTime: { $gte: filters.fromDate } },
                        { endTime: { $gte: filters.fromDate } },
                        { 'repeat.nextRun': { $gte: filters.fromDate } }
                    ]
                });
            }
            if (filters.toDate) {
                query.$and.push({
                    $or: [
                        { startTime: { $lte: filters.toDate } },
                        { endTime: { $lte: filters.toDate } },
                        { 'repeat.nextRun': { $lte: filters.toDate } }
                    ]
                });
            }
        }

        // Search across multiple fields
        if (filters.search) {
            const searchRegex = new RegExp(filters.search, 'i');
            query.$or = [
                { title: searchRegex },
                { description: searchRegex },
                { notes: searchRegex },
                { 'agendaItems.description': searchRegex }
            ];
        }

        return Event.find(query)
            .sort({
                startTime: 1,
                priority: -1,
                createdAt: -1
            })
            .populate('createdBy', 'name email')
            .populate('participants', 'name email')
            .populate('serviceProvider.profileId', 'name avatar');
    }

    /**
     * Update an event
     */
    async updateEvent(
        eventId: string,
        userId: string,
        updateData: Partial<IEvent>
    ): Promise<IEvent> {
        // Validate meeting-specific requirements
        if (updateData.eventType === EventType.Appointment && !updateData.serviceProvider) {
            throw new Error('Service provider is required for appointments');
        }

        // Handle all-day event adjustments
        if (updateData.isAllDay) {
            this.adjustAllDayEvent(updateData as IEvent);
        }

        const event = await Event.findOneAndUpdate(
            { _id: eventId, createdBy: userId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!event) {
            throw new Error('Event not found or access denied');
        }

        return event;
    }

    /**
     * Delete an event
     */
    async deleteEvent(eventId: string, userId: string): Promise<boolean> {
        const result = await Event.deleteOne({ _id: eventId, createdBy: userId });
        if (result.deletedCount === 0) {
            throw new Error('Event not found or access denied');
        }
        return true;
    }

    /**
     * Add an agenda item to an event
     */
    async addAgendaItem(
        eventId: string,
        userId: string,
        agendaItemData: {
            description: string;
            assignedTo?: mongoose.Types.ObjectId;
            completed?: boolean;
        }
    ): Promise<IEvent> {
        const agendaItem = {
            description: agendaItemData.description,
            assignedTo: agendaItemData.assignedTo || undefined,
            completed: agendaItemData.completed || false
        };

        const event = await Event.findOneAndUpdate(
            { _id: eventId, createdBy: userId },
            { $push: { agendaItems: agendaItem } },
            { new: true }
        );

        if (!event) {
            throw new Error('Event not found or access denied');
        }

        return event;
    }

    /**
     * Update an agenda item
     */
    async updateAgendaItem(
        eventId: string,
        userId: string,
        agendaItemIndex: number,
        updateData: {
            description?: string;
            assignedTo?: mongoose.Types.ObjectId;
            completed?: boolean;
        }
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        if (agendaItemIndex < 0 || agendaItemIndex >= (event.agendaItems?.length ?? 0)) {
            throw new Error('Invalid agenda item index');
        }

        // Update agenda item
        if (!event.agendaItems) {
            throw new Error('Agenda items are undefined');
        }
        const agendaItem = event.agendaItems[agendaItemIndex];
        if (updateData.description !== undefined) {
            agendaItem.description = updateData.description;
        }
        if (updateData.assignedTo !== undefined) {
            agendaItem.assignedTo = updateData.assignedTo;
        }
        if (updateData.completed !== undefined) {
            agendaItem.completed = updateData.completed;
        }

        await event.save();
        return event;
    }

    /**
     * Delete an agenda item
     */
    async deleteAgendaItem(
        eventId: string,
        userId: string,
        agendaItemIndex: number
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        if (agendaItemIndex < 0 || agendaItemIndex >= (event.agendaItems?.length ?? 0)) {
            throw new Error('Invalid agenda item index');
        }

        if (event.agendaItems) {
            event.agendaItems.splice(agendaItemIndex, 1);
        } else {
            throw new Error('Agenda items are undefined');
        }
        await event.save();
        return event;
    }

    /**
     * Add an attachment to an event
     */
    async addAttachment(
        eventId: string,
        userId: string,
        attachmentData: Omit<Attachment, 'uploadedAt' | 'uploadedBy'>
    ): Promise<IEvent> {
        const attachment: Attachment = {
            ...attachmentData,
            uploadedAt: new Date(),
            uploadedBy: new mongoose.Types.ObjectId(userId)
        };

        const event = await Event.findOneAndUpdate(
            { _id: eventId, createdBy: userId },
            { $push: { attachments: attachment } },
            { new: true }
        );

        if (!event) {
            throw new Error('Event not found or access denied');
        }

        return event;
    }

    /**
     * Remove an attachment from an event
     */
    async removeAttachment(
        eventId: string,
        userId: string,
        attachmentIndex: number
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        if (attachmentIndex < 0 || attachmentIndex >= event.attachments.length) {
            throw new Error('Invalid attachment index');
        }

        event.attachments.splice(attachmentIndex, 1);
        await event.save();
        return event;
    }

    /**
     * Set service provider for an event
     */
    async setServiceProvider(
        eventId: string,
        userId: string,
        serviceProviderData: {
            profileId: mongoose.Types.ObjectId;
            role: string;
        }
    ): Promise<IEvent> {
        const event = await Event.findOneAndUpdate(
            { _id: eventId, createdBy: userId },
            { serviceProvider: serviceProviderData },
            { new: true }
        );

        if (!event) {
            throw new Error('Event not found or access denied');
        }

        return event;
    }

    /**
     * Add a comment to an event
     */
    async addComment(
        eventId: string,
        userId: string,
        profileId: string,
        commentData: {
            text: string;
            parentCommentId?: mongoose.Types.ObjectId;
            createdBy?: mongoose.Types.ObjectId;
        }
    ): Promise<IEvent> {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        const comment = {
            text: commentData.text,
            postedBy: new mongoose.Types.ObjectId(profileId),
            parentComment: commentData.parentCommentId,
            depth: 0,
            threadId: new mongoose.Types.ObjectId(),
            isThreadRoot: !commentData.parentCommentId,
            replies: [],
            reactions: new Map(),
            createdAt: new Date(),
            updatedAt: new Date(),
            likes: []
        } as Comment;

        if (commentData.parentCommentId) {
            // Find parent comment
            const parentComment = event.comments.find(c => c._id?.equals(commentData.parentCommentId));
            if (!parentComment) {
                throw new Error('Parent comment not found');
            }

            // Set thread properties
            comment.parentComment = commentData.parentCommentId;
            comment.depth = parentComment.depth + 1;
            comment.threadId = parentComment.threadId || parentComment._id;
            comment.isThreadRoot = false;

            // Add to parent's replies
            parentComment.replies.push(comment._id!);
        }

        event.comments.push(comment);
        await event.save();

        return event;
    }

    /**
     * Get thread for a comment
     */
    async getThread(
        eventId: string,
        threadId: mongoose.Types.ObjectId
    ): Promise<any> {
        const event = await Event.findById(eventId)
            .populate('comments.postedBy', 'profileInformation.username profileType')
            .populate('comments.reactions', 'profileInformation.username profileType')
            .lean();

        if (!event) {
            throw new Error('Event not found');
        }

        // Get all comments in the thread
        const threadComments = event.comments.filter(c => 
            c.threadId?.equals(threadId)
        ).sort((a, b) => a.depth - b.depth);

        return {
            rootComment: threadComments.find(c => c.isThreadRoot),
            replies: threadComments.filter(c => !c.isThreadRoot)
        };
    }

    /**
     * Get all threads for an event
     */
    async getEventThreads(eventId: string): Promise<any[]> {
        const event = await Event.findById(eventId)
            .populate('comments.postedBy', 'profileInformation.username profileType')
            .populate('comments.reactions', 'profileInformation.username profileType')
            .lean();

        if (!event) {
            throw new Error('Event not found');
        }

        // Get all root comments
        const rootComments = event.comments.filter(c => c.isThreadRoot);
        
        // For each root comment, get its thread
        const threads = await Promise.all(
            rootComments.map(async (root) => {
                const thread = await this.getThread(eventId, root.threadId!);
                return {
                    ...thread,
                    replyCount: thread.replies.length
                };
            })
        );

        return threads;
    }

    /**
     * Update a comment on an event
     */
    async updateComment(
        eventId: string,
        userId: string,
        profileId: string,
        commentId: mongoose.Types.ObjectId,
        updateData: {
            text?: string;
            updatedAt?: Date;
        }
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new Error('Event not found');
        }

        const comment = event.comments.find(c => c._id?.equals(commentId));
        if (!comment) {
            throw new Error('Comment not found');
        }

        // Verify user has permission to update
        if (!(comment.postedBy as Types.ObjectId).equals(new Types.ObjectId(profileId))) {
            throw new Error('Not authorized to update this comment');
        }

        if (updateData.text !== undefined) {
            comment.text = updateData.text;
        }
        comment.updatedAt = updateData.updatedAt || new Date();

        await event.save();
        return event;
    }

    /**
     * Delete a comment from an event
     */
    async deleteComment(
        eventId: string,
        userId: string,
        profileId: string,
        commentId: mongoose.Types.ObjectId
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new Error('Event not found');
        }

        const comment = event.comments.find(c => c._id?.equals(commentId));
        if (!comment) {
            throw new Error('Comment not found');
        }

        // Verify user has permission to delete
        if (!(comment.postedBy as Types.ObjectId).equals(new Types.ObjectId(profileId))) {
            throw new Error('Not authorized to delete this comment');
        }

        // If it's a root comment, delete all replies
        if (comment.isThreadRoot) {
            event.comments = event.comments.filter(c => 
                !c.threadId?.equals(comment.threadId)
            );
        } else {
            // Remove from parent's replies
            const parentComment = event.comments.find(c => 
                c._id?.equals(comment.parentComment)
            );
            if (parentComment) {
                parentComment.replies = parentComment.replies.filter(
                    replyId => !replyId.equals(commentId)
                );
            }
            // Remove the comment
            event.comments = event.comments.filter(c => 
                !c._id?.equals(commentId)
            );
        }

        await event.save();
        return event;
    }

    /**
     * Like an event
     */
    async likeEvent(eventId: string, userId: string, profileId: string): Promise<IEvent> {
        const event = await Event.findOneAndUpdate(
            { _id: eventId },
            { $addToSet: { likes: new mongoose.Types.ObjectId(userId) } },
            { new: true }
        );

        if (!event) {
            throw new Error('Event not found');
        }

        return event;
    }

    /**
     * Like a comment on an event
     */
    async likeComment(
        eventId: string,
        userId: string,
        commentId: mongoose.Types.ObjectId
    ): Promise<IEvent> {
        const event = await Event.findOneAndUpdate(
            { _id: eventId, 'comments._id': commentId },
            { $addToSet: { 'comments.$.likes': new mongoose.Types.ObjectId(userId) } },
            { new: true }
        );

        if (!event) {
            throw new Error('Event or comment not found');
        }

        return event;
    }

    /**
     * Update booking status
     */
    async updateBookingStatus(
        eventId: string,
        userId: string,
        profileId: string,
        status: BookingStatus,
        cancellationReason?: string
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.eventType !== EventType.Booking || !event.booking) {
            throw new Error('Event is not a booking');
        }

        // Only allow status updates by the service provider or the booking creator's profile
        if (!event.booking.serviceProvider.profileId.equals(new mongoose.Types.ObjectId(profileId)) && 
            !event.profile?.equals(new mongoose.Types.ObjectId(profileId))) {
            throw new Error('Not authorized to update booking status');
        }

        event.booking.status = status;
        if (status === BookingStatus.Cancelled && cancellationReason) {
            event.booking.cancellationReason = cancellationReason;
        }

        await event.save();
        return event;
    }

    /**
     * Update booking reward status
     */
    async updateBookingReward(
        eventId: string,
        userId: string,
        profileId: string,
        rewardData: {
            status: 'pending' | 'completed' | 'failed';
            transactionId?: string;
        }
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.eventType !== EventType.Booking || !event.booking) {
            throw new Error('Event is not a booking');
        }

        // Only allow reward updates by the service provider or the booking creator's profile
        if (!event.booking.serviceProvider.profileId.equals(new mongoose.Types.ObjectId(profileId)) && 
            !event.profile?.equals(new mongoose.Types.ObjectId(profileId))) {
            throw new Error('Not authorized to update reward status');
        }

        if (!event.booking.reward) {
            event.booking.reward = {
                type: 'Reward',
                points: 0,
                currency: 'MyPts',
                description: `Booking reward for ${event.title}`,
                required: false,
                status: 'pending',
                transactionId: undefined
            };
        }

        // Update reward status
        if (rewardData.status === 'completed') {
            const myPts = await MyPtsModel.findOrCreate(new mongoose.Types.ObjectId(userId));
            await myPts.deductMyPts(
                event.booking.reward.points,
                TransactionType.PURCHASE_PRODUCT,
                `Payment for booking: ${event.title}`,
                { eventId: event._id },
                rewardData.transactionId
            );
        }

        await event.save();
        return event;
    }

    /**
     * Reschedule a booking
     */
    async rescheduleBooking(
        eventId: string,
        userId: string,
        profileId: string,
        newStartTime: Date,
        newEndTime: Date
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.eventType !== EventType.Booking || !event.booking) {
            throw new Error('Event is not a booking');
        }

        // Only allow rescheduling by the service provider or the booking creator's profile
        if (!event.booking.serviceProvider.profileId.equals(new mongoose.Types.ObjectId(profileId)) && 
            !event.profile?.equals(new mongoose.Types.ObjectId(profileId))) {
            throw new Error('Not authorized to reschedule booking');
        }

        // Check if booking can be rescheduled
        if (!(event as any).canReschedule()) {
            throw new Error('Maximum reschedule limit reached');
        }

        // Check for time overlap using profile IDs
        const overlapCheck = await checkTimeOverlap(
            event.profile?.toString() || '',
            event.booking.serviceProvider.profileId.toString(),
            {
                startTime: newStartTime,
                endTime: newEndTime,
                isAllDay: event.isAllDay
            }
        );

        if (overlapCheck.overlaps) {
            throw new Error(`Time conflict with existing items: ${overlapCheck.conflictingItems.map(item => `${item.type}: ${item.title}`).join(', ')}`);
        }

        // Update times and increment reschedule count
        event.startTime = newStartTime;
        event.endTime = newEndTime;
        event.booking.rescheduleCount += 1;

        await event.save();
        return event;
    }

    /**
     * Get bookings for a service provider
     */
    async getProviderBookings(
        profileId: mongoose.Types.ObjectId,
        filters: {
            status?: BookingStatus;
            fromDate?: Date;
            toDate?: Date;
        } = {}
    ): Promise<IEvent[]> {
        const query: any = {
            eventType: EventType.Booking,
            'booking.serviceProvider.profileId': profileId
        };

        if (filters.status) {
            query['booking.status'] = filters.status;
        }

        if (filters.fromDate || filters.toDate) {
            query.$and = [];
            if (filters.fromDate) {
                query.$and.push({ startTime: { $gte: filters.fromDate } });
            }
            if (filters.toDate) {
                query.$and.push({ endTime: { $lte: filters.toDate } });
            }
        }

        return Event.find(query)
            .sort({ startTime: 1 })
            .populate('createdBy', 'name email')
            .populate('profile', 'profileInformation.username profileType')
            .populate('booking.serviceProvider.profileId', 'profileInformation.username profileType');
    }

    /**
     * Create a booking event
     */
    async createBooking(
        eventData: Partial<IEvent>,
        userId: string,
        profileId: string
    ): Promise<IEvent> {
        // Validate booking-specific requirements
        if (!eventData.booking?.serviceProvider?.profileId) {
            throw new Error('Service provider profile ID is required for bookings');
        }

        // If service name is provided, validate service duration
        if (eventData.booking?.service?.name && !eventData.booking?.service?.duration) {
            throw new Error('Service duration is required when service name is provided');
        }

        // Check for time overlap
        if (eventData.startTime && eventData.endTime) {
            const overlap = await checkTimeOverlap(
                eventData.createdBy?.toString() || '',
                eventData.profile?.toString() || '',
                {
                    startTime: eventData.startTime,
                    endTime: eventData.endTime,
                    isAllDay: eventData.isAllDay || false
                }
            );
            if (overlap) {
                throw new Error('Time slot overlaps with existing booking');
            }
        }

        // Set initial booking status
        if (eventData.booking) {
            eventData.booking.status = BookingStatus.Pending;
            // Initialize reward if it exists
            if (eventData.booking.reward) {
                eventData.booking.reward = {
                    type: 'Reward',
                    points: eventData.booking.reward.points,
                    currency: 'MyPts',
                    description: eventData.booking.reward.description,
                    required: eventData.booking.reward.required || false,
                    status: 'pending',
                    transactionId: undefined
                };
            }
        }

        const event = new Event({
            ...eventData,
            eventType: EventType.Booking,
            createdBy: new mongoose.Types.ObjectId(userId),
            profile: new mongoose.Types.ObjectId(profileId)
        });

        return event.save();
    }

    /**
     * Create a celebration event
     */
    async createCelebration(
        eventData: Partial<IEvent>,
        userId: string,
        profileId: string
    ): Promise<IEvent> {
        // Validate celebration-specific requirements
        if (!eventData.title) {
            throw new Error('Title is required for celebrations');
        }

        // Set default celebration properties
        const celebrationData = {
            ...eventData,
            eventType: EventType.Celebration,
            createdBy: new mongoose.Types.ObjectId(userId),
            profile: new mongoose.Types.ObjectId(profileId),
            status: EventStatus.Upcoming,
            isGroupEvent: eventData.isGroupEvent || true,
            category: eventData.category || 'birthday'
        };

        const event = new Event(celebrationData);
        return event.save();
    }

    /**
     * Add a gift to a celebration
     */
    async addGift(
        eventId: string,
        giftData: {
            description: string;
            requestedBy?: string;
            link?: string;
        }
    ): Promise<IEvent> {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.eventType !== EventType.Celebration) {
            throw new Error('Event is not a celebration');
        }

        if (!event.celebration) {
            event.celebration = {
                gifts: [],
                category: 'birthday',
                status: 'planning',
                socialMediaPosts: []
            };
        }

        event.celebration.gifts.push({
            description: giftData.description,
            requestedBy: giftData.requestedBy ? new mongoose.Types.ObjectId(giftData.requestedBy) : undefined,
            received: false,
            link: giftData.link
        });

        await event.save();
        return event;
    }

    /**
     * Mark a gift as received in a celebration
     */
    async markGiftReceived(
        eventId: string,
        giftIndex: number
    ): Promise<IEvent> {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.eventType !== EventType.Celebration || !event.celebration) {
            throw new Error('Event is not a celebration');
        }

        if (!event.celebration.gifts[giftIndex]) {
            throw new Error('Gift not found');
        }

        event.celebration.gifts[giftIndex].received = true;
        await event.save();
        return event;
    }

    /**
     * Add a social media post to a celebration
     */
    async addSocialMediaPost(
        eventId: string,
        postData: {
            platform: string;
            postId: string;
            url: string;
        }
    ): Promise<IEvent> {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.eventType !== EventType.Celebration) {
            throw new Error('Event is not a celebration');
        }

        if (!event.celebration) {
            event.celebration = {
                gifts: [],
                category: 'birthday',
                status: 'planning',
                socialMediaPosts: []
            };
        }

        event.celebration.socialMediaPosts.push({
            platform: postData.platform,
            postId: postData.postId,
            url: postData.url
        });

        await event.save();
        return event;
    }

    /**
     * Update celebration status
     */
    async updateCelebrationStatus(
        eventId: string,
        status: 'planning' | 'upcoming' | 'completed' | 'cancelled'
    ): Promise<IEvent> {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.eventType !== EventType.Celebration || !event.celebration) {
            throw new Error('Event is not a celebration');
        }

        event.celebration.status = status;
        await event.save();
        return event;
    }

    /**
     * Update event status
     */
    async updateEventStatus(
        eventId: string,
        userId: string,
        status: EventStatus,
        metadata?: {
            reason?: string;
            updatedBy?: string;
            notes?: string;
        }
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        // Validate status transition
        this.validateStatusTransition(event.status, status);

        // Update status and metadata
        event.status = status;
        if (metadata) {
            event.statusHistory = event.statusHistory || [];
            event.statusHistory.push({
                status,
                changedAt: new Date(),
                reason: metadata.reason,
                updatedBy: metadata.updatedBy ? new mongoose.Types.ObjectId(metadata.updatedBy) : undefined,
                notes: metadata.notes
            });
        }

        // Handle status-specific actions
        await this.handleStatusChange(event, status);

        await event.save();
        return event;
    }

    /**
     * Validate status transition
     */
    private validateStatusTransition(currentStatus: EventStatus, newStatus: EventStatus): void {
        const validTransitions: Record<EventStatus, EventStatus[]> = {
            [EventStatus.Draft]: [EventStatus.Upcoming, EventStatus.Cancelled],
            [EventStatus.Upcoming]: [EventStatus.InProgress, EventStatus.Cancelled, EventStatus.Postponed],
            [EventStatus.InProgress]: [EventStatus.Completed, EventStatus.Cancelled],
            [EventStatus.Completed]: [EventStatus.Archived],
            [EventStatus.Cancelled]: [EventStatus.Archived],
            [EventStatus.Postponed]: [EventStatus.Upcoming, EventStatus.Cancelled],
            [EventStatus.Archived]: []
        };

        if (!validTransitions[currentStatus].includes(newStatus)) {
            throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
        }
    }

    /**
     * Handle status-specific actions
     */
    private async handleStatusChange(event: IEvent, newStatus: EventStatus): Promise<void> {
        switch (newStatus) {
            case EventStatus.InProgress:
                // Notify participants that event has started
                await this.notifyParticipants(event, 'Event has started');
                break;
            case EventStatus.Completed:
                // Handle completion tasks
                await this.handleEventCompletion(event);
                break;
            case EventStatus.Cancelled:
                // Handle cancellation tasks
                await this.handleEventCancellation(event);
                break;
            case EventStatus.Postponed:
                // Handle postponement tasks
                await this.handleEventPostponement(event);
                break;
        }
    }

    /**
     * Handle event completion
     */
    private async handleEventCompletion(event: IEvent): Promise<void> {
        // Mark all agenda items as completed
        if (event.agendaItems) {
            event.agendaItems.forEach(item => item.completed = true);
        }

        // Notify participants
        await this.notifyParticipants(event, 'Event has been completed');

        // Handle booking completion if applicable
        if (event.eventType === EventType.Booking && event.booking) {
            await this.handleBookingCompletion(event);
        }
    }

    /**
     * Handle event cancellation
     */
    private async handleEventCancellation(event: IEvent): Promise<void> {
        // Notify participants
        await this.notifyParticipants(event, 'Event has been cancelled');

        // Handle booking cancellation if applicable
        if (event.eventType === EventType.Booking && event.booking) {
            await this.handleBookingCancellation(event);
        }
    }

    /**
     * Handle event postponement
     */
    private async handleEventPostponement(event: IEvent): Promise<void> {
        // Notify participants
        await this.notifyParticipants(event, 'Event has been postponed');
    }

    /**
     * Handle booking completion
     */
    private async handleBookingCompletion(event: IEvent): Promise<void> {
        if (!event.booking) return;

        // Update booking status
        event.booking.status = BookingStatus.Completed;

        // Process reward if applicable
        if (event.booking.reward && event.booking.reward.status === 'pending') {
            // Handle reward completion logic
            event.booking.reward.status = 'completed';
        }
    }

    /**
     * Handle booking cancellation
     */
    private async handleBookingCancellation(event: IEvent): Promise<void> {
        if (!event.booking) return;

        // Update booking status
        event.booking.status = BookingStatus.Cancelled;

        // Handle reward cancellation if applicable
        if (event.booking.reward && event.booking.reward.status === 'pending') {
            event.booking.reward.status = 'failed';
        }
    }

    /**
     * Notify event participants
     */
    private async notifyParticipants(event: IEvent, message: string): Promise<void> {
        const participants = await participantService.getEventParticipants((event._id as Types.ObjectId).toString());
        await this.notificationService.createNotification({
            recipient: event.createdBy,
            type: 'event_update',
            title: 'Event Update',
            message,
            relatedTo: {
                model: 'Event',
                id: event._id
            },
            priority: 'medium',
            isRead: false,
            isArchived: false
        });
    }

    /**
     * Update status for multiple events
     */
    async bulkUpdateEventStatus(
        eventIds: string[],
        userId: string,
        status: EventStatus,
        metadata?: {
            reason?: string;
            updatedBy?: string;
            notes?: string;
        }
    ): Promise<{ success: string[]; failed: { id: string; error: string }[] }> {
        const results = {
            success: [] as string[],
            failed: [] as { id: string; error: string }[]
        };

        // Process events in parallel
        await Promise.all(
            eventIds.map(async (eventId) => {
                try {
                    const event = await Event.findOne({ _id: eventId, createdBy: userId });
                    if (!event) {
                        throw new Error('Event not found or access denied');
                    }

                    // Validate status transition
                    this.validateStatusTransition(event.status, status);

                    // Update status and metadata
                    event.status = status;
                    if (metadata) {
                        event.statusHistory = event.statusHistory || [];
                        event.statusHistory.push({
                            status,
                            changedAt: new Date(),
                            reason: metadata.reason,
                            updatedBy: metadata.updatedBy ? new mongoose.Types.ObjectId(metadata.updatedBy) : undefined,
                            notes: metadata.notes
                        });
                    }

                    // Handle status-specific actions
                    await this.handleStatusChange(event, status);

                    await event.save();
                    results.success.push(eventId);
                } catch (error) {
                    results.failed.push({
                        id: eventId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            })
        );

        return results;
    }

    /**
     * Calculate next run date for repeating events
     */
    private calculateNextRun(event: Partial<IEvent>): Date {
        if (!event.repeat?.isRepeating || !event.repeat?.frequency) {
            return event.startTime!;
        }

        const lastRun = event.repeat.nextRun || event.startTime!;
        const frequency = event.repeat.frequency;
        const interval = event.repeat.interval || 1;

        let nextRun = new Date(lastRun);

        switch (frequency) {
            case RepeatFrequency.Daily:
                nextRun.setDate(nextRun.getDate() + interval);
                break;
            case RepeatFrequency.Weekly:
                nextRun.setDate(nextRun.getDate() + (7 * interval));
                break;
            case RepeatFrequency.Monthly:
                nextRun.setMonth(nextRun.getMonth() + interval);
                break;
            case RepeatFrequency.Yearly:
                nextRun.setFullYear(nextRun.getFullYear() + interval);
                break;
            case RepeatFrequency.Custom:
                if (event.repeat.customPattern) {
                    nextRun = this.calculateCustomPatternNextRun(lastRun, event.repeat.customPattern);
                }
                break;
            default:
                break;
        }

        return nextRun;
    }

    /**
     * Calculate next run for custom repeat patterns
     */
    private calculateCustomPatternNextRun(lastRun: Date, pattern: {
        daysOfWeek?: number[];
        daysOfMonth?: number[];
        monthsOfYear?: number[];
        interval?: number;
    }): Date {
        const nextRun = new Date(lastRun);
        const interval = pattern.interval || 1;

        if (pattern.daysOfWeek) {
            // Find next occurrence of specified days
            let daysToAdd = 1;
            while (daysToAdd <= 7) {
                nextRun.setDate(nextRun.getDate() + 1);
                if (pattern.daysOfWeek.includes(nextRun.getDay())) {
                    break;
                }
                daysToAdd++;
            }
        } else if (pattern.daysOfMonth) {
            // Find next occurrence of specified days in month
            const currentDay = nextRun.getDate();
            const nextDay = pattern.daysOfMonth.find(day => day > currentDay);
            if (nextDay) {
                nextRun.setDate(nextDay);
            } else {
                nextRun.setMonth(nextRun.getMonth() + interval);
                nextRun.setDate(pattern.daysOfMonth[0]);
            }
        } else if (pattern.monthsOfYear) {
            // Find next occurrence of specified months
            const currentMonth = nextRun.getMonth();
            const nextMonth = pattern.monthsOfYear.find(month => month > currentMonth);
            if (nextMonth) {
                nextRun.setMonth(nextMonth);
            } else {
                nextRun.setFullYear(nextRun.getFullYear() + interval);
                nextRun.setMonth(pattern.monthsOfYear[0]);
            }
        }

        return nextRun;
    }

    /**
     * Check if repeating event should end based on conditions
     */
    private shouldEndRepeating(event: IEvent, nextRun: Date): boolean {
        if (!event.repeat?.endCondition) {
            return false;
        }

        switch (event.repeat.endCondition) {
            case EndCondition.Never:
                return false;
            case EndCondition.AfterOccurrences:
                return event.repeat.occurrences ? event.repeat.occurrences <= 0 : false;
            case EndCondition.UntilDate:
                return event.repeat.endDate ? nextRun > event.repeat.endDate : false;
            default:
                return false;
        }
    }

    /**
     * Update repeat settings for an event
     */
    async updateRepeatSettings(
        eventId: string,
        userId: string,
        repeatSettings: {
            isRepeating: boolean;
            frequency?: RepeatFrequency;
            interval?: number;
            endCondition?: EndCondition;
            endDate?: Date;
            occurrences?: number;
            customPattern?: {
                daysOfWeek?: number[];
                daysOfMonth?: number[];
                monthsOfYear?: number[];
                interval?: number;
            };
        }
    ): Promise<IEvent> {
        const event = await Event.findOne({ 
            _id: new Types.ObjectId(eventId), 
            createdBy: new Types.ObjectId(userId) 
        });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        // Update repeat settings
        event.repeat = {
            ...event.repeat,
            ...repeatSettings,
            frequency: repeatSettings.frequency || event.repeat.frequency,
            endCondition: repeatSettings.endCondition || event.repeat.endCondition
        };

        if (repeatSettings.isRepeating) {
            event.repeat.nextRun = this.calculateNextRun({ ...event.toObject(), startTime: event.repeat.nextRun });
        } else {
            event.repeat.nextRun = undefined;
        }

        await event.save();
        return event.toObject() as IEvent;
    }

    /**
     * Generate series of events based on repeat settings
     */
    async generateEventSeries(
        eventId: string,
        userId: string,
        count: number = 10
    ): Promise<IEvent[]> {
        const event = await Event.findOne({ 
            _id: new Types.ObjectId(eventId), 
            createdBy: new Types.ObjectId(userId) 
        });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        if (!event.repeat?.isRepeating) {
            throw new Error('Event is not repeating');
        }

        const series: IEvent[] = [];
        let currentEvent = { ...event.toObject() };
        let nextRun = event.repeat.nextRun || event.startTime;

        for (let i = 0; i < count; i++) {
            if (this.shouldEndRepeating(event, nextRun)) {
                break;
            }

            const seriesEvent = new Event({
                ...currentEvent,
                _id: undefined,
                startTime: nextRun,
                endTime: new Date(nextRun.getTime() + (event.endTime.getTime() - event.startTime.getTime())),
                repeat: {
                    ...event.repeat,
                    nextRun: this.calculateNextRun({ ...event.toObject(), startTime: nextRun })
                },
                isSeriesInstance: true
            });

            await seriesEvent.save();
            series.push(seriesEvent.toObject() as IEvent);

            nextRun = this.calculateNextRun({ ...event.toObject(), startTime: nextRun });
        }

        return series;
    }
}

export default new EventService();