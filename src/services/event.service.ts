import mongoose from 'mongoose';
import {
    RepeatSettings,
    Reminder,
    Reward,
    Attachment,
    Location,
    PriorityLevel,
    VisibilityType,
    EventType,
    BookingStatus
} from '../models/plans-shared';

import { IEvent, Event } from '../models/Event';
import { User } from '../models/User';
import { checkTimeOverlap } from '../utils/timeUtils';
import { MyPtsModel } from '../models/my-pts.model';
import { TransactionType } from '../interfaces/my-pts.interface';

class EventService {
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

        return Event.findById(eventId)
            .populate('createdBy', 'fullName email')
            .populate('profile', 'profileInformation.username profileType')
            .populate('participants', 'profileInformation.username profileType')
            .populate('serviceProvider.profileId', 'profileInformation.username profileType')
            .populate('agendaItems.assignedTo', 'profileInformation.username profileType')
            .populate('attachments.uploadedBy', 'profileInformation.username profileType')
            .populate({
                path: 'comments',
                populate: [
                    { path: 'profile', select: 'profileInformation.username profileType' },
                    { path: 'likes', select: 'profileInformation.username profileType' }
                ]
            })
            .lean()
            .exec()
            .then(event => {
                if (!event) return null;
                return {
                    ...event,
                    likesCount: event.likes?.length || 0,
                    commentsCount: event.comments?.length || 0
                };
            });
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
            createdBy?: mongoose.Types.ObjectId;
        }
    ): Promise<IEvent> {
        const comment = {
            ...commentData,
            createdBy: commentData.createdBy || new mongoose.Types.ObjectId(userId),
            profile: new mongoose.Types.ObjectId(profileId),
            createdAt: new Date()
        };

        const event = await Event.findOneAndUpdate(
            { _id: eventId, createdBy: userId },
            { $push: { comments: comment } },
            { new: true }
        );

        if (!event) {
            throw new Error('Event not found or access denied');
        }

        return event;
    }

    /**
     * Update a comment on an event
     */
    async updateComment(
        eventId: string,
        userId: string,
        commentId: mongoose.Types.ObjectId,
        updateData: {
            text?: string;
            updatedAt?: Date;
        }
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        const comment = event.comments.find(c => c?._id?.equals(commentId));
        if (!comment) {
            throw new Error('Comment not found');
        }

        if (updateData.text !== undefined) {
            comment.text = updateData.text;
        }
        if (updateData.updatedAt !== undefined) {
            comment.updatedAt = updateData.updatedAt;
        }

        await event.save();
        return event;
    }

    /**
     * Delete a comment from an event
     */
    async deleteComment(
        eventId: string,
        userId: string,
        commentId: mongoose.Types.ObjectId
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        const commentIndex = event.comments.findIndex(c => c._id?.equals(commentId));
        if (commentIndex === -1) {
            throw new Error('Comment not found');
        }

        event.comments.splice(commentIndex, 1);
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

        console.log(event.booking.serviceProvider.profileId, profileId);
        // Only allow status updates by the service provider or the booking creator's profile
        if (!event.booking.serviceProvider.profileId.equals(profileId) && !event.profile?.equals(profileId)) {
            // log the profile id and the event id
            console.info(profileId, eventId);
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
        if (!event.booking.serviceProvider.profileId.equals(profileId) && !event.profile?.equals(profileId)) {
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
        if (!event.booking.serviceProvider.profileId.equals(profileId) && !event.profile?.equals(profileId)) {
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
}

export default new EventService();