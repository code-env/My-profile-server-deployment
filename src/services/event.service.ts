import mongoose from 'mongoose';
import {
    RepeatSettings,
    Reminder,
    Reward,
    Attachment,
    Location,
    PriorityLevel,
    VisibilityType
} from '../models/plans-shared';

import { IEvent, Event } from '../models/Event';
import { checkTimeOverlap } from '../utils/timeUtils';

class EventService {
    /**
     * Create a new event with all fields
     */
    async createEvent(eventData: Partial<IEvent>): Promise<IEvent> {
        // Validate meeting-specific requirements
        if (eventData.eventType === 'appointment' && !eventData.serviceProvider) {
            throw new Error('Service provider is required for meetings');
        }

        // Check for time overlap if the event has a time range
        if (eventData.startTime && eventData.endTime) {
            const overlapCheck = await checkTimeOverlap(
                eventData.createdBy?.toString() || '',
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
            eventType: eventData.eventType || 'meeting',
            isAllDay: eventData.isAllDay || false,
            repeat: eventData.repeat || {
                isRepeating: false,
                frequency: 'None',
                endCondition: 'Never'
            },
            reminders: eventData.reminders || [],
            visibility: eventData.visibility || 'Everyone (Public)',
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
            .populate('createdBy', 'name email')
            .populate('participants', 'name email')
            .populate('serviceProvider.profileId', 'name avatar')
            .populate('agendaItems.assignedTo', 'name email')
            .populate('attachments.uploadedBy', 'name email');
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
        if (updateData.eventType === 'meeting' && !updateData.serviceProvider) {
            throw new Error('Service provider is required for meetings');
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
        commentData: {
            text: string;
            createdBy?: mongoose.Types.ObjectId;
        }
    ): Promise<IEvent> {
        const comment = {
            ...commentData,
            createdBy: commentData.createdBy || new mongoose.Types.ObjectId(userId),
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
    async likeEvent(eventId: string, userId: string): Promise<IEvent> {
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




}

export default new EventService();