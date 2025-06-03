import mongoose, { Types } from 'mongoose';
import {
    RepeatSettings,
    Reminder,
    Reward,
    Attachment,
    PriorityLevel,
    EventType,
    BookingStatus,
    EventStatus,
    RepeatFrequency,
    EndCondition,
    ReminderType,
    ReminderUnit
} from '../models/plans-shared';

import { IEvent, Event } from '../models/Event';
import { User } from '../models/User';
import { checkTimeOverlap } from '../utils/timeUtils';
import { MyPtsModel } from '../models/my-pts.model';
import { TransactionType } from '../interfaces/my-pts.interface';
import { NotificationService } from '../services/notification.service';
import participantService from './participant.service';
import eventSettingsIntegration from '../utils/eventSettingsIntegration';
import { SettingsService } from './settings.service';
import { logger } from '../utils/logger';
import { TimezoneUtils } from '../utils/timezoneUtils';

class EventService {
    private notificationService: NotificationService;
    private settingsService: SettingsService;

    constructor() {
        this.notificationService = new NotificationService();
        this.settingsService = new SettingsService();
    }

    /**
     * Calculate reminder time based on start time and reminder settings with timezone awareness
     */
    private async calculateReminderTime(
        startTime: Date, 
        reminderType: string, 
        amount?: number, 
        unit?: string,
        userId?: string
    ): Promise<Date> {
        // Get user's timezone settings
        let userTimezone = 'UTC';
        if (userId) {
            try {
                const userSettings = await this.settingsService.getSettings(userId);
                userTimezone = userSettings?.general?.time?.timeZone || 'UTC';
            } catch (error) {
                logger.warn(`Failed to get user settings for timezone, using UTC: ${error}`);
            }
        }

        // Convert start time to user's timezone for calculation
        let adjustedStartTime = new Date(startTime);
        if (userTimezone !== 'UTC') {
            try {
                const userTimeString = startTime.toLocaleString('en-US', { timeZone: userTimezone });
                adjustedStartTime = new Date(userTimeString);
            } catch (error) {
                logger.warn(`Invalid timezone ${userTimezone}, falling back to UTC`);
                adjustedStartTime = new Date(startTime);
            }
        }

        const reminderTime = new Date(adjustedStartTime);
        
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
     * Calculate reminder time based on start time and minutes before with timezone awareness
     */
    private async calculateReminderTimeFromMinutes(
        startTime: Date,
        minutesBefore: number,
        userId?: string
    ): Promise<Date> {
        try {
            // Get user timezone
            const userTimezone = userId ? await TimezoneUtils.getUserTimezone(userId) : 'UTC';
            
            // Convert start time to user's timezone for accurate calculations
            const adjustedStartTime = TimezoneUtils.convertToUserTimezone(startTime, userTimezone);
            
            // Calculate reminder time
            const reminderTime = new Date(adjustedStartTime.getTime() - minutesBefore * 60 * 1000);
            
            return reminderTime;
        } catch (error) {
            console.error('Error calculating reminder time:', error);
            // Fallback to simple calculation
            return new Date(startTime.getTime() - minutesBefore * 60 * 1000);
        }
    }

    /**
     * Get reminder type enum from minutes before
     */
    private getReminderTypeFromMinutes(minutes: number): ReminderType {
        switch (minutes) {
            case 15:
                return ReminderType.Minutes15;
            case 30:
                return ReminderType.Minutes30;
            case 60:
                return ReminderType.Hours1;
            case 120:
                return ReminderType.Hours2;
            case 1440:
                return ReminderType.Days1;
            case 2880:
                return ReminderType.Days2;
            case 10080:
                return ReminderType.Weeks1;
            default:
                return ReminderType.Custom;
        }
    }

    /**
     * Create a new event with all fields and apply user settings
     */
    async createEvent(eventData: Partial<IEvent>): Promise<IEvent> {
        // Validate meeting-specific requirements
        if (eventData.eventType === 'meeting' && !eventData.title) {
            throw new Error('Title is required for meetings');
        }

        // Apply user settings defaults using the integration utility
        const enhancedEventData = await eventSettingsIntegration.applyUserDefaultsToEvent(
            eventData.createdBy?.toString() || '', 
            eventData
        );

        // Check for time overlap if the event has a time range
        if (enhancedEventData.startTime && enhancedEventData.endTime) {
            const overlapCheck = await checkTimeOverlap(
                enhancedEventData.createdBy?.toString() || '',
                enhancedEventData.profile?.toString() || '',
                {
                    startTime: enhancedEventData.startTime,
                    endTime: enhancedEventData.endTime,
                    isAllDay: enhancedEventData.isAllDay || false
                }
            );

            if (overlapCheck.overlaps) {
                throw new Error(`Time conflict with existing items: ${overlapCheck.conflictingItems.map(item => `${item.type}: ${item.title}`).join(', ')}`);
            }
        }

        // Process reminders to calculate trigger times with timezone awareness
        if (enhancedEventData.startTime && (!enhancedEventData.reminders || enhancedEventData.reminders.length === 0)) {
            // Mark that this event needs reminder processing
            enhancedEventData.needsReminderProcessing = true;
        } else if (enhancedEventData.reminders && Array.isArray(enhancedEventData.reminders) && enhancedEventData.startTime) {
            // Process existing reminders to calculate trigger times
            const userId = enhancedEventData.createdBy?.toString();
            enhancedEventData.reminders = await Promise.all(
                enhancedEventData.reminders.map(async reminder => ({
                    ...reminder,
                    triggered: false,
                    triggerTime: await this.calculateReminderTime(
                        enhancedEventData.startTime!, 
                        reminder.type,
                        reminder.amount,
                        reminder.unit,
                        userId
                    ),
                    minutesBefore: reminder.type === 'Minutes15' ? 15 : 
                                 reminder.type === 'Minutes30' ? 30 : 
                                 reminder.type === 'Hours1' ? 60 :
                                 reminder.type === 'Hours2' ? 120 :
                                 reminder.type === 'Custom' ? reminder.amount :
                                 undefined
                }))
            );
        }

        const event = new Event({
            ...enhancedEventData,
            createdBy: enhancedEventData.createdBy || null,
            profile: enhancedEventData.profile || null,
            eventType: enhancedEventData.eventType || 'meeting',
            isAllDay: enhancedEventData.isAllDay || false,
            repeat: enhancedEventData.repeat || {
                isRepeating: false,
                frequency: 'None',
                endCondition: 'Never'
            },
            reminders: enhancedEventData.reminders || [],
            visibility: enhancedEventData.visibility || 'Public',
            participants: enhancedEventData.participants || [],
            color: enhancedEventData.color || '#1DA1F2',
            category: enhancedEventData.category || 'Personal',
            priority: enhancedEventData.priority || 'Low',
            status: enhancedEventData.status || 'upcoming',
            attachments: enhancedEventData.attachments || [],
            comments: enhancedEventData.comments || [],
            agendaItems: enhancedEventData.agendaItems || [],
            isGroupEvent: enhancedEventData.isGroupEvent || false
        });

        // Handle all-day event adjustments
        if (event.isAllDay) {
            this.adjustAllDayEvent(event);
        }

        await event.save();

        // Process reminders asynchronously in background
        if (enhancedEventData.needsReminderProcessing) {
            this.processRemindersAsync((event._id as Types.ObjectId).toString(), enhancedEventData.createdBy?.toString()).catch((error: any) => {
                console.error('Failed to process reminders for event:', event._id, error);
            });
        }

        return event.toObject();
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
            .populate('comments.postedBy', 'profileInformation.username profileType')
            .lean()
            .exec();

        if (!event) return null;

        return {
            ...event,
            likesCount: event.likes?.length || 0,
            commentsCount: event.comments?.length || 0
        } as IEvent;
    }

    /**
     * Get all events for a user with filters and pagination
     */
    async getUserEvents(
        userId: string,
        profileId: string,
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
        } = {},
        page: number = 1,
        limit: number = 20
    ): Promise<{
        events: IEvent[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }> {
        // Use $or to find events created by the user OR associated with their profile
        const query: any = {
            $or: [
                { createdBy: userId },
                { profile: profileId }
            ]
        };

        // Apply filters
        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) query.category = filters.category;
        if (filters.eventType) query.eventType = filters.eventType;
        if (filters.isAllDay !== undefined) query.isAllDay = filters.isAllDay;
        if (filters.isGroupEvent !== undefined) query.isGroupEvent = filters.isGroupEvent;

        // Date range filtering
        if (filters.fromDate || filters.toDate) {
            if (!query.$and) query.$and = [];
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
            if (!query.$and) query.$and = [];
            query.$and.push({
                $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { notes: searchRegex },
                    { 'agendaItems.description': searchRegex }
                ]
            });
        }

        // Get total count for pagination
        const total = await Event.countDocuments(query);

        // Calculate pagination values
        const skip = (page - 1) * limit;
        const pages = Math.ceil(total / limit);
        const hasNext = page < pages;
        const hasPrev = page > 1;

        const rawEvents = await Event.find(query)
            .sort({
                startTime: 1,
                priority: -1,
                createdAt: -1
            })
            .skip(skip)
            .limit(limit)
            .populate('createdBy', 'name email')
            .populate('participants', 'name email')
            .populate('serviceProvider.profileId', 'name avatar')
            .lean();

        // Apply privacy filtering
        const filteredEvents = await eventSettingsIntegration.applyPrivacyFiltering(
            rawEvents,
            profileId,
            userId
        );

        return {
            events: filteredEvents,
            pagination: {
                page,
                limit,
                total,
                pages,
                hasNext,
                hasPrev
            }
        };
    }

    /**
     * Update an event
     */
    async updateEvent(
        eventId: string,
        userId: string,
        profileId: string,
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
            { _id: eventId, profile: profileId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!event) {
            throw new Error('Event not found or access denied');
        }

        return event.toObject();
    }

    /**
     * Delete an event
     */
    async deleteEvent(eventId: string, userId: string, profileId: string): Promise<boolean> {
        const result = await Event.deleteOne({ _id: eventId, profile: profileId });
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
        profileId: string,
        attachmentData: Omit<Attachment, 'uploadedAt' | 'uploadedBy'>
    ): Promise<IEvent> {
        const attachment = {
            ...attachmentData,
            uploadedAt: new Date(),
            uploadedBy: new Types.ObjectId(userId)
        };

        const event = await Event.findOneAndUpdate(
            { _id: eventId, profile: profileId },
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
        profileId: string,
        attachmentIndex: number
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, profile: profileId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        if (attachmentIndex < 0 || attachmentIndex >= (event.attachments?.length ?? 0)) {
            throw new Error('Invalid attachment index');
        }

        event.attachments?.splice(attachmentIndex, 1);
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
        }
    ): Promise<IEvent> {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        const comment = {
            text: commentData.text,
            postedBy: new mongoose.Types.ObjectId(profileId),
            createdAt: new Date(),
            updatedAt: new Date(),
            likes: []
        };

        event.comments.push(comment);
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
            .populate('booking.serviceProvider.profileId', 'profileInformation.username profileType')
            .lean();
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

        // Apply user's default settings to the booking event
        eventData.createdBy = new mongoose.Types.ObjectId(userId);
        eventData.profile = new mongoose.Types.ObjectId(profileId);
        eventData.eventType = EventType.Booking;
        
        eventData = await eventSettingsIntegration.applyUserDefaultsToEvent(
            userId,
            eventData
        );

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

        const event = new Event(eventData);
        return (await event.save()).toObject();
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

        // Apply user's default settings to the celebration event
        const enhancedCelebrationData = await eventSettingsIntegration.applyUserDefaultsToEvent(
            userId,
            celebrationData
        );

        const event = new Event(enhancedCelebrationData);
        return (await event.save()).toObject();
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
        return event.toObject();
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
        return event.toObject();
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
        return event.toObject();
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
        return event.toObject();
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
        return event.toObject();
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

    /**
     * Like a comment on an event
     */
    async likeComment(
        eventId: string,
        commentIndex: number,
        userId: string,
        profileId: string
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new Error('Event not found');
        }

        if (commentIndex < 0 || commentIndex >= event.comments.length) {
            throw new Error('Invalid comment index');
        }

        const comment = event.comments[commentIndex];
        const profileIdObj = new mongoose.Types.ObjectId(profileId);

        // Initialize likes array if it doesn't exist
        if (!comment.likes) {
            comment.likes = [];
        }

        // Add the like if not already present
        if (!comment.likes.some(id => id.equals(profileIdObj))) {
            comment.likes.push(profileIdObj);
        }

        await event.save();
        return event;
    }

    /**
     * Unlike a comment on an event
     */
    async unlikeComment(
        eventId: string,
        commentIndex: number,
        userId: string,
        profileId: string
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new Error('Event not found');
        }

        if (commentIndex < 0 || commentIndex >= event.comments.length) {
            throw new Error('Invalid comment index');
        }

        const comment = event.comments[commentIndex];
        const profileIdObj = new mongoose.Types.ObjectId(profileId);

        // Remove the like if present
        comment.likes = comment.likes.filter(id => !id.equals(profileIdObj));

        await event.save();
        return event;
    }

    /**
     * Process reminders asynchronously in the background
     */
    private async processRemindersAsync(eventId: string, userId?: string): Promise<void> {
        try {
            const event = await Event.findById(eventId);
            if (!event || !event.startTime || !userId) {
                return;
            }

            // Get default reminders from user settings
            const defaultReminders = event.settings?.notifications?.reminderSettings?.defaultReminders || [15, 60];
            
            if (defaultReminders.length > 0) {
                const reminders = await Promise.all(
                    defaultReminders.map(async (minutesBefore: number) => ({
                        type: this.getReminderTypeFromMinutes(minutesBefore),
                        amount: minutesBefore,
                        unit: ReminderUnit.Minutes,
                        triggered: false,
                        triggerTime: await this.calculateReminderTimeFromMinutes(
                            event.startTime!,
                            minutesBefore,
                            userId
                        ),
                        minutesBefore: minutesBefore
                    }))
                );

                // Update event with reminders
                await Event.findByIdAndUpdate(eventId, {
                    reminders: reminders,
                    $unset: { needsReminderProcessing: 1 }
                });
            }
        } catch (error) {
            console.error('Error processing reminders for event:', eventId, error);
        }
    }
}

export default new EventService();